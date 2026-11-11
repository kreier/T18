// TTGO T18 (ESP32) Power Consumption Profiler
//
// Cycle sequence for measuring current draw across power states:
// 1. ESP Active (CPU on, Wi-Fi off, LED on)                 : 20 seconds (~45-55 mA)
// 2. Wi-Fi Active Scan (Wi-Fi on scanning, LED flashing)    : 20 seconds (~110-180 mA)
// 3. Radio Off (Wi-Fi off, CPU on, LED on)                  : 20 seconds (~45-55 mA)
// 4. Light Sleep (CPU & Wi-Fi paused, RAM on, LED off)      : 20 seconds (~1.5-2.5 mA)
// 5. Active Resume (Woken from light sleep, LED on)         : 10 seconds (~45-55 mA)
// 6. Deep Sleep (CPU & RAM off, ULP/RTC only, LED off)      : 20 seconds (~0.1-0.2 mA)
// -> Wake from Deep Sleep resets MCU and repeats from Phase 1.
//
// Hardware:
//   Blue LED        : IO5
//   Battery Divider : 100k / 100k to IO35 (multiplier 2.0)
//
// Board in Arduino IDE: "ESP32 Dev Module"

#include <Arduino.h>
#include <WiFi.h>
#include <esp_sleep.h>

const int LED_PIN = 5;
const int BAT_PIN = 35;

float readBatteryVoltage() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogReadMilliVolts(BAT_PIN);
    delay(2);
  }
  return (sum / 16.0f) * 2.0f / 1000.0f;
}

void printCountdown(int seconds, const char* label) {
  for (int i = seconds; i > 0; i--) {
    Serial.printf("  [%s] %2d s remaining...\n", label, i);
    delay(1000);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BAT_PIN, INPUT);
  analogReadResolution(12);

  // Turn Wi-Fi off at cold boot
  WiFi.mode(WIFI_OFF);

  Serial.println("\n==================================================");
  Serial.println("   TTGO T18 ESP32 Power Consumption Benchmark    ");
  Serial.println("==================================================");
  Serial.printf("Battery Voltage: %.2f V\n", readBatteryVoltage());
  Serial.printf("Reset Reason   : %d\n\n", (int)esp_reset_reason());
}

void loop() {
  // -------------------------------------------------------------------------
  // Phase 1: 20 seconds with ESP active and LED constantly ON (Wi-Fi OFF)
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 1/6] ESP Active (Wi-Fi OFF, LED ON) for 20 seconds");
  digitalWrite(LED_PIN, HIGH);
  printCountdown(20, "Phase 1 - Active, LED ON");

  // -------------------------------------------------------------------------
  // Phase 2: 20 seconds with Wi-Fi active scanning while LED is flashing
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 2/6] Wi-Fi Scanning (LED Flashing) for 20 seconds");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  unsigned long phase2Start = millis();
  unsigned long lastToggle = 0;
  bool ledState = false;

  while (millis() - phase2Start < 20000) {
    // Trigger non-blocking Wi-Fi scan
    Serial.println("  Starting Wi-Fi scan...");
    int n = WiFi.scanNetworks(false, true); // synchronous scan
    Serial.printf("  Scan complete: found %d networks\n", n);
    WiFi.scanDelete();

    // Flash LED while waiting for next scan cycle
    unsigned long scanPause = millis();
    while (millis() - scanPause < 1000 && (millis() - phase2Start < 20000)) {
      if (millis() - lastToggle >= 150) {
        lastToggle = millis();
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      }
      delay(10);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: 20 seconds with Wi-Fi OFF and LED constantly ON
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 3/6] Wi-Fi OFF (LED ON) for 20 seconds");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  digitalWrite(LED_PIN, HIGH);
  printCountdown(20, "Phase 3 - Wi-Fi OFF, LED ON");

  // -------------------------------------------------------------------------
  // Phase 4: 20 seconds LED OFF and Light Sleep
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 4/6] Light Sleep (LED OFF, Wi-Fi OFF) for 20 seconds");
  digitalWrite(LED_PIN, LOW);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(20ULL * 1000000ULL); // 20 seconds in microseconds
  esp_light_sleep_start();

  // -------------------------------------------------------------------------
  // Phase 5: 10 seconds back on machine and LED constantly ON
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 5/6] Resumed from Light Sleep (LED ON) for 10 seconds");
  digitalWrite(LED_PIN, HIGH);
  printCountdown(10, "Phase 5 - Resumed Active, LED ON");

  // -------------------------------------------------------------------------
  // Phase 6: 20 seconds Deep Sleep (LED OFF)
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 6/6] Deep Sleep (LED OFF) for 20 seconds");
  Serial.println("  Entering deep sleep. MCU will reset and repeat from Phase 1 on wake.");
  digitalWrite(LED_PIN, LOW);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(20ULL * 1000000ULL); // 20 seconds in microseconds
  esp_deep_sleep_start();

  // Execution never reaches here; deep sleep wake restarts from setup()
}
