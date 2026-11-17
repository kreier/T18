#pragma once

#include <Arduino.h>
#include <esp_sleep.h>
#include "board_pins.h"
#include "app_state.h"
#include "led_controller.h"
#include "app_config.h"
#include "captive_portal.h"
#include "ntp_sync.h"
#include "wifi_scanner.h"
#include "latency_prober.h"
#include "spool_manager.h"
#include "api_client.h"
#include "channel_analyzer.h"
#include "channel_history.h"
#include "bluetooth_scanner.h"
#include "ota_manager.h"

#define MEASUREMENT_INTERVAL_SEC 600 // 10 minutes

class AppMain {
public:
    AppMain() : _led(5), _portal(_configMgr, _led), _lastDailyCheckEpoch(0),
                _lastOtaCheckEpoch(0) {}

    void setup() {
        Serial.begin(115200);
        delay(500);

        _configMgr.begin();
        ChannelHistory::instance().begin();
        SpoolManager::begin();

        _configMgr.loadConfig(_config);

        // Configure LED pin from saved hardware profile
        _led.setPin(_config.hw.status_led_pin);
        _led.begin();
        pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

        Serial.println(F("\n========================================"));
        Serial.printf(" flynn0/T18 Unified Firmware v%s (%s)\n", FIRMWARE_VERSION, _config.hw.board_name);
        Serial.printf(" Target LED: GPIO %d | Battery Pin: GPIO %d\n",
                      _config.hw.status_led_pin, _config.hw.battery_pin);
        Serial.printf(" Power Bank Keep-Alive: %s\n", _config.powerbank_keepalive ? "ENABLED (500ms/20s)" : "DISABLED");
        Serial.printf(" Backup Internet: %s (SSID: %s)\n", _config.backup_enabled ? "ENABLED" : "DISABLED", _config.backup_ssid);
        Serial.println(F("========================================"));

        // If not configured, launch captive portal immediately
        if (!_config.is_configured) {
            Serial.println(F("[Main] Device not configured. Launching setup captive portal (120s window)..."));
            _portal.startPortal(_config, 120);
            _configMgr.loadConfig(_config);
            _led.setPin(_config.hw.status_led_pin);
        }

        // Attempt zero-trust token registration if needed
        ensureDeviceRegistered();
    }

