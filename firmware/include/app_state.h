#pragma once

#include <Arduino.h>
#include <vector>
#include "board_pins.h"

#define MAX_MONITORED_NETWORKS 5
#define DEFAULT_WORKER_URL "https://t18.dhsp.workers.dev"

struct WifiNetworkConfig {
    char ssid[33];
    char password[65];
};

struct AppConfig {
    char station_id[64];
    char station_desc[128];
    char worker_url[128];
    char master_phrase[64]; // Cleared once device_token is acquired
    WifiNetworkConfig networks[MAX_MONITORED_NETWORKS];
    uint8_t network_count;
    bool is_configured;
    bool powerbank_keepalive; // Wake up 500ms every 20s during light sleep
    bool backup_enabled;      // Failover to backup hotspot if primary Wi-Fi has no internet
    char backup_ssid[33];     // Backup SSID (default: "S24")
    char backup_pass[65];     // Backup Password (default: "12345678")
    HardwareProfile hw;

    AppConfig() {
        memset(station_id, 0, sizeof(station_id));
        memset(station_desc, 0, sizeof(station_desc));
        strncpy(worker_url, DEFAULT_WORKER_URL, sizeof(worker_url) - 1);
        memset(master_phrase, 0, sizeof(master_phrase));
        memset(networks, 0, sizeof(networks));
        network_count = 0;
        is_configured = false;
        powerbank_keepalive = false;
        backup_enabled = false;
        strncpy(backup_ssid, "S24", sizeof(backup_ssid) - 1);
        strncpy(backup_pass, "12345678", sizeof(backup_pass) - 1);
        hw.setPreset(BOARD_T18);
    }
};

struct SurveyItem {
    String ssid;
    String bssid;
    int16_t rssi;
    uint8_t quality;
    String encryption;
    String phy_mode;
    uint8_t channel;
    String band;
};

struct NetworkMeasurement {
    String ssid;
    String bssid;
    uint8_t channel;
    int32_t assoc_ms;
    int32_t dhcp_ms;
    int32_t google_ms;
    int32_t cloudflare_ms;
    int32_t microsoft_ms;
    int32_t facebook_ms;
    int32_t netflix_ms;
    int32_t gateway_ms;    // Local gateway RTT (TCP/ICMP)
    int32_t dns_ipv4_ms;   // DNS IPv4 (A) resolution time
    int32_t dns_ipv6_ms;   // DNS IPv6 (AAAA) resolution time (-1 on timeout/fail)
    bool captive_detected; // True if HTTP canary was intercepted or redirected
    String status; // e.g. "connected", "assoc_timeout", "dhcp_timeout"
};

struct NetworkDiagnostics {
    String ssid;
    String gateway_ip;
    String gateway_vendor; // "pfSense", "OpenWrt", "Generic Gateway", "None / Secured"
    bool web_exposed;
    String login_url;
    bool https_redirect;
    bool mtu_1500_ok;
    bool mtu_1492_ok;
    bool mtu_1420_ok;
    int32_t dns_ipv4_ms;
    int32_t dns_ipv6_ms;
    bool dns_ipv6_timeout;
    bool dns_rebind_blocked;
    bool captive_portal_detected;
    String open_ports;
    String details_json;

    NetworkDiagnostics() :
        ssid(""), gateway_ip(""), gateway_vendor("None / Secured"),
        web_exposed(false), login_url(""), https_redirect(false),
        mtu_1500_ok(true), mtu_1492_ok(true), mtu_1420_ok(true),
        dns_ipv4_ms(-1), dns_ipv6_ms(-1), dns_ipv6_timeout(false),
        dns_rebind_blocked(false), captive_portal_detected(false),
        open_ports(""), details_json("") {}
};

struct ChannelUtilizationItem {
    uint8_t channel;
    uint32_t mgmt_frames;
    uint32_t data_frames;
    uint32_t ctrl_frames;
    uint32_t rssi_hist[4]; // [0: < -80, 1: -80..-71, 2: -70..-61, 3: >= -60]
    uint16_t unique_transmitters;
    float airtime_pct;

    ChannelUtilizationItem() :
        channel(0), mgmt_frames(0), data_frames(0), ctrl_frames(0),
        unique_transmitters(0), airtime_pct(0.0f) {
        rssi_hist[0] = 0;
        rssi_hist[1] = 0;
        rssi_hist[2] = 0;
        rssi_hist[3] = 0;
    }
};

struct BleDeviceTelemetry {
    String address;
    String addr_type;
    String name;
    String vendor;
    String category;
    int16_t rssi;
    String fingerprint;
};

struct ClassicBtDeviceTelemetry {
    String address;
    String name;
    uint32_t cod;
    String dev_class;
    int16_t rssi;
};

struct BluetoothCycleTelemetry {
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
    std::vector<BleDeviceTelemetry> ble_devices;
    uint16_t classic_total;
    std::vector<ClassicBtDeviceTelemetry> classic_devices;

    BluetoothCycleTelemetry() :
        scan_duration_ms(0), ble_total_packets(0), ble_total_macs(0),
        ble_unique_devices(0), ble_random_macs(0), ble_public_macs(0),
        ble_beacons(0), ble_smartphones(0), ble_wearables(0),
        ble_audio(0), ble_other(0), classic_total(0) {}
};

struct CycleTelemetry {
    String station_id;
    uint64_t timestamp; // UTC epoch seconds
    uint32_t scan_duration_ms;
    uint16_t battery_mv;
    String board_type;
    std::vector<NetworkMeasurement> measurements;
    std::vector<SurveyItem> survey;
    bool has_diagnostics;
    std::vector<NetworkDiagnostics> diagnostics;
    bool has_channel_utilization;
    std::vector<ChannelUtilizationItem> channel_utilization;
    bool has_bluetooth;
    BluetoothCycleTelemetry bluetooth;

    CycleTelemetry() :
        timestamp(0), scan_duration_ms(0), battery_mv(0), board_type("T18"),
        has_diagnostics(false), has_channel_utilization(false), has_bluetooth(false) {}
};
