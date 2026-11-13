# Data Schema & Repository Layout

This document defines the storage schemas for on-device LittleFS spooling, the Cloudflare Worker ingestion payload, and the git repository telemetry database.

---

## 1. On-Device Spool Format (`/spool/pending.jsonl`)

Each line in `/spool/pending.jsonl` is a compact single-line JSON string:

```json
{"t":1731333600,"s":"Campus-WiFi","r":-68,"ch":1,"a_ms":1320,"d_ms":840,"ip":"10.0.1.52","g_ms":54,"f_ms":92,"cf_ms":38,"dns_ms":28,"err":0,"vbat":3920}
```

### Field Definitions:
- `t`: Unix epoch timestamp (seconds)
- `s`: Wi-Fi SSID
- `r`: RSSI (dBm)
- `ch`: Wi-Fi channel
- `a_ms`: Wi-Fi association time (ms)
- `d_ms`: DHCP lease time (ms)
- `ip`: Assigned IPv4 address
- `g_ms`: Google HTTP response time (ms)
- `f_ms`: Fast.com HTTP response time (ms)
- `cf_ms`: Cloudflare HTTP response time (ms)
- `dns_ms`: 1.1.1.1 HTTP response time (ms)
- `err`: Error bitmask (0 = success, 1 = assoc failed, 2 = dhcp failed, 4 = http partial, 8 = http all failed)
- `vbat`: Battery voltage in millivolts (e.g. 3920 mV)

---

## 2. Ingestion API Payload (`POST /ingest`)

```json
{
  "station_id": "C-103",
  "station_name": "C-103",
  "location": "Science Lab 103",
  "firmware": "0.5.1",
  "battery_mv": 4200,
  "battery_pct": 100,
  "visible_networks": 40,
  "monitored_networks": [
    "Hofkoh",
    "Saigon",
    "iot"
  ],
  "scan_networks": [
    {
      "ssid": "Hofkoh",
      "rssi": -41,
      "ch": 6,
      "sec": "WPA2-PSK"
    },
    {
      "ssid": "Saigon",
      "rssi": -44,
      "ch": 1,
      "sec": "WPA2-PSK"
    },
    {
      "ssid": "S24",
      "rssi": -55,
      "ch": 6,
      "sec": "WPA2-PSK"
    }
  ],
  "records": [
    {
      "timestamp": 1794510463,
      "ssid": "Hofkoh",
      "rssi": -41,
      "channel": 6,
      "assoc_ms": 1117,
      "dhcp_ms": 1,
      "ip": "192.168.1.105",
      "targets": {
        "google": 54,
        "fast": 92,
        "cloudflare": 38,
        "one_one_one_one": 28
      },
      "status": "ok",
      "battery_mv": 4200
    }
  ]
}
```

---

## 3. Repository File Structure

```
data/
├── stations.json
└── C-103/
    ├── 2026-11.json
    └── networks.json
```

### `data/stations.json`
Maintains an index of all registered stations:
```json
[
  {
    "id": "C-103",
    "name": "Room C-103",
    "location": "Science Lab 103",
    "monitored_networks": [
      "Hofkoh",
      "Saigon",
      "iot"
    ],
    "monitored_network": "Hofkoh",
    "fallback_network": "S24",
    "probe_interval_min": 10,
    "first_seen": "2026-11-11T18:47:39Z",
    "last_seen": "2026-11-13T00:27:00Z",
    "battery_mv": 4200,
    "battery_pct": 100,
    "visible_networks": 40,
    "status": "online"
  }
]
```

### `data/<station_id>/networks.json`
Stores the daily visible Wi-Fi spectrum survey tracking all detected wireless networks:
```json
{
  "station": "C-103",
  "monitored_networks": [
    "Hofkoh",
    "Saigon",
    "iot"
  ],
  "daily": {
    "2026-11-13": {
      "date": "2026-11-13",
      "total_scans": 48,
      "networks_count": 40,
      "networks": [
        {
          "ssid": "Hofkoh",
          "is_monitored": true,
          "avg_rssi": -41,
          "min_rssi": -45,
          "max_rssi": -38,
          "visibility_pct": 100,
          "observed_scans": 48,
          "total_scans": 48,
          "channel": 6,
          "security": "WPA2-PSK",
          "last_seen": "2026-11-13T19:50:00Z"
        },
        {
          "ssid": "S24",
          "is_monitored": false,
          "avg_rssi": -55,
          "min_rssi": -60,
          "max_rssi": -52,
          "visibility_pct": 92,
          "observed_scans": 44,
          "total_scans": 48,
          "channel": 6,
          "security": "WPA2-PSK",
          "last_seen": "2026-11-13T19:46:00Z"
        }
      ]
    }
  }
}
```

### `data/<station_id>/<YYYY-MM>.json`
Stores hourly summarized aggregations:
```json
{
  "station": "C-703",
  "month": "2026-11",
  "hours": {
    "2026-11-11T14:00:00Z": {
      "samples": 6,
      "successful": 6,
      "avg_assoc_ms": 1350,
      "avg_dhcp_ms": 820,
      "avg_http_latency_ms": 52,
      "status": "green",
      "avg_rssi": -67,
      "avg_battery_mv": 3930
    },
    "2026-11-11T15:00:00Z": {
      "samples": 6,
      "successful": 5,
      "avg_assoc_ms": 3200,
      "avg_dhcp_ms": 1400,
      "avg_http_latency_ms": 95,
      "status": "orange",
      "avg_rssi": -78,
      "avg_battery_mv": 3925
    }
  }
}
```

### Hourly Status Calculation
- **`green`**: All samples in this hour succeeded, $T_{\text{assoc}} < 3000\text{ms}$, HTTP latency $< 150\text{ms}$.
- **`orange`**: 1 to 2 probe failures in this hour, OR average HTTP latency between 150ms and 500ms.
- **`purple`**: High association or DHCP delay ($T_{\text{assoc}} > 4000\text{ms}$ or $T_{\text{dhcp}} > 3000\text{ms}$), but connection eventually succeeded.
- **`red`**: 3 or more failed attempts, or 0 successful connections in the hour.
- **`gray` / none**: No samples collected during this hour (offline or battery dead).
