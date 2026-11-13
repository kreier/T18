# System Architecture

The T18 Network Reliability Monitor is an autonomous, battery-powered IoT telemetry platform designed to benchmark Wi-Fi network availability, DHCP speed, and Internet reachability across distributed locations.

```
┌────────────────────────────────────────────────────────┐
│                   TTGO T18 (ESP32)                     │
│  - 18650 Battery (TP5400 + ADC on IO35)                │
│  - Cold Boot AP (1 min timeout, Captive Portal)        │
│  - Periodic Wake (Default 10 min)                      │
│  - Probes: Wi-Fi Assoc -> DHCP -> HTTP Targets         │
│  - Local Spool in LittleFS                             │
│  - Daily Batch Upload (Monitored or Fallback Wi-Fi)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ HTTPS POST /ingest
                           │ (Bearer Token Auth)
                           ▼
┌────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Ingestion)             │
│  - Validates Station Token & Payload Schema            │
│  - Merges Daily Data with Monthly Station Partition    │
│  - Commits to GitHub via REST API                      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ GitHub REST API (Contents)
                           ▼
┌────────────────────────────────────────────────────────┐
│            GitHub Repository (kreier/T18)              │
│  - `data/stations.json` (Registry)                     │
│  - `data/<station>/<YYYY-MM>.json` (Hourly Metrics)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ Static HTTP GET
                           ▼
┌────────────────────────────────────────────────────────┐
│          Web Dashboard (kreier.github.io/T18)          │
│  - GitHub Pages served from `/docs`                    │
│  - 53-Day × 24-Hour Hourly Heatmap Grid                │
│  - Station Switcher, Battery Graph, Latency Metrics    │
└────────────────────────────────────────────────────────┘
```

## System Workflow & Sequence

### 1. Cold Boot & Setup Sequence
```
[User Power On / Reset]
       │
       ▼
Is Power-On Reset or BOOT button pressed?
       ├── YES ──► Start Soft-AP "T18-Setup-XXXX" (IP: 192.168.4.1)
       │           Start Captive Portal & Web Configuration Server
       │           Wait 60 seconds for client connection:
       │             - If client connects: Cancel timer, stay in AP mode until "Reboot"
       │             - If no client connects within 60s: Save state, enter sleep cycle
       └── NO  ──► Proceed immediately to measurement cycle
```

### 2. Periodic Measurement Cycle (Every 10 Minutes)
```
Wake from Sleep
  │
  ├─► Read Battery Voltage via ADC (IO35, 100k/100k divider)
  │
  ├─► For each configured Monitored Network (never fallback network):
  │     1. Start timer -> Trigger Wi-Fi connection
  │     2. Measure time to Wi-Fi association (T_assoc)
  │     3. Measure time to DHCP IP assignment (T_dhcp)
  │     4. Record RSSI & Channel
  │     5. If connected:
  │          - HTTP GET http://1.1.1.1 (Latency 1)
  │          - HTTP GET http://www.google.com/generate_204 (Latency 2)
  │          - HTTP GET http://cloudflare.com (Latency 3)
  │          - HTTP GET http://fast.com (Latency 4)
  │     6. Disconnect Wi-Fi
  │
  ├─► Append measurement to LittleFS `/spool/pending.jsonl`
  │
  ├─► Fresh boot / initial setup pending (initial_submitted == false)?
  │     └── YES ──► Trigger Immediate Initial Assessment Upload (see below)
  │
  ├─► Unsubmitted old records from previous day detected?
  │     └── YES ──► Trigger Catch-Up Upload immediately
  │
  ├─► Is Daily Upload Window Active (19:00 - 21:00 UTC / 02:00 - 04:00 ICT)?
  │     ├── NO  ──► Enter Light Sleep for 10 min
  │     └── YES ──► Trigger Daily Batch Upload Routine (see below)
```

### 3. Upload & Spectrum Survey Routine
```
Trigger Upload (Initial Assessment, Catch-Up, or Daily Batch)
  │
  ├─► Perform visible Wi-Fi spectrum scan (SSIDs, RSSIs, channels, security)
  │
  ├─► Try uploading via Monitored Network(s) in order
  │     └── If monitored networks fail or have no internet access:
  │           If fallback enabled, connect to Fallback Network ("S24")
  │
  ├─► Synchronize internal RTC via SNTP (`pool.ntp.org`)
  │
  ├─► Read LittleFS `/spool/pending.jsonl`
  │
  ├─► Transmit payload to Cloudflare Worker endpoint:
  │     POST https://t18-telemetry-worker.kreier.workers.dev/ingest
  │     Header: Authorization: Bearer <AUTH_TOKEN>
  │     Payload: station_id, location, monitored_networks, scan_networks, records
  │
  ├─► Cloudflare Worker commits updates to GitHub:
  │     ├── data/<station_id>/<YYYY-MM>.json (hourly reliability aggregates)
  │     ├── data/stations.json (registry metadata: location, monitored Wi-Fi, battery)
  │     └── data/<station_id>/networks.json (daily visible spectrum survey)
  │
  ├─► On verified HTTP 200/201 (success: true):
  │     Mark records committed in flash, rotate spool, and set initial_submitted = true
  │
  └─► Enter Light Sleep
```
