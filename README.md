# SNIFFF // NETWORK INTELLIGENCE

<div align="center">
  <img src="https://img.shields.io/badge/Status-Development-orange" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-macOS-black" alt="Platform" />
  <img src="https://img.shields.io/badge/Engine-Tauri-blue" alt="Engine" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57" alt="Database" />
</div>

---

## Overview

**SNIFFF** is a tactical network intelligence tool designed for real-time packet monitoring and global traffic visualization. Built with a high-performance **Rust** packet capture engine and a modern **React** frontend, it provides an intuitive interface for tracking where your data is going across the globe.

---

## 📸 Preview

<!-- USER_SCREENSHOT_PLACEHOLDER -->
![SNIFFF Interface Overview](assets/snifff-screenshot.png)
*Replace this with a real screenshot to showcase the tactical UI and World Map.*

---

## ⚡ Key Features

- **🛡️ Real-time PCAP Engine**: High-performance packet sniffing using the Berkeley Packet Filter (BPF).
- **🌍 Global Visualization**: Interactive SVG world map showing real-time hits from across the globe.
- **📍 Geolocation Intelligence**: Integrated IP geolocation (powered by ipinfo.io) to identify traffic origins.
- **🔍 Advanced Filtering**: Filter by IP, ASN, Country, or Time-range to isolate specific network flows.
- **🔔 Proactive Notifications**: Get alerted when traffic from a new country is detected.
- **📦 Persistent Logging**: Local SQLite database storage for historical analysis of network activity.
- **🚀 Autostart & Stealth**: Native macOS autostart support and a "glass" tactical design.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Rust, Tauri v2
- **Visualization**: react-svg-worldmap
- **Storage**: SQLite (via `rusqlite`)
- **Networking**: `libpcap` wrapper for Rust

---

## 🏗️ Architecture

- **Backend**: A multi-threaded Rust engine manages the sniffer loop, geolocation caching, and database persistence.
- **Frontend**: A reactive React application that polls the backend for live updates and renders complex visualizations.
- **Permissions**: Professional authorization flow to grant macOS BPF device permissions securely.

---

## 🚀 Getting Started

### Prerequisites

- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js**: 20.x or later
- **Xcode Command Line Tools**: `xcode-select --install`

### Installation

1. **Clone the repository**:
   ```bash
   git clone git@github.com:iamzubin/snifff.git
   cd snifff
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```

### Permission Setup
On the first run, the app will request administrator authorization to configure network interface access. This is required for packet capture.

---

## 📄 License

Individual/Commercial — See `LICENSE` for details.

---

<div align="center">
  <sub>Built for Network Intelligence Professionals.</sub>
</div>
