# ADR 0003: Light Sleep Mode and Power Strategy

## Status
Accepted (Updated with Empirical Measurements)

## Context
The T18 board (LILYGO T-Energy v3.0) is powered by a single 18650 Li-ion battery (rated 2500 mAh) paired with a TP5400 charge/boost IC and 3.3V LDO.
The station operates autonomously in field locations, waking up every 10 minutes to probe network availability, record telemetry, and sleep between cycles.

Empirical current measurements conducted on the TTGO T18 board hardware yield:
- **Active (CPU 240MHz, Wi-Fi off, LED on)**: 45.10 mA
- **Active Wi-Fi Scanning (LED flashing)**: 150.00 mA
- **Wi-Fi off (LED on)**: 44.90 mA
- **Light Sleep (`esp_light_sleep_start()`, LED off)**: **1.91 mA**
- **Deep Sleep (`esp_deep_sleep_start()`, LED off)**: **0.17 mA** (170 µA)

The station lifecycle requires:
1. **Zero Cold-Boot Re-entry on Periodic Wake**: The station must NOT re-enter configuration Soft-AP mode when waking from its 10-minute sleep.
2. **Clock Continuity**: The internal system clock (`millis()` and POSIX time) must continue advancing during sleep to maintain accurate interval pacing and timestamp offsets.
3. **RAM Retention**: Operational buffers, pending spool queues, and unsynced epoch offsets must remain intact in RAM without requiring complex flash deserialization on every wake.

## Decision
We select **Light Sleep (`esp_light_sleep_start()`)** as the primary sleep mechanism for the T18 monitoring station:

1. **Execution Model**:
   - `setup()` executes **only once** on cold boot (fresh battery insertion or physical reset).
   - During `setup()`, the ESP32 starts the 60-second Soft-AP configuration portal.
   - Once configuration is complete (or after the 60s timeout expires with no client connected), execution enters `loop()`.
   - At the end of each measurement cycle, the firmware sets the timer wakeup (`esp_sleep_enable_timer_wakeup(interval_us)`) and invokes `esp_light_sleep_start()`.
   - On wake, CPU execution resumes immediately after `esp_light_sleep_start()` in `loop()`. The processor does not restart, and `setup()` / Soft-AP mode is completely bypassed.

2. **Power & Hardware Configuration**:
   - Before sleep, Wi-Fi is powered down cleanly via `WiFi.disconnect(true)` and `WiFi.mode(WIFI_OFF)`.
   - Status LED (`IO5`) is turned off.
   - Quiescent current during Light Sleep is **1.91 mA**.
   - With a standard 2500 mAh 18650 cell waking every 10 minutes for a 4-second probe (~125 mA active) and 1 daily batch upload, daily consumption is approximately **65.9 mAh/day** ($I_{\text{avg}} \approx 2.75\text{ mA}$).
   - **Expected Battery Runtime**: **~38 days (~5.5 weeks)** of continuous unattended operation, with zero re-initialization overhead per cycle.

3. **Timekeeping**:
   - The ESP32 High-Resolution Timer (`esp_timer_get_time()`) and `millis()` continue advancing during light sleep via the internal RTC slow clock.
   - If internet access is unavailable upon cold start, measurements are indexed using relative `millis()` ticks. When NTP synchronization succeeds (via a monitored network or fallback hotspot), all pending records are retroactively converted to Unix epoch timestamps.

## Comparison: Light Sleep vs. Deep Sleep (2500 mAh Battery)

| Parameter | Light Sleep (`esp_light_sleep_start`) | Deep Sleep (`esp_deep_sleep_start`) |
|:---|:---:|:---:|
| **Sleep Quiescent Current** | **1.91 mA** | **0.17 mA** (170 µA) |
| **RAM Retention** | Full memory retained | Powered off (RTC memory only) |
| **Wakeup Overhead** | Immediate (0 ms delay, resumes loop) | Cold boot (~500 ms - 1 s reboot) |
| **AP Mode Inadvertent Trigger** | None (bypasses `setup()`) | Requires reset reason guard |
| **Average Daily Current** (10-min interval) | ~2.75 mA | ~1.23 mA |
| **Expected Station Runtime** (2500 mAh) | **~38 days (~5.5 weeks)** | **~85 days (~2.8 months)** |
| **Pure Sleep Shelf Life** (no wakeups) | **54.5 days** | **612 days (~1.67 years)** |

## Consequences
### Positive
- Zero risk of launching Soft-AP mode during routine measurement wakeups.
- State, connection counters, and pending telemetry queues stay retained in memory.
- Seamless timekeeping continuity across sleep cycles without external RTC hardware.

### Negative
- Higher quiescent current draw (1.91 mA vs. 0.17 mA), giving ~5.5 weeks of autonomy instead of ~12 weeks. Battery replacements or recharging will be required approximately every 5–6 weeks.
