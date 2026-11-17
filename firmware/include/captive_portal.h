#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "board_pins.h"
#include "app_state.h"
#include "app_config.h"
#include "led_controller.h"

class CaptivePortalManager {
public:
    CaptivePortalManager(AppConfigManager &configMgr, LedController &led)
        : _configMgr(configMgr), _led(led), _server(80), _clientConnected(false),
          _portalDone(false), _apStartTime(0), _timeoutPaused(false) {}

    bool startPortal(AppConfig &config, uint32_t timeoutSeconds = 60) {
        WiFi.disconnect(true, true);
        delay(100);
        WiFi.mode(WIFI_AP);

        // Derive SSID from efuse MAC
        uint64_t chipId = ESP.getEfuseMac();
        char apSsid[32];
        snprintf(apSsid, sizeof(apSsid), "T18-Mon-%04X", (uint16_t)(chipId & 0xFFFF));

        IPAddress apIP(192, 168, 4, 1);
        IPAddress netMask(255, 255, 255, 0);
        WiFi.softAPConfig(apIP, apIP, netMask);
        WiFi.softAP(apSsid);

        Serial.printf("[Portal] Started Soft-AP '%s' at IP: %s\n", apSsid, WiFi.softAPIP().toString().c_str());

        // DNS Server for captive redirection
        _dnsServer.start(53, "*", apIP);

        // Set LED to 2 Hz blink while waiting for client
        _led.setBlinkRateHz(2.0f);

        _clientConnected = false;
        _timeoutPaused = false;
        _portalDone = false;
        _apStartTime = millis();
        _timeoutMs = timeoutSeconds * 1000;

        setupWebServer(config);
        _server.begin();
        Serial.println(F("[Portal] Web server listening on port 80"));

        // Event loop
        while (!_portalDone) {
            _dnsServer.processNextRequest();
            _server.handleClient();
            _led.update();

            // Check if BOOT button is clicked to skip setup portal immediately
            if (digitalRead(BOOT_BUTTON_PIN) == LOW && !_clientConnected) {
                Serial.println(F("[Portal] BOOT button pressed. Skipping setup portal."));
                break;
            }

            // Check if any station connected to Soft-AP
            int stationNum = WiFi.softAPgetStationNum();
            if (stationNum > 0 && !_clientConnected) {
                _clientConnected = true;
                _timeoutPaused = true;
                _led.setSolid(true); // Switch to solid ON
                Serial.printf("[Portal] Client connected! (%d active). Paused AP timeout.\n", stationNum);
            }

            // Periodic countdown log in Serial
            static uint32_t lastLogSec = 0;
            uint32_t elapsedSec = (millis() - _apStartTime) / 1000;
            if (!_timeoutPaused && (elapsedSec != lastLogSec) && (elapsedSec > 0) && (elapsedSec % 10 == 0)) {
                lastLogSec = elapsedSec;
                Serial.printf("[Portal] Waiting for setup client (%u/%u s remaining, press BOOT to skip)...\n",
                              (unsigned)(timeoutSeconds - elapsedSec), (unsigned)timeoutSeconds);
            }

            // Check timeout if no client has connected yet
            if (!_timeoutPaused) {
                if (millis() - _apStartTime >= _timeoutMs) {
                    Serial.println(F("[Portal] Timeout reached without client connection. Exiting AP mode."));
                    break;
                }
            }

            delay(10);
        }

        // Cleanup
        _server.stop();
        _dnsServer.stop();
        WiFi.softAPdisconnect(true);
        WiFi.mode(WIFI_OFF);
        _led.setOff();
        Serial.println(F("[Portal] Soft-AP mode stopped."));

        return _portalDone;
    }

private:
    void setupWebServer(AppConfig &config) {
        // Captive portal detection endpoints
        auto redirectHandler = [this]() {
            _server.sendHeader("Location", "http://192.168.4.1/", true);
            _server.send(302, "text/plain", "");
        };

        _server.on("/generate_204", redirectHandler);
        _server.on("/hotspot-detect.html", redirectHandler);
        _server.on("/canonical.html", redirectHandler);
        _server.on("/connecttest.txt", redirectHandler);
        _server.on("/ncsi.txt", redirectHandler);

        // Portal Root UI
        _server.on("/", HTTP_GET, [this, &config]() {
            _server.send(200, "text/html", buildHtmlForm(config));
        });

        // Form Submission Handler
        _server.on("/save", HTTP_POST, [this, &config]() {
            handleFormSave(config);
        });
    }

