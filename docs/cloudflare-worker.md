# Cloudflare Worker Deployment & Architecture

The Cloudflare Worker functions as both:
1. **Real-time Live Telemetry Buffer (Cloudflare KV)**: Stores hourly station health heartbeats (battery voltage, signal RSSI, visible networks count, health status) so the dashboard can inspect live status throughout the day without incurring GitHub API rate limits.
2. **Daily Batch Git Committer**: Merges and commits the 24-hour spool into GitHub (`data/<station_id>/<YYYY-MM>.json` and `data/stations.json`) during the early morning upload window.

---

## 1. Step-by-Step Deployment Guide

### Prerequisites
- [Node.js](https://nodejs.org/) installed (v18+).
- A free [Cloudflare Account](https://dash.cloudflare.com/).
- A GitHub Fine-Grained Personal Access Token with `contents:write` on `kreier/T18`.

### Step 1: Install Dependencies
Inside the `worker/` directory:
```bash
cd worker
npm install
```

### Step 2: Authenticate Wrangler
Log in to your Cloudflare account from the CLI:
```bash
npx wrangler login
```

### Step 3: Create the Cloudflare KV Namespace
Create the KV store for holding live hourly station telemetry:
```bash
npx wrangler kv namespace create TELEMETRY_KV
```
This command outputs a block similar to:
```toml
[[kv_namespaces]]
binding = "TELEMETRY_KV"
id = "a1b2c3d4e5f67890abcdef1234567890"
```
Copy and paste this snippet directly into your `worker/wrangler.toml`.

### Step 4: Configure Cloudflare Worker Secrets
Store your secrets securely in Cloudflare:

1. **Station Pre-Shared Bearer Key**:
   ```bash
   npx wrangler secret put AUTH_TOKEN
   # Enter your chosen secret token (e.g. a strong random string)
   ```
2. **GitHub Personal Access Token**:
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   # Paste your GitHub Fine-Grained PAT with contents:write permission
   ```

### Step 5: Deploy the Worker
Deploy to Cloudflare's edge network:
```bash
npx wrangler deploy
```
Wrangler will output your live worker URL:
`https://t18-telemetry-worker.<your-subdomain>.workers.dev`

Enter this URL into the T18 station during Soft-AP configuration mode!

---

## 2. API Endpoints

### `POST /heartbeat` (Hourly Live Telemetry)
Sent by the T18 station once per hour when connected.
- **Header**: `Authorization: Bearer <AUTH_TOKEN>`
- **Payload**:
  ```json
  {
    "station_id": "C-703",
    "timestamp": 1731362400,
    "battery_mv": 3950,
    "battery_pct": 82,
    "rssi": -65,
    "visible_networks": 14,
    "status": "green",
    "last_assoc_ms": 1180,
    "last_dhcp_ms": 720,
    "last_http_latency_ms": 42
  }
  ```
- **Storage**: Cached directly in Cloudflare KV under key `live:<station_id>` with a 48-hour expiration TTL and appended to `buffer:<station_id>:<YYYY-MM-DD>`.

### `GET /live` (Public Real-time Status)
Used by the web dashboard to display live station health.
- **Query Params**: `?station=C-703` (or omit to get all registered stations).
- **CORS**: Fully enabled for GitHub Pages (`Access-Control-Allow-Origin: *`).

### `POST /ingest` (Initial Assessment & Daily 24-Hour Batch Upload)
Sent by the T18 station:
1. **Immediately on initial configuration / fresh boot** (`initial_submitted == false`) to verify setup and register station metadata without waiting 24 hours.
2. **Once per day** during the early morning batch window (19:00–21:00 UTC / 02:00–04:00 ICT) for the 24-hour accumulated telemetry and spectrum survey.
3. **On backlog recovery** if unsubmitted records from a previous day are detected.

- **Header**: `Authorization: Bearer <AUTH_TOKEN>`
- **Action**:
  - Aggregates hourly rollups (Green, Orange, Purple, Red) and commits to `data/<station>/<YYYY-MM>.json` via the GitHub REST API.
  - Updates station registry metadata in `data/stations.json` (`location`, `monitored_networks`, `visible_networks`, `battery_mv`, `status`).
  - Aggregates the daily visible Wi-Fi spectrum survey (`scan_networks`) and commits to `data/<station>/networks.json`.
  - Caches fresh station status in Cloudflare KV under `live:<station_id>` for immediate dashboard reflection.
