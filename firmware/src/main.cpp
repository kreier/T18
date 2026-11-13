/**
 * T18 Network Reliability Monitor Firmware
 * Hardware: TTGO T18 (LilyGo T-Energy v3.0) ESP32
 * Version: 0.5.1
 *
 * Features:
 * - Cold-boot Soft-AP portal (60s timeout, canceled on client connection)
 * - Web configuration stored in LittleFS (/config.json) with configurable Location
 * - Configurable Fallback Network ("S24") with enable/disable switch (backup only, never monitored)
 * - Light sleep cycle (default: 10 min) with clock continuity
 * - Sequential Wi-Fi association & DHCP benchmarking (15s / 10s timeouts)
 * - HTTP target latency probes (3s timeout): 1.1.1.1, Google, Fast.com, Cloudflare
 * - Hourly Live Heartbeat to Cloudflare Worker (battery, RSSI, status, visible networks count)
 * - Offline millis() buffering with retroactive NTP timestamp mapping
 * - Immediate initial assessment submission to GitHub on station setup for immediate verification
 * - Automatic backlog / catch-up check for unsubmitted old collected data
 * - Daily ingestion batch upload (19:00 - 21:00 UTC) with fallback network support
 * - Two-way confirmation: data marked submitted in flash only upon worker commit confirmation
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
struct MonitoredNetwork {
  char ssid[32] = "";
  char pass[64] = "";
};

static const int MAX_MONITORED_NETWORKS = 4;

struct StationConfig {
  char station_id[32]        = "C-103";
  char location[64]          = "Science Building C, Room 103";
  MonitoredNetwork monitored[MAX_MONITORED_NETWORKS];
  int  monitored_count       = 1;
  char monitored_ssid[32]    = "School-Guest";
  char monitored_pass[64]    = "";
  bool fallback_enabled      = true;
  char fallback_ssid[32]     = "S24";
  char fallback_pass[64]     = "12345678";
  int  interval_min          = 10;
  char worker_url[128]       = "https://t18-telemetry-worker.kreier.workers.dev/ingest";
  char auth_token[64]        = "secret-station-token";
};

// Persistent Spool Submission State Model
struct SpoolState {
  bool initial_submitted     = false;
  time_t last_upload_epoch   = 0;
  int  last_upload_day       = -1;
};

StationConfig config;
SpoolState    spoolState;

// State Tracking
static bool apModeActive          = false;
static bool clientConnectedOnce   = false;
static unsigned long apStartTime  = 0;
static bool ntpSynchronized       = false;
static time_t ntpBaseEpoch        = 0;
static unsigned long ntpBaseMillis = 0;
static int lastHeartbeatHour      = -1;

// Web & DNS servers for AP mode
WebServer server(80);
DNSServer dnsServer;

// Forward Declarations (for Arduino IDE preprocessor compatibility)
bool initFileSystem();
void loadConfig();
void saveConfig();
void loadSpoolState();
void saveSpoolState();
void appendRecordToSpool(unsigned long epochSec, unsigned long relMillis, const char* ssid,
                        int rssi, int ch, unsigned long assoc_ms, unsigned long dhcp_ms,
                        const char* ip, const TargetLatency& targets, int errMask, float vbat);
void sendHourlyHeartbeat(float vbat, time_t epochSec);
void retroactivelyMapSpoolTimestamps();
int  probeHttpTarget(const char* url);
void probeSingleNetwork(const char* ssid, const char* pass);
void markSpoolAsSubmitted();
void rotateSubmittedLog();
bool hasUnsubmittedOldData();
void checkUnsubmittedData();
void checkDailyUpload();
void checkInitialUpload();
bool postSpoolToWorker(const char* ssid, const char* pass);
bool uploadSpoolWithFallback();
int  performVisibleNetworksScan();

// ---------- Scanned Networks Survey Model & Helpers ----------

struct ScannedNetwork {
  char ssid[33] = "";
  int rssi      = -99;
  int channel   = 1;
  char security[16] = "WPA2-PSK";
};

static const int MAX_SCANNED_NETWORKS = 64;
static ScannedNetwork latestScanResults[MAX_SCANNED_NETWORKS];
static int latestScanCount = 0;

const char* getAuthModeName(wifi_auth_mode_t auth) {
  switch (auth) {
    case WIFI_AUTH_OPEN:            return "Open";
    case WIFI_AUTH_WEP:             return "WEP";
    case WIFI_AUTH_WPA_PSK:         return "WPA-PSK";
    case WIFI_AUTH_WPA2_PSK:        return "WPA2-PSK";
    case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA/WPA2-PSK";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-Enterprise";
    case WIFI_AUTH_WPA3_PSK:        return "WPA3-PSK";
    case WIFI_AUTH_WPA2_WPA3_PSK:   return "WPA2/WPA3-PSK";
    default:                        return "WPA2-PSK";
  }
}

int performVisibleNetworksScan() {
  Serial.println("[Scan] Scanning visible Wi-Fi spectrum...");
  int n = WiFi.scanNetworks(false, true);
  if (n < 0) {
    Serial.println("[Scan] Wi-Fi scan returned error");
    return 0;
  }

  latestScanCount = (n > MAX_SCANNED_NETWORKS) ? MAX_SCANNED_NETWORKS : n;
  for (int i = 0; i < latestScanCount; i++) {
    strlcpy(latestScanResults[i].ssid, WiFi.SSID(i).c_str(), sizeof(latestScanResults[i].ssid));
    latestScanResults[i].rssi = WiFi.RSSI(i);
    latestScanResults[i].channel = WiFi.channel(i);
    strlcpy(latestScanResults[i].security, getAuthModeName(WiFi.encryptionType(i)), sizeof(latestScanResults[i].security));
  }
  WiFi.scanDelete();
  Serial.printf("[Scan] Detected %d visible networks (%d stored for spectrum survey)\n", n, latestScanCount);
  return n;
}

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

bool initFileSystem() {
  if (!LittleFS.begin(true)) {
    Serial.println("[FS] Failed to mount LittleFS");
    return false;
  }
  Serial.println("[FS] LittleFS mounted successfully");

  if (!LittleFS.exists("/spool")) {
    if (LittleFS.mkdir("/spool")) {
      Serial.println("[FS] Created /spool directory");
    } else {
      Serial.println("[FS] ERROR: Failed to create /spool directory");
      return false;
    }
  }
  return true;
}

void loadConfig() {
  if (!LittleFS.exists("/config.json")) {
    Serial.println("[FS] /config.json not found, using defaults");
    strlcpy(config.monitored[0].ssid, config.monitored_ssid, sizeof(config.monitored[0].ssid));
    strlcpy(config.monitored[0].pass, config.monitored_pass, sizeof(config.monitored[0].pass));
    config.monitored_count = 1;
    return;
  }

  File f = LittleFS.open("/config.json", "r");
  if (!f) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();

  if (!err) {
    strlcpy(config.station_id, doc["station_id"] | config.station_id, sizeof(config.station_id));
    strlcpy(config.location,   doc["location"]   | config.location,   sizeof(config.location));

    // Load multiple monitored networks if array exists
    if (doc.containsKey("monitored_networks") && doc["monitored_networks"].is<JsonArray>()) {
      JsonArray arr = doc["monitored_networks"];
      config.monitored_count = 0;
      for (JsonObject obj : arr) {
        if (config.monitored_count < MAX_MONITORED_NETWORKS) {
          strlcpy(config.monitored[config.monitored_count].ssid, obj["ssid"] | "", sizeof(config.monitored[0].ssid));
          strlcpy(config.monitored[config.monitored_count].pass, obj["pass"] | "", sizeof(config.monitored[0].pass));
          config.monitored_count++;
        }
      }
    } else {
      strlcpy(config.monitored[0].ssid, doc["monitored_ssid"] | config.monitored_ssid, sizeof(config.monitored[0].ssid));
      strlcpy(config.monitored[0].pass, doc["monitored_pass"] | config.monitored_pass, sizeof(config.monitored[0].pass));
      config.monitored_count = 1;
    }

    if (config.monitored_count > 0 && strlen(config.monitored[0].ssid) > 0) {
      strlcpy(config.monitored_ssid, config.monitored[0].ssid, sizeof(config.monitored_ssid));
      strlcpy(config.monitored_pass, config.monitored[0].pass, sizeof(config.monitored_pass));
    }

    config.fallback_enabled = doc.containsKey("fallback_enabled") ? doc["fallback_enabled"].as<bool>() : true;
    strlcpy(config.fallback_ssid,  doc["fallback_ssid"]  | config.fallback_ssid,  sizeof(config.fallback_ssid));
    strlcpy(config.fallback_pass,  doc["fallback_pass"]  | config.fallback_pass,  sizeof(config.fallback_pass));
    config.interval_min = doc["interval_min"] | config.interval_min;
    strlcpy(config.worker_url,     doc["worker_url"]     | config.worker_url,     sizeof(config.worker_url));
    strlcpy(config.auth_token,     doc["auth_token"]     | config.auth_token,     sizeof(config.auth_token));
    Serial.printf("[Config] Loaded station: %s, Location: %s, Monitored networks: %d, Fallback: %s (%s)\n",
                  config.station_id, config.location, config.monitored_count, config.fallback_ssid,
                  config.fallback_enabled ? "enabled" : "disabled");
  }
}

void saveConfig() {
  File f = LittleFS.open("/config.json", "w");
  if (!f) {
    Serial.println("[FS] Failed to open /config.json for writing");
    return;
  }

  JsonDocument doc;
  doc["station_id"] = config.station_id;
  doc["location"]   = config.location;

  JsonArray netArr = doc["monitored_networks"].to<JsonArray>();
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      JsonObject netObj = netArr.add<JsonObject>();
      netObj["ssid"] = config.monitored[i].ssid;
      netObj["pass"] = config.monitored[i].pass;
    }
  }

  doc["monitored_ssid"]   = config.monitored[0].ssid;
  doc["monitored_pass"]   = config.monitored[0].pass;
  doc["fallback_enabled"] = config.fallback_enabled;
  doc["fallback_ssid"]    = config.fallback_ssid;
  doc["fallback_pass"]    = config.fallback_pass;
  doc["interval_min"]     = config.interval_min;
  doc["worker_url"]       = config.worker_url;
  doc["auth_token"]       = config.auth_token;

  serializeJson(doc, f);
  f.close();
  Serial.println("[FS] Configuration saved to /config.json");
}

void loadSpoolState() {
  if (!LittleFS.exists("/spool/state.json")) {
    spoolState.initial_submitted = false;
    spoolState.last_upload_epoch = 0;
    spoolState.last_upload_day   = -1;
    Serial.println("[SpoolState] /spool/state.json not found, defaults initialized (initial_submitted=false)");
    return;
  }

  File f = LittleFS.open("/spool/state.json", "r");
  if (!f) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();

  if (!err) {
    spoolState.initial_submitted = doc["initial_submitted"] | false;
    spoolState.last_upload_epoch = doc["last_upload_epoch"] | (time_t)0;
    spoolState.last_upload_day   = doc["last_upload_day"]   | -1;
    Serial.printf("[SpoolState] Loaded state: initial_sub=%d, last_epoch=%ld, last_day=%d\n",
                  spoolState.initial_submitted, (long)spoolState.last_upload_epoch, spoolState.last_upload_day);
  }
}

void saveSpoolState() {
  if (!LittleFS.exists("/spool")) {
    LittleFS.mkdir("/spool");
  }

  File f = LittleFS.open("/spool/state.json", "w");
  if (!f) {
    Serial.println("[SpoolState] Failed to open /spool/state.json for writing");
    return;
  }

  JsonDocument doc;
  doc["initial_submitted"] = spoolState.initial_submitted;
  doc["last_upload_epoch"] = (unsigned long)spoolState.last_upload_epoch;
  doc["last_upload_day"]   = spoolState.last_upload_day;

  serializeJson(doc, f);
  f.close();
  Serial.println("[SpoolState] Saved state to /spool/state.json");
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
    .card { max-width: 520px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 12px; }
    h1 { margin-top: 0; font-size: 20px; color: #38bdf8; }
    .section-title { color: #38bdf8; font-size: 13px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    label { display: block; margin-top: 10px; font-size: 12px; color: #94a3b8; }
    input, select { width: 100%; box-sizing: border-box; padding: 9px 12px; margin-top: 4px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 13px; }
    .net-box { background: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155; margin-bottom: 8px; }
    .switch-label { display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 0; font-size: 13px; color: #e2e8f0; font-weight: 500; }
    .switch-label input[type="checkbox"] { width: auto; margin: 0; accent-color: #0284c7; }
    .btn { background: #0284c7; color: #fff; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; margin-top: 24px; cursor: pointer; }
    .btn:hover { background: #0369a1; }
    .info { font-size: 12px; color: #64748b; margin-top: 6px; }
    .vbat { background: #0f172a; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>T18 Station Setup (v0.5.1)</h1>
    <div class="vbat">Battery: <strong>%VBAT% V (%BAT_PCT%%)</strong></div>
    <div class="vbat" style="margin-top:6px;">Status: <strong>%SUB_STATUS%</strong></div>
    <form action="/save" method="POST">
      <label>Station ID</label>
      <input type="text" name="station_id" value="%STATION_ID%" placeholder="e.g. C-103" required>

      <label>Location</label>
      <input type="text" name="location" value="%LOCATION%" placeholder="e.g. Science Building C, Room 103" required>

      <div class="section-title">Monitored Wi-Fi Networks</div>
      <div class="net-box">
        <label style="margin-top:0;">Network 1 (Primary) SSID</label>
        <input type="text" name="mon_ssid_1" value="%MON_SSID_1%" required>
        <label>Network 1 Password</label>
        <input type="password" name="mon_pass_1" value="%MON_PASS_1%">
      </div>

      <div class="net-box">
        <label style="margin-top:0;">Network 2 (Optional) SSID</label>
        <input type="text" name="mon_ssid_2" value="%MON_SSID_2%">
        <label>Network 2 Password</label>
        <input type="password" name="mon_pass_2" value="%MON_PASS_2%">
      </div>

      <div class="net-box">
        <label style="margin-top:0;">Network 3 (Optional) SSID</label>
        <input type="text" name="mon_ssid_3" value="%MON_SSID_3%">
        <label>Network 3 Password</label>
        <input type="password" name="mon_pass_3" value="%MON_PASS_3%">
      </div>

      <div class="section-title">Fallback Network (Backup Only)</div>
      <div class="net-box">
        <label class="switch-label">
          <input type="checkbox" name="fallback_enabled" value="1" %FB_ENABLED%>
          <span>Enable Fallback Network</span>
        </label>
        <label>Fallback SSID</label>
        <input type="text" name="fallback_ssid" value="%FB_SSID%" placeholder="S24">
        <label>Fallback Password</label>
        <input type="password" name="fallback_pass" value="%FB_PASS%" placeholder="12345678">
        <div class="info">Used only if monitored networks fail to connect or have no internet access. This network is never monitored.</div>
      </div>

      <label>Probe Interval (Minutes)</label>
      <input type="number" name="interval_min" min="1" max="60" value="%INTERVAL%">

      <label>Cloudflare Worker Ingest URL</label>
      <input type="text" name="worker_url" value="%WORKER_URL%">

      <label>Device Bearer Token</label>
      <input type="password" name="auth_token" value="%AUTH_TOKEN%">

      <button type="submit" class="btn">Save & Reboot Station</button>
    </form>
    <div class="info">Settings are committed to LittleFS. After reboot, initial telemetry assessment is submitted immediately to GitHub and shown on GitHub Pages.</div>
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
  html.replace("%LOCATION%", config.location);

  html.replace("%MON_SSID_1%", config.monitored[0].ssid);
  html.replace("%MON_PASS_1%", config.monitored[0].pass);
  html.replace("%MON_SSID_2%", config.monitored[1].ssid);
  html.replace("%MON_PASS_2%", config.monitored[1].pass);
  html.replace("%MON_SSID_3%", config.monitored[2].ssid);
  html.replace("%MON_PASS_3%", config.monitored[2].pass);

  html.replace("%FB_ENABLED%", config.fallback_enabled ? "checked" : "");
  html.replace("%FB_SSID%", config.fallback_ssid);
  html.replace("%FB_PASS%", config.fallback_pass);

  html.replace("%INTERVAL%", String(config.interval_min));
  html.replace("%WORKER_URL%", config.worker_url);
  html.replace("%AUTH_TOKEN%", config.auth_token);

  String subStatus = spoolState.initial_submitted ? "Initial upload completed" : "Initial upload pending";
  if (spoolState.last_upload_epoch > 0) {
    char timeBuf[32];
    struct tm* ptm = gmtime(&spoolState.last_upload_epoch);
    if (ptm) {
      strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M UTC", ptm);
      subStatus += String(" (Last: ") + timeBuf + ")";
    }
  }
  html.replace("%SUB_STATUS%", subStatus);

  server.send(200, "text/html", html);
}

void handlePortalSave() {
  if (server.hasArg("station_id")) strlcpy(config.station_id, server.arg("station_id").c_str(), sizeof(config.station_id));
  if (server.hasArg("location"))   strlcpy(config.location,   server.arg("location").c_str(),   sizeof(config.location));

  config.monitored_count = 0;
  if (server.hasArg("mon_ssid_1") && server.arg("mon_ssid_1").length() > 0) {
    strlcpy(config.monitored[config.monitored_count].ssid, server.arg("mon_ssid_1").c_str(), sizeof(config.monitored[0].ssid));
    strlcpy(config.monitored[config.monitored_count].pass, server.arg("mon_pass_1").c_str(), sizeof(config.monitored[0].pass));
    config.monitored_count++;
  }
  if (server.hasArg("mon_ssid_2") && server.arg("mon_ssid_2").length() > 0) {
    strlcpy(config.monitored[config.monitored_count].ssid, server.arg("mon_ssid_2").c_str(), sizeof(config.monitored[0].ssid));
    strlcpy(config.monitored[config.monitored_count].pass, server.arg("mon_pass_2").c_str(), sizeof(config.monitored[0].pass));
    config.monitored_count++;
  }
  if (server.hasArg("mon_ssid_3") && server.arg("mon_ssid_3").length() > 0) {
    strlcpy(config.monitored[config.monitored_count].ssid, server.arg("mon_ssid_3").c_str(), sizeof(config.monitored[0].ssid));
    strlcpy(config.monitored[config.monitored_count].pass, server.arg("mon_pass_3").c_str(), sizeof(config.monitored[0].pass));
    config.monitored_count++;
  }

  if (config.monitored_count > 0) {
    strlcpy(config.monitored_ssid, config.monitored[0].ssid, sizeof(config.monitored_ssid));
    strlcpy(config.monitored_pass, config.monitored[0].pass, sizeof(config.monitored_pass));
  }

  config.fallback_enabled = server.hasArg("fallback_enabled");
  if (server.hasArg("fallback_ssid")) strlcpy(config.fallback_ssid, server.arg("fallback_ssid").c_str(), sizeof(config.fallback_ssid));
  if (server.hasArg("fallback_pass")) strlcpy(config.fallback_pass, server.arg("fallback_pass").c_str(), sizeof(config.fallback_pass));

  if (server.hasArg("interval_min")) config.interval_min = server.arg("interval_min").toInt();
  if (server.hasArg("worker_url"))   strlcpy(config.worker_url, server.arg("worker_url").c_str(), sizeof(config.worker_url));
  if (server.hasArg("auth_token"))   strlcpy(config.auth_token, server.arg("auth_token").c_str(), sizeof(config.auth_token));

  saveConfig();

  // Reset initial submission flag so freshly configured station immediately submits telemetry upon reboot
  spoolState.initial_submitted = false;
  saveSpoolState();

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

void appendRecordToSpool(unsigned long epochSec, unsigned long relMillis, const char* ssid,
                        int rssi, int ch, unsigned long assoc_ms, unsigned long dhcp_ms,
                        const char* ip, const TargetLatency& targets, int errMask, float vbat) {
  if (!LittleFS.exists("/spool")) {
    LittleFS.mkdir("/spool");
  }

  File f = LittleFS.open("/spool/pending.jsonl", "a");
  if (!f) {
    Serial.println("[Spool] CRITICAL ERROR: Failed to open /spool/pending.jsonl for writing");
    return;
  }

  JsonDocument doc;
  doc["t"]       = epochSec;
  doc["rel_ms"]  = relMillis;
  doc["synced"]  = ntpSynchronized;
  doc["s"]       = ssid;
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
  doc["sub"]     = false;

  serializeJson(doc, f);
  f.println();
  size_t sz = f.size();
  f.close();

  Serial.printf("[Spool] Appended record for '%s' to flash (t=%lu, rel_ms=%lu, total size=%u bytes)\n",
                ssid, epochSec, relMillis, (unsigned int)sz);
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

// Probes a single network and logs the benchmark record to spool
void probeSingleNetwork(const char* ssid, const char* pass) {
  WiFi.mode(WIFI_STA);
  unsigned long t0 = millis();
  WiFi.begin(ssid, pass);

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
      unsigned long elapsed = millis() - t_dhcp0;
      dhcp_ms = (elapsed > 0) ? elapsed : 1;
      ip = WiFi.localIP().toString();

      // 3. HTTP Latency benchmarking
      targets.one_one_one_one = probeHttpTarget("http://1.1.1.1");
      targets.google          = probeHttpTarget("http://www.google.com/generate_204");
      targets.fast            = probeHttpTarget("http://fast.com");
      targets.cloudflare      = probeHttpTarget("http://cloudflare.com");

      // Sync NTP if needed
      if (!ntpSynchronized) {
        syncNTP();
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

  float vbat = readBatteryVoltage();
  appendRecordToSpool(currentEpoch, millis(), ssid, rssi, channel, assoc_ms, dhcp_ms, ip.c_str(), targets, errMask, vbat);
  Serial.printf("[Probe] Network '%s': Assoc=%lu ms, DHCP=%lu ms, Err=%d, RSSI=%d\n", ssid, assoc_ms, dhcp_ms, errMask, rssi);
}

// Send lightweight hourly heartbeat to Cloudflare Worker
void sendHourlyHeartbeat(float vbat, time_t epochSec) {
  int visible = performVisibleNetworksScan();

  String hbUrl = config.worker_url;
  int idx = hbUrl.lastIndexOf('/');
  if (idx > 0) {
    hbUrl = hbUrl.substring(0, idx) + "/heartbeat";
  }

  JsonDocument doc;
  doc["station_id"]           = config.station_id;
  doc["station_name"]         = config.station_id;
  doc["location"]             = config.location;
  doc["timestamp"]            = epochSec;
  doc["battery_mv"]           = (int)(vbat * 1000.0f);
  doc["battery_pct"]          = batteryPercent(vbat);
  doc["visible_networks"]     = visible > 0 ? visible : 0;
  doc["status"]               = "green";

  JsonArray netArr = doc["monitored_networks"].to<JsonArray>();
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      netArr.add(config.monitored[i].ssid);
    }
  }

  String payload;
  serializeJson(doc, payload);

  auto tryPostHeartbeat = [&](const char* ssid, const char* pass) -> bool {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, pass);
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 10000) {
      delay(50);
    }
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.disconnect(true);
      return false;
    }

    HTTPClient http;
    http.setTimeout(4000);
    http.begin(hbUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + config.auth_token);

    int code = http.POST(payload);
    http.end();
    WiFi.disconnect(true);
    return (code == 200 || code == 201);
  };

  bool ok = false;
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      ok = tryPostHeartbeat(config.monitored[i].ssid, config.monitored[i].pass);
      if (ok) break;
    }
  }

  if (!ok && config.fallback_enabled && strlen(config.fallback_ssid) > 0) {
    Serial.println("[Heartbeat] Primary networks failed, attempting fallback network for ping...");
    ok = tryPostHeartbeat(config.fallback_ssid, config.fallback_pass);
  }

  Serial.printf("[Heartbeat] Hourly ping result: %s (visible: %d, battery: %.2fV)\n",
                ok ? "OK" : "FAILED", visible, vbat);
}

void runMeasurement() {
  digitalWrite(PIN_LED, HIGH);
  float vbat = readBatteryVoltage();
  Serial.printf("[Probe] Battery: %.2fV (%d%%)\n", vbat, batteryPercent(vbat));

  // Sequentially assess all configured monitored networks (fallback is NOT monitored)
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      Serial.printf("[Probe] Assessing network %d/%d: '%s'...\n", i + 1, config.monitored_count, config.monitored[i].ssid);
      probeSingleNetwork(config.monitored[i].ssid, config.monitored[i].pass);
    }
  }

  // Hourly heartbeat check
  if (ntpSynchronized) {
    time_t now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
    struct tm* ptm = gmtime(&now);
    if (ptm && ptm->tm_hour != lastHeartbeatHour) {
      sendHourlyHeartbeat(vbat, now);
      lastHeartbeatHour = ptm->tm_hour;
    }
  }

  digitalWrite(PIN_LED, LOW);
}

// ---------- Flash Spool Confirmation & Management ----------

void rotateSubmittedLog() {
  File f = LittleFS.open("/spool/submitted.jsonl", "r");
  if (!f) return;

  File temp = LittleFS.open("/spool/sub_tmp.jsonl", "w");
  if (!temp) {
    f.close();
    return;
  }

  int totalLines = 0;
  while (f.available()) {
    f.readStringUntil('\n');
    totalLines++;
  }
  f.seek(0);

  // Retain the newest 100 lines
  int linesToSkip = (totalLines > 100) ? (totalLines - 100) : 0;
  int current = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    if (current++ >= linesToSkip && line.length() >= 5) {
      temp.println(line);
    }
  }
  f.close();
  temp.close();

  LittleFS.remove("/spool/submitted.jsonl");
  LittleFS.rename("/spool/sub_tmp.jsonl", "/spool/submitted.jsonl");
  Serial.println("[Spool] Rotated /spool/submitted.jsonl (retained 100 newest records)");
}

void markSpoolAsSubmitted() {
  if (!LittleFS.exists("/spool")) {
    LittleFS.mkdir("/spool");
  }

  int count = 0;
  if (LittleFS.exists("/spool/pending.jsonl")) {
    File readFile = LittleFS.open("/spool/pending.jsonl", "r");
    if (readFile) {
      File subFile = LittleFS.open("/spool/submitted.jsonl", "a");
      if (subFile) {
        while (readFile.available()) {
          String line = readFile.readStringUntil('\n');
          if (line.length() < 10) continue;
          JsonDocument doc;
          DeserializationError err = deserializeJson(doc, line);
          if (!err) {
            doc["sub"] = true;
            serializeJson(doc, subFile);
            subFile.println();
            count++;
          }
        }
        subFile.close();
      }
      readFile.close();
    }
    LittleFS.remove("/spool/pending.jsonl");
  }

  // Keep submitted.jsonl bounded (max ~64KB)
  File checkFile = LittleFS.open("/spool/submitted.jsonl", "r");
  if (checkFile) {
    size_t sz = checkFile.size();
    checkFile.close();
    if (sz > 65536) {
      rotateSubmittedLog();
    }
  }

  // Update persistent submission state
  time_t now = 0;
  if (ntpSynchronized) {
    now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
    struct tm tmNow;
    gmtime_r(&now, &tmNow);
    spoolState.last_upload_day = tmNow.tm_yday;
  }
  spoolState.last_upload_epoch = now;
  spoolState.initial_submitted = true;
  saveSpoolState();

  Serial.printf("[Spool] Submission confirmed and marked in flash (%d records committed)\n", count);
}

// ---------- Batch Ingestion & Backlog Handling ----------

bool postSpoolToWorker(const char* ssid, const char* pass) {
  if (!LittleFS.exists("/spool/pending.jsonl")) {
    Serial.println("[Upload] No pending records file (/spool/pending.jsonl does not exist)");
    return false;
  }

  File f = LittleFS.open("/spool/pending.jsonl", "r");
  if (!f || f.size() < 10) {
    if (f) f.close();
    Serial.println("[Upload] Spool file is empty or unreadable");
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 15000) {
    delay(100);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[Upload] Wi-Fi connection to '%s' failed\n", ssid);
    f.close();
    WiFi.disconnect(true);
    return false;
  }

  if (!ntpSynchronized) syncNTP();

  // Build batch payload
  JsonDocument doc;
  doc["station_id"]   = config.station_id;
  doc["station_name"] = config.station_id;
  doc["location"]     = config.location;
  doc["firmware"]     = "0.5.1";
  doc["battery_mv"]   = (int)(readBatteryVoltage() * 1000.0f);
  doc["battery_pct"]  = batteryPercent(readBatteryVoltage());

  // Perform Wi-Fi spectrum scan to populate visible networks survey
  performVisibleNetworksScan();
  doc["visible_networks"] = latestScanCount;

  JsonArray scanArr = doc["scan_networks"].to<JsonArray>();
  for (int i = 0; i < latestScanCount; i++) {
    if (strlen(latestScanResults[i].ssid) > 0) {
      JsonObject sObj = scanArr.add<JsonObject>();
      sObj["ssid"] = latestScanResults[i].ssid;
      sObj["rssi"] = latestScanResults[i].rssi;
      sObj["ch"]   = latestScanResults[i].channel;
      sObj["sec"]  = latestScanResults[i].security;
    }
  }

  JsonArray netArr = doc["monitored_networks"].to<JsonArray>();
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      netArr.add(config.monitored[i].ssid);
    }
  }

  JsonArray recs = doc["records"].to<JsonArray>();
  while (f.available()) {
    String line = f.readStringUntil('\n');
    if (line.length() < 10) continue;
    JsonDocument lineDoc;
    if (!deserializeJson(lineDoc, line)) {
      unsigned long t = lineDoc["t"];
      // If record is still un-synced (t == 0), retroactively calculate if NTP is available
      if (t == 0 && ntpSynchronized) {
        unsigned long rel_ms = lineDoc["rel_ms"] | 0;
        long diffSec = (long)((millis() - rel_ms) / 1000);
        t = (unsigned long)(ntpBaseEpoch - diffSec);
      }
      if (t == 0) continue; // Skip un-synced records to avoid worker HTTP 400 rejection

      JsonObject obj = recs.add<JsonObject>();
      obj["timestamp"] = t;
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
    Serial.println("[Upload] No valid timestamped records in spool to submit");
    return false;
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.setTimeout(15000);
  http.begin(config.worker_url);
  http.addHeader("Content-Type", "application/json");
  String auth = String("Bearer ") + config.auth_token;
  http.addHeader("Authorization", auth);

  Serial.printf("[Upload] Posting %d records to %s via '%s'...\n", recs.size(), config.worker_url, ssid);
  int code = http.POST(payload);
  String responseBody = "";
  if (code > 0) {
    responseBody = http.getString();
  }
  http.end();
  WiFi.disconnect(true);

  bool confirmed = false;
  if (code == 200 || code == 201) {
    JsonDocument respDoc;
    DeserializationError err = deserializeJson(respDoc, responseBody);
    if (!err && respDoc["success"].as<bool>() == true) {
      confirmed = true;
      int processed = respDoc["records_processed"] | recs.size();
      Serial.printf("[Upload] Ingestion confirmed by worker! (%d records processed)\n", processed);
    } else {
      Serial.printf("[Upload] HTTP %d received but response verification failed: %s\n", code, responseBody.c_str());
    }
  } else {
    Serial.printf("[Upload] Worker returned HTTP %d: %s\n", code, responseBody.c_str());
  }

  // Only then mark the data in the flash of the esp32 as submitted
  if (confirmed) {
    markSpoolAsSubmitted();
    return true;
  }

  Serial.println("[Upload] Ingestion was not confirmed. Records remain marked pending in flash.");
  return false;
}

// Connects through monitored networks, falling back to backup network if needed
bool uploadSpoolWithFallback() {
  bool ok = false;
  // 1. Try each monitored network in order
  for (int i = 0; i < config.monitored_count; i++) {
    if (strlen(config.monitored[i].ssid) > 0) {
      Serial.printf("[Upload] Attempting upload via monitored network '%s'...\n", config.monitored[i].ssid);
      ok = postSpoolToWorker(config.monitored[i].ssid, config.monitored[i].pass);
      if (ok) return true;
    }
  }

  // 2. If login to monitored networks failed or if they lack internet access, try Fallback Network
  if (config.fallback_enabled && strlen(config.fallback_ssid) > 0) {
    Serial.printf("[Upload] Monitored networks failed / no internet. Using fallback network '%s'...\n", config.fallback_ssid);
    ok = postSpoolToWorker(config.fallback_ssid, config.fallback_pass);
    if (ok) return true;
  }

  return false;
}

bool hasUnsubmittedOldData() {
  if (!LittleFS.exists("/spool/pending.jsonl")) return false;

  File f = LittleFS.open("/spool/pending.jsonl", "r");
  if (!f) return false;
  if (f.size() < 10) {
    f.close();
    return false;
  }

  if (!ntpSynchronized) {
    f.close();
    return false;
  }

  time_t now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
  struct tm tmNow;
  gmtime_r(&now, &tmNow);

  bool foundOld = false;
  while (f.available() && !foundOld) {
    String line = f.readStringUntil('\n');
    if (line.length() < 10) continue;
    JsonDocument doc;
    if (!deserializeJson(doc, line)) {
      unsigned long t = doc["t"];
      if (t > 1000000000) {
        time_t recEpoch = (time_t)t;
        struct tm tmRec;
        gmtime_r(&recEpoch, &tmRec);

        // Record is from an earlier year or earlier calendar day in the same year
        if (tmRec.tm_year < tmNow.tm_year ||
           (tmRec.tm_year == tmNow.tm_year && tmRec.tm_yday < tmNow.tm_yday)) {
          foundOld = true;
          Serial.printf("[Spool] Found unsubmitted record from %04d-%02d-%02d (today is %04d-%02d-%02d)\n",
                        tmRec.tm_year + 1900, tmRec.tm_mon + 1, tmRec.tm_mday,
                        tmNow.tm_year + 1900, tmNow.tm_mon + 1, tmNow.tm_mday);
          break;
        }

        // Or record is older than 20 hours
        if (now > recEpoch && (now - recEpoch) > 72000) {
          foundOld = true;
          Serial.printf("[Spool] Found unsubmitted record older than 20 hours (%ld seconds old)\n", (long)(now - recEpoch));
          break;
        }
      }
    }
  }
  f.close();

  // Also check if daily upload for yesterday was never executed while pending records exist
  if (!foundOld && spoolState.last_upload_day != -1 && spoolState.last_upload_day < tmNow.tm_yday) {
    foundOld = true;
    Serial.printf("[Spool] Pending records exist and last upload day was %d (current day %d)\n",
                  spoolState.last_upload_day, tmNow.tm_yday);
  }

  return foundOld;
}

void checkUnsubmittedData() {
  if (!LittleFS.exists("/spool/pending.jsonl")) return;

  if (!ntpSynchronized) {
    syncNTP();
  }
  if (!ntpSynchronized) return;

  if (hasUnsubmittedOldData()) {
    Serial.println("[Spool] Old collected data has not been submitted! Triggering immediate upload...");
    bool ok = uploadSpoolWithFallback();
    if (ok) {
      Serial.println("[Spool] Old data successfully submitted and marked in flash.");
    } else {
      Serial.println("[Spool] Failed to submit old data; will retry next probe cycle.");
    }
  }
}

void checkDailyUpload() {
  if (!ntpSynchronized) return;

  time_t now = ntpBaseEpoch + (millis() - ntpBaseMillis) / 1000;
  struct tm tmNow;
  gmtime_r(&now, &tmNow);
  int hourUTC = tmNow.tm_hour;
  int currentDay = tmNow.tm_yday;

  // Upload window: 19:00 to 21:00 UTC (02:00 to 04:00 Vietnam time)
  if (hourUTC >= 19 && hourUTC <= 21 && spoolState.last_upload_day != currentDay) {
    Serial.println("[Upload] Triggering daily batch upload...");
    bool ok = uploadSpoolWithFallback();
    if (ok) {
      Serial.println("[Upload] Daily batch upload confirmed and recorded.");
    }
  }
}

void checkInitialUpload() {
  if (spoolState.initial_submitted) return;

  Serial.println("[Startup] Initial setup upload pending. Attempting first assessment submission to GitHub...");
  bool ok = uploadSpoolWithFallback();
  if (ok) {
    Serial.println("[Startup] Initial assessment confirmed! Station registered on GitHub immediately.");
  } else {
    Serial.println("[Startup] Initial submission not yet completed. Will retry on next probe cycle.");
  }
}

// ---------- Arduino Lifecycle ----------

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  digitalWrite(PIN_LED, LOW);
  analogReadResolution(12);

  initFileSystem();
  loadConfig();
  loadSpoolState();

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

  // If a new station is set up, submit initial data to GitHub as the initial step
  checkInitialUpload();

  // Check if old collected data has not been submitted (catch-up)
  checkUnsubmittedData();

  // Check if inside daily upload window (19:00 - 21:00 UTC)
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
