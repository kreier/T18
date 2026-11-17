#pragma once

#include <Arduino.h>
#include <esp_partition.h>
#include <vector>
#include <ArduinoJson.h>
#include "app_state.h"
#include "api_client.h"

#define CHAN_HIST_MAGIC   0x43484953 // "CHIS" (Channel History)
#define CHAN_HIST_OFFSET  0x1000     // Partition offset: Sectors 1..3 in 'spiffs' partition (12 KB)
#define CHAN_HIST_SECTORS 3
#define CHAN_HIST_SLOTS   48         // 48 half-hour slots per 24 hours (48 * 30 min = 1440 min = 24h)
#define CHAN_HIST_CHANS   13         // Wi-Fi 2.4 GHz channels 1..13

struct ChannelMetricsSummary {
    uint8_t airtime_pct;        // 0..100% average airtime
    uint8_t unique_transmitters;// 0..255 average unique MACs
    uint16_t mgmt_frames;       // Average management frame count
    uint16_t data_frames;       // Average data frame count
    uint16_t ctrl_frames;       // Average control frame count
    uint16_t rssi_hist[4];      // 4-bracket RSSI histogram (< -80, -80..-71, -70..-61, >= -60 dBm)
};

struct ChannelSlotRecord {
    uint32_t timestamp;         // UTC epoch timestamp of 30-min window start (or 0 if recorded before NTP sync)
    uint32_t relative_sec;      // esp_timer / millis uptime seconds when recorded
    uint8_t  transmitted;       // 1 = successfully submitted to worker, 0 = pending transmission
    uint8_t  sample_count;      // number of cycles averaged in this 30-min slot
    uint8_t  valid;             // 1 = slot contains valid data, 0 = empty
    uint8_t  reserved;          // padding
    uint16_t ble_unique_devices;// unique BLE devices count (max in 30-min slot)
    uint16_t classic_devices;   // classic Bluetooth devices count (max in 30-min slot)
    uint16_t battery_mv;        // battery voltage in mV (or 0 if none)
    uint16_t max_airtime_pct;   // overall max airtime percentage across 13 channels
    ChannelMetricsSummary channels[CHAN_HIST_CHANS]; // 13 channels (index 0 for Ch 1 .. index 12 for Ch 13)
};

struct ChannelHistoryHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t slot_count;
    uint32_t reserved;
};

class ChannelHistoryManager {
public:
    static ChannelHistoryManager& instance() {
        static ChannelHistoryManager inst;
        return inst;
    }

    bool begin() {
        const esp_partition_t *part = getPartition();
        if (!part) {
            Serial.println(F("[ChannelHistory] Error: Data partition 'spiffs' not found!"));
            return false;
        }

        ChannelHistoryHeader hdr;
        if (esp_partition_read(part, CHAN_HIST_OFFSET, &hdr, sizeof(hdr)) != ESP_OK ||
            hdr.magic != CHAN_HIST_MAGIC || hdr.version != 3 || hdr.slot_count != CHAN_HIST_SLOTS) {
            Serial.println(F("[ChannelHistory] Formatting clean 48-slot 30-min history buffer in flash..."));
            memset(_slots, 0, sizeof(_slots));
            saveToFlash();
        } else {
            if (esp_partition_read(part, CHAN_HIST_OFFSET + sizeof(hdr), _slots, sizeof(_slots)) != ESP_OK) {
                Serial.println(F("[ChannelHistory] Failed reading slots from flash, reinitializing"));
                memset(_slots, 0, sizeof(_slots));
                saveToFlash();
            } else {
                uint8_t validCount = 0;
                uint8_t pendingCount = 0;
                for (int i = 0; i < CHAN_HIST_SLOTS; i++) {
                    if (_slots[i].valid) {
                        validCount++;
                        if (!_slots[i].transmitted) pendingCount++;
                    }
                }
                Serial.printf("[ChannelHistory] Flash storage ready: %u valid 30-min records (%u pending transmission)\n",
                              (unsigned)validCount, (unsigned)pendingCount);
            }
        }
        return true;
    }

