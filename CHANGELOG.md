# Changelog

All notable changes to the `flynn0/T18` platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-17

### Added
- **Power-Aware Adaptive Measurement Matrix**:
  - Senses operating power supply via ADC voltage on IO35 ($V_{\text{bat}} = 2.0 \times V_{\text{pin}}$).
  - **Battery Mode** ($\le 4.20\text{ V}$): Wi-Fi scan and BLE + Classic BT scan every 10 minutes; 13-channel promiscuous congestion survey and station speed/latency probes every 30 minutes; non-existent networks are omitted from connection attempts to avoid timeout penalties.
  - **Powered Mode** ($> 4.20\text{ V}$ / USB / no battery): 2-minute cycle cadence running Wi-Fi scan, BLE + Classic scan, and 13-channel survey, accumulating peak maximums in RAM over 10-minute intervals before testing latency and uploading telemetry.
- **Zero-Flash-Wear Invariant When Online**:
  - Telemetry is transmitted directly from RAM over HTTP; zero bytes written to flash when upload succeeds every 10 minutes.
  - Offline buffering safely engages only when upload fails or no networks are visible: commits 48-slot (24-hour) 30-minute buffer (`ChannelHistory`) and binary records to raw circular flash spool (`SpoolManager`).
  - Automatic backlog drainage and spool clearing upon network reconnection.
- **D1 Daily 30-Minute Summaries (Migration 0011)**:
  - Added `daily_30min_summaries` table storing 48 half-hour intervals of the previous UTC day aggregated by daily cron trigger at 00:15 UTC (max 13-channel airtime utilization array, max unique BLE devices, max Classic BT devices, and battery voltage).
- **Change-Only Network Environment & Firewall Diagnostics History**:
  - Added `station_network_diagnostics_history` table recording long-term audit snapshots once on initial detection and only appending records when gateway or firewall configuration changes, strictly ignoring `dns_ipv4_ms` and `dns_ipv6_ms` response time jitter.
- **Architecture Overview & ADR 0008**:
  - Added comprehensive multi-tier Mermaid architecture diagram in `README.md`.
  - Documented ADR 0008 detailing power-aware measurement matrix, 30-minute rollups, and zero-flash-wear invariants.

### Changed
- **Web UI Enhancements**:
  - 24-Hour Spectrum & BLE Heatmap drawer is expanded by default.
  - Battery voltage and discharge profile graph is expanded by default when battery telemetry is detected.
  - Removed "Previous 24 Hours" button/list from the Bluetooth table in favor of real-time cycle inspection.
  - Added live KPI breakdown badges for Key Vendors (Apple, Microsoft, Samsung) and Categories (Smartphone, Computer, Beacon).
  - Repaired footer styling, centered layout, and font inheritance broken by dangling CSS syntax.

---

## [1.0.4] - 2026-11-17

### Changed
- **Main Repository & Domain Migration to flynn0**:
  - Re-anchored primary repository to `flynn0/T18`.
  - Updated Cloudflare Worker host to `https://t18.dhsp.workers.dev` and static mirror to `https://flynn0.github.io/T18`.
  - Updated default worker URL and preset domain for authentication in firmware to `https://t18.dhsp.workers.dev`.
  - Added automatic NVS migration detecting legacy `*.kreier.workers.dev` configurations and resetting device tokens for clean re-authentication with `t18.dhsp.workers.dev`.
- **Bluetooth Scan Optimization**:
  - Removed legacy Bluetooth Classic inquiry and `BluetoothSerial` dependency from `BluetoothScanner`, significantly reducing firmware binary footprint and execution latency.
  - Scan focuses entirely on 2.4 GHz Bluetooth Low Energy (BLE) with de-randomization and categorization.

### Added
- **24-Hour Unique BLE Device Local Flash Storage**:
  - Extended `ChannelHistoryManager` (`ChannelSlotRecord` v2) to store and average unique BLE device counts across each of the 48 half-hour slots (24 hours total).
  - Synchronizes offline BLE unique device count alongside 13-channel utilization metrics directly to the worker backend upon network reconnection.

---

## [1.0.3] - 2026-11-17

