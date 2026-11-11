# T18 Network Reliability Monitor

[![GitHub License](https://img.shields.io/github/license/kreier/T18)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/kreier/T18)](https://github.com/kreier/T18/releases)
[![Dashboard](https://img.shields.io/badge/Dashboard-kreier.github.io%2FT18-blue)](https://kreier.github.io/T18)

An autonomous, battery-powered Wi-Fi reliability monitoring station and telemetry platform based on the **LilyGo TTGO T18 v3.0 (T-Energy)** ESP32 board.

The station wakes periodically from low-power sleep, benchmarks local Wi-Fi association speed, DHCP lease acquisition, and WAN reachability across multiple targets, saves measurements to flash, and uploads batched data daily via Cloudflare Workers to GitHub. Visualizations are rendered as a **53-day hourly reliability heatmap** hosted on [GitHub Pages](https://kreier.github.io/T18).

---

## Live Dashboard
Explore live and historical telemetry across deployed stations:
👉 **[https://kreier.github.io/T18](https://kreier.github.io/T18)**

---

## System Architecture

```
┌─────────────────────────┐
│ TTGO T18 Station        │ (18650 Battery, TP5400)
│ - Cold boot AP Portal   │ Wakes every 10 min -> Wi-Fi Assoc -> DHCP -> HTTP targets
│ - LittleFS Spool        │
└────────────┬────────────┘
             │ Daily batch upload (or via Fallback Wi-Fi "S24")
             ▼ HTTPS POST /ingest
┌─────────────────────────┐
│ Cloudflare Worker       │ (Ingestion Proxy)
│ - Token Auth            │ Aggregates hourly rollups (Green, Orange, Purple, Red)
│ - GitHub Commit API     │
└────────────┬────────────┘
             │ GitHub REST API (Fine-Grained PAT)
             ▼
┌─────────────────────────┐
│ GitHub Repo (kreier/T18)│
│ - data/stations.json    │ Station registry
│ - data/<id>/YYYY-MM.json│ Partitioned telemetry records
└────────────┬────────────┘
             │ Static JSON fetch
             ▼
┌─────────────────────────┐
│ Web Dashboard           │ (GitHub Pages)
│ - 53-Day Hourly Heatmap │ Interactive grid of 53 days x 24 hours per station
└─────────────────────────┘
```

---

## Hardware: LilyGo TTGO T18 (T-Energy v3.0)

Documented by LilyGo at [LILYGO-T-Energy](https://github.com/LilyGO/LILYGO-T-Energy) and [Schematics PDF](https://github.com/LilyGO/LILYGO-T-Energy/blob/master/t18_v3.0.pdf).

### Key Pin Assignments
- **Blue LED**: `IO5`
- **Battery Measurement**: `IO35` via 100kΩ / 100kΩ voltage divider ($V_{\text{bat}} = 2.0 \times V_{\text{pin}}$)
- **Power Management IC**: TP5400 (Charge controller + 3.3V LDO)
- **Reset Button**: `EN`
- **Boot / Config Button**: `IO0` (hold on boot to force Soft-AP portal)

### Hardware Schematics & Photos
Buttons and LED:
![Buttons and LED](docs/buttons_led.jpg)

Charge controller TP5400, 3.3V LDO, and voltage divider to IO35:
![TP5400](docs/TP5400.jpg)

---

## Repository Structure

```
.
├── .gitignore                   # Ignores build artifacts, OS files (.DS_Store), secrets
├── README.md                    # Project overview and hardware guide
├── ROADMAP.md                   # Phased milestone delivery plan
├── data/                        # Version-controlled telemetry records
│   ├── stations.json            # Registry of deployed stations & health status
│   └── C-703/                   # Station data partitioned by month
│       └── 2026-11.json
├── docs/                        # GitHub Pages dashboard & documentation
│   ├── index.html               # 53-Day hourly heatmap dashboard
│   ├── style.css                # Responsive dashboard styles (dark theme)
│   ├── app.js                   # Client-side dynamic data loader & SVG grid
│   ├── architecture.md          # System workflow, sequence diagrams, failure modes
│   ├── firmware-specification.md# Firmware state machine, AP portal, measurement spec
│   ├── cloudflare-worker.md     # Ingestion proxy, auth, GitHub API commit flow
│   ├── data-schema.md           # Spool format, API payload, repository JSON schema
│   ├── dashboard.md             # Dashboard UI specification & color grade rules
│   └── adr/                     # Architecture Decision Records
│       ├── 0001-system-architecture.md
│       ├── 0002-cloudflare-worker-data-ingestion.md
│       ├── 0003-sleep-mode-and-power-strategy.md
│       ├── 0004-data-storage-format-and-partitioning.md
│       └── 0005-dashboard-and-heatmap-visualization.md
├── firmware/                    # ESP32 C++ firmware (PlatformIO / Arduino)
│   ├── platformio.ini
│   └── README.md
└── worker/                      # Cloudflare Worker telemetry ingestion proxy
    ├── package.json
    ├── wrangler.toml
    └── src/index.ts
```

---

## Architecture Decision Records (ADRs)
- [ADR 0001: System Architecture and Data Ingestion Pipeline](docs/adr/0001-system-architecture.md)
- [ADR 0002: Cloudflare Worker as Ingestion Intermediate](docs/adr/0002-cloudflare-worker-data-ingestion.md)
- [ADR 0003: Sleep Mode and Power Strategy (Deep Sleep vs Light Sleep)](docs/adr/0003-sleep-mode-and-power-strategy.md)
- [ADR 0004: Data Storage Format and Partitioning](docs/adr/0004-data-storage-format-and-partitioning.md)
- [ADR 0005: Dashboard and Heatmap Visualization](docs/adr/0005-dashboard-and-heatmap-visualization.md)

---

## Detailed Specifications
- [End-to-End System Architecture](docs/architecture.md)
- [Firmware Specification & State Machine](docs/firmware-specification.md)
- [Data Schema & Flash Storage Spec](docs/data-schema.md)
- [Cloudflare Worker Ingestion Pipeline](docs/cloudflare-worker.md)
- [Dashboard & Heatmap Visualization](docs/dashboard.md)
- [Project Roadmap](ROADMAP.md)

---

## Legacy Status Example
For quick bench-testing of the TTGO T18 board hardware (reading the battery voltage divider on IO35 and driving the blue LED on IO5), refer to the standalone sketch in [firmware/README.md](firmware/README.md).