    // Accumulates cycle measurements into the corresponding 30-minute average/max slot
    void recordCycle(const std::vector<ChannelUtilizationItem> &items,
                     uint16_t bleUniqueDevices,
                     uint16_t classicDevices,
                     uint16_t batteryMv,
                     uint64_t epoch) {
        if (items.empty() && bleUniqueDevices == 0 && classicDevices == 0 && batteryMv == 0) return;

        uint32_t uptimeSec = millis() / 1000;
        uint32_t slotTs = 0;
        uint8_t slotIdx = 0;

        if (epoch >= 1700000000) {
            slotTs = (uint32_t)((epoch / 1800) * 1800);
            slotIdx = (uint8_t)((epoch / 1800) % CHAN_HIST_SLOTS);
        } else {
            slotTs = 0;
            slotIdx = (uint8_t)((uptimeSec / 1800) % CHAN_HIST_SLOTS);
        }

        ChannelSlotRecord &slot = _slots[slotIdx];

        // Determine if we are updating an existing active slot within the same 30-minute interval
        bool sameWindow = false;
        if (slot.valid) {
            if (slotTs > 0 && slot.timestamp == slotTs) {
                sameWindow = true;
            } else if (slotTs == 0 && slot.timestamp == 0 && (uptimeSec >= slot.relative_sec) && ((uptimeSec - slot.relative_sec) < 1800)) {
                sameWindow = true;
            }
        }

        if (sameWindow) {
            uint8_t n = slot.sample_count;
            uint8_t nextN = (n < 255) ? (n + 1) : 255;

            for (const auto &it : items) {
                if (it.channel >= 1 && it.channel <= CHAN_HIST_CHANS) {
                    auto &cm = slot.channels[it.channel - 1];
                    cm.airtime_pct = (uint8_t)(((uint32_t)cm.airtime_pct * n + (uint32_t)round(it.airtime_pct)) / nextN);
                    cm.unique_transmitters = (uint8_t)(((uint32_t)cm.unique_transmitters * n + (it.unique_transmitters > 255 ? 255 : it.unique_transmitters)) / nextN);
                    cm.mgmt_frames = (uint16_t)(((uint32_t)cm.mgmt_frames * n + it.mgmt_frames) / nextN);
                    cm.data_frames = (uint16_t)(((uint32_t)cm.data_frames * n + it.data_frames) / nextN);
                    cm.ctrl_frames = (uint16_t)(((uint32_t)cm.ctrl_frames * n + it.ctrl_frames) / nextN);
                    for (int h = 0; h < 4; h++) {
                        cm.rssi_hist[h] = (uint16_t)(((uint32_t)cm.rssi_hist[h] * n + it.rssi_hist[h]) / nextN);
                    }
                    if (cm.airtime_pct > slot.max_airtime_pct) {
                        slot.max_airtime_pct = cm.airtime_pct;
                    }
                }
            }
            if (bleUniqueDevices > slot.ble_unique_devices) slot.ble_unique_devices = bleUniqueDevices;
            if (classicDevices > slot.classic_devices) slot.classic_devices = classicDevices;
            if (batteryMv > 0) slot.battery_mv = batteryMv;

            slot.sample_count = nextN;
            slot.transmitted = 0; // New cycle added to 30-min record; mark pending upload
            Serial.printf("[ChannelHistory] Averaged cycle into 30-min slot %u (sample count: %u, BLE: %u, Classic: %u, Bat: %u mV)\n",
                          (unsigned)slotIdx, (unsigned)nextN, (unsigned)slot.ble_unique_devices,
                          (unsigned)slot.classic_devices, (unsigned)slot.battery_mv);
        } else {
            // New 30-minute interval: reset slot and populate initial measurement
            slot.valid = 1;
            slot.timestamp = slotTs;
            slot.relative_sec = uptimeSec;
            slot.sample_count = 1;
            slot.transmitted = 0;
            slot.ble_unique_devices = bleUniqueDevices;
            slot.classic_devices = classicDevices;
            slot.battery_mv = batteryMv;
            slot.max_airtime_pct = 0;
            memset(slot.channels, 0, sizeof(slot.channels));

            for (const auto &it : items) {
                if (it.channel >= 1 && it.channel <= CHAN_HIST_CHANS) {
                    auto &cm = slot.channels[it.channel - 1];
                    cm.airtime_pct = (uint8_t)round(it.airtime_pct);
                    cm.unique_transmitters = (it.unique_transmitters > 255) ? 255 : (uint8_t)it.unique_transmitters;
                    cm.mgmt_frames = (it.mgmt_frames > 65535) ? 65535 : (uint16_t)it.mgmt_frames;
                    cm.data_frames = (it.data_frames > 65535) ? 65535 : (uint16_t)it.data_frames;
                    cm.ctrl_frames = (it.ctrl_frames > 65535) ? 65535 : (uint16_t)it.ctrl_frames;
                    for (int h = 0; h < 4; h++) {
                        cm.rssi_hist[h] = (it.rssi_hist[h] > 65535) ? 65535 : (uint16_t)it.rssi_hist[h];
                    }
                    if (cm.airtime_pct > slot.max_airtime_pct) {
                        slot.max_airtime_pct = cm.airtime_pct;
                    }
                }
            }
            Serial.printf("[ChannelHistory] Initialized 30-min slot %u (timestamp: %u, BLE: %u, Classic: %u, Bat: %u mV)\n",
                          (unsigned)slotIdx, (unsigned)slotTs, (unsigned)slot.ble_unique_devices,
                          (unsigned)slot.classic_devices, (unsigned)slot.battery_mv);
        }
    }