### Fixed
- **Telemetry Ingestion & Station Registration Routing**:
  - Corrected compiled firmware binaries and portal defaults so new stations register and upload directly to `https://t18.kreier.workers.dev` instead of the legacy `wifi` worker, ensuring new stations appear in the T18 project.
  - Added automatic NVS migration in `AppConfigManager` and `CaptivePortalManager` that detects and converts legacy `wifi.kreier.workers.dev` configurations to `https://t18.kreier.workers.dev` and resets device token for clean zero-trust re-registration.

### Added
- **Preserve Settings & Data Flashing Option (Firmware Update Only)**:
  - Added installation mode selector in the Web Serial Flasher UI allowing operators to choose between **⚡ Update Firmware Only (Keep Settings & Data)** (default) and **🧹 Clean Install (Full Flash & Partitions)**.
  - Implemented `manifest-update.json` targeting only the application slot at offset `0x10000`, preserving NVS Wi-Fi credentials, tokens, and offline channel utilization history.
  - Added `"new_install_prompt_erase": true` in `manifest.json` so full installs prompt for confirmation before erasing flash.
- **24-Hour 13-Channel Utilization Average Ring Storage & Offline Backlog Sync**:
  - Implemented `ChannelHistoryManager` storing 48 half-hour average records (13 channels × 48 slots = 24 hours of 30-minute averages) persistently in dedicated flash sectors (`0x1000` to `0x3FFF`).
  - Rolling average accumulation across 10-minute cycles within each 30-minute interval.
  - Timestamps recorded during offline periods are automatically calibrated to UTC half-hour epochs upon NTP synchronization.
  - Automatic transmission of all un-transmitted records (`transmitted == false`) to the T18 worker `/data` endpoint as soon as network connectivity is restored, marking slots as transmitted upon successful worker receipt.
  - Fixed flash sector boundary erase handling in `SpoolManager` to prevent circular buffer sector over-erasure.

## [1.0.2] - 2026-11-16

### Added
- **In-Browser Web Serial Firmware Flasher**:
  - Integrated ESP Web Tools (`<esp-web-install-button>`) directly into the Web UI dashboard with a 3-tab modal dialog (`Web Serial Install`, `Direct Downloads & CLI`, and `First-Boot Setup`).
  - Supports one-click USB flashing directly from Google Chrome, Microsoft Edge, Brave, or Opera over Web Serial.
  - Generates and serves `manifest.json` and static binaries (`firmware.bin`, `partitions.bin`, `bootloader.bin`, `boot_app0.bin`, and an all-in-one `firmware-esp32-merged.bin`) from both Cloudflare Edge Worker and GitHub Pages.
  - Deep-link support via `/?flash=1` and `/flash` routes.
- **2.4 GHz Bluetooth Low Energy (BLE) & Classic Spectrum Scanning**:
  - Sequential dual-stack Bluetooth scan in every 10-minute cycle (`BluetoothScanner::performScan`).
  - Active 3-second BLE scan capturing Advertising, Service UUIDs, and local device names.
  - 3-second Classic Bluetooth Inquiry querying discoverable BR/EDR devices, capturing fixed MACs, Class of Device (COD), and RSSI.
  - Advanced payload de-randomization establishing deterministic fingerprints for Resolvable Private Addresses (RPA) across Apple (Find My / AirTag, iBeacon), Google (Eddystone), Tile, Samsung, and Microsoft devices.
  - D1 database migration (`0010_bluetooth_telemetry.sql`) adding `station_bluetooth_summary` and `station_latest_bluetooth`.
  - Web UI visualization: dedicated **2.4 GHz Bluetooth & BLE Activity** card with KPIs, 24-hour trend graph, collapsible device inspector, and Bluetooth heatmap row in the channel utilization view.
- **Dynamic LED & Boot Survey Sequence**:
  - 13-channel promiscuous congestion survey runs immediately on boot/wake with active LED feedback: solid ON while dwelling on a channel, 100 ms blink OFF during channel transitions.
  - Non-blocking BOOT button monitoring during channel scans: pressing BOOT immediately halts the scan and launches the Soft-AP captive portal setup without waiting.
- **Backup Hotspot Internet Failover**:
  - Automatic detection of backup AP (e.g. "S24") in the Wi-Fi scan survey.
  - If primary monitored Wi-Fi networks have no internet connection or fail to upload telemetry, the station automatically connects to the backup hotspot to transmit queued offline telemetry and current cycle data.
  - Setup portal includes backup hotspot credentials configuration section.
