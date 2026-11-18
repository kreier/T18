#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <vector>
#include "app_state.h"

class WifiScanner {
public:
    static std::vector<SurveyItem> performScan(uint32_t &scanDurationMs) {
        std::vector<SurveyItem> results;
        Serial.println(F("[Scanner] Scanning 2.4 GHz Wi-Fi spectrum..."));

        // Set station mode for scanning
        WiFi.mode(WIFI_STA);
        WiFi.disconnect();
        delay(100);

        uint32_t startMs = millis();
        // Parameters: async=false, show_hidden=true, passive=false, max_ms_per_chan=300
        int16_t n = WiFi.scanNetworks(false, true);
        scanDurationMs = millis() - startMs;

        if (n < 0) {
            Serial.printf("[Scanner] Wi-Fi scan failed with code %d (elapsed %u ms)\n", n, (unsigned)scanDurationMs);
            WiFi.scanDelete();
            WiFi.mode(WIFI_OFF);
            return results;
        }

        Serial.printf("[Scanner] Scan complete in %u ms. Found %d networks.\n", (unsigned)scanDurationMs, n);
        results.reserve(n);

        for (int i = 0; i < n; i++) {
            SurveyItem item;
            item.ssid = WiFi.SSID(i);
            if (item.ssid.length() == 0) {
                item.ssid = "<Hidden>";
            }
            item.bssid = WiFi.BSSIDstr(i);
            item.bssid.toUpperCase();
            item.rssi = WiFi.RSSI(i);
            item.quality = calculateQuality(item.rssi);
            item.encryption = getEncryptionString(WiFi.encryptionType(i));
            item.channel = (uint8_t)WiFi.channel(i);
            item.band = "2.4 GHz";
            item.phy_mode = determinePhyMode(WiFi.encryptionType(i), item.channel);

            results.push_back(item);
        }

        // Free scan memory and turn off Wi-Fi radio to reclaim DRAM for Bluetooth scanning
        WiFi.scanDelete();
        WiFi.mode(WIFI_OFF);
        delay(50);

        return results;
    }

    static std::vector<SurveyItem> performScan() {
        uint32_t dummy = 0;
        return performScan(dummy);
    }

    static uint8_t calculateQuality(int16_t rssi) {
        if (rssi <= -100) return 0;
        if (rssi >= -50) return 100;
        return (uint8_t)(2 * (rssi + 100));
    }

    static String getEncryptionString(wifi_auth_mode_t auth) {
        switch (auth) {
            case WIFI_AUTH_OPEN:            return "Open";
            case WIFI_AUTH_WEP:             return "WEP";
            case WIFI_AUTH_WPA_PSK:         return "WPA";
            case WIFI_AUTH_WPA2_PSK:        return "WPA2";
            case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA/WPA2";
            case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-Enterprise";
            case WIFI_AUTH_WPA3_PSK:        return "WPA3";
            case WIFI_AUTH_WPA2_WPA3_PSK:   return "WPA2/WPA3";
            default:                        return "Unknown";
        }
    }

    static String determinePhyMode(wifi_auth_mode_t auth, uint8_t channel) {
        // Standard ESP32 is 2.4 GHz supporting 802.11b (WIFI_1), 802.11g (WIFI_3), 802.11n (WIFI_4)
        if (channel > 13) {
            return "WIFI_1"; // Channel 14 is DSSS only / 802.11b legacy (Japan TELEC)
        }
        if (auth == WIFI_AUTH_WEP) {
            // WEP was supported on both 802.11b and 802.11g (up to 54 Mbps ERP-OFDM).
            // 802.11n strictly prohibits WEP with High Throughput (HT) rates.
            // On channels 1-13, 2.4 GHz WEP access points operate as 802.11g (Wi-Fi 3).
            return "WIFI_3"; // 802.11g (Wi-Fi 3)
        }
        // WPA2 and WPA3 networks on 2.4GHz almost universally support 802.11n HT20
        return "WIFI_4"; // 802.11n (Wi-Fi 4)
    }
};
