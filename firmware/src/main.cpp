/**
 * T18 Network Reliability Monitor Firmware
 * Hardware: TTGO T18 (LilyGo T-Energy v3.0) ESP32
 *
 * Features:
 * - Cold-boot Soft-AP portal (60s timeout, canceled on client connection)
 * - Web configuration stored in LittleFS (/config.json)
 * - Light sleep cycle (default: 10 min) with clock continuity
 * - Sequential Wi-Fi association & DHCP benchmarking (15s / 10s timeouts)
 * - HTTP target latency probes (3s timeout): 1.1.1.1, Google, Fast.com, Cloudflare
 * - Hourly Live Heartbeat to Cloudflare Worker (battery, RSSI, status, visible networks count)
 * - Offline millis() buffering with retroactive NTP timestamp mapping
 * - Daily ingestion batch upload (19:00 - 21:00 UTC) with fallback network
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <time.h>
#include <esp_sleep.h>

// ---------- Hardware Pin Definitions ----------
static const int PIN_LED     = 5;   // Blue LED
static const int PIN_BATTERY = 35;  // Battery voltage divider (input-only ADC)
static const int PIN_BOOT    = 0;   // BOOT button

static const float BATTERY_DIVIDER_RATIO = 2.0f; // 100k / 100k
static const int   ADC_SAMPLES           = 16;

// Benchmarking Timeouts
static const unsigned long TIMEOUT_ASSOC_MS = 15000;
static const unsigned long TIMEOUT_DHCP_MS  = 10000;
static const unsigned long TIMEOUT_HTTP_MS  = 3000;

// ---------- Data Models & Structures ----------

// Target Latency Telemetry Model
struct TargetLatency {
  int google = -1;
  int fast = -1;
  int one_one_one_one = -1;
  int cloudflare = -1;
};

// Configuration Model
struct StationConfig {
  char station_id[32]        = "C-703";
  char monitored_ssid[32]    = "School-Guest";
  char monitored_pass[64]    = "";
  char fallback_ssid[32]     = "S24";
  char fallback_pass[64]     = "12345678";
  int  interval_min          = 10;
  char worker_url[128]       = "https://t18-telemetry-worker.workers.dev/ingest";
  char auth_token[64]        = "secret-station-token";
};

StationConfig config;

// State Tracking
static bool apModeActive          = false;
static bool clientConnectedOnce   = false;
static unsigned long apStartTime  = 0;
static bool ntpSynchronized       = false;
static time_t ntpBaseEpoch        = 0;
static unsigned long ntpBaseMillis = 0;
static int lastUploadDay          = -1;
static int lastHeartbeatHour      = -1;

// Web & DNS servers for AP mode
WebServer server(80);
DNSServer dnsServer;

// Forward Declarations (for Arduino IDE preprocessor compatibility)
void appendRecordToSpool(unsigned long epochSec, unsigned long relMillis, int rssi, int ch,
                        unsigned long assoc_ms, unsigned long dhcp_ms, const char* ip,
                        const TargetLatency& targets, int errMask, float vbat);
void sendHourlyHeartbeat(float vbat, int rssi, unsigned long assoc_ms, unsigned long dhcp_ms,
                         const TargetLatency& targets, int errMask, time_t epochSec);
void retroactivelyMapSpoolTimestamps();
int  probeHttpTarget(const char* url);

// ---------- Helper Functions ----------

float readBatteryVoltage() {
  uint32_t sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogReadMilliVolts(PIN_BATTERY);
    delay(2);
  }
  float pin_mV = sum / (float)ADC_SAMPLES;
  return pin_mV * BATTERY_DIVIDER_RATIO / 1000.0f;
}

int batteryPercent(float v) {
  int p = (int)((v - 3.0f) / (4.2f - 3.0f) * 100.0f + 0.5f);
  return constrain(p, 0, 100);
}

void loadConfig() {
  if (!LittleFS.begin(true)) {
    Serial.println("[FS] Failed to mount LittleFS");
    return;
  }

  if (!LittleFS.exists("/config.json")) {
    Serial.println("[FS] /config.json not found, using defaults");
    return;
  }

  File f = LittleFS.open("/config.json", "r");
  if (!f) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();

  if (!err) {
    strlcpy(config.station_id,     doc["station_id"]     | config.station_id,     sizeof(config.station_id));
    strlcpy(config.monitored_ssid, doc["monitored_ssid"] | config.monitored_ssid, sizeof(config.monitored_ssid));
    strlcpy(config.monitored_pass, doc["monitored_pass"] | config.monitored_pass, sizeof(config.monitored_pass));
    strlcpy(config.fallback_ssid,  doc["fallback_ssid"]  | config.fallback_ssid,  sizeof(config.fallback_ssid));
    strlcpy(config.fallback_pass,  doc["fallback_pass"]  | config.fallback_pass,  sizeof(config.fallback_pass));
    config.interval_min = doc["interval_min"] | config.interval_min;
    strlcpy(config.worker_url,     doc["worker_url"]     | config.worker_url,     sizeof(config.worker_url));
    strlcpy(config.auth_token,     doc["auth_token"]     | config.auth_token,     sizeof(config.auth_token));
    Serial.printf("[Config] Loaded station: %s, Monitored: %s\n", config.station_id, config.monitored_ssid);
  }
}

void saveConfig() {
  File f = LittleFS.open("/config.json", "w");
  if (!f) {
    Serial.println("[FS] Failed to open /config.json for writing");
    return;
  }

  JsonDocument doc;
  doc["station_id"]     = config.station_id;
  doc["monitored_ssid"] = config.monitored_ssid;
  doc["monitored_pass"] = config.monitored_pass;
  doc["fallback_ssid"]  = config.fallback_ssid;
  doc["fallback_pass"]  = config.fallback_pass;
  doc["interval_min"]   = config.interval_min;
  doc["worker_url"]     = config.worker_url;
  doc["auth_token"]     = config.auth_token;

  serializeJson(doc, f);
  f.close();
  Serial.println("[FS] Configuration saved");
}

// ---------- Soft-AP Web Configuration Portal ----------

const char PORTAL_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>T18 Setup</title>
  <style>
    body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .card { max-width: 500px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 12px; }
    h1 { margin-top: 0; font-size: 20px; color: #38bdf8; }
    label { display: block; margin-top: 14px; font-size: 13px; color: #94a3b8; }
    input, select { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 4px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 14px; }
    .btn { background: #0284c7; color: #fff; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; margin-top: 24px; cursor: pointer; }
    .btn:hover { background: #0369a1; }
    .info { font-size: 12px; color: #64748b; margin-top: 6px; }
    .vbat { background: #0f172a; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>T18 Station Setup</h1>
    <div class="vbat">Battery: <strong>%VBAT% V (%BAT_PCT%%)</strong></div>
    <form action="/save" method="POST">
      <label>Station ID / Location Name</label>
      <input type="text" name="station_id" value="%STATION_ID%" required>

      <label>Monitored Wi-Fi SSID</label>
      <input type="text" name="monitored_ssid" value="%MON_SSID%" required>

      <label>Monitored Wi-Fi Password</label>
      <input type="password" name="monitored_pass" value="%MON_PASS%">

      <label>Fallback Wi-Fi SSID (Emergency Sync)</label>
      <input type="text" name="fallback_ssid" value="%FB_SSID%" required>

      <label>Fallback Wi-Fi Password</label>
      <input type="password" name="fallback_pass" value="%FB_PASS%">

      <label>Probe Interval (Minutes)</label>
      <input type="number" name="interval_min" min="1" max="60" value="%INTERVAL%">

      <label>Cloudflare Worker Ingest URL</label>
      <input type="text" name="worker_url" value="%WORKER_URL%">

      <label>Device Bearer Token</label>
      <input type="password" name="auth_token" value="%AUTH_TOKEN%">

      <button type="submit" class="btn">Save & Reboot Station</button>
    </form>
    <div class="info">Settings are committed to LittleFS. Soft-AP remains active until reboot.</div>
  </div>
</body>
</html>
)HTML";

void handlePortalRoot() {
  float v = readBatteryVoltage();
  String html = PORTAL_HTML;
  html.replace("%VBAT%", String(v, 2));
  html.replace("%BAT_PCT%", String(batteryPercent(v)));
  html.replace("%STATION_ID%", config.station_id);
  html.replace("%MON_SSID%", config.monitored_ssid);
  html.replace("%MON_PASS%", config.monitored_pass);
  html.replace("%FB_SSID%", config.fallback_ssid);
  html.replace("%FB_PASS%", config.fallback_pass);
  html.replace("%INTERVAL%", String(config.interval_min));
  html.replace("%WORKER_URL%", config.worker_url);
  html.replace("%AUTH_TOKEN%", config.auth_token);
  server.send(200, "text/html", html);
}

void handlePortalSave() {
  if (server.hasArg("station_id"))     strlcpy(config.station_id,     server.arg("station_id").c_str(),     sizeof(config.station_id));
  if (server.hasArg("monitored_ssid")) strlcpy(config.monitored_ssid, server.arg("monitored_ssid").c_str(), sizeof(config.monitored_ssid));
  if (server.hasArg("monitored_pass")) strlcpy(config.monitored_pass, server.arg("monitored_pass").c_str(), sizeof(config.monitored_pass));
  if (server.hasArg("fallback_ssid"))  strlcpy(config.fallback_ssid,  server.arg("fallback_ssid").c_str(),  sizeof(config.fallback_ssid));
  if (server.hasArg("fallback_pass"))  strlcpy(config.fallback_pass,  server.arg("fallback_pass").c_str(),  sizeof(config.fallback_pass));
  if (server.hasArg("interval_min"))   config.interval_min = server.arg("interval_min").toInt();
  if (server.hasArg("worker_url"))     strlcpy(config.worker_url,     server.arg("worker_url").c_str(),     sizeof(config.worker_url));
  if (server.hasArg("auth_token"))     strlcpy(config.auth_token,     server.arg("auth_token").c_str(),     sizeof(config.auth_token));

  saveConfig();

  server.send(200, "text/html", "<html><body style='font-family:sans-serif;background:#0f172a;color:#38bdf8;padding:40px;text-align:center;'><h2>Settings Saved!</h2><p>Rebooting station now...</p></body></html>");
  delay(1000);
  ESP.restart();
}

void startSoftAP() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char apName[32];
  snprintf(apName, sizeof(apName), "T18-Setup-%02X%02X", mac[4], mac[5]);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName);
  delay(100);

  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", handlePortalRoot);
  server.on("/save", HTTP_POST, handlePortalSave);
  server.onNotFound([]() {
    server.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
    server.send(302, "text/plain", "");
  });
  server.begin();

  apModeActive = true;
  apStartTime  = millis();
  Serial.printf("[AP] Started Soft-AP '%s' on %s (60s timeout)...\n", apName, WiFi.softAPIP().toString().c_str());
}

// ---------- Telemetry Benchmark & Spooling ----------

int probeHttpTarget(const char* url) {
  HTTPClient http;
  http.setTimeout(TIMEOUT_HTTP_MS);
  unsigned long t0 = millis();
  if (!http.begin(url)) return -1;
  int code = http.GET();
  unsigned long elapsed = millis() - t0;
  http.end();
  return (code > 0) ? (int)elapsed : -1;
}

void appendRecordToSpool(unsigned long epochSec, unsigned long relMillis, int rssi, int ch,
                        unsigned long assoc_ms, unsigned long dhcp_ms, const char* ip,
                        const TargetLatency& targets, int errMask, float vbat) {
  File f = LittleFS.open("/spool/pending.jsonl", "a");
  if (!f) return;

  JsonDocument doc;
  doc["t"]       = epochSec;
  doc["rel_ms"]  = relMillis;
  doc["synced"]  = ntpSynchronized;
  doc["s"]       = config.monitored_ssid;
  doc["r"]       = rssi;
  doc["ch"]      = ch;
  doc["a_ms"]    = assoc_ms;
  doc["d_ms"]    = dhcp_ms;
  doc["ip"]      = ip;
  doc["g_ms"]    = targets.google;
  doc["f_ms"]    = targets.fast;
  doc["dns_ms"]  = targets.one_one_one_one;
  doc["cf_ms"]   = targets.cloudflare;
  doc["err"]     = errMask;
  doc["vbat"]    = (int)(vbat * 1000.0f);

  serializeJson(doc, f);
  f.println();
  f.close();
}

void syncNTP() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    time_t now = time(nullptr);
    if (now > 1000000000) {
      ntpSynchronized = true;
      ntpBaseEpoch    = now;
      ntpBaseMillis   = millis();
      Serial.printf("[NTP] Clock synchronized: %ld UTC\n", (long)now);

      retroactivelyMapSpoolTimestamps();
    }
  }
}

void retroactivelyMapSpoolTimestamps() {
  if (!LittleFS.exists("/spool/pending.jsonl")) return;

  File readFile = LittleFS.open("/spool/pending.jsonl", "r");
  if (!readFile) return;

  File tempFile = LittleFS.open("/spool/temp.jsonl", "w");
  if (!tempFile) { readFile.close(); return; }

  bool modified = false;
  while (readFile.available()) {
    String line = readFile.readStringUntil('\n');
    if (line.length() < 5) continue;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, line);
    if (!err) {
      if (!doc["synced"].as<bool>() && doc["t"].as<unsigned long>() == 0) {
        unsigned long rel_ms = doc["rel_ms"].as<unsigned long>();
        long diffSec = (long)((millis() - rel_ms) / 1000);
        time_t calcEpoch = ntpBaseEpoch - diffSec;
        doc["t"] = calcEpoch;
        doc["synced"] = true;
        modified = true;
      }
      serializeJson(doc, tempFile);
      tempFile.println();
    }
  }

  readFile.close();
  tempFile.close();

  if (modified) {
    LittleFS.remove("/spool/pending.jsonl");
    LittleFS.rename("/spool/temp.jsonl", "/spool/pending.jsonl");
    Serial.println("[NTP] Retroactively updated timestamps in spool file");
  } else {
    LittleFS.remove("/spool/temp.jsonl");
  }
}

// Send lightweight hourly heartbeat to Cloudflare Worker
void sendHourlyHeartbeat(float vbat, int rssi, unsigned long assoc_ms, unsigned long dhcp_ms,
                         const TargetLatency& targets, int errMask, time_t epochSec) {
  // Quick Wi-Fi scan to count visible networks
  int visible = WiFi.scanNetworks(false, true);
  WiFi.scanDelete();

  int totalLatency = 0;
  int countLatency = 0;
  if (targets.one_one_one_one > 0) { totalLatency += targets.one_one_one_one; countLatency++; }
  if (targets.google > 0)          { totalLatency += targets.google; countLatency++; }
  if (targets.fast > 0)            { totalLatency += targets.fast; countLatency++; }
  if (targets.cloudflare > 0)      { totalLatency += targets.cloudflare; countLatency++; }
  int avgLatency = countLatency > 0 ? (totalLatency / countLatency) : 0;

  const char* status = "green";
  if (errMask != 0) {
    status = (errMask == 1) ? "red" : "orange";
  } else if (avgLatency > 150) {
    status = "orange";
  } else if (assoc_ms > 4000 || dhcp_ms > 3000) {
    status = "purple";
  }

  // Derive heartbeat URL from worker_url (replace /ingest with /heartbeat)
  String hbUrl = config.worker_url;
  int idx = hbUrl.lastIndexOf('/');
  if (idx > 0) {
    hbUrl = hbUrl.substring(0, idx) + "/heartbeat";
  }

  JsonDocument doc;
  doc["station_id"]           = config.station_id;
  doc["timestamp"]            = epochSec;
  doc["battery_mv"]           = (int)(vbat * 1000.0f);
  doc["battery_pct"]          = batteryPercent(vbat);
  doc["rssi"]                 = rssi;
  doc["visible_networks"]     = visible;
  doc["status"]               = status;
  doc["last_assoc_ms"]        = assoc_ms;
  doc["last_dhcp_ms"]         = dhcp_ms;
  doc["last_http_latency_ms"] = avgLatency;

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.setTimeout(4000);
  http.begin(hbUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + config.auth_token);

  int code = http.POST(payload);
  http.end();
  Serial.printf("[Heartbeat] Sent hourly ping to %s -> HTTP %d (networks: %d, battery: %.2fV)\n",
                hbUrl.c_str(), code, visible, vbat);
}

void runMeasurement() {
  digitalWrite(PIN_LED, HIGH);
  float vbat = readBatteryVoltage();
  Serial.printf("[Probe] Battery: %.2fV (%d%%)\n", vbat, batteryPercent(vbat));

  WiFi.mode(WIFI_STA);
  unsigned long t0 = millis();
  WiFi.begin(config.monitored_ssid, config.monitored_pass);

  unsigned long assoc_ms = 0;
  unsigned long dhcp_ms  = 0;
  int errMask = 0;
  int rssi = 0;
  int channel = 0;
  String ip = "0.0.0.0";
  TargetLatency targets;

  // 1. Wi-Fi Association
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < TIMEOUT_ASSOC_MS) {
    delay(50);
  }

  if (WiFi.status() == WL_CONNECTED) {
    assoc_ms = millis() - t0;
    rssi     = WiFi.RSSI();
    channel  = WiFi.channel();

    // 2. DHCP lease acquisition
    unsigned long t_dhcp0 = millis();
    while (WiFi.localIP() == IPAddress(0, 0, 0, 0) && (millis() - t_dhcp0) < TIMEOUT_DHCP_MS) {
      delay(50);
    }

    if (WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
      dhcp_ms = millis() - t_dhcp0;
      ip = WiFi.localIP().toString();

      // 3. HTTP Latency benchmarking
      targets.one_one_one_one = probeHttpTarget("http://1.1.1.1");
      targets.google          = probeHttpTarget("http://www.google.com/generate_204");
      targets.fast            = probeHttpTarget("http://fast.com");
      targets.cloudflare      = probeHttpTarget("http://cloudflare.com");

      // Try NTP sync if not yet synchronized
      if (!ntpSynchronized) {
        syncNTP();
      }

      // Check if we should send an hourly heartbeat update
      if (ntpSynchronized) {
        time_t now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
        struct tm* ptm = gmtime(&now);
        if (ptm && ptm->tm_hour != lastHeartbeatHour) {
          sendHourlyHeartbeat(vbat, rssi, assoc_ms, dhcp_ms, targets, errMask, now);
          lastHeartbeatHour = ptm->tm_hour;
        }
      }
    } else {
      errMask |= 2; // DHCP timeout
    }
  } else {
    errMask |= 1; // Wi-Fi association failed
  }

  WiFi.disconnect(true);

  // Compute current epoch or 0 if un-synced
  time_t currentEpoch = 0;
  if (ntpSynchronized) {
    currentEpoch = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
  }

  appendRecordToSpool(currentEpoch, millis(), rssi, channel, assoc_ms, dhcp_ms, ip.c_str(), targets, errMask, vbat);
  Serial.printf("[Probe] Assoc: %lu ms, DHCP: %lu ms, Err: %d\n", assoc_ms, dhcp_ms, errMask);
  digitalWrite(PIN_LED, LOW);
}

// ---------- Daily Upload & Fallback Network ----------

bool postSpoolToWorker(const char* ssid, const char* pass) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 15000) {
    delay(100);
  }
  if (WiFi.status() != WL_CONNECTED) return false;

  if (!ntpSynchronized) syncNTP();

  File f = LittleFS.open("/spool/pending.jsonl", "r");
  if (!f) { WiFi.disconnect(true); return true; }

  // Build batch payload
  JsonDocument doc;
  doc["station_id"]   = config.station_id;
  doc["battery_mv"]   = (int)(readBatteryVoltage() * 1000.0f);
  doc["battery_pct"]  = batteryPercent(readBatteryVoltage());

  JsonArray recs = doc["records"].to<JsonArray>();
  while (f.available()) {
    String line = f.readStringUntil('\n');
    if (line.length() < 10) continue;
    JsonDocument lineDoc;
    if (!deserializeJson(lineDoc, line)) {
      JsonObject obj = recs.add<JsonObject>();
      obj["timestamp"] = lineDoc["t"];
      obj["ssid"]      = lineDoc["s"];
      obj["rssi"]      = lineDoc["r"];
      obj["channel"]   = lineDoc["ch"];
      obj["assoc_ms"]  = lineDoc["a_ms"];
      obj["dhcp_ms"]   = lineDoc["d_ms"];
      obj["ip"]        = lineDoc["ip"];

      JsonObject tg = obj["targets"].to<JsonObject>();
      tg["one_one_one_one"] = lineDoc["dns_ms"];
      tg["google"]          = lineDoc["g_ms"];
      tg["fast"]            = lineDoc["f_ms"];
      tg["cloudflare"]      = lineDoc["cf_ms"];
      obj["status"]         = (lineDoc["err"].as<int>() == 0) ? "ok" : "err";
      obj["battery_mv"]     = lineDoc["vbat"];
    }
  }
  f.close();

  if (recs.size() == 0) {
    WiFi.disconnect(true);
    return true;
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(config.worker_url);
  http.addHeader("Content-Type", "application/json");
  String auth = String("Bearer ") + config.auth_token;
  http.addHeader("Authorization", auth);

  int code = http.POST(payload);
  http.end();
  WiFi.disconnect(true);

  if (code == 200 || code == 201) {
    LittleFS.remove("/spool/pending.jsonl");
    Serial.printf("[Upload] Ingestion success (%d records committed)\n", recs.size());
    return true;
  }

  Serial.printf("[Upload] Worker returned HTTP %d\n", code);
  return false;
}

void checkDailyUpload() {
  if (!ntpSynchronized) return;

  time_t now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
  struct tm* ptm = gmtime(&now);
  int hourUTC = ptm->tm_hour;
  int currentDay = ptm->tm_yday;

  // Upload window: 19:00 to 21:00 UTC (02:00 to 04:00 Vietnam time)
  if (hourUTC >= 19 && hourUTC <= 21 && lastUploadDay != currentDay) {
    Serial.println("[Upload] Triggering daily batch upload...");
    bool ok = postSpoolToWorker(config.monitored_ssid, config.monitored_pass);
    if (!ok && strlen(config.fallback_ssid) > 0) {
      Serial.println("[Upload] Primary failed, attempting Fallback Network...");
      ok = postSpoolToWorker(config.fallback_ssid, config.fallback_pass);
    }
    if (ok) lastUploadDay = currentDay;
  }
}

// ---------- Arduino Lifecycle ----------

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  digitalWrite(PIN_LED, LOW);
  analogReadResolution(12);

  loadConfig();

  // Cold boot detection:
  // AP is launched only if power-on reset or BOOT button held down or config missing
  esp_reset_reason_t reason = esp_reset_reason();
  bool forceAp = (digitalRead(PIN_BOOT) == LOW);

  if (reason == ESP_RST_POWERON || forceAp || strlen(config.monitored_ssid) == 0) {
    startSoftAP();
  } else {
    Serial.println("[Boot] Normal start, proceeding directly to measurement...");
  }
}

void loop() {
  // If in Soft-AP mode during cold start
  if (apModeActive) {
    dnsServer.processNextRequest();
    server.handleClient();

    // Check if client connected: cancel 60s timeout
    if (WiFi.softAPgetStationNum() > 0) {
      if (!clientConnectedOnce) {
        clientConnectedOnce = true;
        Serial.println("[AP] Client connected! 60s timeout cancelled. AP active until reboot.");
      }
    }

    // If 60 seconds pass without any client, exit AP mode
    if (!clientConnectedOnce && (millis() - apStartTime) > 60000) {
      Serial.println("[AP] 60s timeout reached with no client. Switching to measurement mode.");
      server.stop();
      dnsServer.stop();
      WiFi.softAPdisconnect(true);
      WiFi.mode(WIFI_OFF);
      apModeActive = false;
    } else {
      delay(10);
      return;
    }
  }

  // Routine Measurement Cycle
  runMeasurement();

  // Check if inside daily upload window
  checkDailyUpload();

  // Power down Wi-Fi before entering light sleep
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  // Light Sleep for configured interval
  uint64_t sleep_us = (uint64_t)config.interval_min * 60ULL * 1000000ULL;
  Serial.printf("[Sleep] Entering light sleep for %d minutes...\n", config.interval_min);
  Serial.flush();

  esp_sleep_enable_timer_wakeup(sleep_us);
  esp_light_sleep_start();

  // On wake, execution resumes here! (Loop repeats without cold start / AP mode)
  Serial.println("[Wake] Resumed from light sleep");
}
