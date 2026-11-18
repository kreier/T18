#pragma once

#include <Arduino.h>
#include <vector>
#include <algorithm>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BluetoothSerial.h>

struct BleDeviceRecord {
    String address;       // "AA:BB:CC:DD:EE:FF"
    String addr_type;     // "public", "random_static", "random_rpa", "random_nrpa"
    String name;          // e.g. "Apple AirTag", "Tile", "Bose QC35", or empty
    String vendor;        // "Apple", "Google", "Microsoft", "Samsung", "Tile", "Nordic", etc.
    String category;      // "smartphone", "wearable", "beacon", "audio", "peripheral", "other"
    int16_t rssi;
    String fingerprint;   // Dedup signature
};

struct ClassicBtDeviceRecord {
    String address;       // "AA:BB:CC:DD:EE:FF"
    String name;          // Device friendly name
    uint32_t cod;         // Class of Device (24-bit)
    String dev_class;     // Decoded class (e.g. "Audio / Headset", "Phone", "Computer")
    int16_t rssi;
};

struct BluetoothScanResult {
    uint32_t scan_duration_ms;
    uint32_t ble_total_packets;
    uint16_t ble_total_macs;
    uint16_t ble_unique_devices;
    uint16_t ble_random_macs;
    uint16_t ble_public_macs;
    uint16_t ble_beacons;
    uint16_t ble_smartphones;
    uint16_t ble_wearables;
    uint16_t ble_audio;
    uint16_t ble_other;
    std::vector<BleDeviceRecord> ble_devices;
    uint16_t classic_total;
    std::vector<ClassicBtDeviceRecord> classic_devices;

    BluetoothScanResult() :
        scan_duration_ms(0), ble_total_packets(0), ble_total_macs(0),
        ble_unique_devices(0), ble_random_macs(0), ble_public_macs(0),
        ble_beacons(0), ble_smartphones(0), ble_wearables(0),
        ble_audio(0), ble_other(0), classic_total(0) {}
};

class BluetoothScanner {
public:
    static BluetoothScanResult performScan(uint32_t bleDurationSec = 3, uint32_t classicDurationMs = 2000) {
        BluetoothScanResult result;
        uint32_t startMs = millis();

        // Ensure Wi-Fi radio is off to maximize available DRAM for Bluedroid stack
        WiFi.mode(WIFI_OFF);
        delay(30);

        Serial.printf("[Bluetooth] Initiating 2.4 GHz BLE and Classic Bluetooth Spectrum Scan (Free Heap: %u bytes)...\n",
                      (unsigned)ESP.getFreeHeap());

        // 1. BLE Scan Phase
        scanBle(result, bleDurationSec);

        // 2. Bluetooth Classic Inquiry Phase
        scanClassic(result, classicDurationMs);

        result.scan_duration_ms = millis() - startMs;
        Serial.printf("[Bluetooth] Complete in %lu ms: BLE %lu packets, %u MACs, %u unique devices (Random: %u, Public: %u); Classic: %u devices. Remaining Heap: %u bytes.\n",
                      (unsigned long)result.scan_duration_ms, (unsigned long)result.ble_total_packets,
                      (unsigned)result.ble_total_macs, (unsigned)result.ble_unique_devices,
                      (unsigned)result.ble_random_macs, (unsigned)result.ble_public_macs,
                      (unsigned)result.classic_total, (unsigned)ESP.getFreeHeap());
        return result;
    }