    // Calibrates timestamps of slots recorded while offline once NTP sync succeeds
    void calibrateTimestamps(uint64_t currentEpoch) {
        if (currentEpoch < 1700000000) return;
        uint32_t nowSec = millis() / 1000;
        for (int i = 0; i < CHAN_HIST_SLOTS; i++) {
            if (_slots[i].valid && _slots[i].timestamp < 1700000000) {
                uint32_t elapsed = (nowSec >= _slots[i].relative_sec) ? (nowSec - _slots[i].relative_sec) : 0;
                uint64_t realTs = (currentEpoch > elapsed) ? (currentEpoch - elapsed) : currentEpoch;
                _slots[i].timestamp = (uint32_t)((realTs / 1800) * 1800);
                Serial.printf("[ChannelHistory] Calibrated offline slot %d to UTC %lu\n", i, (unsigned long)_slots[i].timestamp);
            }
        }
    }

    // Submits un-transmitted 30-minute channel history records to worker
    bool submitPendingHistory(const String &workerUrl, const String &token, const String &stationId) {
        if (token.length() == 0) return false;

        std::vector<uint8_t> pendingIndices;
        for (uint8_t i = 0; i < CHAN_HIST_SLOTS; i++) {
            if (_slots[i].valid && !_slots[i].transmitted && _slots[i].timestamp >= 1700000000) {
                pendingIndices.push_back(i);
            }
        }

        if (pendingIndices.empty()) return true;

        Serial.printf("[ChannelHistory] Submitting %u pending 30-min channel records to worker...\n",
                      (unsigned)pendingIndices.size());

        // Batch up to 6 slots per HTTP POST to conserve memory
        const size_t batchSize = 6;
        for (size_t b = 0; b < pendingIndices.size(); b += batchSize) {
            size_t endIdx = std::min(b + batchSize, pendingIndices.size());

            JsonDocument doc;
            JsonArray rootArr = doc.to<JsonArray>();

            for (size_t k = b; k < endIdx; k++) {
                uint8_t idx = pendingIndices[k];
                const auto &slot = _slots[idx];

                JsonObject obj = rootArr.add<JsonObject>();
                obj["station_id"] = stationId;
                obj["timestamp"] = slot.timestamp;
                obj["scan_duration_ms"] = 26000;

                if (slot.ble_unique_devices > 0 || slot.classic_devices > 0) {
                    JsonObject bt = obj["bluetooth"].to<JsonObject>();
                    if (slot.ble_unique_devices > 0) bt["ble_unique_devices"] = slot.ble_unique_devices;
                    if (slot.classic_devices > 0) bt["classic_total"] = slot.classic_devices;
                }
                if (slot.battery_mv > 0) {
                    obj["battery_mv"] = slot.battery_mv;
                }

                JsonArray chArr = obj["channel_utilization"].to<JsonArray>();
                for (uint8_t c = 1; c <= CHAN_HIST_CHANS; c++) {
                    const auto &cm = slot.channels[c - 1];
                    JsonObject co = chArr.add<JsonObject>();
                    co["channel"] = c;
                    co["airtime_pct"] = cm.airtime_pct;
                    co["unique_transmitters"] = cm.unique_transmitters;
                    co["mgmt_frames"] = cm.mgmt_frames;
                    co["data_frames"] = cm.data_frames;
                    co["ctrl_frames"] = cm.ctrl_frames;
                    JsonArray rh = co["rssi_hist"].to<JsonArray>();
                    rh.add(cm.rssi_hist[0]);
                    rh.add(cm.rssi_hist[1]);
                    rh.add(cm.rssi_hist[2]);
                    rh.add(cm.rssi_hist[3]);
                }
            }

            String payload;
            serializeJson(doc, payload);

            if (ApiClient::uploadTelemetry(workerUrl, token, payload)) {
                for (size_t k = b; k < endIdx; k++) {
                    _slots[pendingIndices[k]].transmitted = 1;
                }
                saveToFlash();
                Serial.printf("[ChannelHistory] Successfully uploaded batch of %u 30-min records.\n",
                              (unsigned)(endIdx - b));
            } else {
                Serial.println(F("[ChannelHistory] Upload batch failed, will retry on next cycle."));
                return false;
            }
        }
        return true;
    }