    String buildHtmlForm(const AppConfig &config) {
        String html = F("<!DOCTYPE html><html lang='en'><head>"
            "<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<title>T18 Wi-Fi Monitor Setup</title><style>"
            ":root{--bg:#0f172a;--card:#1e293b;--text:#f8fafc;--muted:#94a3b8;--border:#334155;"
            "--primary:#38bdf8;--primary-hover:#0284c7;--success:#22c55e}"
            "*{box-sizing:border-box;margin:0;padding:0}"
            "body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;"
            "padding:1.5rem;display:flex;justify-content:center}"
            ".card{background:var(--card);border:1px solid var(--border);border-radius:1rem;padding:2rem;"
            "width:100%;max-width:540px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5)}"
            "h1{font-size:1.5rem;color:var(--primary);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem}"
            "p.sub{color:var(--muted);font-size:0.875rem;margin-bottom:1.5rem}"
            ".section-title{font-size:1rem;font-weight:600;margin:1.25rem 0 0.75rem;color:var(--primary);"
            "border-bottom:1px solid var(--border);padding-bottom:0.25rem}"
            ".field{margin-bottom:1rem}"
            "label{display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.25rem;color:var(--text)}"
            "input,select{width:100%;padding:0.625rem;border-radius:0.5rem;border:1px solid var(--border);"
            "background:#0f172a;color:#fff;font-size:0.875rem}"
            "input:focus,select:focus{outline:none;border-color:var(--primary)}"
            ".row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}"
            ".net-box{background:#111827;border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem}"
            ".pwd-wrap{position:relative;display:flex}"
            ".pwd-wrap input{padding-right:3rem}"
            ".toggle-btn{position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);background:none;"
            "border:none;color:var(--muted);cursor:pointer;font-size:0.75rem;padding:0.25rem}"
            "button[type='submit']{width:100%;background:var(--primary);color:#0f172a;font-weight:600;padding:0.75rem;"
            "border:none;border-radius:0.5rem;cursor:pointer;font-size:1rem;margin-top:1.5rem;transition:background 0.2s}"
            "button[type='submit']:hover{background:var(--primary-hover)}"
            "</style></head><body><div class='card'>"
            "<h1>&#128246; Wi-Fi Monitor Setup</h1>"
            "<p class='sub'>Configure device identity, hardware board profile, and network credentials.</p>"
            "<form method='POST' action='/save'>");

        // Identity
        html += F("<div class='section-title'>Device Identity</div>");
        html += F("<div class='field'><label for='station_id'>Station ID *</label>"
                  "<input type='text' id='station_id' name='station_id' required maxlength='63' value='");
        html += String(config.station_id);
        html += F("' placeholder='e.g. 9E1-9 or office-node-1'></div>");

        html += F("<div class='field'><label for='station_desc'>Description</label>"
                  "<input type='text' id='station_desc' name='station_desc' maxlength='127' value='");
        html += String(config.station_desc);
        html += F("' placeholder='e.g. 2nd Floor Server Room'></div>");

        // Hardware Profile
        html += F("<div class='section-title'>Hardware Board Profile</div>");
        html += F("<div class='field'><label for='hw_type'>Target Board Preset</label>"
                  "<select id='hw_type' name='hw_type' onchange='updateHwPreset()'>");
        html += "<option value='0'" + String(config.hw.board_type == BOARD_T18 ? " selected" : "") + ">LILYGO T18 (LED: GPIO 5, Battery: GPIO 35, 100k/100k)</option>";
        html += "<option value='1'" + String(config.hw.board_type == BOARD_T8 ? " selected" : "") + ">LILYGO T8 (LED: GPIO 21, Battery: GPIO 35, 100k/100k)</option>";
        html += "<option value='2'" + String(config.hw.board_type == BOARD_DEVKIT ? " selected" : "") + ">ESP32 DevKit V1 (LED: GPIO 2, No Battery)</option>";
        html += "<option value='3'" + String(config.hw.board_type == BOARD_CUSTOM ? " selected" : "") + ">Custom / ESP32-C5 (Manual Configuration)</option>";
        html += F("</select></div>");

        html += F("<div class='row'>"
                  "<div class='field'><label for='led_pin'>Status LED Pin (GPIO)</label>"
                  "<input type='number' id='led_pin' name='led_pin' value='");
        html += String(config.hw.status_led_pin);
        html += F("'></div>"
                  "<div class='field'><label for='bat_pin'>Battery ADC Pin (-1 to disable)</label>"
                  "<input type='number' id='bat_pin' name='bat_pin' value='");
        html += String(config.hw.battery_pin);
        html += F("'></div></div>");

        html += F("<div class='row'>"
                  "<div class='field'><label for='bat_div'>Battery Divider Ratio</label>"
                  "<input type='number' step='0.01' id='bat_div' name='bat_div' value='");
        html += String(config.hw.battery_divider, 2);
        html += F("'></div>"
                  "<div class='field'><label for='hw_name'>Hardware Label</label>"
                  "<input type='text' id='hw_name' name='hw_name' value='");
        html += String(config.hw.board_name);
        html += F("'></div></div>");

        // Power Management / Power Bank Keep-Alive
        html += F("<div class='section-title'>Power Management</div>");
        html += F("<div class='field' style='display:flex;align-items:flex-start;gap:0.75rem;margin-top:0.5rem;'>"
                  "<input type='checkbox' id='pb_alive' name='pb_alive' value='1'");
        if (config.powerbank_keepalive) {
            html += F(" checked");
        }
        html += F(" style='width:1.25rem;min-width:1.25rem;height:1.25rem;accent-color:var(--primary);cursor:pointer;margin-top:0.2rem;'>"
                  "<div><label for='pb_alive' style='cursor:pointer;margin-bottom:0.15rem;font-weight:600;'>Power Bank Keep-Alive Workaround</label>"
                  "<span style='color:var(--muted);font-size:0.75rem;line-height:1.3;display:block;'>"
                  "Wake up ESP32 from light sleep for 500 ms every 20 seconds to draw current and prevent external power banks from auto-shutting off."
                  "</span></div></div>");

        // Monitored Networks
        html += F("<div class='section-title'>Monitored Wi-Fi Networks</div>");
        for (int i = 0; i < MAX_MONITORED_NETWORKS; i++) {
            String netSsid = (i < config.network_count) ? String(config.networks[i].ssid) : "";
            String netPass = (i < config.network_count) ? String(config.networks[i].password) : "";
            html += "<div class='net-box'>";
            html += "<div class='field'><label>Network " + String(i + 1) + " SSID</label>";
            html += "<input type='text' name='ssid_" + String(i) + "' value='" + netSsid + "' placeholder='Network SSID (Leave blank to omit)'></div>";
            html += "<div class='field'><label>Password</label><div class='pwd-wrap'>";
            html += "<input type='password' id='pwd_" + String(i) + "' name='pass_" + String(i) + "' value='" + netPass + "' placeholder='Password (or leave blank for Open)'>";
            html += "<button type='button' class='toggle-btn' onclick='togglePwd(\"pwd_" + String(i) + "\")'>Show</button></div></div></div>";
        }

        // Backup Internet Connection
        html += F("<div class='section-title'>Backup Internet Connection</div>");
        html += F("<div class='field' style='display:flex;align-items:flex-start;gap:0.75rem;margin-top:0.5rem;'>"
                  "<input type='checkbox' id='bkp_en' name='bkp_en' value='1'");
        if (config.backup_enabled) {
            html += F(" checked");
        }
        html += F(" style='width:1.25rem;min-width:1.25rem;height:1.25rem;accent-color:var(--primary);cursor:pointer;margin-top:0.2rem;'>"
                  "<div><label for='bkp_en' style='cursor:pointer;margin-bottom:0.15rem;font-weight:600;'>Enable Backup Internet Failover</label>"
                  "<span style='color:var(--muted);font-size:0.75rem;line-height:1.3;display:block;'>"
                  "Connect to backup hotspot (e.g. S24) if monitored networks have no internet connection to ensure telemetry upload."
                  "</span></div></div>");

        html += F("<div class='row'>"
                  "<div class='field'><label for='bkp_ssid'>Backup Hotspot SSID</label>"
                  "<input type='text' id='bkp_ssid' name='bkp_ssid' maxlength='32' value='");
        html += String(strlen(config.backup_ssid) > 0 ? config.backup_ssid : "S24");
        html += F("'></div>"
                  "<div class='field'><label for='bkp_pass'>Backup Password</label><div class='pwd-wrap'>"
                  "<input type='password' id='bkp_pass' name='bkp_pass' maxlength='64' value='");
        html += String(strlen(config.backup_pass) > 0 ? config.backup_pass : "12345678");
        html += F("'><button type='button' class='toggle-btn' onclick='togglePwd(\"bkp_pass\")'>Show</button></div></div></div>");

        // Worker & Bootstrap Security
        html += F("<div class='section-title'>Cloudflare Worker & Provisioning</div>");
        html += F("<div class='field'><label for='worker_url'>Worker Base URL *</label>"
                  "<input type='url' id='worker_url' name='worker_url' required maxlength='127' value='");
        String dispWorkerUrl = (strlen(config.worker_url) > 0) ? String(config.worker_url) : String(DEFAULT_WORKER_URL);
        if (dispWorkerUrl.indexOf("kreier.workers.dev") >= 0 || dispWorkerUrl.length() == 0) {
            dispWorkerUrl = DEFAULT_WORKER_URL;
        }
        html += dispWorkerUrl;
        html += F("'></div>");

        html += F("<div class='field'><label for='master_phrase'>Master Phrase (Bootstrap Secret) *</label>"
                  "<div class='pwd-wrap'>"
                  "<input type='password' id='master_phrase' name='master_phrase' required maxlength='63' value='");
        html += String(config.master_phrase);
        html += F("' placeholder='Worker MASTER_PHRASE for token provisioning'>"
                  "<button type='button' class='toggle-btn' onclick='togglePwd(\"master_phrase\")'>Show</button></div></div>");

        // Submit Button & JavaScript
        html += F("<button type='submit'>Save and Start Monitoring</button></form></div>"
                  "<script>"
                  "function togglePwd(id){"
                  "  const inp = document.getElementById(id);"
                  "  const btn = event.target;"
                  "  if(inp.type==='password'){inp.type='text';btn.innerText='Hide';}"
                  "  else{inp.type='password';btn.innerText='Show';}"
                  "}"
                  "function updateHwPreset(){"
                  "  const t = parseInt(document.getElementById('hw_type').value);"
                  "  const led = document.getElementById('led_pin');"
                  "  const bat = document.getElementById('bat_pin');"
                  "  const div = document.getElementById('bat_div');"
                  "  const lbl = document.getElementById('hw_name');"
                  "  if(t===0){led.value=5;bat.value=35;div.value='0.50';lbl.value='T18';}"
                  "  else if(t===1){led.value=21;bat.value=35;div.value='0.50';lbl.value='T8';}"
                  "  else if(t===2){led.value=2;bat.value=-1;div.value='0.50';lbl.value='DevKitV1';}"
                  "  else if(t===3){lbl.value='Custom';}"
                  "}"
                  "</script></body></html>");

        return html;
    }

