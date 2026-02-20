mod db;
mod geolocator;
mod permissions;
mod sniffer;

use db::{Database, IpConnection, CountryStats};
use geolocator::Geolocator;
use sniffer::Sniffer;
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, AppHandle};

pub struct AppState {
    pub db: Arc<Database>,
    pub sniffer: Arc<Sniffer>,
    pub geolocator: Arc<Geolocator>,
    pub start_time: std::time::Instant,
    pub tokio_rt: Arc<tokio::runtime::Runtime>,
}

#[derive(Debug, Clone, Serialize)]
struct NewIpEvent {
    ip: String,
    country_code: Option<String>,
    country: Option<String>,
    asn: Option<String>,
    as_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppStats {
    pub total_ips: u64,
    pub total_hits: u64,
    pub total_countries: u64,
    pub uptime_seconds: u64,
    pub is_running: bool,
}

// ─── Tauri Commands ────────────────────────────────────────────

#[tauri::command]
fn check_permissions() -> Result<bool, String> {
    Ok(permissions::check_bpf_access())
}

#[tauri::command]
fn request_permissions() -> Result<bool, String> {
    permissions::ensure_bpf_access()
}

#[tauri::command]
fn get_interfaces() -> Vec<String> {
    Sniffer::list_interfaces()
}

#[tauri::command]
fn start_sniffing(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    interface: Option<String>,
) -> Result<(), String> {
    let iface = interface
        .or_else(|| Sniffer::default_interface())
        .ok_or("No network interface found")?;

    log::info!("[SNIFFF] Starting capture on interface: {}", iface);

    let db = state.db.clone();
    let geo = state.geolocator.clone();
    let app_handle = app.clone();
    let rt = state.tokio_rt.clone();

    state.sniffer.start(&iface, move |ip_str| {
        let db = db.clone();
        let geo = geo.clone();
        let app_handle = app_handle.clone();
        let ip = ip_str.clone();

        log::info!("[SNIFFF] New IP detected: {}", ip);

        // Insert into DB immediately
        if let Err(e) = db.upsert_connection(&ip) {
            log::error!("[SNIFFF] DB upsert error for {}: {}", ip, e);
            return;
        }

        // Geo lookup using dedicated runtime (pcap thread has no tokio runtime)
        rt.spawn(async move {
            // Skip if we already have geo info
            if db.has_geo_info(&ip).unwrap_or(false) {
                log::debug!("[SNIFFF] Geo info already cached for {}, skipping", ip);
                return;
            }

            log::info!("[SNIFFF] Looking up geo info for {}", ip);

            match geo.lookup(&ip).await {
                Ok(info) => {
                    log::info!(
                        "[SNIFFF] Geo result for {}: country={:?} asn={:?} as_name={:?}",
                        ip,
                        info.country_code,
                        info.asn,
                        info.as_name
                    );

                    if let Err(e) = db.update_geo_info(
                        &ip,
                        info.asn.as_deref(),
                        info.as_name.as_deref(),
                        info.as_domain.as_deref(),
                        info.country_code.as_deref(),
                        info.country.as_deref(),
                        info.continent_code.as_deref(),
                        info.continent.as_deref(),
                    ) {
                        log::error!("[SNIFFF] DB geo update failed for {}: {}", ip, e);
                    }

                    // Emit event to frontend
                    let event = NewIpEvent {
                        ip: ip.clone(),
                        country_code: info.country_code,
                        country: info.country,
                        asn: info.asn,
                        as_name: info.as_name,
                    };
                    let _ = app_handle.emit("new-ip", &event);
                }
                Err(e) => {
                    log::error!("[SNIFFF] Geo lookup FAILED for {}: {}", ip, e);
                    // Still emit the event without geo info
                    let event = NewIpEvent {
                        ip: ip.clone(),
                        country_code: None,
                        country: None,
                        asn: None,
                        as_name: None,
                    };
                    let _ = app_handle.emit("new-ip", &event);
                }
            }
        });
    })?;

    log::info!("[SNIFFF] Capture started successfully");
    Ok(())
}

#[tauri::command]
fn stop_sniffing(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    log::info!("[SNIFFF] Stopping capture");
    state.sniffer.stop();
    Ok(())
}

#[tauri::command]
fn get_connections(
    state: tauri::State<'_, Arc<AppState>>,
    limit: Option<usize>,
) -> Result<Vec<IpConnection>, String> {
    state.db.get_connections(limit.unwrap_or(500))
}

#[tauri::command]
fn get_country_stats(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<CountryStats>, String> {
    state.db.get_country_stats()
}

#[tauri::command]
fn get_stats(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<AppStats, String> {
    let (total_ips, total_hits, total_countries) = state.db.get_total_stats()?;

    Ok(AppStats {
        total_ips,
        total_hits,
        total_countries,
        uptime_seconds: state.start_time.elapsed().as_secs(),
        is_running: state.sniffer.is_running(),
    })
}

// ─── App Setup ─────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file
    dotenv::dotenv().ok();

    // Initialize logger — always show info+ for our crate in dev
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("snifff=debug,info")
    ).init();

    let token = std::env::var("IPINFO_TOKEN")
        .unwrap_or_else(|_| String::new());

    if token.is_empty() || token == "your_token_here" {
        log::warn!("[SNIFFF] ⚠ IPINFO_TOKEN is not set! Geo lookups will fail. Set it in .env");
    } else {
        log::info!("[SNIFFF] IPinfo token loaded ({}...)", &token[..std::cmp::min(8, token.len())]);
    }

    // Create a dedicated tokio runtime for async work (geo lookups)
    let tokio_rt = Arc::new(
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(2)
            .build()
            .expect("Failed to create tokio runtime")
    );

    let db = Arc::new(Database::new().expect("Failed to initialize database"));
    let sniffer = Arc::new(Sniffer::new());
    let geolocator = Arc::new(Geolocator::new(token));

    log::info!("[SNIFFF] Database initialized");
    log::info!("[SNIFFF] Available interfaces: {:?}", Sniffer::list_interfaces());

    let state = Arc::new(AppState {
        db,
        sniffer,
        geolocator,
        start_time: std::time::Instant::now(),
        tokio_rt,
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            check_permissions,
            request_permissions,
            get_interfaces,
            start_sniffing,
            stop_sniffing,
            get_connections,
            get_country_stats,
            get_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