    void markSlotTransmitted(uint64_t epoch) {
        if (epoch < 1700000000) return;
        uint32_t slotTs = (uint32_t)((epoch / 1800) * 1800);
        uint8_t slotIdx = (uint8_t)((epoch / 1800) % CHAN_HIST_SLOTS);
        if (_slots[slotIdx].valid && _slots[slotIdx].timestamp == slotTs) {
            _slots[slotIdx].transmitted = 1;
        }
    }

    uint8_t getPendingCount() const {
        uint8_t count = 0;
        for (int i = 0; i < CHAN_HIST_SLOTS; i++) {
            if (_slots[i].valid && !_slots[i].transmitted) count++;
        }
        return count;
    }

    // Persists 48-slot 24h history buffer to raw flash partition ONLY when offline
    void saveToFlash() {
        const esp_partition_t *part = getPartition();
        if (!part) return;

        // Erase 3 sectors (0x1000 to 0x3FFF = 12288 bytes)
        esp_partition_erase_range(part, CHAN_HIST_OFFSET, CHAN_HIST_SECTORS * 4096);

        ChannelHistoryHeader hdr;
        hdr.magic = CHAN_HIST_MAGIC;
        hdr.version = 3;
        hdr.slot_count = CHAN_HIST_SLOTS;
        hdr.reserved = 0;

        esp_partition_write(part, CHAN_HIST_OFFSET, &hdr, sizeof(hdr));
        esp_partition_write(part, CHAN_HIST_OFFSET + sizeof(hdr), _slots, sizeof(_slots));
    }

private:
    ChannelSlotRecord _slots[CHAN_HIST_SLOTS];

    ChannelHistoryManager() {
        memset(_slots, 0, sizeof(_slots));
    }

    static const esp_partition_t* getPartition() {
        static const esp_partition_t *part = nullptr;
        if (!part) {
            part = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_SPIFFS, NULL);
            if (!part) {
                part = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "spiffs");
            }
        }
        return part;
    }
};

using ChannelHistory = ChannelHistoryManager;
