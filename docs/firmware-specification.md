# Firmware Specification: T18 Network Reliability Monitor

## 1. Hardware Architecture (TTGO T18 / T-Energy v3.0)

- **MCU**: ESP32-WROOM / ESP32-WROVER (240MHz, 4MB Flash)
- **Power**: 18650 Li-ion battery (2500 mAh) + TP5400 Charge & 3.3V Step-down IC
- **Battery Measurement**:
  - `IO35` (ADC1_CHANNEL_7) connected to a 100kΩ / 100kΩ voltage divider.
  - Calculation: $V_{\text{bat}} = 2.0 \times \text{ADC\_mV} / 1000$.
- **LED**: Blue LED on `IO5` (active HIGH).
- **Buttons**:
  - `EN`: Hardware Reset (triggers cold start).
  - `BOOT`: `IO0` (hold during boot or press to invoke AP configuration mode).

---

## 2. Lifecycle & Power Management (Light Sleep)

Because the ESP32 utilizes **Light Sleep (`esp_light_sleep_start()`)**:
- `setup()` executes **only upon cold boot** (battery insertion, hardware reset, or user-triggered reboot from the web portal).
- `loop()` controls the continuous probe & sleep sequence:
  1. Wake from light sleep (CPU resumes directly in `loop()`).
  2. Execute sequential measurement of monitored networks.
  3. Append records to memory spool / LittleFS (`/spool/pending.jsonl`).
  4. If newly setup station (`initial_submitted == false`), immediately submit initial telemetry to GitHub.
  5. Check if old unsubmitted data exists from previous day(s) or missed windows. If yes, trigger catch-up upload.
  6. Check if current time falls within the daily upload window (19:00–21:00 UTC). If yes, upload batch.
  7. Confirm HTTP response from Cloudflare Worker (`code == 200` and `success: true`) before marking records in flash as submitted.
  8. Shut down Wi-Fi radio (`WiFi.mode(WIFI_OFF)`).
  9. Enable timer wakeup (`esp_sleep_enable_timer_wakeup(interval_us)`).
  10. Enter light sleep (`esp_light_sleep_start()`).

```
                    ┌────────────────────────────┐
                    │  Cold Boot (Power Insert)  │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │ 60s Soft-AP Config Mode    │
                    │ (Captive Portal: 192.168.4.1│
                    └──────┬──────────────┬──────┘
             Client Connects│              │No Client after 60s
                           ▼              │
            ┌──────────────────────┐      │
            │ Stay in AP Mode      │      │
            │ until "Save & Reboot"│      │
            └──────────┬───────────┘      │
                       ▼                  ▼
                    ┌────────────────────────────┐
             ┌─────►│  WAKE FROM LIGHT SLEEP     │
             │      └─────────────┬──────────────┘
             │                    │
             │                    ▼
             │      ┌────────────────────────────┐
             │      │ Sequential Probe Sequence  │
             │      │ (Assoc -> DHCP -> HTTP)    │
             │      └─────────────┬──────────────┘
             │                    │
             │                    ▼
             │      ┌────────────────────────────┐
             │      │ Record to RAM / LittleFS   │
             │      │ (Retroactive Time Sync)    │
             │      └─────────────┬──────────────┘
             │                    │
             │      In Daily Window (19:00-21:00)?
             │      ┌─────────────┴──────────────┐
             │   YES│                          NO│
             │      ▼                            │
             │  ┌──────────────────────┐         │
             │  │ Daily Upload & NTP   │         │
             │  │ (Primary or Fallback)│         │
             │  └──────────┬───────────┘         │
             │             │                     │
             │             └──────────┬──────────┘
             │                        ▼
             │      ┌────────────────────────────┐
             │      │ Wi-Fi Off & Light Sleep    │
             └──────┤ (esp_light_sleep_start)    │
                    └────────────────────────────┘
```

---

## 3. Cold Start & Soft-AP Captive Portal

1. **AP Initialization**:
   - SSID: `T18-Setup-<MAC_SUFFIX>` (open network, no password).
   - Local IP: `192.168.4.1`.
   - DNS server intercepts all requests (Captive Portal mode).