    void loop() {
        uint32_t cycleStartMs = millis();

        // 1. Read battery voltage and determine power mode
        uint16_t batteryMv = BatteryReader::readBatteryMilliVolts(_config.hw);
        bool onBattery = (_config.hw.battery_pin >= 0 && batteryMv > 0 && batteryMv <= 4200);

        uint32_t targetIntervalSec = onBattery ? 600 : 120; // 10m on battery, 2m if powered (> 4.2V or no battery)
        bool is10mBoundary = false;
        bool is30mBoundary = false;

        if (onBattery) {
            // Every cycle on battery is a 10-minute cycle
            is10mBoundary = true;
            is30mBoundary = (_batteryCycleCount % 3 == 0);
            Serial.printf("\n>>> [Battery Mode: %u mV] Starting 10-Min Cycle #%u (30-Min Cadence: %s) <<<\n",
                          batteryMv, (unsigned)_batteryCycleCount, is30mBoundary ? "YES" : "NO");
        } else {
            // Powered mode: 2-minute cycle, accumulating into 10-minute interval
            _usbSubcycle++;
            is10mBoundary = (_usbSubcycle >= 5);
            if (is10mBoundary) {
                is30mBoundary = (_powered10mCount % 3 == 0);
            }
            Serial.printf("\n>>> [Powered Mode: %u mV] 2-Min Subcycle %u/5 (10-Min Boundary: %s) <<<\n",
                          batteryMv, (unsigned)_usbSubcycle, is10mBoundary ? "YES" : "NO");
        }

        // 2. Check BOOT button
        if (digitalRead(BOOT_BUTTON_PIN) == LOW && checkBootButtonHold(1500)) {
            Serial.println(F("[Main] BOOT button pressed! Launching setup portal..."));
            _portal.startPortal(_config, 60);
            _configMgr.loadConfig(_config);
            _led.setPin(_config.hw.status_led_pin);
            ensureDeviceRegistered();
            return;
        }

        // 3. Promiscuous 13-channel congestion survey (Task 3)
        // On battery: every 30 minutes; Powered: every 2 minutes
        bool shouldScanChannels = onBattery ? is30mBoundary : true;
        std::vector<ChannelUtilizationItem> chanResults;
        if (shouldScanChannels) {
            bool bootPressed = false;
            chanResults = ChannelAnalyzer::measureChannels(2000, &_led, &bootPressed);
            if (bootPressed) {
                Serial.println(F("[Main] BOOT button pressed during channel scan! Launching setup portal..."));
                _portal.startPortal(_config, 60);
                _configMgr.loadConfig(_config);
                _led.setPin(_config.hw.status_led_pin);
                ensureDeviceRegistered();
                return;
            }
            accumulateChannels(chanResults);
        } else {
            Serial.println(F("[Main] Skipping 13-channel survey to conserve battery (30-min cadence)."));
        }

        // 4. Wi-Fi scan survey (Task 1)
        // On battery: every 10 min; Powered: every 2 min
        _led.setSolid(true);
        uint32_t scanDurationMs = 0;
        std::vector<SurveyItem> scanResults = WifiScanner::performScan(scanDurationMs);
        _led.setOff();
        _ramScanDurationMs += scanDurationMs;
        accumulateSurvey(scanResults);

        // 5. Bluetooth 2.4 GHz Scan (Task 2: BLE & Classic)
        // On battery: every 10 min; Powered: every 2 min
        BluetoothScanResult btScan = BluetoothScanner::performScan(3, 2000);
        accumulateBt(btScan);

        // If in powered mode and not yet at 10-minute boundary, enter light sleep now
        if (!onBattery && !is10mBoundary) {
            uint32_t elapsedMs = millis() - cycleStartMs;
            uint32_t sleepMs = 10000;
            if (elapsedMs < (targetIntervalSec * 1000)) {
                sleepMs = (targetIntervalSec * 1000) - elapsedMs;
            }
            enterLightSleep(sleepMs);
            return;
        }

        // =========================================================================
        // 10-MINUTE INTERVAL PROCESSING (Triggered every 10m on battery or powered)
        // =========================================================================

        // Identify visible monitored networks and backup AP from 10-minute accumulated scan
        std::vector<uint8_t> visibleMonitoredIndices;
        for (uint8_t i = 0; i < _config.network_count; i++) {
            for (const auto &item : _ramSurvey) {
                if (item.ssid.length() > 0 && item.ssid == _config.networks[i].ssid) {
                    visibleMonitoredIndices.push_back(i);
                    break;
                }
            }
        }

        bool backupApVisible = false;
        for (const auto &item : _ramSurvey) {
            if (item.ssid == "S24" || (_config.backup_enabled && strlen(_config.backup_ssid) > 0 && item.ssid == _config.backup_ssid)) {
                backupApVisible = true;
                break;
            }
        }
        if (backupApVisible) {
            Serial.println(F("[Main] Backup AP detected in 10-minute Wi-Fi scan."));
        }

        // Check NTP time synchronization if needed
        if (_ntp.shouldSync() && (!visibleMonitoredIndices.empty() || backupApVisible)) {
            bool ntpConnected = false;
            for (uint8_t idx : visibleMonitoredIndices) {
                if (connectWifiSpecific(_config.networks[idx].ssid, _config.networks[idx].password, 15000)) {
                    ntpConnected = true;
                    break;
                }
            }
            if (!ntpConnected && backupApVisible) {
                const char *bSsid = (_config.backup_enabled && strlen(_config.backup_ssid) > 0) ? _config.backup_ssid : "S24";
                const char *bPass = (_config.backup_enabled && strlen(_config.backup_pass) > 0) ? _config.backup_pass : "12345678";
                if (connectWifiSpecific(bSsid, bPass, 15000)) {
                    ntpConnected = true;
                }
            }
            if (ntpConnected) {
                _ntp.syncTime();
                uint64_t ntpEpoch = _ntp.getCurrentEpoch();
                if (_lastOtaCheckEpoch == 0 || (ntpEpoch >= _lastOtaCheckEpoch + 3600)) {
                    _lastOtaCheckEpoch = ntpEpoch;
                    bool updating = OtaManager::checkForUpdate(_config.worker_url, _config.station_id,
                                                               FIRMWARE_VERSION, _config.hw);
                    if (updating) return;
                }
                WiFi.disconnect(true);
            }
        }
        uint64_t currentEpoch = _ntp.getCurrentEpoch();

        // Task 4: Connection speed & latencies
        // On battery: every 30m; Powered: every 10m
        // STRICT REQUIREMENT: Only test defined wifi stations that appeared in 1) (visibleMonitoredIndices)
        bool shouldProbeSpeed = onBattery ? is30mBoundary : true;
        std::vector<NetworkMeasurement> measurements;
        std::vector<NetworkDiagnostics> dailyDiags;
        bool shouldRunDaily = (_lastDailyCheckEpoch == 0 || (currentEpoch > _lastDailyCheckEpoch + 86400));

        if (shouldProbeSpeed) {
            for (uint8_t idx : visibleMonitoredIndices) {
                Serial.printf("[Main] Probing visible station '%s'...\n", _config.networks[idx].ssid);
                NetworkMeasurement m = LatencyProber::probeNetwork(_config.networks[idx], 15000);
                measurements.push_back(m);

                if (shouldRunDaily && m.status == "connected") {
                    dailyDiags.push_back(LatencyProber::runDailyDiagnostics(_config.networks[idx]));
                }
                delay(200);
            }
            if (shouldRunDaily && !dailyDiags.empty()) {
                _lastDailyCheckEpoch = currentEpoch;
            }
        } else {
            Serial.println(F("[Main] Skipping station latency probing to conserve battery (30-min cadence)."));
        }
        _led.setOff();

        // Record 30-minute revolving slot into ChannelHistory buffer (kept in RAM; written to flash only if offline)
        if (is30mBoundary) {
            ChannelHistory::instance().recordCycle(_ramChan, _ramBt.ble_unique_devices, _ramBt.classic_total, batteryMv, currentEpoch);
        }

        // Package cycle telemetry
        CycleTelemetry cycle;
        cycle.station_id = _config.station_id;
        cycle.timestamp = currentEpoch;
        cycle.scan_duration_ms = _ramScanDurationMs;
        cycle.battery_mv = batteryMv;
        cycle.board_type = _config.hw.board_name;
        cycle.measurements = measurements;
        cycle.survey = _ramSurvey;
        cycle.has_diagnostics = !dailyDiags.empty();
        cycle.diagnostics = dailyDiags;
        cycle.has_channel_utilization = !_ramChan.empty();
        cycle.channel_utilization = _ramChan;

        // Bluetooth telemetry
        cycle.has_bluetooth = true;
        cycle.bluetooth.scan_duration_ms = _ramBt.scan_duration_ms;
        cycle.bluetooth.ble_total_packets = _ramBt.ble_total_packets;
        cycle.bluetooth.ble_total_macs = _ramBt.ble_total_macs;
        cycle.bluetooth.ble_unique_devices = _ramBt.ble_unique_devices;
        cycle.bluetooth.ble_random_macs = _ramBt.ble_random_macs;
        cycle.bluetooth.ble_public_macs = _ramBt.ble_public_macs;
        cycle.bluetooth.ble_beacons = _ramBt.ble_beacons;
        cycle.bluetooth.ble_smartphones = _ramBt.ble_smartphones;
        cycle.bluetooth.ble_wearables = _ramBt.ble_wearables;
        cycle.bluetooth.ble_audio = _ramBt.ble_audio;
        cycle.bluetooth.ble_other = _ramBt.ble_other;
        for (const auto &bd : _ramBt.ble_devices) {
            BleDeviceTelemetry dt;
            dt.address = bd.address;
            dt.addr_type = bd.addr_type;
            dt.name = bd.name;
            dt.vendor = bd.vendor;
            dt.category = bd.category;
            dt.rssi = bd.rssi;
            dt.fingerprint = bd.fingerprint;
            cycle.bluetooth.ble_devices.push_back(dt);
        }
        cycle.bluetooth.classic_total = _ramBt.classic_total;
        for (const auto &cd : _ramBt.classic_devices) {
            ClassicBtDeviceTelemetry ct;
            ct.address = cd.address;
            ct.name = cd.name;
            ct.cod = cd.cod;
            ct.dev_class = cd.dev_class;
            ct.rssi = cd.rssi;
            cycle.bluetooth.classic_devices.push_back(ct);
        }

        // Upload Attempt every 10 minutes if 1) shows monitored networks or backup "S24"
        bool uploadCandidate = (!visibleMonitoredIndices.empty() || backupApVisible);
        bool uploadSuccess = false;
        if (uploadCandidate) {
            uploadSuccess = processCycleUploadAndOta(cycle, currentEpoch, visibleMonitoredIndices, backupApVisible);
        } else {
            Serial.println(F("[Main] No monitored networks or backup 'S24' visible; skipping Wi-Fi connect to preserve battery."));
        }

        // Flash persistence ONLY if upload is impossible
        if (!uploadSuccess) {
            Serial.println(F("[Main] Offline / Upload not possible: Persisting 30-min channel history and buffering cycle to flash spool."));
            ChannelHistory::instance().saveToFlash();
            SpoolManager::appendCycle(cycle);
        }

        // Reset 10-minute RAM accumulators
        clearRamAccumulators();

        if (onBattery) {
            _batteryCycleCount++;
        } else {
            _usbSubcycle = 0;
            _powered10mCount++;
        }

        // Calculate sleep duration and enter Light Sleep
        uint32_t elapsedMs = millis() - cycleStartMs;
        uint32_t sleepMs = 10000;
        if (elapsedMs < (targetIntervalSec * 1000)) {
            sleepMs = (targetIntervalSec * 1000) - elapsedMs;
        }

        enterLightSleep(sleepMs);

        // Check wake up cause
        if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
            Serial.println(F("[Main] Woken up by BOOT button!"));
            if (checkBootButtonHold(2500)) {
                Serial.println(F("[Main] BOOT button held! Launching captive portal..."));
                _portal.startPortal(_config, 60);
                _configMgr.loadConfig(_config);
                _led.setPin(_config.hw.status_led_pin);
                ensureDeviceRegistered();
            }
        }
    }

