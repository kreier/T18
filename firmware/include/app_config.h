#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include "app_state.h"

#define NVS_NAMESPACE "wifi_mon"
#define NVS_KEY_TOKEN "device_token"

class AppConfigManager {
public:
    AppConfigManager() {}

    bool begin() {
        return true;
    }

    bool loadConfig(AppConfig &config) {
        Preferences prefs;
        if (!prefs.begin(NVS_NAMESPACE, true)) {
            Serial.println(F("[Config] No NVS configuration found."));
            config.is_configured = false;
            return false;
        }

        String stId = prefs.getString("st_id", "");
        if (stId.length() == 0) {
            prefs.end();
            config.is_configured = false;
            return false;
        }

        strlcpy(config.station_id, stId.c_str(), sizeof(config.station_id));
        strlcpy(config.station_desc, prefs.getString("st_desc", "").c_str(), sizeof(config.station_desc));
        strlcpy(config.worker_url, prefs.getString("worker_url", DEFAULT_WORKER_URL).c_str(), sizeof(config.worker_url));
        if (strstr(config.worker_url, "kreier.workers.dev") != nullptr || strlen(config.worker_url) == 0) {
            Serial.println(F("[Config] Migrating worker_url to T18 worker: " DEFAULT_WORKER_URL));
            strlcpy(config.worker_url, DEFAULT_WORKER_URL, sizeof(config.worker_url));
            prefs.end();
            if (prefs.begin(NVS_NAMESPACE, false)) {
                prefs.putString("worker_url", config.worker_url);
                prefs.remove(NVS_KEY_TOKEN);
                prefs.end();
            }
            prefs.begin(NVS_NAMESPACE, true);
        }
        strlcpy(config.master_phrase, prefs.getString("master", "").c_str(), sizeof(config.master_phrase));

        config.network_count = prefs.getUChar("net_cnt", 0);
        if (config.network_count > MAX_MONITORED_NETWORKS) {
            config.network_count = MAX_MONITORED_NETWORKS;
        }

        for (uint8_t i = 0; i < config.network_count; i++) {
            String ssidKey = "ssid_" + String(i);
            String passKey = "pass_" + String(i);
            strlcpy(config.networks[i].ssid, prefs.getString(ssidKey.c_str(), "").c_str(), sizeof(config.networks[0].ssid));
            strlcpy(config.networks[i].password, prefs.getString(passKey.c_str(), "").c_str(), sizeof(config.networks[0].password));
        }

        // Backup Internet Connection
        config.backup_enabled = prefs.getBool("bkp_en", false);
        String bkpSsid = prefs.getString("bkp_ssid", "S24");
        String bkpPass = prefs.getString("bkp_pass", "12345678");
        strlcpy(config.backup_ssid, bkpSsid.c_str(), sizeof(config.backup_ssid));
        strlcpy(config.backup_pass, bkpPass.c_str(), sizeof(config.backup_pass));

        // Hardware Profile
        uint8_t hwType = prefs.getUChar("hw_type", (uint8_t)BOARD_T18);
        config.hw.setPreset((BoardType)hwType);

        String hwName = prefs.getString("hw_name", "");
        if (hwName.length() > 0) {
            strlcpy(config.hw.board_name, hwName.c_str(), sizeof(config.hw.board_name));
        }
        config.hw.status_led_pin = prefs.getChar("led_pin", config.hw.status_led_pin);
        config.hw.rgb_led_pin = prefs.getChar("rgb_pin", config.hw.rgb_led_pin);
        config.hw.battery_pin = prefs.getChar("bat_pin", config.hw.battery_pin);
        config.hw.battery_divider = prefs.getFloat("bat_div", config.hw.battery_divider);
        config.hw.has_5ghz = prefs.getBool("has_5g", config.hw.has_5ghz);
        config.hw.has_wifi6 = prefs.getBool("has_w6", config.hw.has_wifi6);

        config.powerbank_keepalive = prefs.getBool("pb_alive", false);
        config.is_configured = prefs.getBool("is_cfg", (strlen(config.station_id) > 0 && config.network_count > 0));
        prefs.end();

        Serial.printf("[Config] Loaded station '%s' (%s) with %d networks configured from NVS\n",
                      config.station_id, config.hw.board_name, config.network_count);
        return true;
    }

    bool saveConfig(const AppConfig &config) {
        Preferences prefs;
        if (!prefs.begin(NVS_NAMESPACE, false)) {
            Serial.println(F("[Config] Failed to open NVS for writing"));
            return false;
        }

        prefs.putString("st_id", config.station_id);
        prefs.putString("st_desc", config.station_desc);
        prefs.putString("worker_url", config.worker_url);

        if (strlen(config.master_phrase) > 0) {
            prefs.putString("master", config.master_phrase);
        } else {
            prefs.remove("master");
        }

        prefs.putUChar("net_cnt", config.network_count);
        for (uint8_t i = 0; i < config.network_count; i++) {
            String ssidKey = "ssid_" + String(i);
            String passKey = "pass_" + String(i);
            prefs.putString(ssidKey.c_str(), config.networks[i].ssid);
            prefs.putString(passKey.c_str(), config.networks[i].password);
        }

        // Backup Internet Connection
        prefs.putBool("bkp_en", config.backup_enabled);
        prefs.putString("bkp_ssid", config.backup_ssid);
        prefs.putString("bkp_pass", config.backup_pass);

        // Hardware Profile
        prefs.putUChar("hw_type", config.hw.board_type);
        prefs.putString("hw_name", config.hw.board_name);
        prefs.putChar("led_pin", config.hw.status_led_pin);
        prefs.putChar("rgb_pin", config.hw.rgb_led_pin);
        prefs.putChar("bat_pin", config.hw.battery_pin);
        prefs.putFloat("bat_div", config.hw.battery_divider);
        prefs.putBool("has_5g", config.hw.has_5ghz);
        prefs.putBool("has_w6", config.hw.has_wifi6);

        prefs.putBool("pb_alive", config.powerbank_keepalive);
        prefs.putBool("is_cfg", config.is_configured);
        prefs.end();

        Serial.println(F("[Config] Successfully saved configuration to NVS"));
        return true;
    }

    bool eraseMasterPhrase(AppConfig &config) {
        memset(config.master_phrase, 0, sizeof(config.master_phrase));
        Preferences prefs;
        if (prefs.begin(NVS_NAMESPACE, false)) {
            prefs.remove("master");
            prefs.end();
            Serial.println(F("[Config] Zero-Trust: MASTER_PHRASE permanently erased from NVS and RAM"));
            return true;
        }
        return false;
    }

    bool saveDeviceToken(const String &token) {
        Preferences prefs;
        if (!prefs.begin(NVS_NAMESPACE, false)) {
            Serial.println(F("[NVS] Failed to open NVS namespace"));
            return false;
        }
        size_t written = prefs.putString(NVS_KEY_TOKEN, token);
        prefs.end();
        return written > 0;
    }

    String getDeviceToken() {
        Preferences prefs;
        if (!prefs.begin(NVS_NAMESPACE, true)) {
            return String();
        }
        String token = prefs.getString(NVS_KEY_TOKEN, "");
        prefs.end();
        return token;
    }

    bool hasDeviceToken() {
        String token = getDeviceToken();
        return token.length() > 0;
    }

    void clearDeviceToken() {
        Preferences prefs;
        if (prefs.begin(NVS_NAMESPACE, false)) {
            prefs.remove(NVS_KEY_TOKEN);
            prefs.end();
            Serial.println(F("[NVS] Cleared stored device token"));
        }
    }
};
