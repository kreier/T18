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
Wake from Timer
  │
  ├─► Read Battery Voltage via ADC (IO35, 100k/100k divider)
  │
  ├─► For each configured Monitored Network:
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
  ├─► Is Daily Upload Scheduled (e.g. 03:00 UTC or 24h accumulated)?
  │     ├── NO  ──► Configure timer for next interval (10 min) -> Deep Sleep
  │     └── YES ──► Trigger Upload Routine (see below)
```

### 3. Daily Upload & NTP Sync Routine
```
Trigger Daily Sync
  │
  ├─► Try uploading via Monitored Network
  │     └── If monitored network fails or unavailable:
  │           Connect to Fallback Network (e.g. "S24" hotspot)
  │
  ├─► Synchronize internal RTC via SNTP (`pool.ntp.org`)
  │
  ├─► Read LittleFS `/spool/pending.jsonl`
  │
  ├─► Transmit payload to Cloudflare Worker endpoint:
  │     POST https://t18-ingest.<worker>.workers.dev/ingest
  │     Header: Authorization: Bearer <STATION_SECRET>
  │
  ├─► On HTTP 200 OK:
  │     Clear or truncate `/spool/pending.jsonl`
  │
  └─► Go to Deep Sleep
```
