# Firmware Specification: T18 Network Reliability Monitor

## 1. Hardware Architecture (TTGO T18 / T-Energy v3.0)

- **MCU**: ESP32-WROOM / ESP32-WROVER (240MHz, 4MB Flash)
- **Power**: 18650 Li-ion battery + TP5400 Charge & 3.3V Step-down IC
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
  3. Append records to memory spool / LittleFS.
  4. Check if current time falls within the daily upload window (19:00–21:00 UTC). If yes, upload batch.
  5. Shut down Wi-Fi radio (`WiFi.mode(WIFI_OFF)`).
  6. Enable timer wakeup (`esp_sleep_enable_timer_wakeup(interval_us)`).
  7. Enter light sleep (`esp_light_sleep_start()`).

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
   - **Station Name**: String ID (e.g., `C-703`).
   - **Monitored Networks**: Ordered list of WPA2/WPA3 Personal SSIDs & passwords.
   - **Fallback Network**: SSID & password (default: `S24` / `12345678`) used when monitored networks fail or for daily sync.
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

## 6. Daily Upload & Fallback Routine

1. **Upload Window**:
   - Scheduled daily between **19:00 and 21:00 UTC** (which corresponds to **02:00 to 04:00 local Vietnam time / UTC+7**).
   - Only triggers once per 24-hour cycle (tracked via `last_upload_epoch`).
2. **Network Selection**:
   - Attempts connection to the primary monitored network.
   - If monitored network connection or HTTP POST fails, immediately switches to the configured **Fallback Network** (`S24` / `12345678`).
3. **Payload Transmission**:
   - Posts all buffered records (including multi-day backlogs if previous days were offline).
   - Header: `Authorization: Bearer <INGESTION_SECRET>`.
   - On `HTTP 200 OK`: clears the pending spool file and updates `last_upload_epoch`.
