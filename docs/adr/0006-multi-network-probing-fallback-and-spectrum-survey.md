# ADR 0006: Multi-Network Probing, Fallback Backup Channel, and Visible Spectrum Survey

## Status
Accepted

## Context
Initial iterations of the T18 monitor evaluated only a single primary Wi-Fi SSID and counted visible networks without retaining spectrum scan details. Field deployments revealed three critical requirements:
1. **Multi-Network Environments**: A single station deployed in an educational or enterprise campus frequently needs to benchmark multiple co-existing Wi-Fi networks (e.g., Guest, Staff, and IoT networks) sequentially during the same probe cycle.
2. **Emergency Fallback Uplink**: When monitored networks experience total WAN outages or captive portal re-authentication locks, stations must still be able to upload their telemetry buffer. A dedicated fallback network (e.g. mobile hotspot `"S24"`) is required, but it **must never be monitored or benchmarked** as part of reliability metrics. It must also have a configurable toggle switch to activate/deactivate it.
3. **Immediate Verification vs. Daily Batch Collection**: When a new station is deployed or re-configured, users need immediate confirmation on the public dashboard (`https://kreier.github.io/T18`) showing actual monitored networks and location without waiting for the 24-hour batch window. After initial verification, the station must revert to low-power whole-day spooling and upload its accumulated telemetry and spectrum survey once daily.
4. **Visible Spectrum Survey**: Network reliability issues are often caused by RF channel crowding and rogue AP interference. A daily historical survey of all visible Wi-Fi networks (signal strength distributions, channels, encryption, and visibility percentages) is required.

## Decision

### 1. Multi-Network Sequential Probing
- Station configuration supports up to 4 monitored networks (`monitored_networks`), configurable via the captive portal and stored in LittleFS `/config.json`.
- In each measurement cycle (`runMeasurement()`), the station iterates through each configured monitored network:
  - Measures Wi-Fi association time ($T_{\text{assoc}}$).
  - Measures DHCP lease acquisition time ($T_{\text{dhcp}}$).
  - Executes HTTP latency probes (`1.1.1.1`, Google, Fast.com, Cloudflare).
  - Records RSSI, channel, and error flags.
- Each network's result is appended as an independent record in LittleFS `/spool/pending.jsonl`.

### 2. Dedicated Fallback Network ("S24") & Strict Backup Isolation
- The station supports a configurable fallback SSID (default: `"S24"`) and password (default: `"12345678"`), with a hardware/portal toggle switch (`fallback_enabled`).
- **Strict Isolation**: The fallback network is **never probed, measured, or included in telemetry metrics**.
- **Backup Routing**: The helper function `uploadSpoolWithFallback()` attempts transmission through the monitored networks first. If they fail to connect or lack WAN reachability, the station connects to the fallback network solely to deliver buffered data to the Cloudflare Worker.

### 3. Immediate Initial Assessment on Fresh Boot
- Upon initial setup or reboot following configuration (`spoolState.initial_submitted == false`):
  1. The station immediately executes a first assessment of all monitored networks.
  2. Scans visible Wi-Fi spectrum (`performVisibleNetworksScan()`).
  3. Immediately transmits the assessment, actual monitored network SSIDs, location, visible networks count, and scan spectrum to `POST /ingest` via `uploadSpoolWithFallback()`.
  4. The Cloudflare Worker atomically updates `data/stations.json`, `data/<station_id>/<YYYY-MM>.json`, and `data/<station_id>/networks.json` on GitHub and caches the station in Cloudflare KV.
  5. GitHub Pages fetches fresh data with cache-busting and live KV synchronization, immediately reflecting the new station and actual monitored Wi-Fi pills.
  6. Upon worker confirmation, the station sets `spoolState.initial_submitted = true` and saves state to flash.

### 4. Whole-Day Data Collection & Daily Batch Push
- Following the initial assessment, the station enters its routine low-power cycle (default: 10 minutes light sleep).
- Measurements accumulate in `/spool/pending.jsonl` throughout the 24-hour cycle.
- Hourly lightweight heartbeats update Cloudflare KV without triggering Git commits.
- Once per day during the designated ingestion window (**19:00–21:00 UTC / 02:00–04:00 ICT**):
  - The station performs `uploadSpoolWithFallback()`.
  - The Cloudflare Worker aggregates all records into hourly averages and status grades, updates the daily visible Wi-Fi spectrum survey, and commits updates to GitHub.

### 5. Visible Wi-Fi Spectrum Survey (`networks.json`)
- Each upload includes a full synchronous scan array (`scan_networks`) containing `ssid`, `rssi`, `ch`, and `sec`.
- The Cloudflare Worker updates `data/<station_id>/networks.json`:
  - Tracks `total_scans` and per-network `observed_scans` to compute daily `visibility_pct`.
  - Tracks `min_rssi`, `max_rssi`, and running `avg_rssi`.
  - Flags monitored networks (`is_monitored: true`) and sorts them prominently at the top.

## Consequences

### Positive
- **Instant Usability**: Stations appear on GitHub Pages immediately after deployment with actual SSIDs and location, eliminating 24-hour blind spots.
- **Fail-Safe Connectivity**: Outages on monitored client networks do not block telemetry ingestion when the backup fallback hotspot is enabled.
- **Rich Spectrum Visibility**: The dashboard provides RF visibility and channel usage analysis across days and weeks.
- **Clean Metrics**: Production reliability data is never skewed by fallback network performance.

### Negative
- Scanning all visible networks adds ~1.5 seconds of active radio time per survey scan ($\approx 60\text{ mA}\cdot\text{s}$ energy consumption).
- Payload size during daily batch uploads increases by ~2 KB for the scanned networks array.
