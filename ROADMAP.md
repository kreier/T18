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

## Phase 4: Web Dashboard, Multi-Network & Spectrum Survey (v0.5.0)
- [x] Implement GitHub Pages static application (`docs/index.html`).
- [x] Station selector dropdown reading `data/stations.json`.
- [x] 53-Day × 24-Hour interactive CSS Grid heatmap with local ICT (UTC+7) and UTC toggle.
- [x] Dynamic version badge loaded from repository `version.json` (v0.5.0).
- [x] Dark Mode / Light Mode theme toggle with system preference detection and localStorage persistence.
- [x] Fixed heatmap cell CSS specificity so status colors display properly instead of gray.
- [x] Multi-network Wi-Fi monitoring in ESP32 setup portal & config storage (v0.5.0).
- [x] Display multiple monitored Wi-Fi network pills in dashboard (v0.5.0).
- [x] Daily 10-minute spectrum scan & database tracking for available networks with relative signal strength & daily visibility % (v0.5.0).
- [x] Interactive Visible Networks Spectrum Modal dialog behind "VISIBLE NETWORKS" field (v0.5.0).
- [x] Removed Emergency Fallback and First Transmission fields from dashboard for cleaner UI (v0.5.0).
- [x] Tooltips with drill-down metrics (samples, association time, DHCP time, latencies, battery).
- [ ] Battery drain trend curve over 53 days.
- [ ] Mobile responsiveness polish.

---

## Phase 4.1: Bug Fixes, Fallback Network & Immediate Station Registration (v0.5.1)
- [x] Fixed compiler syntax error at lines 422–424 in `firmware/T18_wifiquality/T18_wifiquality.ino`.
- [x] Added configurable Location field to ESP32 Soft-AP configuration portal and persistent LittleFS storage.
- [x] Reintroduced configurable Fallback Network ("S24") with active/inactive toggle switch (backup upload only, never monitored).
- [x] Firmware conducts first assessment of all configured monitored networks upon startup/setup and submits immediately to GitHub.
- [x] Cloudflare Worker updates station location, monitored networks, and visible network count in `data/stations.json` atomically.
- [x] GitHub Pages dashboard immediately reflects new stations and updated network telemetry with cache-busting and live worker synchronization.

---

## Phase 5: Multi-Station Deployment & Field Hardening (v1.0.0)
- [ ] Multi-network round-robin probing per cycle.
- [ ] Low-battery safety lock (prevent brownout flash corruption when $< 3.1\text{V}$).
- [ ] OTA (Over-The-Air) firmware update trigger via Worker or Fallback AP.
- [ ] Comprehensive field validation across multiple campus/office locations.