2. **60-Second Timeout Rule**:
   - A 60-second timer begins upon AP start.
   - Using `WiFi.softAPgetStationNum()`: if $\ge 1$ station connects within 60s, **the timeout timer is cancelled**.
   - The station remains in AP mode indefinitely, allowing the user to configure settings without being disconnected.
   - If 60 seconds elapse with 0 connected clients, the AP is shut down and normal operation begins immediately.
3. **Web Portal Configuration Parameters**:
   - **Station ID**: String ID (e.g., `C-103`).
   - **Location**: Human-readable location description (e.g., `Science Building C, Room 103`).
   - **Monitored Networks**: Ordered list of up to 4 SSIDs & passwords sequentially benchmarked.
   - **Fallback Network**: Configurable SSID & password (default: `S24` / `12345678`) with enable/disable switch (used strictly as backup when monitored networks fail or lack internet connectivity; never monitored).
   - **Measurement Interval**: Minutes between wakeups (default: 10 minutes).
   - **Ingestion Worker URL & Bearer Token**: Cloudflare Worker endpoint and PSK.
   - **Save & Reboot Button**: Saves configuration to LittleFS `/config.json` and invokes `ESP.restart()`.

---

## 4. Measurement Routine & Cutoff Timeouts

On every measurement wake:
1. **Battery Sampling**:
   - Average 16 ADC samples on `IO35`.
   - Record millivolts and battery percentage.
2. **Sequential Probing**:
   For each monitored network configured:
   - **Wi-Fi Association**:
     - Call `WiFi.begin(ssid, password)`.
     - Timeout: **15,000 ms**.
     - If exceeded: record `assoc_ms = 0`, flag `ASSOC_FAILED`, skip DHCP and HTTP.
   - **DHCP Acquisition**:
     - Poll until `WiFi.localIP()` is non-zero.
     - Timeout: **10,000 ms**.
     - If exceeded: record `dhcp_ms = 0`, flag `DHCP_FAILED`, skip HTTP.
   - **HTTP Target Latency**:
     - Probe targets sequentially with a strict **3,000 ms** timeout per target:
       - `http://1.1.1.1` (Cloudflare DNS web service)
       - `http://www.google.com/generate_204` (Google fast status)
       - `http://fast.com` (Netflix CDN target)
       - `http://cloudflare.com` (Cloudflare portal)
     - Record latency in milliseconds or -1 if unreachable/timeout.
   - Disconnect Wi-Fi cleanly: `WiFi.disconnect(true)`.

---

## 5. Offline Boot & Retroactive Timestamp Mapping

When the station boots fresh with no prior NTP sync (e.g. after a cold battery insert with no available internet):
1. Records are initially timestamped with relative `millis()` ticks and marked `synced = false`.
2. When the station achieves its first successful NTP sync (via a working monitored network or the fallback network):
   $$\Delta_{\text{offset}} = \text{Epoch}_{\text{NTP}} - \left(\frac{\text{millis}_{\text{now}}}{1000}\right)$$
3. The firmware iterates through all pending records in RAM / LittleFS and computes:
   $$\text{timestamp}_{\text{record}} = \Delta_{\text{offset}} + \left(\frac{\text{record.millis}}{1000}\right)$$
4. All retroactively mapped records are flagged `synced = true`.

---

## 6. Submission Lifecycle, Confirmation & Fallback Routine

1. **Initial Setup Assessment & Instant Submission**:
   - Immediately following new station configuration in the Soft-AP portal (or fresh cold boot where `initial_submitted == false`), the station performs a **first assessment**:
     - Sequentially benchmarks each configured monitored network (Association, DHCP lease, and HTTP target latency probes).
     - Performs a full visible Wi-Fi spectrum scan (`performVisibleNetworksScan()`) collecting detected SSIDs, RSSIs, channels, and security modes.
   - Posts this initial assessment immediately to the Cloudflare Worker via `uploadSpoolWithFallback()`.
   - Allows instant confirmation and immediate appearance of the station's location, actual monitored Wi-Fi SSIDs, visible networks survey, and health on `https://kreier.github.io/T18` without waiting 24 hours.
2. **Whole-Day Data Collection**:
   - For all subsequent cycles throughout the day (default: every 10 minutes), the station wakes from light sleep, sequentially benchmarks each configured monitored network, and appends records to `/spool/pending.jsonl` in LittleFS flash.
   - Probes are strictly isolated to the configured monitored networks; the fallback network is **never monitored**.
   - Hourly lightweight heartbeats update Cloudflare KV with real-time status.
