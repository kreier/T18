# ADR 0007: In-Browser Web Serial Flashing and 2.4 GHz Bluetooth Telemetry

## Status
Accepted

## Date
2026-11-16

## Context
The `flynn0/T18` telemetry fleet monitor previously required operators to install desktop toolchains (PlatformIO or Arduino IDE) or set up Python with `esptool.py` to flash the ESP32 firmware onto TTGO T18, T8, or DevKit nodes. Furthermore, 2.4 GHz RF contention from non-Wi-Fi devices (smartphones, audio headsets, beacons, wearables) was invisible to the telemetry pipeline.

## Decision

### 1. In-Browser Web Serial Firmware Installer
- Integrated **ESP Web Tools** (`<esp-web-install-button>`) into `worker/src/frontend.ts` and static dashboard.
- Serves `manifest.json` and firmware binaries directly from `/manifest.json` and `/firmware/*` with CORS enabled.
- Pre-compiled binaries for bootloader (0x1000), partitions (0x8000), otadata (0xe000), and application firmware (0x10000), as well as a single merged binary (`firmware-esp32-merged.bin`) for simple one-command flashing.
- Deep links `/flash` and `/?flash=1` allow operators to launch the modal directly.

### 2. Dual-Stack Bluetooth (BLE & Classic) Spectrum Scanning
- Integrated `BluetoothScanner` (`firmware/include/bluetooth_scanner.h`) running sequentially after Wi-Fi channel analysis and spectrum scan.
- De-randomizes Resolvable Private Addresses (RPA) through advertising payload TLV fingerprinting (Apple Find My/AirTag, iBeacon, Eddystone, Tile, Samsung/Google continuity).
- Tracks unique devices, public vs random MACs, beacons, smartphones, audio, and wearables.

### 3. Edge Database & Migration (0010)
- Added `station_bluetooth_summary` and `station_latest_bluetooth` tables to Cloudflare D1.
- Telemetry ingestion in `telemetry.ts` automatically parses and indexes Bluetooth cycle payloads.
- Added 30-day retention cleanup in `cron.ts`.

### 4. Backup Internet Uplink & LED Scan Feedback
- Nodes support configurable backup internet uplink (e.g. "S24") for offline telemetry dump when primary monitored networks have no WAN connectivity.
- Visual LED feedback dwells solid during channel analysis and blinks off during transitions.
- Non-blocking BOOT button monitoring during 13-channel survey allows immediate launch of Soft-AP setup portal without waiting.

## Consequences
- Zero-install browser commissioning removes friction from onboarding new T18 nodes.
- Full 2.4 GHz spectrum visibility correlating RF contention with Wi-Fi and Bluetooth presence.
- Parity between Cloudflare Edge Worker SSR and GitHub Pages static mirror.
