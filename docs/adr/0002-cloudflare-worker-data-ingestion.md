# ADR 0002: Cloudflare Worker as Ingestion Intermediate

## Status
Accepted

## Context
Stations need to transmit 24 hours of collected measurements (or multi-day backlogs after an outage) to the GitHub repository.

Directly pushing from the ESP32 to GitHub via Git or the GitHub REST API has major drawbacks:
1. **Security**: The ESP32 would require a GitHub Personal Access Token (PAT) with write access to the repository. Physical possession of the ESP32 or flash dump could leak this token.
2. **TLS & Resource Overhead**: Creating Git tree objects or multi-file Git API calls on an ESP32 is memory-intensive and prone to TLS handshake and timeout failures.
3. **Concurrent Commit Collisions**: If multiple stations push at the same time, simultaneous direct commits can create SHA conflicts on `main`.

## Decision
We deploy a serverless **Cloudflare Worker** as an ingestion proxy:
1. The ESP32 sends a compact JSON payload via HTTPS POST to the worker endpoint (`POST /ingest`).
2. Authentication uses a lightweight device pre-shared key (PSK) transmitted in the `Authorization: Bearer <token>` header.
3. The Cloudflare Worker:
   - Validates the PSK against environment secret `AUTH_TOKEN`.
   - Validates the incoming schema (station name, timestamp sanity, measurement structure).
   - Retrieves the existing month file (`data/<station>/<YYYY-MM>.json`) via GitHub REST API if present, merges the new hourly data records (deduplicating by timestamp), and writes the updated file back using a GitHub Fine-Grained Personal Access Token with only contents:write permissions on `kreier/T18`.
   - Returns a HTTP 200 OK with confirmation timestamp back to the ESP32 so the station can safely mark the buffered records as committed in LittleFS.

## Consequences
### Positive
- ESP32 firmware remains small, fast, and simple (single standard HTTPS POST).
- GitHub PAT stays protected inside Cloudflare Worker Secrets.
- Worker can handle atomic updates, retries, and data normalization before committing to Git.
- Free tier of Cloudflare Worker is more than sufficient (100,000 req/day vs < 1,000 req/day across dozens of stations).

### Negative
- Requires a Cloudflare account setup and Wrangler deployment.
- Ingestion is dependent on Cloudflare edge availability and GitHub API uptime.
