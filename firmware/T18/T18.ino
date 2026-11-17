// flynn0/T18 - ESP32 Wi-Fi Monitoring Node
// Arduino IDE Sketch Entry Point
// Version: 1.1.0
//
// Single Unified ESP32 Firmware:
// Hardware target (T18, T8, DevKit V1, Custom) is dynamically selected
// on first boot in the Captive Portal and persisted to NVS.
// Default hardware is LILYGO T18 (LED: GPIO 5, Battery: GPIO 35).
//
// In Arduino IDE:
// Tools -> Partition Scheme -> "Minimal SPIFFS (Large APPS with OTA)"

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "1.1.0"
#endif

#include "../include/app_main.h"

void setup() {
    app_setup();
}

void loop() {
    app_loop();
}