    static String decodeCod(uint32_t cod) {
        if (cod == 0) return "Unknown";
        uint8_t major = (cod >> 8) & 0x1F;
        uint8_t minor = (cod >> 2) & 0x3F;

        switch (major) {
            case 1: { // Computer
                if (minor == 1) return "Desktop Computer";
                if (minor == 2) return "Server";
                if (minor == 3) return "Laptop";
                if (minor == 4) return "Handheld PC/PDA";
                return "Computer";
            }
            case 2: { // Phone
                if (minor == 1) return "Cellular Phone";
                if (minor == 2) return "Cordless Phone";
                if (minor == 3) return "Smartphone";
                return "Phone";
            }
            case 3: return "Network AP";
            case 4: { // Audio / Video
                if (minor == 1) return "Audio / Headset";
                if (minor == 2) return "Audio / Handsfree";
                if (minor == 4) return "Audio / Microphone";
                if (minor == 5) return "Audio / Loudspeaker";
                if (minor == 6) return "Audio / Headphones";
                if (minor == 7) return "Portable Audio";
                if (minor == 8) return "Car Audio";
                if (minor == 10) return "HiFi Audio";
                return "Audio / Video";
            }
            case 5: { // Peripheral
                if (minor & 0x10) return "Keyboard";
                if (minor & 0x20) return "Mouse / Pointing";
                return "Peripheral";
            }
            case 6: return "Imaging / Printer";
            case 7: { // Wearable
                if (minor == 1) return "Smartwatch";
                return "Wearable";
            }
            case 8: return "Toy";
            case 9: return "Health Device";
            default: return "Bluetooth Device";
        }
    }

private:
    static void scanBle(BluetoothScanResult &result, uint32_t durationSec) {
        if (ESP.getFreeHeap() < 40000) {
            Serial.printf("[Bluetooth] Warning: Low heap (%u bytes), skipping BLE scan to prevent crash.\n",
                          (unsigned)ESP.getFreeHeap());
            return;
        }

        BLEDevice::init("WIFI-Mon");
        BLEScan* pBLEScan = BLEDevice::getScan();
        if (!pBLEScan) {
            Serial.println(F("[Bluetooth] Warning: Failed to obtain BLEScan instance."));
            BLEDevice::deinit(false);
            return;
        }
        pBLEScan->setActiveScan(true);
        pBLEScan->setInterval(100);
        pBLEScan->setWindow(99);

        BLEScanResults* pResults = pBLEScan->start(durationSec, false);
        if (!pResults) {
            BLEDevice::deinit(false);
            return;
        }

        int count = pResults->getCount();
        result.ble_total_packets = count;

        std::vector<uint64_t> observedMacs;
        observedMacs.reserve(64);
        std::vector<BleDeviceRecord> uniqueDevices;
        uniqueDevices.reserve(25);

        for (int i = 0; i < count; i++) {
            BLEAdvertisedDevice dev = pResults->getDevice(i);

            // Record MAC address as 64-bit integer (zero heap allocation)
            uint8_t* nativeAddr = dev.getAddress().getNative();
            if (nativeAddr) {
                uint64_t macKey = 0;
                for (int b = 0; b < 6; b++) macKey = (macKey << 8) | nativeAddr[b];
                bool macSeen = false;
                for (uint64_t m : observedMacs) {
                    if (m == macKey) { macSeen = true; break; }
                }
                if (!macSeen) observedMacs.push_back(macKey);
            }

            // Determine address type
            uint8_t addrType = dev.getAddressType();
            uint8_t topByte = nativeAddr ? nativeAddr[0] : 0;

            String addrTypeStr = "public";
            if (addrType != 0) {
                if ((topByte & 0xC0) == 0xC0) {
                    addrTypeStr = "random_static";
                } else if ((topByte & 0xC0) == 0x40) {
                    addrTypeStr = "random_rpa";
                } else {
                    addrTypeStr = "random_nrpa";
                }
            }

            // Extract basic fields
            String devName = dev.haveName() ? dev.getName().c_str() : "";
            int rssi = dev.getRSSI();
            uint8_t* payload = dev.getPayload();
            size_t payloadLen = dev.getPayloadLength();

            // Analyze payload AD structures
            String vendor = "Generic";
            String category = "other";
            String beaconId = "";
            uint16_t companyId = 0;
            uint8_t mfrSubType = 0;
            uint16_t primaryServiceUuid = 0;

            parseBlePayload(payload, payloadLen, devName, vendor, category,
                            beaconId, companyId, mfrSubType, primaryServiceUuid);

            // Fallback categorization based on name or services
            if (category == "other") {
                if (dev.haveAppearance()) {
                    uint16_t app = dev.getAppearance();
                    uint8_t appCat = (app >> 6) & 0x3F;
                    if (appCat == 1) category = "smartphone";
                    else if (appCat == 2) category = "computer";
                    else if (appCat == 3) category = "wearable";
                    else if (appCat == 8 || appCat == 9) category = "beacon";
                    else if (appCat == 13) category = "other";
                }
            }

            String addrStr = dev.getAddress().toString().c_str();
            addrStr.toUpperCase();

            // Build deduplication fingerprint
            String fp;
            if (addrTypeStr == "public") {
                fp = "PUB:" + addrStr;
            } else if (!beaconId.isEmpty()) {
                fp = "BEACON:" + beaconId;
            } else if (!devName.isEmpty()) {
                fp = "NAME:" + devName + ":" + String(companyId, HEX) + ":" + String(primaryServiceUuid, HEX);
            } else if (companyId != 0) {
                int rssiZone = (rssi + 120) / 18;
                fp = "RPA:" + String(companyId, HEX) + ":" + String(mfrSubType, HEX) + ":" +
                     String(primaryServiceUuid, HEX) + ":Z" + String(rssiZone);
            } else {
                fp = "RAND:" + addrStr;
            }

            BleDeviceRecord rec;
            rec.address = addrStr;
            rec.addr_type = addrTypeStr;
            rec.name = devName;
            rec.vendor = vendor;
            rec.category = category;
            rec.rssi = rssi;
            rec.fingerprint = fp;

            // Deduplicate linearly without allocating map/tree nodes (strictly capped at 25 devices)
            bool found = false;
            for (auto &existing : uniqueDevices) {
                if (existing.fingerprint == fp) {
                    if (rssi > existing.rssi) {
                        existing = rec;
                    }
                    found = true;
                    break;
                }
            }
            if (!found && uniqueDevices.size() < 25) {
                uniqueDevices.push_back(rec);
            }
        }

        pBLEScan->clearResults();
        BLEDevice::deinit(false);

        result.ble_total_macs = observedMacs.size();
        result.ble_unique_devices = uniqueDevices.size();

        // Count categories and address distributions
        for (const auto &d : uniqueDevices) {
            if (d.addr_type == "public" || d.addr_type == "random_static") {
                result.ble_public_macs++;
            } else {
                result.ble_random_macs++;
            }

            if (d.category == "beacon") result.ble_beacons++;
            else if (d.category == "smartphone") result.ble_smartphones++;
            else if (d.category == "wearable") result.ble_wearables++;
            else if (d.category == "audio") result.ble_audio++;
            else result.ble_other++;

            result.ble_devices.push_back(d);
        }

        // Sort unique devices by signal strength descending (strongest first)
        std::sort(result.ble_devices.begin(), result.ble_devices.end(),
                  [](const BleDeviceRecord &a, const BleDeviceRecord &b) {
                      return a.rssi > b.rssi;
                  });

        // Cap reported BLE device details to top 15 most prominent
        if (result.ble_devices.size() > 15) {
            result.ble_devices.resize(15);
        }
    }

