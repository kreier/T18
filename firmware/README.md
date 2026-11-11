# T18 Station Firmware

Autonomous Wi-Fi reliability monitoring station firmware for the **LilyGo TTGO T18 (T-Energy v3.0)** ESP32 board.

---

## What Software to Upload to the T18?

Upload the main firmware source code located at:
👉 **[`firmware/src/main.cpp`](src/main.cpp)**

### Key Capabilities Included:
1. **Cold-Boot Configuration Portal**:
   - Launches an open Soft-AP (`T18-Setup-XXXX`) on `192.168.4.1` for 60 seconds.
   - If you connect with a smartphone or laptop, the timeout is canceled, allowing you to configure station name, monitored networks, fallback Wi-Fi (`S24`), interval, and Cloudflare Worker URL.
   - Settings are committed to LittleFS (`/config.json`).
2. **Light Sleep Lifecycle**:
   - Wakes every 10 minutes (configurable), retaining memory and clock continuity.
   - Bypasses Soft-AP entirely on routine measurement wakes.
3. **Sequential Probing Engine**:
   - Wi-Fi association speed benchmark (15s timeout).
   - DHCP lease acquisition speed benchmark (10s timeout).
   - Latency to 4 HTTP targets (3s timeout each): `1.1.1.1`, Google, Fast.com, Cloudflare.
   - Battery voltage and percentage sampling via `IO35` divider.
4. **Hourly Live Heartbeat (Cloudflare KV)**:
   - Once per hour, sends live telemetry (`POST /heartbeat`) containing battery voltage, signal strength (RSSI), status, and number of visible 2.4 GHz networks.
5. **Daily Batch Upload & Fallback Network**:
   - Once per day (19:00–21:00 UTC / 02:00–04:00 Vietnam time), posts all buffered 24h records to Cloudflare Worker.
   - Automatically switches to the fallback network (`S24`) if the monitored network fails.

---

## Flashing Instructions

### Option 1: PlatformIO (Recommended)
1. Install [PlatformIO IDE](https://platformio.org/) in VS Code or CLI.
2. Connect TTGO T18 via micro-USB.
3. Build and upload:
   ```bash
   pio run -t upload
   pio device monitor
   ```

### Option 2: Arduino IDE
1. Open Arduino IDE (v2.x recommended).
2. Install the **ESP32** board package (`esp32` by Espressif Systems) via Boards Manager.
3. Install **ArduinoJson** (v7.x) via Library Manager.
4. Open or copy `firmware/src/main.cpp` into a sketch folder `firmware/src/src.ino` (or rename to match folder name).
5. Configure board settings under **Tools**:
   - **Board**: `ESP32 Dev Module`
   - **Upload Speed**: `921600` (or `115200`)
   - **Flash Frequency**: `80MHz`
   - **Partition Scheme**: `Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)` or `No OTA (2MB APP/2MB SPIFFS)`
   - **Port**: Select the USB serial port (e.g., `/dev/ttyUSB0` or `COMx`)
6. Click **Upload**.

---

## Initial Field Setup (First Boot)

1. Insert 18650 battery or plug in USB.
2. The blue LED (`IO5`) will light up briefly as Soft-AP starts.
3. On your phone or laptop, connect to Wi-Fi network: **`T18-Setup-XXXX`**.
4. Open browser to **`http://192.168.4.1/`** (or wait for captive portal prompt).
5. Enter:
   - **Station ID**: e.g., `C-703`
   - **Monitored Wi-Fi SSID & Password**
   - **Fallback Wi-Fi SSID & Password**: e.g., `S24` / `12345678`
   - **Cloudflare Worker Ingest URL**: `https://<your-worker>.workers.dev/ingest`
   - **Device Bearer Token**: Match your `AUTH_TOKEN` secret in Cloudflare.
6. Click **Save & Reboot Station**.
7. The station will reboot, begin measuring every 10 minutes, and enter light sleep between cycles.