    void handleFormSave(AppConfig &config) {
        String stId = _server.arg("station_id");
        String stDesc = _server.arg("station_desc");
        String workerUrl = _server.arg("worker_url");
        String masterPhrase = _server.arg("master_phrase");

        stId.trim();
        stDesc.trim();
        workerUrl.trim();
        masterPhrase.trim();

        if (workerUrl.indexOf("kreier.workers.dev") >= 0 || workerUrl.length() == 0) {
            workerUrl = DEFAULT_WORKER_URL;
        }

        if (stId.length() == 0 || workerUrl.length() == 0) {
            _server.send(400, "text/plain", "Missing required fields: Station ID or Worker URL");
            return;
        }

        // Check if Station ID has changed
        bool stationIdChanged = (strcmp(config.station_id, stId.c_str()) != 0);

        strlcpy(config.station_id, stId.c_str(), sizeof(config.station_id));
        strlcpy(config.station_desc, stDesc.c_str(), sizeof(config.station_desc));
        strlcpy(config.worker_url, workerUrl.c_str(), sizeof(config.worker_url));
        if (masterPhrase.length() > 0) {
            strlcpy(config.master_phrase, masterPhrase.c_str(), sizeof(config.master_phrase));
        }

        // Hardware Profile
        uint8_t hwType = (uint8_t)_server.arg("hw_type").toInt();
        config.hw.board_type = hwType;
        String hwName = _server.arg("hw_name");
        hwName.trim();
        if (hwName.length() > 0) {
            strlcpy(config.hw.board_name, hwName.c_str(), sizeof(config.hw.board_name));
        }
        config.hw.status_led_pin = (int8_t)_server.arg("led_pin").toInt();
        config.hw.battery_pin = (int8_t)_server.arg("bat_pin").toInt();
        config.hw.battery_divider = _server.arg("bat_div").toFloat();
        if (config.hw.battery_divider <= 0.01f) config.hw.battery_divider = 0.5f;

        // Apply new LED pin immediately
        _led.setPin(config.hw.status_led_pin);

        // Power Management
        config.powerbank_keepalive = _server.hasArg("pb_alive");

        // Networks
        config.network_count = 0;
        for (int i = 0; i < MAX_MONITORED_NETWORKS; i++) {
            String ssid = _server.arg("ssid_" + String(i));
            String pass = _server.arg("pass_" + String(i));
            ssid.trim();
            if (ssid.length() > 0) {
                strlcpy(config.networks[config.network_count].ssid, ssid.c_str(), sizeof(config.networks[0].ssid));
                strlcpy(config.networks[config.network_count].password, pass.c_str(), sizeof(config.networks[0].password));
                config.network_count++;
            }
        }

        // Backup Internet Connection
        config.backup_enabled = _server.hasArg("bkp_en");
        String bkpSsid = _server.arg("bkp_ssid");
        String bkpPass = _server.arg("bkp_pass");
        bkpSsid.trim();
        if (bkpSsid.length() == 0) bkpSsid = "S24";
        if (bkpPass.length() == 0 && !_server.hasArg("bkp_pass")) bkpPass = "12345678";
        strlcpy(config.backup_ssid, bkpSsid.c_str(), sizeof(config.backup_ssid));
        strlcpy(config.backup_pass, bkpPass.c_str(), sizeof(config.backup_pass));

        config.is_configured = (config.network_count > 0);
        bool saved = _configMgr.saveConfig(config);

        if (stationIdChanged) {
            Serial.println(F("[Portal] Station ID changed! Clearing device token so station re-registers under new ID."));
            _configMgr.clearDeviceToken();
        }

        String resp = F("<!DOCTYPE html><html><head><meta charset='utf-8'>"
                        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                        "<title>Configuration Saved</title><style>"
                        "body{background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:2rem;text-align:center}"
                        ".box{background:#1e293b;border-radius:1rem;padding:2rem;max-width:400px;margin:auto}"
                        "h2{color:#22c55e;margin-bottom:1rem}p{color:#94a3b8;line-height:1.5}"
                        "</style></head><body><div class='box'>"
                        "<h2>Settings Saved!</h2>"
                        "<p>The ESP32 is now rebooting and switching to monitoring mode with the new settings.</p>"
                        "</div></body></html>");

        _server.send(200, "text/html", resp);
        Serial.printf("[Portal] Saved configuration for station '%s' (%s). Rebooting ESP...\n",
                      config.station_id, config.hw.board_name);

        delay(1500);
        _portalDone = true;
        ESP.restart();
    }

    AppConfigManager &_configMgr;
    LedController &_led;
    WebServer _server;
    DNSServer _dnsServer;
    bool _clientConnected;
    bool _portalDone;
    uint32_t _apStartTime;
    uint32_t _timeoutMs;
    bool _timeoutPaused;
};