    static void parseBlePayload(const uint8_t* payload, size_t payloadLen,
                                String &devName, String &vendor, String &category,
                                String &beaconId, uint16_t &companyId,
                                uint8_t &mfrSubType, uint16_t &primaryServiceUuid) {
        if (!payload || payloadLen == 0) return;

        size_t idx = 0;
        while (idx < payloadLen) {
            uint8_t adLen = payload[idx];
            if (adLen == 0 || idx + 1 + adLen > payloadLen) break;
            uint8_t adType = payload[idx + 1];
            const uint8_t* adData = &payload[idx + 2];
            uint8_t dataLen = adLen - 1;

            if ((adType == 0x08 || adType == 0x09) && devName.isEmpty() && dataLen > 0) {
                char nameBuf[33];
                size_t cLen = (dataLen < 32) ? dataLen : 32;
                memcpy(nameBuf, adData, cLen);
                nameBuf[cLen] = '\0';
                devName = String(nameBuf);
            } else if (adType == 0x02 || adType == 0x03) {
                // 16-bit Service UUIDs
                for (size_t s = 0; s + 1 < dataLen; s += 2) {
                    uint16_t uuid = adData[s] | (adData[s + 1] << 8);
                    if (primaryServiceUuid == 0) primaryServiceUuid = uuid;
                    classifyServiceUuid(uuid, vendor, category, devName);
                }
            } else if (adType == 0x16 && dataLen >= 2) {
                // Service Data 16-bit UUID
                uint16_t sUuid = adData[0] | (adData[1] << 8);
                if (primaryServiceUuid == 0) primaryServiceUuid = sUuid;
                if (sUuid == 0xFEAA && dataLen >= 3) {
                    // Google Eddystone
                    vendor = "Google";
                    category = "beacon";
                    if (adData[2] == 0x00 && dataLen >= 19) {
                        // Eddystone-UID: namespace (10 bytes) + instance (6 bytes)
                        char buf[34];
                        snprintf(buf, sizeof(buf), "EDDY_%02X%02X%02X%02X%02X%02X",
                                 adData[13], adData[14], adData[15], adData[16], adData[17], adData[18]);
                        beaconId = String(buf);
                        if (devName.isEmpty()) devName = "Eddystone Beacon";
                    } else if (devName.isEmpty()) {
                        devName = "Eddystone URL/TLM";
                    }
                } else {
                    classifyServiceUuid(sUuid, vendor, category, devName);
                }
            } else if (adType == 0xFF && dataLen >= 2) {
                // Manufacturer Specific Data
                companyId = adData[0] | (adData[1] << 8);
                if (dataLen >= 3) mfrSubType = adData[2];

                if (companyId == 0x004C) { // Apple Inc.
                    vendor = "Apple";
                    if (dataLen >= 4) {
                        uint8_t appleType = adData[2];
                        if (appleType == 0x02 && dataLen >= 25) { // iBeacon
                            category = "beacon";
                            uint16_t major = (adData[20] << 8) | adData[21];
                            uint16_t minor = (adData[22] << 8) | adData[23];
                            char bBuf[32];
                            snprintf(bBuf, sizeof(bBuf), "IBEACON:%u:%u", major, minor);
                            beaconId = String(bBuf);
                            if (devName.isEmpty()) devName = "iBeacon";
                        } else if (appleType == 0x12) { // Apple Find My / AirTag
                            category = "beacon";
                            if (devName.isEmpty()) devName = "Apple Find My / AirTag";
                            if (dataLen >= 7) {
                                char bBuf[32];
                                snprintf(bBuf, sizeof(bBuf), "AIRTAG:%02X%02X%02X%02X",
                                         adData[3], adData[4], adData[5], adData[6]);
                                beaconId = String(bBuf);
                            }
                        } else if (appleType == 0x10) { // Nearby Action
                            category = "smartphone";
                            if (devName.isEmpty()) devName = "Apple Nearby Device";
                        } else if (appleType == 0x07) { // AirPods
                            category = "audio";
                            if (devName.isEmpty()) devName = "AirPods";
                        } else if (appleType == 0x05) { // AirDrop
                            category = "smartphone";
                            if (devName.isEmpty()) devName = "Apple AirDrop";
                        } else if (appleType == 0x09) { // AirPlay
                            category = "audio";
                            if (devName.isEmpty()) devName = "AirPlay Target";
                        } else if (category == "other") {
                            category = "smartphone";
                            if (devName.isEmpty()) devName = "Apple Device";
                        }
                    } else if (category == "other") {
                        category = "smartphone";
                        if (devName.isEmpty()) devName = "Apple Device";
                    }
                } else if (companyId == 0x0006) { // Microsoft
                    vendor = "Microsoft";
                    category = "computer";
                    if (devName.isEmpty()) devName = "Windows Device";
                } else if (companyId == 0x00E0) { // Google
                    vendor = "Google";
                    category = "smartphone";
                    if (devName.isEmpty()) devName = "Google Fast Pair / Android";
                } else if (companyId == 0x0075) { // Samsung
                    vendor = "Samsung";
                    category = "smartphone";
                    if (devName.isEmpty()) devName = "Samsung Galaxy / SmartThings";
                } else if (companyId == 0x038F) { // Xiaomi
                    vendor = "Xiaomi";
                    category = "wearable";
                    if (devName.isEmpty()) devName = "Xiaomi Device";
                } else if (companyId == 0x01DA) { // Logitech
                    vendor = "Logitech";
                    category = "peripheral";
                    if (devName.isEmpty()) devName = "Logitech Peripheral";
                } else if (companyId == 0x0059) { // Nordic Semiconductor
                    vendor = "Nordic";
                    if (devName.isEmpty()) devName = "Nordic BLE Sensor";
                }
            }

            idx += 1 + adLen;
        }
    }

