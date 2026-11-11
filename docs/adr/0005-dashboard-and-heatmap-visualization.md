# ADR 0005: Dashboard and Heatmap Visualization

## Status
Accepted

## Context
The project needs a web dashboard hosted at `https://kreier.github.io/T18` to visualize network reliability across monitored stations.
Key requirements:
1. Multi-station selection (e.g. "C-703", "Library-2F", "Lab-101").
2. 53-day heat map for the selected station, organized by day (columns or rows) and hour (00:00 to 23:00, 24 boxes per day).
3. Visual color coding:
   - **Green**: Connection healthy (all probes successful, fast association & latency).
   - **Orange**: Degraded (one or more probe failures, or latency above warning threshold).
   - **Purple**: High association/DHCP delay (Wi-Fi connected, but took abnormally long).
   - **Red**: Complete failure (cannot associate with Wi-Fi, DHCP failed, or WAN unreachable).
   - **Muted / Gray**: No data (station offline or sleep scheduled off).

## Decision
1. **Hosting**: Hosted as static files in the repository (`docs/index.html`, `docs/app.js`, `docs/style.css`), served natively via GitHub Pages configured from the `/docs` directory.
2. **Framework-Free Static Frontend**: Use vanilla HTML5, CSS Grid / Flexbox, and lightweight JavaScript (zero npm build step or bundler required). This ensures that any change in git immediately renders on GitHub Pages with zero CI build friction.
3. **Heatmap Layout**:
   - 53 columns representing the past 53 calendar days (left to right, ending today).
   - 24 rows representing hours of the day (0 to 23 UTC or local station time).
   - Tooltip hover/tap showing exact stats: sample count, success rate, average Wi-Fi connect time, DHCP time, target latencies, battery voltage.
4. **Data Ingestion Client**:
   - Frontend fetches `data/stations.json` to populate the station picker and metadata overview.
   - Frontend fetches `data/<station>/<year>-<month>.json` for the months covering the 53-day window (at most 2 or 3 small files).

## Consequences
### Positive
- Zero hosting maintenance, zero build step, 100% static uptime.
- High performance rendering even on mobile browsers.
- Instant debugging and visual inspection directly in the browser.

### Negative
- Client-side browser logic handles joining multi-month JSON files for the 53-day rolling window.
