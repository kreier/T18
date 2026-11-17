// flynn0/T18 - ESP32 Wi-Fi Monitoring Node
// Arduino IDE Sketch Entry Point
// Version: 1.0.4

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "1.0.4"
#endif

#include "../include/app_main.h"

void setup() {
    app_setup();
}

void loop() {
    app_loop();
}
