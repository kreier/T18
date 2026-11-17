-- Migration 0011: Daily 30-minute rollup summaries and long-term network diagnostics change history
-- New tables: daily_30min_summaries, station_network_diagnostics_history

CREATE TABLE IF NOT EXISTS daily_30min_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    date TEXT NOT NULL,
    interval_index INTEGER NOT NULL,
    start_timestamp INTEGER NOT NULL,
    channel_max_airtime TEXT NOT NULL,
    ble_max_unique INTEGER DEFAULT 0,
    classic_max INTEGER DEFAULT 0,
    battery_mv INTEGER,
    UNIQUE(station_id, date, interval_index)
);

CREATE INDEX IF NOT EXISTS idx_daily_30min_station_date ON daily_30min_summaries (station_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_30min_station_time ON daily_30min_summaries (station_id, start_timestamp DESC);

CREATE TABLE IF NOT EXISTS station_network_diagnostics_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    ssid TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    gateway_ip TEXT,
    gateway_vendor TEXT,
    web_exposed INTEGER DEFAULT 0,
    login_url TEXT,
    https_redirect INTEGER DEFAULT 0,
    mtu_1500_ok INTEGER DEFAULT 1,
    mtu_1492_ok INTEGER DEFAULT 1,
    mtu_1420_ok INTEGER DEFAULT 1,
    dns_ipv6_timeout INTEGER DEFAULT 0,
    dns_rebind_blocked INTEGER DEFAULT 0,
    captive_portal_detected INTEGER DEFAULT 0,
    open_ports TEXT,
    details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_diag_hist_station_ssid_time ON station_network_diagnostics_history (station_id, ssid, timestamp DESC);
