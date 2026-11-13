# ADR 0004: Data Storage Format and Partitioning

## Status
Accepted

## Context
Stations probe networks every 10 minutes (6 times per hour, 144 times per day).
For each probe, the station records:
- Timestamp (Unix epoch)
- Network SSID & BSSID / Channel
- Wi-Fi association time (milliseconds)
- DHCP lease acquisition time (milliseconds)
- Assigned IP address
- Target response times: Google, fast.com, 1.1.1.1, Cloudflare (HTTP status, latency in ms)
- Battery voltage (mV) and RSSI (dBm)

Data must be stored on ESP32 flash during offline periods (e.g., when monitored networks are down or before the daily upload).
In the GitHub repository, data must be structured to support the 53-day hourly heatmap while maintaining fast loading times on GitHub Pages.

## Decision

### 1. On-Device Storage (LittleFS)
- ESP32 uses a standard 4MB flash layout with ~1.5MB allocated to LittleFS.
- Unsent measurements are written as append-only binary or compact JSON lines (`/spool/pending.jsonl`).
- Each record is approximately 120 bytes. 144 records/day ≈ 17.3 KB/day.
- LittleFS can easily store > 30 days of offline telemetry (approx. 520 KB) without exhausting flash or causing excessive flash wear.
- Upon successful upload to the Cloudflare Worker, the pending spool file is cleared or rotated.

### 2. Repository Data Layout (Partitioned by Station & Month)
Telemetry files are stored in the git repository under:
```
data/
  stations.json                       # Station metadata registry (name, location, monitored networks, last_seen)
  <station_id>/
    <YYYY>-<MM>.json                  # Consolidated hourly summaries & raw aggregates for that month
    networks.json                     # Daily visible Wi-Fi spectrum survey tracking detected networks (ADR 0006)
```

Example `data/stations.json`:
```json
[
  {
    "id": "C-103",
    "name": "Room C-103",
    "location": "Science Lab 103",
    "monitored_networks": ["Hofkoh", "Saigon", "iot"],
    "monitored_network": "Hofkoh",
    "fallback_network": "S24",
    "last_seen": "2026-11-13T00:27:00Z",
    "battery_mv": 4200,
    "battery_pct": 100,
    "visible_networks": 40,
    "status": "online"
  }
]
```

Example `data/C-703/2026-11.json`:
```json
{
  "station": "C-703",
  "month": "2026-11",
  "hours": {
    "2026-11-11T14:00:00Z": {
      "samples": 6,
      "successful": 6,
      "avg_wifi_connect_ms": 1420,
      "avg_dhcp_ms": 830,
      "avg_http_latency_ms": 42,
      "status": "green",
      "avg_battery_mv": 3980,
      "avg_rssi": -62
    }
  }
}
```

### 3. Hourly Aggregation
To display the 53-day hourly heatmap on GitHub Pages:
- 53 days × 24 hours = 1,272 hourly cells per station.
- By storing pre-aggregated hourly records, the browser only downloads ~50 KB of JSON per station instead of megabytes of raw 10-minute ping logs.

## Consequences
### Positive
- Browser loads quickly on mobile and desktop without client-side lag.
- Partitioning by `station_id` and month ensures git commits from different stations never produce merge conflicts.
- Storage wear on ESP32 SPI flash is minimized through buffered batch writes.

### Negative
- Raw 10-minute granular latency details are summarized into hourly metrics (min, max, avg, failure counts) in the primary dashboard view.
