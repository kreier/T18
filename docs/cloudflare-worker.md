# Cloudflare Worker Ingestion Pipeline

## Purpose
The Cloudflare Worker serves as a secure, serverless bridge between field ESP32 stations and the GitHub repository (`kreier/T18`). It prevents the ESP32 from holding GitHub write tokens and handles aggregation into monthly JSON files.

---

## Endpoint Specification

### `POST /ingest`

#### Request Headers
```http
POST /ingest HTTP/1.1
Host: t18-worker.<subdomain>.workers.dev
Authorization: Bearer <INGESTION_SECRET>
Content-Type: application/json
```

#### Request Payload
```json
{
  "station_id": "C-703",
  "device_id": "A4CF129D1234",
  "firmware_version": "1.0.0",
  "battery_mv": 3950,
  "records": [
    {
      "timestamp": 1731333600,
      "ssid": "School-Guest",
      "rssi": -65,
      "channel": 6,
      "assoc_ms": 1420,
      "dhcp_ms": 780,
      "ip": "192.168.10.45",
      "targets": {
        "google": 45,
        "fast": 88,
        "one_one_one_one": 24,
        "cloudflare": 31
      },
      "status": "ok"
    }
  ]
}
```

#### Response
- `200 OK`: Data accepted and committed to GitHub.
```json
{
  "status": "success",
  "records_ingested": 144,
  "committed_file": "data/C-703/2026-11.json",
  "commit_sha": "d7a8e1b..."
}
```
- `401 Unauthorized`: Invalid or missing Bearer token.
- `400 Bad Request`: Invalid payload schema or malformed JSON.
- `500 Internal Error`: GitHub API failure or rate limit.

---

## Processing Flow in Worker

1. **Token Authentication**: Compares the incoming `Authorization` header against the worker environment secret `AUTH_TOKEN`.
2. **Hourly Aggregation**:
   - Groups records into 1-hour buckets.
   - For each hour, calculates:
     - Total samples & successful samples
     - Average Wi-Fi association time
     - Average DHCP time
     - Average HTTP latency across targets
     - Worst failure state (e.g., if 1 sample failed, hourly status = `orange`; if all failed, status = `red`)
     - Battery voltage and average RSSI
3. **GitHub Repository Sync**:
   - Fetches the existing `data/<station_id>/<YYYY-MM>.json` file using GitHub REST API:
     `GET https://api.github.com/repos/kreier/T18/contents/data/<station>/<YYYY-MM>.json`
   - Parses existing hours, merges/overwrites incoming hourly data.
   - Updates `data/stations.json` with `last_seen`, `battery_mv`, and station metadata.
   - Commits updated files using a GitHub Fine-Grained Personal Access Token (`GITHUB_TOKEN` secret) via `PUT /repos/:owner/:repo/contents/:path`.

---

## Worker Configuration (`wrangler.toml`)

```toml
name = "t18-telemetry-ingest"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[vars]
GITHUB_OWNER = "kreier"
GITHUB_REPO = "T18"
GITHUB_BRANCH = "main"

# Secrets configured via `wrangler secret put`:
# - AUTH_TOKEN
# - GITHUB_TOKEN
```
