// TTGO T18 (ESP32) status page
// - Connects to WiFi, reachable as http://T18.local/ (and by its IP)
// - Shows uptime, 18650 battery voltage and WiFi signal strength / quality
//
// Hardware:
//   Blue LED        : IO5
//   Battery divider : 100k / 100k from battery+ to GND, midpoint on IO35
//
// Board in Arduino IDE: "ESP32 Dev Module" (esp32 core 2.x or 3.x)

#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebServer.h>

const char* WIFI_SSID     = "your-ssid";      // <-- fill in later
const char* WIFI_PASSWORD = "your-password";  // <-- fill in later
const char* HOSTNAME      = "T18";

const int LED_PIN = 5;    // blue LED
const int BAT_PIN = 35;   // battery voltage divider (input only pin)

const float DIVIDER_RATIO = 2.0;  // 100k/100k -> Vbat = 2 * Vpin
const int   ADC_SAMPLES   = 16;

WebServer server(80);

// ---------- helpers ----------

float readBatteryVoltage() {
  uint32_t sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogReadMilliVolts(BAT_PIN);  // calibrated millivolts at the pin
    delay(2);
  }
  float pin_mV = sum / (float)ADC_SAMPLES;
  return pin_mV * DIVIDER_RATIO / 1000.0;
}

// Rough battery percentage for a single Li-ion cell (3.0 V empty, 4.2 V full)
int batteryPercent(float v) {
  int p = (int)((v - 3.0) / (4.2 - 3.0) * 100.0 + 0.5);
  return constrain(p, 0, 100);
}

// Common mapping: -50 dBm or better = 100 %, -100 dBm or worse = 0 %
int rssiToQuality(int rssi) {
  return constrain(2 * (rssi + 100), 0, 100);
}

String uptimeString(uint64_t seconds) {
  uint32_t d = seconds / 86400;
  uint32_t h = (seconds % 86400) / 3600;
  uint32_t m = (seconds % 3600) / 60;
  uint32_t s = seconds % 60;
  char buf[40];
  snprintf(buf, sizeof(buf), "%ud %02uh %02um %02us", d, h, m, s);
  return String(buf);
}

// ---------- web handlers ----------

const char PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>T18 Status</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           margin: 0; padding: 2rem; background: #0f172a; color: #f8fafc; }
    .card { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px;
            padding: 1.5rem 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    h1 { margin-top: 0; font-size: 1.5rem; color: #38bdf8; }
    dl { display: grid; grid-template-columns: 1fr 1fr; row-gap: 0.75rem; margin: 1.5rem 0 0; }
    dt { color: #94a3b8; font-weight: 500; }
    dd { margin: 0; font-weight: 600; text-align: right; }
    .bar-bg { grid-column: span 2; background: #334155; border-radius: 6px; height: 10px;
              overflow: hidden; margin-top: -0.25rem; margin-bottom: 0.5rem; }
    .bar-fill { height: 100%; background: #38bdf8; transition: width 0.3s; }
    .footer { margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TTGO T18 &middot; Status</h1>
    <dl>
      <dt>WiFi Network</dt><dd>%SSID%</dd>
      <dt>Signal (RSSI)</dt><dd>%RSSI% dBm (%SIGNAL%%%)</dd>
      <div class="bar-bg"><div class="bar-fill" style="width: %SIGNAL%%%"></div></div>

      <dt>Battery</dt><dd>%VBAT% V (%BAT_PCT%%%)</dd>
      <div class="bar-bg"><div class="bar-fill" style="width: %BAT_PCT%%%; background: %BAT_COLOR%;"></div></div>

      <dt>Uptime</dt><dd>%UPTIME%</dd>
      <dt>IP Address</dt><dd>%IP%</dd>
      <dt>Free Heap</dt><dd>%HEAP% KB</dd>
    </dl>
    <div class="footer">Refreshes every 5 seconds &middot; LED on IO5 toggles on request</div>
  </div>
  <script>setTimeout(() => location.reload(), 5000);</script>
</body>
</html>
)HTML";

void handleRoot() {
  digitalWrite(LED_PIN, HIGH);

  float vbat   = readBatteryVoltage();
  int bat_pct  = batteryPercent(vbat);
  int rssi     = WiFi.RSSI();
  int sig_pct  = rssiToQuality(rssi);
  String uptime = uptimeString(esp_timer_get_time() / 1000000ULL);

  const char* bat_color = bat_pct > 50 ? "#4ade80" : (bat_pct > 20 ? "#facc15" : "#f87171");

  String html = PAGE;
  html.replace("%SSID%",      WiFi.SSID());
  html.replace("%RSSI%",      String(rssi));
  html.replace("%SIGNAL%",    String(sig_pct));
  html.replace("%VBAT%",      String(vbat, 2));
  html.replace("%BAT_PCT%",   String(bat_pct));
  html.replace("%BAT_COLOR%", bat_color);
  html.replace("%UPTIME%",    uptime);
  html.replace("%IP%",        WiFi.localIP().toString());
  html.replace("%HEAP%",      String(ESP.getFreeHeap() / 1024));

  server.send(200, "text/html", html);
  digitalWrite(LED_PIN, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  analogReadResolution(12);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  if (MDNS.begin(HOSTNAME)) {
    Serial.printf("mDNS responder started: http://%s.local/\n", HOSTNAME);
  }

  server.on("/", handleRoot);
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  delay(2);
}