3. **Daily Ingestion Batch Window**:
   - Scheduled daily between **19:00 and 21:00 UTC** (corresponding to **02:00 to 04:00 local Vietnam time / UTC+7**).
   - Only triggers once per 24-hour cycle (persisted in `/spool/state.json`).
   - The station executes `uploadSpoolWithFallback()`, posting the entire day's accumulated telemetry records along with the latest visible Wi-Fi spectrum scan to `POST /ingest`.
   - The Cloudflare Worker aggregates all records into hourly averages (association time, DHCP time, target latencies, and color grading) and daily network survey statistics, committing the updates to GitHub.
4. **Old Data / Backlog Catch-Up**:
   - The firmware inspects `/spool/pending.jsonl` every cycle.
   - If unsubmitted records from a previous day (`record_day < current_day`) or older than 20 hours are detected (e.g. from an outage or missed 2:00 AM window), an immediate catch-up upload is initiated without waiting for 19:00 UTC.
5. **Fallback Network Selection & Strict Backup Isolation**:
   - The station iterates through each configured monitored network in order.
   - If login to the monitored networks fails or if they lack internet connectivity (e.g. HTTP POST fails to connect to the ingestion endpoint), the station automatically connects to the configured **Fallback Network** (`S24` / `12345678`), provided it is enabled (`fallback_enabled == true`).
   - The fallback network is used strictly as a backup communication channel for uploading spooled telemetry and heartbeats. It is never included in the reliability monitoring probe set.
6. **Two-Way Confirmation & Flash Commitment**:
   - Posts buffered records to `POST /ingest` with `Authorization: Bearer <INGESTION_SECRET>`.
   - The Cloudflare Worker validates the batch, commits updates to GitHub (`data/<station>/<YYYY-MM>.json`, `data/stations.json`, `data/<station>/networks.json`), and returns `HTTP 200` with `{"success": true, ...}`.
   - **Only upon verified confirmation** (`success: true`) does the ESP32 mark records in flash as submitted:
     - Pending records are appended to `/spool/submitted.jsonl` with `"sub": true`.
     - `/spool/pending.jsonl` is removed.
     - Persistent state is written to LittleFS `/spool/state.json` (`initial_submitted = true`, `last_upload_epoch`, `last_upload_day`).
   - If the upload fails or worker confirmation is missing, records remain marked as pending in flash for retry on the next probe cycle.

---

## 7. Measured Power Consumption & Battery Autonomy (2500 mAh)

Based on empirical measurements on the TTGO T18 board (TP5400, 3.7V–4.2V Li-ion cell):

| Operating State | Measured Current | Notes |
|:---|:---:|:---|
| **Active (CPU 240MHz, Wi-Fi off, LED on)** | **45.10 mA** | Baseline CPU draw |
| **Wi-Fi Active Scan / Association** | **150.00 mA** | Peak radio transmission & scanning |
| **Active Wi-Fi off (LED on)** | **44.90 mA** | Post-disconnect radio shutoff |
| **Light Sleep (`esp_light_sleep_start`)** | **1.91 mA** | CPU paused, RAM retained, LED off |
| **Active Resume (LED on)** | **44.80 mA** | Post-sleep CPU resume |
| **Deep Sleep (`esp_deep_sleep_start`)** | **0.17 mA** (170 µA) | CPU & RAM off, RTC slow clock only |

### Runtime Projections on a 2500 mAh 18650 Battery:
- **Station in Light Sleep (10-minute probe cycle)**:
  - Daily consumption: $\approx 65.9\text{ mAh/day}$ ($I_{\text{avg}} \approx 2.75\text{ mA}$).
  - **Expected Runtime**: **~38 days (~5.5 weeks)**.
- **Station in Deep Sleep (10-minute probe cycle)**:
  - Daily consumption: $\approx 29.5\text{ mAh/day}$ ($I_{\text{avg}} \approx 1.23\text{ mA}$).
  - **Expected Runtime**: **~85 days (~2.8 months)**.
- **Pure Standby Shelf Life**:
  - Light Sleep: **~54.5 days** (1,309 hours).
  - Deep Sleep: **~612 days / 1.67 years** (14,705 hours).
