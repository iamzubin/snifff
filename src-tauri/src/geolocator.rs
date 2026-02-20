use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Deserialize)]
pub struct IpInfoResponse {
    pub ip: Option<String>,
    pub asn: Option<String>,
    pub as_name: Option<String>,
    pub as_domain: Option<String>,
    pub country_code: Option<String>,
    pub country: Option<String>,
    pub continent_code: Option<String>,
    pub continent: Option<String>,
}

pub struct Geolocator {
    client: Client,
    token: String,
    cache: Mutex<HashMap<String, IpInfoResponse>>,
}

impl Geolocator {
    pub fn new(token: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            token,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Look up IP geolocation via IPinfo Lite API
    pub async fn lookup(&self, ip: &str) -> Result<IpInfoResponse, String> {
        // Check cache first
        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if let Some(cached) = cache.get(ip) {
                log::debug!("[SNIFFF:GEO] Cache hit for {}", ip);
                return Ok(cached.clone());
            }
        }

        if self.token.is_empty() || self.token == "your_token_here" {
            return Err("IPINFO_TOKEN not configured".to_string());
        }

        let url = format!(
            "https://api.ipinfo.io/lite/{}?token={}",
            ip, self.token
        );

        log::debug!("[SNIFFF:GEO] Requesting: {}", url.replace(&self.token, "***"));

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            log::error!("[SNIFFF:GEO] API error {} for {}: {}", status, ip, body);
            return Err(format!("API returned status: {} — {}", status, body));
        }

        // Read raw body for debug
        let body = response.text().await
            .map_err(|e| format!("Failed to read response body: {}", e))?;
        log::debug!("[SNIFFF:GEO] Raw response for {}: {}", ip, body);

        let info: IpInfoResponse = serde_json::from_str(&body)
            .map_err(|e| format!("Failed to parse response: {} — body: {}", e, body))?;

        log::info!(
            "[SNIFFF:GEO] Resolved {}: country={:?} asn={:?}",
            ip,
            info.country_code,
            info.asn
        );

        // Cache the result
        {
            let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
            cache.insert(ip.to_string(), info.clone());
        }

        Ok(info)
    }
}
