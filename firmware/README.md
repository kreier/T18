# T18 Station Firmware

Firmware for TTGO T18 (ESP32 T-Energy v3.0) battery-powered Wi-Fi reliability station.

## Features
- **Cold Boot Soft-AP Mode**: Starts captive portal AP for 60 seconds on cold boot; remains on if connected by user until reboot.
- **Web Configuration Portal**:
  - Scan local 2.4 GHz Wi-Fi networks.
  - Set station name (e.g. `C-703`).
  - Configure monitored SSIDs and passwords.
  - Configure emergency/fallback Wi-Fi (e.g. `S24` mobile hotspot) for daily synchronization.
  - Set measurement interval (default: 10 minutes).
- **Probing Engine**:
  - Accurate millisecond benchmark of Wi-Fi Association time.
  - DHCP lease acquisition time measurement.
  - Response time and HTTP code measurement for Google, Fast.com, 1.1.1.1, and Cloudflare.
  - Battery voltage sampling on `IO35`.
- **Low Power Sleep**:
  - Enters deep sleep / light sleep between measurement cycles.
  - Spools telemetry into LittleFS non-volatile memory.
- **Daily Ingestion Sync**:
  - Connects to primary or fallback Wi-Fi once per day.
  - Syncs internal RTC via SNTP.
  - Posts pending telemetry batch to Cloudflare Worker.

## Pin Assignment
- **IO5**: Blue LED
- **IO35**: Battery Voltage Divider (100k/100k to GND, factor 2.0x)
- **EN**: Reset
- **IO0**: BOOT button (hold down during boot to force Soft-AP mode)

## Build & Flash
### Using PlatformIO:
```bash
pio run -t upload
```

### Using Arduino IDE:
1. Select Board: "ESP32 Dev Module"
2. Upload Speed: 115200 or 921600
3. Flash Size: 4MB
4. Partition Scheme: "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)" or "No OTA (2MB APP/2MB SPIFFS)"
