# ADR 0008: Power-Aware Measurement Cadence, 30-Minute Rollup Aggregation, and Zero-Flash-Wear Invariants

## Status
Accepted

## Date
2026-11-17

## Context
Operating ESP32 nodes on single-cell 18650 LiPo batteries requires aggressive power conservation. The node's heaviest power consumers are:
1. Promiscuous 13-channel packet capture (26 seconds of continuous high-power radio reception).
2. Wi-Fi station association, DHCP negotiation, gateway ping, DNS resolution, and multi-target HTTP speed probes (high-power Wi-Fi transmission with potential timeouts on unreachable networks).
3. Repeated flash writes to SPI flash sectors, which both consume substantial milliamp-seconds and cause premature flash wear.

Telemetry requirements demand detailed visibility into Wi-Fi spectrum congestion, BLE/Classic Bluetooth presence, and network latency without draining the battery in a few days.

## Decision

### 1. Adaptive Power Detection & Dual-Cadence Measurement Matrix
Nodes read battery ADC voltage ($V_{\text{bat}} = 2.0 \times V_{\text{pin}}$ on IO35) and evaluate operating power state:
- **Battery Powered** ($V_{\text{bat}} \le 4.20\text{ V}$ with valid battery pin):
  - Base cycle interval: **10 minutes** (Light sleep between cycles).
  - **Task 1 (Wi-Fi Spectrum Scan)**: Runs every 10 minutes.
  - **Task 2 (BLE & Classic Bluetooth Scan)**: Runs every 10 minutes.
  - **Task 3 (13-Channel Airtime Survey)**: Runs every **30 minutes** (skipped during 10m and 20m subcycles to eliminate 26s of active radio dwell).
  - **Task 4 (Speed & Latency Testing)**: Runs every **30 minutes**, and **STRICTLY ONLY for configured networks that appeared in Task 1**. Networks not detected in the Wi-Fi scan are never probed, eliminating timeout penalties.
  - **Upload**: Attempted every 10 minutes if Task 1 detected any monitored network or the backup network (`"S24"`).
- **USB / AC Powered** ($V_{\text{bat}} > 4.20\text{ V}$ or no battery connected):
  - Base cycle interval: **2 minutes**.
  - **Tasks 1, 2, 3**: Run every 2 minutes. Maximum values (highest RSSI, unique BLE devices, Classic BT devices, and channel airtime percentages) are accumulated in RAM over a 10-minute window.
  - **Task 4 (Speed & Latency Testing)**: Runs every 10 minutes (every 5th subcycle) for visible networks.
  - **Upload**: Attempted every 10 minutes with the accumulated 10-minute maximums.

### 2. Zero Flash Wear When Online
- If telemetry upload succeeds every 10 minutes, **zero bytes are written to flash**. Telemetry is transmitted directly from RAM.
- Only if an upload attempt fails (or no visible networks are detected) are records committed to flash:
  1. The 48-slot (24-hour) revolving 30-minute buffer is saved to flash (`ChannelHistory::instance().saveToFlash()`).
  2. The cycle telemetry is buffered into the circular 190 KB raw binary flash spool (`SpoolManager::appendCycle(cycle)`).
- When internet connectivity is restored, all backlogged spool batches and un-transmitted 30-minute records are transmitted to the backend, after which the spool is cleared.

### 3. Edge Database Rollup & Change-Only Diagnostics (Migration 0011)
- **`daily_30min_summaries`**: Daily cron at `00:15 UTC` calculates and stores the previous day's 48 30-minute intervals (00:00 to 24:00 UTC) per station:
  - Maximum airtime utilization for all 13 Wi-Fi channels.
  - Maximum unique BLE devices.
  - Maximum Classic Bluetooth devices.
  - Battery voltage.
- **Change-Only Network Environment & Firewall Diagnostics (`station_network_diagnostics_history`)**:
  - The security audit (gateway IP, gateway vendor, web exposure, login URL, HTTPS redirect, PMTUD MTU tests, DNS IPv6 timeout, DNS rebind blocking, captive portal detection, open ports) is recorded long-term once on initial discovery.
  - Subsequent updates are stored into history **only when an audit/config field actually changes**. Fluctuations in `dns_ipv4_ms` and `dns_ipv6_ms` are strictly ignored to avoid redundant database writes.

### 4. Web UI Enhancements
- 24-Hour Spectrum & BLE Heatmap is expanded by default.
- Battery discharge graph is expanded by default (when battery is present).
- The "Previous 24 Hours" button is removed in favor of real-time active device inspection.
- Added live KPI breakdowns for Key Vendors (Apple, Microsoft, Samsung) and Categories (Smartphone, Computer, Beacon).
- Repaired footer styling and layout.

## Consequences
- Single-cell 18650 battery runtime extends from days to months.
- Zero flash wear during normal online fleet operations.
- Long-term storage in Cloudflare D1 captures daily 48-interval resolution without unbounded storage growth.
