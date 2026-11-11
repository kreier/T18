# TTGO T18 (ESP32) Firmware Examples

This directory contains standalone reference sketches for testing, hardware validation, and power profiling on the **LilyGo TTGO T18 v3.0 (T-Energy)** board.

---

## 1. Status Page (`status/status.ino`)

A lightweight web server showing live hardware vitals and network telemetry:
- **Web Dashboard**: Accessible via `http://T18.local/` (via mDNS) or the station's assigned local IP.
- **Metrics Displayed**:
  - Wi-Fi SSID, RSSI (dBm), and signal quality percentage.
  - 18650 battery voltage (calibrated via `IO35` divider) and estimated capacity percentage.
  - System uptime ($d, h, m, s$).
  - IP address and free heap memory.
- **Hardware Integration**:
  - Toggles the blue LED on `IO5` when serving web requests.
  - Refreshes automatically every 5 seconds.

---

## 2. Power Consumption Benchmark (`powerconsumption/powerconsumption.ino`)

An automated sequence designed for measuring current draw across ESP32 power modes using an ammeter, multimeter, or power profiler (e.g., Nordic PPK2, Otii Arc):

### Measured Cycle Sequence:
| Phase | Duration | State Description | LED (`IO5`) | Wi-Fi State | Measured Current (3.7V - 4.2V) |
|:---|:---|:---|:---:|:---:|:---:|
| **Phase 1** | 20 seconds | ESP Active (CPU 240MHz) | **ON** (solid) | Radio OFF | **45.10 mA** |
| **Phase 2** | 20 seconds | Active Wi-Fi Scanning | **Flashing** (150ms) | Scanning 2.4GHz | **150.00 mA** |
| **Phase 3** | 20 seconds | Radio Disabled | **ON** (solid) | Radio OFF | **44.90 mA** |
| **Phase 4** | 20 seconds | **Light Sleep** (`esp_light_sleep_start`) | **OFF** | Radio OFF | **1.91 mA** |
| **Phase 5** | 10 seconds | Resumed Active Execution | **ON** (solid) | Radio OFF | **44.80 mA** |
| **Phase 6** | 20 seconds | **Deep Sleep** (`esp_deep_sleep_start`) | **OFF** | Powered Down | **0.17 mA** (170 µA) |

> **Reset Behavior**: After Phase 6 (Deep Sleep), the ESP32 timer fires after 20 seconds, causing a clean reset back to `setup()`, which automatically repeats the sequence from Phase 1.

---

## 3. Battery Runtime Analysis (2500 mAh 18650 Li-ion Cell)

Based on the empirical current measurements above, the expected battery life on a standard **2500 mAh 18650 Li-ion battery** is calculated across different operational profiles:

### A. Continuous Benchmark Cycle (110 seconds loop)
- **Charge per cycle**:
  $$\begin{aligned}
  Q_{\text{cycle}} &= (20\text{s} \times 45.1\text{ mA}) + (20\text{s} \times 150.0\text{ mA}) + (20\text{s} \times 44.9\text{ mA}) \\
  &\quad + (20\text{s} \times 1.91\text{ mA}) + (10\text{s} \times 44.8\text{ mA}) + (20\text{s} \times 0.17\text{ mA}) \\
  &= 902 + 3000 + 898 + 38.2 + 448 + 3.4 = 5289.6\text{ mA}\cdot\text{s}
  \end{aligned}$$
- **Average Current**:
  $$I_{\text{avg}} = \frac{5289.6\text{ mA}\cdot\text{s}}{110\text{ s}} \approx \mathbf{48.09\text{ mA}}$$
- **Expected Runtime**:
  $$T = \frac{2500\text{ mAh}}{48.09\text{ mA}} \approx \mathbf{52.0\text{ hours}} \quad (\approx \mathbf{2.17\text{ days}})$$

---

### B. Field Reliability Station: Light Sleep Lifecycle (10-minute probe interval)
Operating profile implemented in `firmware/src/main.cpp`:
- **Sleep interval**: 10 minutes (600 seconds), with ~596 seconds in Light Sleep (1.91 mA).
- **Active probe**: ~4 seconds of Wi-Fi association, DHCP, and HTTP pings (~120–150 mA, avg 125 mA).
- **Daily upload**: 1 transmission per day (~10 seconds at 150 mA).

**Daily Charge Calculation**:
1. Active Probes (144 times/day):
   $$144 \times 4\text{ s} \times 125\text{ mA} = 72,000\text{ mA}\cdot\text{s} = 20.0\text{ mAh/day}$$
2. Daily Batch Upload:
   $$1 \times 10\text{ s} \times 150\text{ mA} = 1,500\text{ mA}\cdot\text{s} \approx 0.42\text{ mAh/day}$$
3. Light Sleep Quiescent (remaining ~23.83 hours):
   $$23.83\text{ h} \times 1.91\text{ mA} \approx 45.52\text{ mAh/day}$$
4. **Total Daily Consumption**:
   $$Q_{\text{day}} = 20.0 + 0.42 + 45.52 = \mathbf{65.94\text{ mAh/day}} \quad (I_{\text{avg}} \approx 2.75\text{ mA})$$
5. **Expected Station Runtime**:
   $$\mathbf{T = \frac{2500\text{ mAh}}{65.94\text{ mAh/day}} \approx 37.9\text{ days}} \quad (\approx \mathbf{5.4\text{ weeks}})$$

---

### C. Field Reliability Station: Deep Sleep Mode (Alternative Profile)
If the station is configured to use Deep Sleep (`0.17 mA`) instead of Light Sleep:
- Daily sleep quiescent: $23.83\text{ h} \times 0.17\text{ mA} \approx 4.05\text{ mAh/day}$.
- Cold-boot overhead adds ~1 extra second per wake ($144 \times 5\text{s} \times 125\text{ mA} \approx 25.0\text{ mAh/day}$).
- **Total Daily Consumption**:
  $$Q_{\text{day}} = 25.0 + 0.42 + 4.05 = \mathbf{29.47\text{ mAh/day}} \quad (I_{\text{avg}} \approx 1.23\text{ mA})$$
- **Expected Station Runtime**:
  $$\mathbf{T = \frac{2500\text{ mAh}}{29.47\text{ mAh/day}} \approx 84.8\text{ days}} \quad (\approx \mathbf{2.8\text{ months}})$$

---

### D. Standby Shelf Life (No Wakeups)
- **Pure Light Sleep** (1.91 mA):
  $$\frac{2500\text{ mAh}}{1.91\text{ mA}} \approx \mathbf{1,309\text{ hours}} \quad (\approx \mathbf{54.5\text{ days}})$$
- **Pure Deep Sleep** (0.17 mA):
  $$\frac{2500\text{ mAh}}{0.17\text{ mA}} \approx \mathbf{14,705\text{ hours}} \quad (\approx \mathbf{612\text{ days}} \ / \ \mathbf{1.67\text{ years}})$$

---

## Hardware Pinout Quick Reference

| Function | Pin | Notes |
|---|---|---|
| **Blue LED** | `IO5` | Active HIGH (`digitalWrite(5, HIGH)`) |
| **Battery Divider** | `IO35` | ADC1 Channel 7 (Input only); $V_{\text{bat}} = 2.0 \times V_{\text{pin}}$ |
| **Boot Button** | `IO0` | Active LOW; internally pulled up |
| **Reset Button** | `EN` | Hardware power enable/reset |
| **Charge IC** | TP5400 | Li-ion charger & step-down regulator |
