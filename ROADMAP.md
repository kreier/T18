# Project Roadmap

This roadmap tracks the development of the T18 Network Reliability Monitor across hardware firmware, cloud ingestion, and web visualization.

---

## Phase 0: Architecture & Foundation (Current Phase)
- [x] Initial hardware pinout and battery schematics documentation.
- [x] Baseline Arduino status sketch with WebServer.
- [x] System Architecture Decision Records (ADRs 0001–0005).
- [x] Complete technical specifications for firmware, data schemas, worker, and dashboard.
- [x] Repository structure definition and `.gitignore` setup.

---

## Phase 1: Firmware Core & Local Web Portal (v0.2.0)
- [ ] Implement LittleFS configuration manager (`/config.json`).
- [ ] Cold-boot detection (`ESP_RST_POWERON` / BOOT button) with 60-second Soft-AP timeout.
- [ ] Responsive Captive Portal UI:
  - Wi-Fi network scanner with signal strength indicators.
  - Form to enter and persist monitored SSIDs and passwords.
  - Fallback Wi-Fi configuration (e.g. "S24").
  - Station name (`station_id`, e.g. "C-703").
  - Interval timer setting (default: 10 minutes).
- [ ] Battery measurement function with calibrated ADC curve.
- [ ] Deep Sleep / Light Sleep power cycle engine.

---

## Phase 2: Probe Engine & Spooling (v0.3.0)
- [ ] Wi-Fi association timing benchmark ($T_{\text{assoc}}$).
- [ ] DHCP lease acquisition benchmark ($T_{\text{dhcp}}$).
- [ ] Multi-target HTTP probe engine (`1.1.1.1`, `google.com/generate_204`, `fast.com`, `cloudflare.com`).
- [ ] Local LittleFS telemetry spooler (`/spool/pending.jsonl`) with flash wear management.
- [ ] RTC time synchronization via NTP on successful connection or fallback link.

---

## Phase 3: Cloudflare Worker Ingestion & GitHub Sync (v0.4.0)
- [x] Implement TypeScript Cloudflare Worker (`POST /ingest` & `POST /heartbeat`).
- [x] Token-based device authentication with Bearer PSK.
- [x] Hourly bucketing and status grading logic (Green, Orange, Purple, Red).
- [x] GitHub REST API integration:
  - Atomic commit to `data/<station_id>/<YYYY-MM>.json`.
  - Update `data/stations.json` index.
- [x] Initial submission on new station setup for immediate dashboard verification.
- [x] Backlog catch-up system checking for unsubmitted old data from previous day(s).
- [x] Two-way submission confirmation before marking records as committed in ESP32 flash.
- [ ] Worker error handling, retry backoff, and GitHub rate-limit protection.

---

## Phase 4: Web Dashboard & 53-Day Heatmap (v0.5.0)
- [ ] Implement GitHub Pages static application (`docs/index.html`).
- [ ] Station selector dropdown reading `data/stations.json`.
- [ ] 53-Day × 24-Hour interactive SVG/CSS Grid heatmap.
- [ ] Tooltips with drill-down metrics (samples, association time, DHCP time, latencies, battery).
- [ ] Battery drain trend curve over 53 days.
- [ ] Dark / Light theme support and mobile responsiveness.

---

## Phase 5: Multi-Station Deployment & Field Hardening (v1.0.0)
- [ ] Multi-network round-robin probing per cycle.
- [ ] Low-battery safety lock (prevent brownout flash corruption when $< 3.1\text{V}$).
- [ ] OTA (Over-The-Air) firmware update trigger via Worker or Fallback AP.
- [ ] Comprehensive field validation across multiple campus/office locations.