    static void classifyServiceUuid(uint16_t uuid, String &vendor, String &category, String &devName) {
        switch (uuid) {
            case 0x180D: // Heart Rate
                category = "wearable";
                if (devName.isEmpty()) devName = "Heart Rate Monitor";
                break;
            case 0x1812: // HID
                category = "peripheral";
                if (devName.isEmpty()) devName = "BLE Keyboard / Mouse";
                break;
            case 0x180F: // Battery Service
                if (category == "other") category = "wearable";
                break;
            case 0xFE2C: // Google Fast Pair
                vendor = "Google";
                category = "smartphone";
                if (devName.isEmpty()) devName = "Google Fast Pair";
                break;
            case 0xFD6F: // Exposure Notification
                category = "smartphone";
                if (devName.isEmpty()) devName = "Exposure Notification";
                break;
            case 0xFEED: // Tile
                vendor = "Tile";
                category = "beacon";
                if (devName.isEmpty()) devName = "Tile Tracker";
                break;
            default:
                break;
        }
    }

    static void scanClassic(BluetoothScanResult &result, uint32_t durationMs) {
        if (ESP.getFreeHeap() < 35000) {
            Serial.printf("[Bluetooth] Warning: Low heap (%u bytes), skipping Classic BT scan.\n",
                          (unsigned)ESP.getFreeHeap());
            return;
        }

        BluetoothSerial serialBT;
        if (!serialBT.begin("WIFI-Mon", true)) {
            Serial.println(F("[Bluetooth] Warning: BluetoothSerial master initialization failed."));
            return;
        }

        BTScanResults* pBtResults = serialBT.discover(durationMs);
        if (pBtResults) {
            int count = pBtResults->getCount();
            result.classic_total = count;

            for (int i = 0; i < count; i++) {
                BTAdvertisedDevice* bDev = pBtResults->getDevice(i);
                if (!bDev) continue;

                ClassicBtDeviceRecord rec;
                rec.address = bDev->getAddress().toString().c_str();
                rec.address.toUpperCase();
                rec.name = bDev->haveName() ? bDev->getName().c_str() : "";
                rec.cod = bDev->haveCOD() ? bDev->getCOD() : 0;
                rec.dev_class = decodeCod(rec.cod);
                rec.rssi = bDev->haveRSSI() ? bDev->getRSSI() : -100;

                result.classic_devices.push_back(rec);
            }
        }

        serialBT.discoverClear();
        serialBT.end();

        // Sort classic devices by RSSI descending
        std::sort(result.classic_devices.begin(), result.classic_devices.end(),
                  [](const ClassicBtDeviceRecord &a, const ClassicBtDeviceRecord &b) {
                      return a.rssi > b.rssi;
                  });

        if (result.classic_devices.size() > 10) {
            result.classic_devices.resize(10);
        }
    }
};
