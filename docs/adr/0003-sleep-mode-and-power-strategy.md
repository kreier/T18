# ADR 0003: Light Sleep Mode and Power Strategy

## Status
Accepted (Updated)

## Context
The T18 board (LILYGO T-Energy v3.0) is powered by a single 18650 Li-ion battery paired with a TP5400 charge/boost IC.
The station operates autonomously in field locations, waking up every 10 minutes (configurable) to probe network availability, record telemetry, and sleep between cycles.

The station lifecycle requires:
1. **Zero Cold-Boot Re-entry on Periodic Wake**: The station must NOT re-enter configuration Soft-AP mode when waking from its 10-minute sleep.
2. **Clock Continuity**: The internal system clock (`millis()` and POSIX time) must continue advancing during sleep to maintain accurate interval pacing and timestamp offsets.
3. **RAM Retention**: Operational buffers, pending spool queues, and unsynced epoch offsets must remain intact in RAM without requiring complex flash deserialization on every wake.

## Decision
We select **Light Sleep (`esp_light_sleep_start()`)** as the sleep mechanism for the T18 monitoring station:

1. **Execution Model**:
   - `setup()` executes **only once** on cold boot (fresh battery insertion or physical reset).
   - During `setup()`, the ESP32 starts the 60-second Soft-AP configuration portal.
   - Once configuration is complete (or after the 60s timeout expires with no client connected), execution enters `loop()`.
   - At the end of each measurement cycle, the firmware sets the timer wakeup (`esp_sleep_enable_timer_wakeup(interval_us)`) and invokes `esp_light_sleep_start()`.
   - On wake, CPU execution resumes immediately after `esp_light_sleep_start()` in `loop()`. The processor does not restart, and `setup()` / Soft-AP mode is completely bypassed.

2. **Power & Hardware Configuration**:
   - Before sleep, Wi-Fi is powered down cleanly via `WiFi.disconnect(true)` and `WiFi.mode(WIFI_OFF)`, and the RF synthesizer is stopped to reduce power draw.
   - Status LED (`IO5`) is turned off.
   - Current consumption during light sleep with RF off drops to approximately 0.8 mA – 1.2 mA on the ESP32 chip.
   - With a 3,000–3,500 mAh 18650 cell, expected battery life is **1.5 to 2.5 months** of continuous unattended operation, with zero re-initialization overhead per cycle.

3. **Timekeeping**:
   - The ESP32 High-Resolution Timer (`esp_timer_get_time()`) and `millis()` continue advancing during light sleep via the internal RTC slow clock.
   - If internet access is unavailable upon cold start, measurements are indexed using relative `millis()` ticks. When NTP synchronization succeeds (via a monitored network or fallback hotspot), all pending records are retroactively converted to Unix epoch timestamps.

## Consequences
### Positive
- Zero risk of launching Soft-AP mode during routine measurement wakeups.
- State, connection counters, and pending telemetry queues stay retained in memory.
- Seamless timekeeping continuity across sleep cycles without external RTC hardware.

### Negative
- Higher quiescent current draw (~1 mA) compared to deep sleep (~15 µA), giving ~2 months of runtime instead of 6–12 months. Battery replacements or solar top-ups will be required every 6–8 weeks.
