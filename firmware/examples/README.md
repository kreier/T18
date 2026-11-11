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

### Cycle Sequence:
| Phase | Duration | State | LED (`IO5`) | Wi-Fi State | Expected Current (3.7V - 4.2V) |
|---|---|---|---|---|---|
| **Phase 1** | 20 seconds | Active (CPU 240MHz) | **ON** (solid) | Radio OFF | ~45 – 55 mA |
| **Phase 2** | 20 seconds | Active Wi-Fi Scanning | **Flashing** (150ms) | Scanning 2.4GHz | ~110 – 180 mA (spikes to ~250mA) |
| **Phase 3** | 20 seconds | Radio Disabled | **ON** (solid) | Radio OFF | ~45 – 55 mA |
| **Phase 4** | 20 seconds | **Light Sleep** | **OFF** | Radio OFF | ~1.5 – 2.5 mA |
| **Phase 5** | 10 seconds | Resumed Active | **ON** (solid) | Radio OFF | ~45 – 55 mA |
| **Phase 6** | 20 seconds | **Deep Sleep** | **OFF** | Powered Down | ~0.1 – 0.2 mA (100–150 µA) |

### Notes:
- After Phase 6 (Deep Sleep), the ESP32 timer fires, causing a clean reset back to `setup()`, which automatically repeats the cycle starting from Phase 1.
- Serial output is provided at **115200 baud** with countdown timers for each phase.

---

## Hardware Pinout Quick Reference

| Function | Pin | Notes |
|---|---|---|
| **Blue LED** | `IO5` | Active HIGH (`digitalWrite(5, HIGH)`) |
| **Battery Divider** | `IO35` | ADC1 Channel 7 (Input only); $V_{\text{bat}} = 2.0 \times V_{\text{pin}}$ |
| **Boot Button** | `IO0` | Active LOW; internally pulled up |
| **Reset Button** | `EN` | Hardware power enable/reset |
| **Charge IC** | TP5400 | Li-ion charger & step-down regulator |
