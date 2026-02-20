use std::collections::HashSet;
use std::net::IpAddr;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;

use etherparse::SlicedPacket;

/// Filter out private/local/reserved IP addresses
fn is_public_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            !v4.is_private()
                && !v4.is_loopback()
                && !v4.is_link_local()
                && !v4.is_broadcast()
                && !v4.is_unspecified()
                && !v4.is_multicast()
                // Filter CGNAT range 100.64.0.0/10
                && !(v4.octets()[0] == 100 && (v4.octets()[1] & 0xC0) == 64)
        }
        IpAddr::V6(v6) => {
            !v6.is_loopback()
                && !v6.is_unspecified()
                && !v6.is_multicast()
        }
    }
}

pub struct Sniffer {
    running: Arc<AtomicBool>,
    seen_ips: Arc<Mutex<HashSet<String>>>,
}

impl Sniffer {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            seen_ips: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// List available network interfaces
    pub fn list_interfaces() -> Vec<String> {
        match pcap::Device::list() {
            Ok(devices) => devices.into_iter().map(|d| d.name).collect(),
            Err(_) => vec![],
        }
    }

    /// Get the default interface name
    pub fn default_interface() -> Option<String> {
        pcap::Device::lookup()
            .ok()
            .flatten()
            .map(|d| d.name)
    }

    /// Start capturing packets on the given interface.
    /// Calls `on_new_ip` for each new public IP discovered.
    pub fn start<F>(
        &self,
        interface: &str,
        on_new_ip: F,
    ) -> Result<(), String>
    where
        F: Fn(String) + Send + 'static,
    {
        if self.running.load(Ordering::SeqCst) {
            return Err("Sniffer is already running".to_string());
        }

        let cap = pcap::Capture::from_device(interface)
            .map_err(|e| format!("Failed to open device '{}': {}", interface, e))?
            .promisc(false)
            .snaplen(128) // We only need headers, not payload
            .timeout(1000)
            .open()
            .map_err(|e| format!("Failed to start capture: {}", e))?;

        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();
        let seen_ips = self.seen_ips.clone();

        thread::spawn(move || {
            let mut cap = cap;
            // Only capture IP packets (skip ARP, etc.)
            if let Err(e) = cap.filter("ip or ip6", true) {
                log::error!("Failed to set BPF filter: {}", e);
            }

            while running.load(Ordering::SeqCst) {
                match cap.next_packet() {
                    Ok(packet) => {
                        if let Some(ip) = extract_dest_ip(packet.data) {
                            if is_public_ip(&ip) {
                                let ip_str = ip.to_string();
                                let is_new = {
                                    let mut seen = seen_ips.lock().unwrap();
                                    seen.insert(ip_str.clone())
                                };
                                if is_new {
                                    on_new_ip(ip_str);
                                }
                            }
                        }
                    }
                    Err(pcap::Error::TimeoutExpired) => {
                        // Normal — no packets in timeout window
                        continue;
                    }
                    Err(e) => {
                        log::error!("Capture error: {}", e);
                        break;
                    }
                }
            }
            log::info!("Sniffer thread stopped");
        });

        Ok(())
    }

    /// Stop the capture
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Check if sniffer is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Reset seen IPs (e.g. on new session)
    pub fn reset_seen(&self) {
        if let Ok(mut seen) = self.seen_ips.lock() {
            seen.clear();
        }
    }
}

/// Extract destination IP from raw packet data (Ethernet frame)
fn extract_dest_ip(data: &[u8]) -> Option<IpAddr> {
    match SlicedPacket::from_ethernet(data) {
        Ok(packet) => {
            match packet.net {
                Some(etherparse::NetSlice::Ipv4(ipv4_slice)) => {
                    Some(IpAddr::V4(ipv4_slice.header().destination_addr()))
                }
                Some(etherparse::NetSlice::Ipv6(ipv6_slice)) => {
                    Some(IpAddr::V6(ipv6_slice.header().destination_addr()))
                }
                _ => None,
            }
        }
        Err(_) => None,
    }
}
