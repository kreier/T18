export interface Env {
  DB: D1Database;
  MASTER_PHRASE: string;
  ENVIRONMENT?: string;
  STABLE_VERSION?: string;
  OTA_BUCKET?: R2Bucket;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

export interface StationRecord {
  station_id: string;
  description: string | null;
  device_token: string;
  created_at: number;
  last_seen: number | null;
  firmware_version?: string | null;
  target_version?: string | null;
  board_type?: string | null;
  battery_mv?: number | null;
  is_canary?: number | null;
  ota_url?: string | null;
}

export interface MeasurementRecord {
  id?: number;
  station_id: string;
  timestamp: number;
  ssid: string;
  bssid: string | null;
  channel: number | null;
  assoc_ms: number | null;
  dhcp_ms: number | null;
  google_ms: number | null;
  cloudflare_ms: number | null;
  microsoft_ms: number | null;
  facebook_ms: number | null;
  netflix_ms: number | null;
  apple_ms?: number | null;
  gateway_ms?: number | null;
  dns_ipv4_ms?: number | null;
  dns_ipv6_ms?: number | null;
  scan_duration_ms?: number | null;
  battery_mv?: number | null;
  status: string | null;
}

export interface ScanSurveyRecord {
  id?: number;
  station_id: string;
  timestamp: number;
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  quality: number | null;
  encryption: string | null;
  phy_mode: string | null;
  channel: number | null;
  band: string | null;
}

export interface InactiveSurveyRecord {
  ssid: string | null;
  bssid: string | null;
  channel: number | null;
  phy_mode: string | null;
  encryption: string | null;
  band: string | null;
  rssi?: number | null;
  quality?: number | null;
  last_seen: number;
}

export interface DailySummaryRecord {
  id?: number;
  station_id: string;
  date: string;
  ssid: string;
  sample_count: number;
  assoc_min: number;
  assoc_avg: number;
  assoc_max: number;
  dhcp_min: number;
  dhcp_avg: number;
  dhcp_max: number;
  cf_min: number;
  cf_avg: number;
  cf_max: number;
  google_min: number;
  google_avg: number;
  google_max: number;
}

export interface RegisterRequest {
  station_id: string;
  description?: string;
  bootstrap_secret: string;
}

export interface NetworkPayload {
  ssid: string;
  bssid?: string;
  channel?: number;
  assoc_ms?: number;
  dhcp_ms?: number;
  http_latencies?: {
    google?: number;
    cloudflare?: number;
    microsoft?: number;
    facebook?: number;
    netflix?: number;
    apple?: number;
  };
  gateway_ms?: number;
  dns_ipv4_ms?: number;
  dns_ipv6_ms?: number;
  status?: string;
}

export interface NetworkDiagnosticsPayload {
  ssid?: string;
  gateway_ip?: string;
  gateway_vendor?: string;
  web_exposed?: boolean;
  login_url?: string;
  https_redirect?: boolean;
  mtu_1500_ok?: boolean;
  mtu_1492_ok?: boolean;
  mtu_1420_ok?: boolean;
  dns_ipv4_ms?: number;
  dns_ipv6_ms?: number;
  dns_ipv6_timeout?: boolean;
  dns_rebind_blocked?: boolean;
  captive_portal_detected?: boolean;
  open_ports?: string;
  details_json?: string;
}

export interface NetworkDiagnosticsRecord {
  station_id: string;
  ssid: string;
  timestamp: number;
  gateway_ip: string | null;
  gateway_vendor: string | null;
  web_exposed: number;
  login_url: string | null;
  https_redirect: number;
  mtu_1500_ok: number;
  mtu_1492_ok: number;
  mtu_1420_ok: number;
  dns_ipv4_ms: number | null;
  dns_ipv6_ms: number | null;
  dns_ipv6_timeout: number;
  dns_rebind_blocked: number;
  captive_portal_detected: number;
  open_ports: string | null;
  details_json: string | null;
}

export interface SurveyPayload {
  ssid?: string;
  bssid?: string;
  rssi?: number;
  quality?: number;
  encryption?: string;
  phy_mode?: string;
  channel?: number;
  band?: string;
}

export interface ChannelUtilizationPayload {
  channel: number;
  mgmt_frames: number;
  data_frames: number;
  ctrl_frames: number;
  rssi_hist: number[];
  unique_transmitters: number;
  airtime_pct: number;
}

export interface ChannelUtilizationRecord {
  id?: number;
  station_id: string;
  timestamp: number;
  channel: number;
  mgmt_frames: number;
  data_frames: number;
  ctrl_frames: number;
  rssi_hist: string; // JSON encoded number[]: [lt80, 80_71, 70_61, gte60]
  unique_transmitters: number;
  airtime_pct: number;
  scan_duration_ms?: number | null;
}

export interface BleDevicePayload {
  address: string;
  addr_type?: string;
  name?: string;
  vendor?: string;
  category?: string;
  rssi: number;
  fingerprint?: string;
}

export interface ClassicBtDevicePayload {
  address: string;
  name?: string;
  cod?: number;
  dev_class?: string;
  rssi?: number;
}

export interface BluetoothPayload {
  scan_duration_ms?: number;
  ble_total_packets?: number;
  ble_total_macs?: number;
  ble_unique_devices?: number;
  ble_random_macs?: number;
  ble_public_macs?: number;
  ble_categories?: {
    beacons?: number;
    smartphones?: number;
    wearables?: number;
    audio?: number;
    other?: number;
  };
  ble_devices?: BleDevicePayload[];
  classic_total?: number;
  classic_devices?: ClassicBtDevicePayload[];
}

export interface BluetoothRecord {
  id?: number;
  station_id: string;
  timestamp: number;
  ble_total_packets: number;
  ble_total_macs: number;
  ble_unique_devices: number;
  ble_random_macs: number;
  ble_public_macs: number;
  ble_beacons: number;
  ble_smartphones: number;
  ble_wearables: number;
  ble_audio: number;
  ble_other: number;
  classic_total: number;
  scan_duration_ms?: number | null;
  devices_json?: string | null;
}

export interface InactiveBluetoothRecord {
  type: 'ble' | 'classic';
  address: string;
  addr_type?: string;
  name?: string;
  vendor?: string;
  category?: string;
  dev_class?: string;
  cod?: number;
  rssi?: number | null;
  fingerprint?: string;
  last_seen: number;
  is_active?: boolean | number;
}

export interface TelemetryCyclePayload {
  station_id?: string;
  description?: string;
  timestamp?: number;
  scan_duration_ms?: number;
  battery_mv?: number;
  board_type?: string;
  firmware_version?: string;
  networks?: NetworkPayload[];
  scan_survey?: SurveyPayload[];
  diagnostics?: NetworkDiagnosticsPayload | NetworkDiagnosticsPayload[];
  channel_utilization?: ChannelUtilizationPayload[];
  bluetooth?: BluetoothPayload;
}

export interface StationOverviewCacheRecord {
  station_id: string;
  cached_at: number;
  data: string;
}

export interface DiscoveredApRecord {
  station_id: string;
  bssid: string;
  ssid: string | null;
  channel: number | null;
  rssi: number | null;
  quality: number | null;
  encryption: string | null;
  phy_mode: string | null;
  band: string | null;
  last_seen: number;
}

export interface BatteryHistoryRecord {
  station_id: string;
  timestamp: number;
  battery_mv: number;
}


