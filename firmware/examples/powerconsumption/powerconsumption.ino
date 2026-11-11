// TTGO T18 (ESP32) Power Consumption Profiler
//
// Cycle sequence and empirical current measurements (TTGO T18 v3.0, TP5400, 3.7V - 4.2V):
// -----------------------------------------------------------------------------------------
// Phase 1 (20 s): ESP Active (CPU 240MHz, Wi-Fi off, LED on)    : 45.10 mA
// Phase 2 (20 s): Wi-Fi Active Scan (Wi-Fi on, LED flashing)    : 150.00 mA
// Phase 3 (20 s): Radio Off (Wi-Fi off, CPU on, LED on)         : 44.90 mA
// Phase 4 (20 s): Light Sleep (CPU & Wi-Fi paused, LED off)     :  1.91 mA
// Phase 5 (10 s): Active Resume (Woken from light sleep, LED on): 44.80 mA
// Phase 6 (20 s): Deep Sleep (CPU & RAM off, RTC only, LED off) :  0.17 mA (170 µA)
// -> Wake from Deep Sleep resets MCU and repeats from Phase 1.
// Total cycle duration: 110 seconds.
//
// Expected Runtime on a 2500 mAh 18650 Li-ion Battery:
// -----------------------------------------------------------------------------------------
// - Continuous Benchmark Cycle (110 s loop) : Avg 48.09 mA  -> ~52 hours (~2.2 days)
// - Field Station: Light Sleep (10 min wake): Avg  2.73 mA  -> ~38.2 days (~5.5 weeks)
// - Field Station: Deep Sleep (10 min wake) : Avg  1.19 mA  -> ~87.7 days (~2.9 months)
// - Pure Light Sleep Shelf Life (no wakeups):      1.91 mA  -> ~1,309 hours (~54.5 days)
// - Pure Deep Sleep Shelf Life  (no wakeups):      0.17 mA  -> ~14,705 hours (~612 days / 1.67 yrs)
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

void printCountdown(int seconds, const char* label, float current_mA) {
  for (int i = seconds; i > 0; i--) {
    Serial.printf("  [%s | ~%.2f mA] %2d s remaining...\n", label, current_mA, i);
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
  Serial.printf("Battery Voltage : %.2f V\n", readBatteryVoltage());
  Serial.printf("Reset Reason    : %d\n", (int)esp_reset_reason());
  Serial.println("Battery Capacity: 2500 mAh (18650 Li-ion)");
  Serial.println("Measured Profile: 45.1mA / 150mA / 44.9mA / 1.91mA / 44.8mA / 0.17mA\n");
}

void loop() {
  // -------------------------------------------------------------------------
  // Phase 1: 20 seconds with ESP active and LED constantly ON (Wi-Fi OFF)
  // Measured: 45.10 mA
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 1/6] ESP Active (Wi-Fi OFF, LED ON) - Measured: 45.1 mA");
  digitalWrite(LED_PIN, HIGH);
  printCountdown(20, "Phase 1 - Active, LED ON", 45.10f);

  // -------------------------------------------------------------------------
  // Phase 2: 20 seconds with Wi-Fi active scanning while LED is flashing
  // Measured: 150.00 mA
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 2/6] Wi-Fi Scanning (LED Flashing) - Measured: 150.0 mA");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  unsigned long phase2Start = millis();
  unsigned long lastToggle = 0;
  bool ledState = false;

  while (millis() - phase2Start < 20000) {
    Serial.println("  Starting Wi-Fi scan...");
    int n = WiFi.scanNetworks(false, true); // synchronous scan
    Serial.printf("  Scan complete: found %d networks (active draw ~150 mA)\n", n);
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
  // Measured: 44.90 mA
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 3/6] Wi-Fi OFF (LED ON) - Measured: 44.9 mA");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  digitalWrite(LED_PIN, HIGH);
  printCountdown(20, "Phase 3 - Wi-Fi OFF, LED ON", 44.90f);

  // -------------------------------------------------------------------------
  // Phase 4: 20 seconds LED OFF and Light Sleep
  // Measured: 1.91 mA
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 4/6] Light Sleep (LED OFF, Wi-Fi OFF) - Measured: 1.91 mA");
  digitalWrite(LED_PIN, LOW);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(20ULL * 1000000ULL); // 20 seconds in microseconds
  esp_light_sleep_start();

  // -------------------------------------------------------------------------
  // Phase 5: 10 seconds back on machine and LED constantly ON
  // Measured: 44.80 mA
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 5/6] Resumed from Light Sleep (LED ON) - Measured: 44.8 mA");
  digitalWrite(LED_PIN, HIGH);
  printCountdown(10, "Phase 5 - Resumed Active, LED ON", 44.80f);

  // -------------------------------------------------------------------------
  // Phase 6: 20 seconds Deep Sleep (LED OFF)
  // Measured: 0.17 mA (170 µA)
  // -------------------------------------------------------------------------
  Serial.println(">>> [Phase 6/6] Deep Sleep (LED OFF) - Measured: 0.17 mA (170 µA)");
  Serial.println("  Entering deep sleep. MCU will reset and repeat from Phase 1 on wake.");
  digitalWrite(LED_PIN, LOW);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(20ULL * 1000000ULL); // 20 seconds in microseconds
  esp_deep_sleep_start();

  // Execution never reaches here; deep sleep wake restarts from setup()
}
