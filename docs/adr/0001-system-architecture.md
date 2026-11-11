# ADR 0001: System Architecture and Data Ingestion Pipeline

## Status
Accepted

## Context
We need a distributed network reliability monitoring solution that operates autonomously from battery-powered IoT stations (TTGO T18 ESP32 with 18650 cell). The stations must periodically measure local Wi-Fi link establishment, DHCP lease acquisition, and WAN reachability across multiple targets, recording telemetry over time.

Measurements must be centrally aggregated and visualized on a public static dashboard hosted on GitHub Pages (`https://kreier.github.io/T18`), displaying a 53-day, 24-hour hourly reliability heatmap per station.

Key constraints:
1. Low-power, battery-operated field stations (months of unattended operation).
2. ESP32 stations must not expose GitHub write credentials (Personal Access Tokens / SSH keys) directly in firmware or flash.
3. Network outages at monitored sites must not result in data loss.
4. Minimal infrastructure costs (using serverless free-tier solutions: GitHub Pages, Cloudflare Workers).

## Decision
We adopt a decoupled, three-tier architecture:

```
[TTGO T18 Station (ESP32)]
       │
       ▼ (Daily batch or on fallback Wi-Fi)
[Cloudflare Worker (Ingestion API)]
       │
       ▼ (GitHub REST API - Commit batch)
[GitHub Repository (data/stations/<id>/YYYY-MM.json)]
       │
       ▼ (GitHub Pages static build/client fetch)
[Web Dashboard (53-Day Hourly Heatmap)]
```

1. **Edge Stations (Firmware)**:
   - On cold start: Broadcasts soft-AP (`T18-Setup-<ID>`) for 60 seconds with captive portal for configuration (station name, monitored SSIDs, fallback SSID, intervals). If a client connects, timeout is cancelled until manual reboot.
   - Normal operation: Periodic wake (default: 10 minutes) -> probe monitored Wi-Fi network(s) -> record timestamps, connection time, DHCP time, ping/HTTP response times to flash storage (LittleFS).
   - Once daily: Sync local time via NTP and upload buffered 24h batch to Cloudflare Worker via monitored connection (or fallback network if primary fails).

2. **Ingestion Layer (Cloudflare Worker)**:
   - Provides a lightweight HTTP POST endpoint (e.g., `/api/v1/telemetry`).
   - Validates station token (pre-shared bearer key per station or global secret).
   - Batches or formats telemetry into clean JSON and commits it directly to the repository via the GitHub REST API (`repos/{owner}/{repo}/contents/...`) using a scoped GitHub Fine-Grained Personal Access Token stored as an encrypted Cloudflare Worker secret.
   - Prevents exposure of GitHub write credentials to IoT devices.

3. **Storage & Visualization Layer (GitHub Repository & Pages)**:
   - Telemetry data is persisted as JSON files structured by station and month: `data/<station_id>/<year>-<month>.json` to prevent merge conflicts and Git index bloat.
   - A single-page dashboard hosted on GitHub Pages (`docs/index.html`) fetches raw data files via HTTP GET and renders a 53-day × 24-hour heatmap using SVG/Canvas, showing hourly status (Green, Orange, Purple, Red).

## Consequences
### Positive
- **Security**: No sensitive GitHub credentials exist on ESP32 flash memory.
- **Resilience**: Data is buffered in flash during network outages and retransmitted once connectivity or fallback Wi-Fi is restored.
- **Zero Cost**: Cloudflare Workers free tier (100k requests/day) and GitHub Pages provide complete operational infrastructure at zero hosting cost.
- **Transparency & Portability**: Telemetry is version-controlled in Git, enabling historical audits and external analysis.

### Negative
- Cloudflare Worker introduces an external dependency that must be configured and maintained.
- Writing commits via GitHub REST API has rate limits (5,000 requests/hour per authenticated token) and high commit volume could clutter Git history if not daily-batched.