private:
    void clearRamAccumulators() {
        _ramSurvey.clear();
        _ramScanDurationMs = 0;
        _ramChan.clear();
        _ramBt = BluetoothScanResult();
    }

    void accumulateSurvey(const std::vector<SurveyItem> &scanResults) {
        for (const auto &item : scanResults) {
            bool found = false;
            for (auto &existing : _ramSurvey) {
                if ((existing.bssid.length() > 0 && existing.bssid == item.bssid) ||
                    (existing.bssid.isEmpty() && existing.ssid == item.ssid)) {
                    if (item.rssi > existing.rssi) {
                        existing.rssi = item.rssi;
                        existing.quality = item.quality;
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                _ramSurvey.push_back(item);
            }
        }
    }

    void accumulateBt(const BluetoothScanResult &bt) {
        _ramBt.scan_duration_ms += bt.scan_duration_ms;
        _ramBt.ble_total_packets += bt.ble_total_packets;
        if (bt.ble_total_macs > _ramBt.ble_total_macs) _ramBt.ble_total_macs = bt.ble_total_macs;
        if (bt.ble_unique_devices > _ramBt.ble_unique_devices) _ramBt.ble_unique_devices = bt.ble_unique_devices;
        if (bt.ble_random_macs > _ramBt.ble_random_macs) _ramBt.ble_random_macs = bt.ble_random_macs;
        if (bt.ble_public_macs > _ramBt.ble_public_macs) _ramBt.ble_public_macs = bt.ble_public_macs;
        if (bt.ble_beacons > _ramBt.ble_beacons) _ramBt.ble_beacons = bt.ble_beacons;
        if (bt.ble_smartphones > _ramBt.ble_smartphones) _ramBt.ble_smartphones = bt.ble_smartphones;
        if (bt.ble_wearables > _ramBt.ble_wearables) _ramBt.ble_wearables = bt.ble_wearables;
        if (bt.ble_audio > _ramBt.ble_audio) _ramBt.ble_audio = bt.ble_audio;
        if (bt.ble_other > _ramBt.ble_other) _ramBt.ble_other = bt.ble_other;
        if (bt.classic_total > _ramBt.classic_total) _ramBt.classic_total = bt.classic_total;

        for (const auto &dev : bt.ble_devices) {
            bool found = false;
            for (auto &existing : _ramBt.ble_devices) {
                if (existing.address == dev.address) {
                    if (dev.rssi > existing.rssi) existing.rssi = dev.rssi;
                    if (existing.name.isEmpty() && !dev.name.isEmpty()) existing.name = dev.name;
                    found = true;
                    break;
                }
            }
            if (!found) {
                _ramBt.ble_devices.push_back(dev);
            }
        }

        for (const auto &cdev : bt.classic_devices) {
            bool found = false;
            for (auto &existing : _ramBt.classic_devices) {
                if (existing.address == cdev.address) {
                    if (cdev.rssi > existing.rssi) existing.rssi = cdev.rssi;
                    if (existing.name.isEmpty() && !cdev.name.isEmpty()) existing.name = cdev.name;
                    found = true;
                    break;
                }
            }
            if (!found) {
                _ramBt.classic_devices.push_back(cdev);
            }
        }
    }

    void accumulateChannels(const std::vector<ChannelUtilizationItem> &items) {
        if (_ramChan.empty()) {
            _ramChan = items;
            return;
        }
        for (const auto &it : items) {
            bool found = false;
            for (auto &existing : _ramChan) {
                if (existing.channel == it.channel) {
                    if (it.airtime_pct > existing.airtime_pct) existing.airtime_pct = it.airtime_pct;
                    if (it.unique_transmitters > existing.unique_transmitters) existing.unique_transmitters = it.unique_transmitters;
                    if (it.mgmt_frames > existing.mgmt_frames) existing.mgmt_frames = it.mgmt_frames;
                    if (it.data_frames > existing.data_frames) existing.data_frames = it.data_frames;
                    if (it.ctrl_frames > existing.ctrl_frames) existing.ctrl_frames = it.ctrl_frames;
                    for (int h = 0; h < 4; h++) {
                        if (it.rssi_hist[h] > existing.rssi_hist[h]) existing.rssi_hist[h] = it.rssi_hist[h];
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                _ramChan.push_back(it);
            }
        }
    }

    bool processCycleUploadAndOta(CycleTelemetry &cycle, uint64_t currentEpoch,
                                  const std::vector<uint8_t> &visibleMonitoredIndices,
                                  bool backupApVisible) {
        bool uploadSuccess = false;

        // Lambda to execute upload and OTA check once connected to an AP
        auto doUpload = [&](const char *apName) -> bool {
            if (!_configMgr.hasDeviceToken()) {
                ensureDeviceRegistered();
            }

            if (!_configMgr.hasDeviceToken()) {
                return false;
            }

            // Check for OTA firmware updates (check every 1 hour or on initial boot)
            if (_lastOtaCheckEpoch == 0 || (currentEpoch >= _lastOtaCheckEpoch + 3600)) {
                _lastOtaCheckEpoch = currentEpoch;
                bool updating = OtaManager::checkForUpdate(_config.worker_url, _config.station_id,
                                                           FIRMWARE_VERSION, _config.hw);
                if (updating) return false;
            }

            String token = _configMgr.getDeviceToken();

            // 1. Submit un-transmitted 30-minute channel utilization history first
            ChannelHistory::instance().calibrateTimestamps(currentEpoch);
            ChannelHistory::instance().submitPendingHistory(_config.worker_url, token, _config.station_id);

            // 2. If there is pending data from past offline cycles, upload it first
            if (SpoolManager::hasPendingData()) {
                Serial.printf("[Main] Found %u pending offline records in flash spool. Uploading backlog...\n",
                              (unsigned)SpoolManager::getRecordCount());
                String spooledBatch = SpoolManager::readNextBatchJson(_config.station_id);
                if (spooledBatch.length() > 2) {
                    if (ApiClient::uploadTelemetry(_config.worker_url, token, spooledBatch)) {
                        SpoolManager::clearSpool();
                        Serial.println(F("[Main] Offline backlog successfully transmitted and cleared."));
                    }
                }
            }

            // 3. Transmit current cycle directly from RAM (ZERO FLASH WEAR)
            String currentPayload = serializeCycleJson(cycle);
            bool ok = ApiClient::uploadTelemetry(_config.worker_url, token, currentPayload);

            if (ok) {
                ChannelHistory::instance().markSlotTransmitted(currentEpoch);
                Serial.printf("[Main] Telemetry uploaded directly from RAM via '%s'.\n", apName);
            } else {
                Serial.printf("[Main] Upload failed via '%s' (no internet access).\n", apName);
            }
            return ok;
        };

        // 1. Try visible monitored networks first
        for (uint8_t idx : visibleMonitoredIndices) {
            if (connectWifiSpecific(_config.networks[idx].ssid, _config.networks[idx].password, 15000)) {
                uploadSuccess = doUpload(_config.networks[idx].ssid);
                WiFi.disconnect(true);
                if (uploadSuccess) break;
            }
        }

        // 2. Failover: If upload failed and backup AP is enabled and was seen in the scan
        if (!uploadSuccess && _config.backup_enabled && backupApVisible && strlen(_config.backup_ssid) > 0) {
            Serial.printf("[Main] Monitored networks unavailable or without internet. Attempting failover to backup AP '%s'...\n",
                          _config.backup_ssid);

            if (connectWifiSpecific(_config.backup_ssid, _config.backup_pass, 15000)) {
                Serial.printf("[Main] Connected to backup AP '%s'! Uploading telemetry...\n", _config.backup_ssid);

                if (_ntp.shouldSync()) {
                    _ntp.syncTime();
                    cycle.timestamp = _ntp.getCurrentEpoch();
                }

                uploadSuccess = doUpload(_config.backup_ssid);
                WiFi.disconnect(true);
            } else {
                Serial.printf("[Main] Failed to connect to backup AP '%s'.\n", _config.backup_ssid);
            }
        }

        // 3. Fallback: If no visible networks succeeded and backup AP was not visible, attempt blind connect to configured networks (e.g. hidden SSID)
        if (!uploadSuccess && visibleMonitoredIndices.empty() && _config.network_count > 0 && !backupApVisible) {
            Serial.println(F("[Main] No visible networks detected; attempting blind connect fallback..."));
            for (uint8_t i = 0; i < _config.network_count; i++) {
                if (connectWifiSpecific(_config.networks[i].ssid, _config.networks[i].password, 10000)) {
                    uploadSuccess = doUpload(_config.networks[i].ssid);
                    WiFi.disconnect(true);
                    if (uploadSuccess) break;
                }
            }
        }

        return uploadSuccess;
    }

    String serializeCycleJson(const CycleTelemetry &cycle) {
        JsonDocument doc;
        doc["station_id"] = cycle.station_id;
        doc["timestamp"] = cycle.timestamp;
        doc["scan_duration_ms"] = cycle.scan_duration_ms;
        if (cycle.battery_mv > 0) doc["battery_mv"] = cycle.battery_mv;
        doc["board_type"] = cycle.board_type;
        doc["firmware_version"] = FIRMWARE_VERSION;
        if (strlen(_config.station_desc) > 0) doc["description"] = _config.station_desc;

        JsonArray arrNet = doc["networks"].to<JsonArray>();
        for (const auto &net : cycle.measurements) {
            JsonObject o = arrNet.add<JsonObject>();
            o["ssid"] = net.ssid;
            o["bssid"] = net.bssid;
            o["channel"] = net.channel;
            o["assoc_ms"] = net.assoc_ms;
            o["dhcp_ms"] = net.dhcp_ms;
            o["gateway_ms"] = net.gateway_ms;
            o["dns_ipv4_ms"] = net.dns_ipv4_ms;
            o["dns_ipv6_ms"] = net.dns_ipv6_ms;
            o["captive_detected"] = net.captive_detected;

            JsonObject lat = o["http_latencies"].to<JsonObject>();
            lat["google"] = net.google_ms;
            lat["cloudflare"] = net.cloudflare_ms;
            lat["microsoft"] = net.microsoft_ms;
            lat["facebook"] = net.facebook_ms;
            lat["netflix"] = net.netflix_ms;

            o["status"] = net.status;
        }

        JsonArray arrSurvey = doc["scan_survey"].to<JsonArray>();
        for (const auto &item : cycle.survey) {
            JsonObject s = arrSurvey.add<JsonObject>();
            s["ssid"] = item.ssid;
            s["bssid"] = item.bssid;
            s["rssi"] = item.rssi;
            s["quality"] = item.quality;
            s["encryption"] = item.encryption;
            s["phy_mode"] = item.phy_mode;
            s["channel"] = item.channel;
            s["band"] = item.band;
        }

        if (cycle.has_diagnostics && !cycle.diagnostics.empty()) {
            JsonArray arrDiag = doc["diagnostics"].to<JsonArray>();
            for (const auto &dItem : cycle.diagnostics) {
                JsonObject d = arrDiag.add<JsonObject>();
                d["ssid"] = dItem.ssid;
                d["gateway_ip"] = dItem.gateway_ip;
                d["gateway_vendor"] = dItem.gateway_vendor;
                d["web_exposed"] = dItem.web_exposed;
                d["login_url"] = dItem.login_url;
                d["https_redirect"] = dItem.https_redirect;
                d["mtu_1500_ok"] = dItem.mtu_1500_ok;
                d["mtu_1492_ok"] = dItem.mtu_1492_ok;
                d["mtu_1420_ok"] = dItem.mtu_1420_ok;
                d["dns_ipv4_ms"] = dItem.dns_ipv4_ms;
                d["dns_ipv6_ms"] = dItem.dns_ipv6_ms;
                d["dns_ipv6_timeout"] = dItem.dns_ipv6_timeout;
                d["dns_rebind_blocked"] = dItem.dns_rebind_blocked;
                d["captive_portal_detected"] = dItem.captive_portal_detected;
                d["open_ports"] = dItem.open_ports;
                d["details_json"] = dItem.details_json;
            }
        }

        if (cycle.has_channel_utilization) {
            JsonArray arrChan = doc["channel_utilization"].to<JsonArray>();
            for (const auto &item : cycle.channel_utilization) {
                JsonObject co = arrChan.add<JsonObject>();
                co["channel"] = item.channel;
                co["mgmt_frames"] = item.mgmt_frames;
                co["data_frames"] = item.data_frames;
                co["ctrl_frames"] = item.ctrl_frames;
                JsonArray rh = co["rssi_hist"].to<JsonArray>();
                rh.add(item.rssi_hist[0]);
                rh.add(item.rssi_hist[1]);
                rh.add(item.rssi_hist[2]);
                rh.add(item.rssi_hist[3]);
                co["unique_transmitters"] = item.unique_transmitters;
                co["airtime_pct"] = round(item.airtime_pct * 10.0f) / 10.0f;
            }
        }

        if (cycle.has_bluetooth) {
            JsonObject bt = doc["bluetooth"].to<JsonObject>();
            bt["scan_duration_ms"] = cycle.bluetooth.scan_duration_ms;
            bt["ble_total_packets"] = cycle.bluetooth.ble_total_packets;
            bt["ble_total_macs"] = cycle.bluetooth.ble_total_macs;
            bt["ble_unique_devices"] = cycle.bluetooth.ble_unique_devices;
            bt["ble_random_macs"] = cycle.bluetooth.ble_random_macs;
            bt["ble_public_macs"] = cycle.bluetooth.ble_public_macs;

            JsonObject cat = bt["ble_categories"].to<JsonObject>();
            cat["beacons"] = cycle.bluetooth.ble_beacons;
            cat["smartphones"] = cycle.bluetooth.ble_smartphones;
            cat["wearables"] = cycle.bluetooth.ble_wearables;
            cat["audio"] = cycle.bluetooth.ble_audio;
            cat["other"] = cycle.bluetooth.ble_other;

            JsonArray bleArr = bt["ble_devices"].to<JsonArray>();
            for (const auto &bd : cycle.bluetooth.ble_devices) {
                JsonObject o = bleArr.add<JsonObject>();
                o["address"] = bd.address;
                o["addr_type"] = bd.addr_type;
                if (!bd.name.isEmpty()) o["name"] = bd.name;
                o["vendor"] = bd.vendor;
                o["category"] = bd.category;
                o["rssi"] = bd.rssi;
                if (!bd.fingerprint.isEmpty()) o["fingerprint"] = bd.fingerprint;
            }

            bt["classic_total"] = cycle.bluetooth.classic_total;
            JsonArray btArr = bt["classic_devices"].to<JsonArray>();
            for (const auto &cd : cycle.bluetooth.classic_devices) {
                JsonObject o = btArr.add<JsonObject>();
                o["address"] = cd.address;
                if (!cd.name.isEmpty()) o["name"] = cd.name;
                o["cod"] = cd.cod;
                o["dev_class"] = cd.dev_class;
                o["rssi"] = cd.rssi;
            }
        }

        String jsonPayload;
        serializeJson(doc, jsonPayload);
        return jsonPayload;
    }

    bool checkBootButtonHold(uint32_t holdTimeMs) {
        if (digitalRead(BOOT_BUTTON_PIN) != LOW) {
            return false;
        }

        Serial.printf("[Main] Checking BOOT button hold (%u ms)...\n", (unsigned)holdTimeMs);
        uint32_t start = millis();
        while (digitalRead(BOOT_BUTTON_PIN) == LOW) {
            if (millis() - start >= holdTimeMs) {
                Serial.println(F("[Main] BOOT button hold confirmed!"));
                return true;
            }
            delay(50);
        }
        return false;
    }

    void ensureDeviceRegistered() {
        if (!_config.is_configured) return;
        if (_configMgr.hasDeviceToken()) return;

        if (strlen(_config.master_phrase) == 0) {
            Serial.println(F("[Main] No device token and no MASTER_PHRASE present. Re-run portal to configure."));
            return;
        }

        Serial.println(F("[Main] Starting Zero-Trust token registration..."));

        bool alreadyConnected = (WiFi.status() == WL_CONNECTED);
        if (!alreadyConnected) {
            if (!connectFirstAvailableWifi()) {
                if (_config.backup_enabled && strlen(_config.backup_ssid) > 0) {
                    Serial.printf("[Main] Monitored networks failed, attempting registration via backup AP '%s'...\n", _config.backup_ssid);
                    if (!connectWifiSpecific(_config.backup_ssid, _config.backup_pass, 15000)) {
                        Serial.println(F("[Main] Cannot register: Backup AP also failed."));
                        return;
                    }
                } else {
                    Serial.println(F("[Main] Cannot register: No Wi-Fi connection available."));
                    return;
                }
            }
        }

        _ntp.syncTime();

        String receivedToken;
        bool ok = ApiClient::registerStation(_config.worker_url, _config.station_id,
                                            _config.station_desc, _config.master_phrase,
                                            receivedToken);

        if (ok) {
            _configMgr.saveDeviceToken(receivedToken);
            _configMgr.eraseMasterPhrase(_config);
            Serial.println(F("[Main] Zero-Trust provisioning complete. Device token secured."));
        } else {
            Serial.println(F("[Main] Registration failed. Retaining MASTER_PHRASE for next cycle retry."));
        }

        if (!alreadyConnected) {
            WiFi.disconnect(true);
        }
    }

    bool connectWifiSpecific(const char *ssid, const char *pass, uint32_t timeoutMs = 15000) {
        WiFi.disconnect(true);
        delay(100);
        WiFi.mode(WIFI_STA);

        Serial.printf("[Main] Connecting to Wi-Fi '%s'...\n", ssid);
        if (pass && strlen(pass) > 0) {
            WiFi.begin(ssid, pass);
        } else {
            WiFi.begin(ssid);
        }

        uint32_t start = millis();
        while (WiFi.status() != WL_CONNECTED && (millis() - start < timeoutMs)) {
            delay(200);
        }

        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("[Main] Connected to '%s' (IP: %s)\n", ssid, WiFi.localIP().toString().c_str());
            return true;
        } else {
            Serial.printf("[Main] Failed to connect to '%s'\n", ssid);
            WiFi.disconnect(true);
            delay(100);
            return false;
        }
    }

    bool connectFirstAvailableWifi(uint32_t timeoutMs = 15000) {
        for (uint8_t i = 0; i < _config.network_count; i++) {
            if (connectWifiSpecific(_config.networks[i].ssid, _config.networks[i].password, timeoutMs)) {
                return true;
            }
        }
        return false;
    }

    void enterLightSleep(uint32_t sleepDurationMs) {
        Serial.printf("[Main] Entering Light Sleep for %u seconds (Power Bank Keep-Alive: %s)...\n",
                      (unsigned)(sleepDurationMs / 1000),
                      _config.powerbank_keepalive ? "ENABLED (500ms pulse every 20s)" : "DISABLED");
        Serial.flush();

        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        _led.setOff();

        esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);

        if (!_config.powerbank_keepalive) {
            uint64_t sleepUs = ((uint64_t)sleepDurationMs) * 1000ULL;
            esp_sleep_enable_timer_wakeup(sleepUs);
            esp_light_sleep_start();
        } else {
            uint32_t remainingMs = sleepDurationMs;
            const uint32_t INTERVAL_SLEEP_MS = 20000; // 20 seconds
            const uint32_t WAKE_PULSE_MS = 500;       // 500 ms

            while (remainingMs > 0) {
                uint32_t chunkSleepMs = (remainingMs > INTERVAL_SLEEP_MS) ? INTERVAL_SLEEP_MS : remainingMs;
                uint64_t chunkSleepUs = ((uint64_t)chunkSleepMs) * 1000ULL;
                esp_sleep_enable_timer_wakeup(chunkSleepUs);
                esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0);

                esp_light_sleep_start();

                // If woken up by BOOT button, exit sleep immediately
                if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
                    break;
                }

                if (remainingMs > chunkSleepMs) {
                    remainingMs -= chunkSleepMs;
                } else {
                    break;
                }

                // Keep-alive pulse: wake for 500 ms with active current draw to keep power bank awake
                _led.setSolid(true);
                delay(WAKE_PULSE_MS);
                _led.setOff();

                if (remainingMs > WAKE_PULSE_MS) {
                    remainingMs -= WAKE_PULSE_MS;
                } else {
                    break;
                }

                // If BOOT button is pressed during pulse, break immediately
                if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
                    break;
                }
            }
        }

        Serial.println(F("[Main] Woke up from Light Sleep."));
    }

    AppConfigManager _configMgr;
    AppConfig _config;
    LedController _led;
    CaptivePortalManager _portal;
    NtpSyncManager _ntp;
    uint64_t _lastDailyCheckEpoch;
    uint64_t _lastOtaCheckEpoch;

    // Power-aware measurement matrix state & RAM accumulators
    uint32_t _batteryCycleCount = 0;
    uint8_t  _usbSubcycle = 0;
    uint32_t _powered10mCount = 0;
    std::vector<SurveyItem> _ramSurvey;
    BluetoothScanResult _ramBt;
    std::vector<ChannelUtilizationItem> _ramChan;
    uint32_t _ramScanDurationMs = 0;
};

// Global singleton helper for setup & loop
inline AppMain& getAppInstance() {
    static AppMain instance;
    return instance;
}

inline void app_setup() {
    getAppInstance().setup();
}

inline void app_loop() {
    getAppInstance().loop();
}