- **Backend & OTA Enhancements**:
  - Enforced strict SemVer comparison checks in firmware and Worker OTA to prevent unintended fleet downgrades.
  - Worker endpoints for `/manifest.json`, `/firmware/manifest.json`, and `/firmware/*` binary streaming with CORS.
  - Automated 30-day data retention cleanup for Bluetooth summaries in daily cron maintenance.

---

## [1.0.1] - 2026-11-16

### Added
- **Firmware (v1.0.1)**: Multi-network fallback data upload:
  - If the primary monitored network fails to connect or lacks internet access, the node automatically iterates through all other configured monitored networks (Networks 2, 3...) to upload telemetry.
- **Firmware (v1.0.1)**: Fallback backup network (unmonitored):
  - Preconfigured with default SSID `"S24"` and password `"12345678"`.
  - Configurable toggle in the initial setup Captive Portal, persisted to hardware NVS (`Preferences`).
  - This network is strictly used for uploading data when monitored networks fail or lack internet; it is never probed or monitored during telemetry cycles.
- **Firmware (v1.0.1)**: Post-sleep backlog upload via fallback:
  - When waking from a light sleep cycle, if unuploaded records are detected in the flash spool (`SpoolManager::hasPendingData()`), the station checks the 2.4 GHz spectrum scan survey for the fallback network (`S24`).
  - If visible, the station connects and immediately transmits the pending backlog before proceeding with the measurement cycle.
- **Worker & OTA (v1.0.1)**: Bumped stable fleet production OTA target to `1.0.1` (`STABLE_VERSION`).

---

## [1.0.0] - 2026-11-15

### Added
- **Edge Backend (v1.0.0)**: Cloudflare Worker interface deployed at `https://t18.kreier.workers.dev` backed by a dedicated Cloudflare D1 SQLite database (`t18-mon-db`).
- **OTA Updates (v1.0.0)**: Automated Over-The-Air firmware updater (`/api/ota` and streaming download `/api/ota/download/:filename`) with canary target routing and zero-redirect streaming proxy from GitHub Releases.
- **Hardware Profile Tailored for T18 & T8**:
  - **LILYGO T18 (Default)**: Status LED on **GPIO 5**, battery voltage sensing on **GPIO 35** via 100kΩ/100kΩ resistor divider (ratio 0.50f, $V_{\text{bat}} = 2.0 \times V_{\text{pin}}$).
  - **LILYGO T8**: Status LED on **GPIO 21**, battery voltage sensing on **GPIO 35** via 100kΩ/100kΩ resistor divider (ratio 0.50f).
  - **ESP32 DevKit V1**: Status LED on **GPIO 2**, battery monitoring disabled.
  - **Custom / ESP32-C5**: Configurable GPIO mappings persisted to NVS (`Preferences`).
- **Battery Telemetry & Discharge Analytics**:
  - Live battery voltage measurement on ADC pin IO35.
  - Automated remaining runtime estimation and discharge slope analysis.
  - Interactive battery discharge history chart with Day (24h), Week (7d), and Month (30d) timeframes.
- **Spectrum Survey & Promiscuous Mode Contention**:
  - 13-channel 2.4 GHz full spectrum sweeps measuring airtime % and frame distributions (Management, Data, Control).
  - 4-tier RSSI distribution histograms and unique transmitter MAC counts.
  - 10-minute spectrum scan duration variance tracking.
- **Local Network & Dual-Stack Diagnostics**:
  - Gateway TCP SYN-ACK round-trip latency (`WiFi.gatewayIP()`).
  - Dual-stack DNS benchmark (IPv4 `A` vs IPv6 `AAAA`).
  - Captive portal HTTP canary hijacking detection.
  - 24-hour gateway firewall and open port sweep.
- **Zero-Flash-Wear Telemetry & Raw Spooling**:
  - RAM-first transmission during healthy connectivity (zero SPI flash wear).
  - 192 KB raw binary SPI flash ring buffer (`raw_spool`) for offline resilience.
- **Dual Dashboard Mirror**:
  - Server-rendered Cloudflare Edge dashboard at [https://t18.kreier.workers.dev/](https://t18.kreier.workers.dev/).
  - Static client mirror at [https://kreier.github.io/T18/](https://kreier.github.io/T18/).
  - Client-side station deep-linking (`/:station_id`).

---

## [0.5.0] - 2026-11-12
### Added
- Multi-network Wi-Fi monitoring and initial GitHub commit data pipeline.
