import { Env, StationRecord, MeasurementRecord, ScanSurveyRecord, InactiveSurveyRecord, NetworkDiagnosticsPayload, NetworkDiagnosticsRecord, ChannelUtilizationPayload, ChannelUtilizationRecord, BluetoothPayload, BluetoothRecord, InactiveBluetoothRecord } from "./types";

export class Database {
  private db: D1Database;

  constructor(env: Env) {
    this.db = env.DB;
  }

  async getStationByToken(deviceToken: string): Promise<StationRecord | null> {
    const result = await this.db
      .prepare("SELECT * FROM stations WHERE device_token = ? LIMIT 1")
      .bind(deviceToken)
      .first<StationRecord>();
    return result;
  }

  async getStationById(stationId: string): Promise<StationRecord | null> {
    const result = await this.db
      .prepare("SELECT * FROM stations WHERE station_id = ? LIMIT 1")
      .bind(stationId)
      .first<StationRecord>();
    return result;
  }

  async upsertStation(stationId: string, description: string, deviceToken: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(`
        INSERT INTO stations (station_id, description, device_token, created_at, last_seen)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(station_id) DO UPDATE SET
          description = excluded.description,
          device_token = excluded.device_token,
          last_seen = excluded.last_seen
      `)
      .bind(stationId, description, deviceToken, now, now)
      .run();
  }

  async renameStation(oldId: string, newId: string): Promise<void> {
    if (!oldId || !newId || oldId === newId) return;
    const statements = [
      this.db.prepare("UPDATE stations SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE measurements SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_latest_measurements SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_latest_scan SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_discovered_aps SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_channel_utilization SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_network_diagnostics SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE daily_summaries SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_overview_cache SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_bluetooth_summary SET station_id = ? WHERE station_id = ?").bind(newId, oldId),
      this.db.prepare("UPDATE station_latest_bluetooth SET station_id = ? WHERE station_id = ?").bind(newId, oldId)
    ];
    await this.db.batch(statements);
  }

  async updateStationDescription(stationId: string, description: string): Promise<void> {
    await this.db
      .prepare("UPDATE stations SET description = ? WHERE station_id = ?")
      .bind(description, stationId)
      .run();
  }

  async updateStationLastSeen(
    stationId: string,
    timestamp: number,
    meta?: { firmware_version?: string; board_type?: string; battery_mv?: number }
  ): Promise<void> {
    if (meta && (meta.firmware_version || meta.board_type || meta.battery_mv !== undefined)) {
      await this.db
        .prepare(`
          UPDATE stations SET
            last_seen = ?,
            firmware_version = COALESCE(?, firmware_version),
            board_type = COALESCE(?, board_type),
            battery_mv = COALESCE(?, battery_mv)
          WHERE station_id = ?
        `)
        .bind(
          timestamp,
          meta.firmware_version ?? null,
          meta.board_type ?? null,
          meta.battery_mv ?? null,
          stationId
        )
        .run();
    } else {
      await this.db
        .prepare("UPDATE stations SET last_seen = ? WHERE station_id = ?")
        .bind(timestamp, stationId)
        .run();
    }
  }

  async insertMeasurements(measurements: MeasurementRecord[]): Promise<number> {
    if (measurements.length === 0) return 0;
    
    // Batch insert historical measurements and upsert latest measurements
    const statements: D1PreparedStatement[] = [];

    for (const m of measurements) {
      // 1. Append to historical measurements (144/day per SSID, deduplicating retries)
      statements.push(
        this.db
          .prepare(`
            INSERT INTO measurements (
              station_id, timestamp, ssid, bssid, channel,
              assoc_ms, dhcp_ms, google_ms, cloudflare_ms,
              microsoft_ms, facebook_ms, netflix_ms, apple_ms,
              gateway_ms, dns_ipv4_ms, dns_ipv6_ms, scan_duration_ms, battery_mv, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, ssid, timestamp) DO UPDATE SET
              bssid = excluded.bssid,
              channel = excluded.channel,
              assoc_ms = excluded.assoc_ms,
              dhcp_ms = excluded.dhcp_ms,
              google_ms = excluded.google_ms,
              cloudflare_ms = excluded.cloudflare_ms,
              microsoft_ms = excluded.microsoft_ms,
              facebook_ms = excluded.facebook_ms,
              netflix_ms = excluded.netflix_ms,
              apple_ms = excluded.apple_ms,
              gateway_ms = excluded.gateway_ms,
              dns_ipv4_ms = excluded.dns_ipv4_ms,
              dns_ipv6_ms = excluded.dns_ipv6_ms,
              scan_duration_ms = excluded.scan_duration_ms,
              battery_mv = excluded.battery_mv,
              status = excluded.status
          `)
          .bind(
            m.station_id,
            m.timestamp,
            m.ssid,
            m.bssid ?? null,
            m.channel ?? null,
            m.assoc_ms ?? null,
            m.dhcp_ms ?? null,
            m.google_ms ?? null,
            m.cloudflare_ms ?? null,
            m.microsoft_ms ?? null,
            m.facebook_ms ?? null,
            m.netflix_ms ?? null,
            m.apple_ms ?? null,
            m.gateway_ms ?? null,
            m.dns_ipv4_ms ?? null,
            m.dns_ipv6_ms ?? null,
            m.scan_duration_ms ?? null,
            m.battery_mv ?? null,
            m.status ?? "unknown"
          )
      );

      // 2. Fast upsert into station_latest_measurements (1 row per SSID)
      statements.push(
        this.db
          .prepare(`
            INSERT INTO station_latest_measurements (
              station_id, ssid, timestamp, bssid, channel,
              assoc_ms, dhcp_ms, google_ms, cloudflare_ms,
              microsoft_ms, facebook_ms, netflix_ms, apple_ms,
              gateway_ms, dns_ipv4_ms, dns_ipv6_ms, scan_duration_ms, battery_mv, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, ssid) DO UPDATE SET
              timestamp = excluded.timestamp,
              bssid = excluded.bssid,
              channel = excluded.channel,
              assoc_ms = excluded.assoc_ms,
              dhcp_ms = excluded.dhcp_ms,
              google_ms = excluded.google_ms,
              cloudflare_ms = excluded.cloudflare_ms,
              microsoft_ms = excluded.microsoft_ms,
              facebook_ms = excluded.facebook_ms,
              netflix_ms = excluded.netflix_ms,
              apple_ms = excluded.apple_ms,
              gateway_ms = excluded.gateway_ms,
              dns_ipv4_ms = excluded.dns_ipv4_ms,
              dns_ipv6_ms = excluded.dns_ipv6_ms,
              scan_duration_ms = excluded.scan_duration_ms,
              battery_mv = excluded.battery_mv,
              status = excluded.status
          `)
          .bind(
            m.station_id,
            m.ssid,
            m.timestamp,
            m.bssid ?? null,
            m.channel ?? null,
            m.assoc_ms ?? null,
            m.dhcp_ms ?? null,
            m.google_ms ?? null,
            m.cloudflare_ms ?? null,
            m.microsoft_ms ?? null,
            m.facebook_ms ?? null,
            m.netflix_ms ?? null,
            m.apple_ms ?? null,
            m.gateway_ms ?? null,
            m.dns_ipv4_ms ?? null,
            m.dns_ipv6_ms ?? null,
            m.scan_duration_ms ?? null,
            m.battery_mv ?? null,
            m.status ?? "unknown"
          )
      );
    }

    await this.db.batch(statements);
    return measurements.length;
  }

  async saveSurveys(stationId: string, timestamp: number, surveys: ScanSurveyRecord[], scanDurationMs?: number | null): Promise<number> {
    if (surveys.length === 0) return 0;

    const normalizedSurveys = surveys.map(s => ({
      ...s,
      bssid: s.bssid ? s.bssid.trim().toUpperCase() : null
    }));

    const statements: D1PreparedStatement[] = [];

    // 1. Snapshot the latest survey as a single compact JSON document (1 row instead of 70+ rows!)
    statements.push(
      this.db
        .prepare(`
          INSERT INTO station_latest_scan (station_id, timestamp, scan_json, scan_duration_ms)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(station_id) DO UPDATE SET
            timestamp = excluded.timestamp,
            scan_json = excluded.scan_json,
            scan_duration_ms = excluded.scan_duration_ms
        `)
        .bind(stationId, timestamp, JSON.stringify(normalizedSurveys), scanDurationMs ?? null)
    );

    // 2. Upsert each AP into station_discovered_aps for tracking unique APs and inactive detection
    for (const s of normalizedSurveys) {
      if (!s.bssid) continue;
      statements.push(
        this.db
          .prepare(`
            INSERT INTO station_discovered_aps (
              station_id, bssid, ssid, channel, rssi, quality, encryption, phy_mode, band, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, bssid) DO UPDATE SET
              ssid = excluded.ssid,
              channel = excluded.channel,
              rssi = excluded.rssi,
              quality = excluded.quality,
              encryption = excluded.encryption,
              phy_mode = excluded.phy_mode,
              band = excluded.band,
              last_seen = excluded.last_seen
          `)
          .bind(
            stationId,
            s.bssid,
            s.ssid ?? null,
            s.channel ?? null,
            s.rssi ?? null,
            s.quality ?? null,
            s.encryption ?? null,
            s.phy_mode ?? null,
            s.band ?? "2.4 GHz",
            timestamp
          )
      );
    }

    await this.db.batch(statements);
    return surveys.length;
  }

  // Deprecated legacy insertSurveys kept for backward compatibility
  async insertSurveys(surveys: ScanSurveyRecord[]): Promise<number> {
    if (surveys.length === 0) return 0;
    const first = surveys[0];
    return await this.saveSurveys(first.station_id, first.timestamp, surveys);
  }

  async listStations(): Promise<StationRecord[]> {
    const result = await this.db
      .prepare("SELECT station_id, description, created_at, last_seen, firmware_version, board_type, battery_mv FROM stations ORDER BY last_seen DESC")
      .all<StationRecord>();
    return result.results;
  }

  async getLatestMeasurements(stationId: string): Promise<MeasurementRecord[]> {
    // 1. Fast path: lookup from station_latest_measurements (1-3 rows read)
    const fastResult = await this.db
      .prepare("SELECT * FROM station_latest_measurements WHERE station_id = ? ORDER BY ssid ASC")
      .bind(stationId)
      .all<MeasurementRecord>();

    if (fastResult.results && fastResult.results.length > 0) {
      return fastResult.results;
    }

    // 2. Fallback to legacy query if fast table has not been populated yet
    const result = await this.db
      .prepare(`
        SELECT m.* FROM measurements m
        INNER JOIN (
          SELECT ssid, MAX(timestamp) as max_time
          FROM measurements
          WHERE station_id = ?
          GROUP BY ssid
        ) latest ON m.ssid = latest.ssid AND m.timestamp = latest.max_time
        WHERE m.station_id = ?
        ORDER BY m.ssid ASC
      `)
      .bind(stationId, stationId)
      .all<MeasurementRecord>();
    return result.results;
  }

  async getLatestSurvey(stationId: string): Promise<ScanSurveyRecord[]> {
    const cached = await this.db
      .prepare("SELECT scan_json FROM station_latest_scan WHERE station_id = ?")
      .bind(stationId)
      .first<{ scan_json: string }>();

    if (cached && cached.scan_json) {
      try {
        const list = JSON.parse(cached.scan_json) as ScanSurveyRecord[];
        return list.map(item => ({
          ...item,
          bssid: item.bssid ? item.bssid.trim().toUpperCase() : item.bssid
        }));
      } catch {}
    }

    return [];
  }

  async getInactiveSurveys(stationId: string): Promise<InactiveSurveyRecord[]> {
    const latestScan = await this.db
      .prepare("SELECT timestamp, scan_json FROM station_latest_scan WHERE station_id = ?")
      .bind(stationId)
      .first<{ timestamp: number; scan_json?: string }>();

    if (latestScan && latestScan.timestamp) {
      const activeBssids = new Set<string>();
      if (latestScan.scan_json) {
        try {
          const parsed = JSON.parse(latestScan.scan_json) as ScanSurveyRecord[];
          for (const item of parsed) {
            if (item.bssid) activeBssids.add(item.bssid.trim().toUpperCase());
          }
        } catch {}
      }

      const since24h = latestScan.timestamp - 86400;
      const result = await this.db
        .prepare(`
          SELECT ssid, UPPER(bssid) AS bssid, channel, phy_mode, encryption, band, rssi, quality, last_seen
          FROM station_discovered_aps
          WHERE station_id = ?
            AND last_seen >= ?
            AND last_seen < ?
          ORDER BY last_seen DESC
        `)
        .bind(stationId, since24h, latestScan.timestamp)
        .all<InactiveSurveyRecord>();

      const seenInactive = new Set<string>();
      const filtered: InactiveSurveyRecord[] = [];
      for (const row of (result.results || [])) {
        const upBssid = (row.bssid || '').trim().toUpperCase();
        if (!upBssid || activeBssids.has(upBssid) || seenInactive.has(upBssid)) {
          continue;
        }
        seenInactive.add(upBssid);
        filtered.push({ ...row, bssid: upBssid });
      }
      return filtered;
    }

    return [];
  }

  async getRecentMeasurements(stationId: string, limit: number = 288): Promise<MeasurementRecord[]> {
    const result = await this.db
      .prepare(`
        SELECT * FROM measurements
        WHERE station_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .bind(stationId, limit)
      .all<MeasurementRecord>();
    return result.results.reverse(); // Chronological order
  }

  async getDailySummaries(stationId: string, limitDays: number = 30) {
    const result = await this.db
      .prepare(`
        SELECT * FROM daily_summaries
        WHERE station_id = ?
        ORDER BY date DESC
        LIMIT ?
      `)
      .bind(stationId, limitDays * 5)
      .all();
    return result.results;
  }

  // 10-minute Overview Temporary Dataset Cache
  async getOverviewCache(stationId: string, maxAgeSec: number = 600): Promise<string | null> {
    const minCachedAt = Math.floor(Date.now() / 1000) - maxAgeSec;
    const result = await this.db
      .prepare("SELECT data FROM station_overview_cache WHERE station_id = ? AND cached_at >= ?")
      .bind(stationId, minCachedAt)
      .first<{ data: string }>();
    return result?.data ?? null;
  }

  async setOverviewCache(stationId: string, data: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .prepare(`
        INSERT INTO station_overview_cache (station_id, cached_at, data)
        VALUES (?, ?, ?)
        ON CONFLICT(station_id) DO UPDATE SET
          cached_at = excluded.cached_at,
          data = excluded.data
      `)
      .bind(stationId, now, data)
      .run();
  }

  async invalidateOverviewCache(stationId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM station_overview_cache WHERE station_id = ?")
      .bind(stationId)
      .run();
  }

  async saveNetworkDiagnostics(stationId: string, timestamp: number, diag: NetworkDiagnosticsPayload): Promise<void> {
    const ssid = diag.ssid || "primary";

    // 1. Fetch current diagnostics for change detection (ignoring DNS response times)
    const existing = await this.db
      .prepare("SELECT * FROM station_network_diagnostics WHERE station_id = ? AND ssid = ?")
      .bind(stationId, ssid)
      .first<NetworkDiagnosticsRecord>();

    const gwIp = diag.gateway_ip ?? null;
    const gwVendor = diag.gateway_vendor ?? "Unknown";
    const webExposed = diag.web_exposed ? 1 : 0;
    const loginUrl = diag.login_url ?? null;
    const httpsRedirect = diag.https_redirect ? 1 : 0;
    const mtu1500 = diag.mtu_1500_ok ? 1 : 0;
    const mtu1492 = diag.mtu_1492_ok ? 1 : 0;
    const mtu1420 = diag.mtu_1420_ok ? 1 : 0;
    const dnsIpv6Timeout = diag.dns_ipv6_timeout ? 1 : 0;
    const dnsRebindBlocked = diag.dns_rebind_blocked ? 1 : 0;
    const captiveDetected = diag.captive_portal_detected ? 1 : 0;
    const openPorts = diag.open_ports ?? null;
    const detailsJson = diag.details_json ?? null;

    let isChanged = false;
    if (!existing) {
      isChanged = true; // Initial observation recorded long-term once
    } else {
      isChanged = (
        existing.gateway_ip !== gwIp ||
        existing.gateway_vendor !== gwVendor ||
        (existing.web_exposed ? 1 : 0) !== webExposed ||
        existing.login_url !== loginUrl ||
        (existing.https_redirect ? 1 : 0) !== httpsRedirect ||
        (existing.mtu_1500_ok ? 1 : 0) !== mtu1500 ||
        (existing.mtu_1492_ok ? 1 : 0) !== mtu1492 ||
        (existing.mtu_1420_ok ? 1 : 0) !== mtu1420 ||
        (existing.dns_ipv6_timeout ? 1 : 0) !== dnsIpv6Timeout ||
        (existing.dns_rebind_blocked ? 1 : 0) !== dnsRebindBlocked ||
        (existing.captive_portal_detected ? 1 : 0) !== captiveDetected ||
        existing.open_ports !== openPorts ||
        existing.details_json !== detailsJson
      );
    }

    // 2. If initial record or configuration/firewall changed, insert into long-term history
    if (isChanged) {
      try {
        await this.db
          .prepare(`
            INSERT INTO station_network_diagnostics_history (
              station_id, ssid, timestamp, gateway_ip, gateway_vendor,
              web_exposed, login_url, https_redirect,
              mtu_1500_ok, mtu_1492_ok, mtu_1420_ok,
              dns_ipv6_timeout, dns_rebind_blocked, captive_portal_detected,
              open_ports, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            stationId,
            ssid,
            timestamp,
            gwIp,
            gwVendor,
            webExposed,
            loginUrl,
            httpsRedirect,
            mtu1500,
            mtu1492,
            mtu1420,
            dnsIpv6Timeout,
            dnsRebindBlocked,
            captiveDetected,
            openPorts,
            detailsJson
          )
          .run();
      } catch (err) {
        console.error("[DB] Error recording diagnostics history:", err);
      }
    }

    // 3. Upsert latest diagnostics record for real-time dashboard display
    await this.db
      .prepare(`
        INSERT INTO station_network_diagnostics (
          station_id, ssid, timestamp, gateway_ip, gateway_vendor,
          web_exposed, login_url, https_redirect,
          mtu_1500_ok, mtu_1492_ok, mtu_1420_ok,
          dns_ipv4_ms, dns_ipv6_ms, dns_ipv6_timeout,
          dns_rebind_blocked, captive_portal_detected, open_ports, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(station_id, ssid) DO UPDATE SET
          timestamp = excluded.timestamp,
          gateway_ip = excluded.gateway_ip,
          gateway_vendor = excluded.gateway_vendor,
          web_exposed = excluded.web_exposed,
          login_url = excluded.login_url,
          https_redirect = excluded.https_redirect,
          mtu_1500_ok = excluded.mtu_1500_ok,
          mtu_1492_ok = excluded.mtu_1492_ok,
          mtu_1420_ok = excluded.mtu_1420_ok,
          dns_ipv4_ms = excluded.dns_ipv4_ms,
          dns_ipv6_ms = excluded.dns_ipv6_ms,
          dns_ipv6_timeout = excluded.dns_ipv6_timeout,
          dns_rebind_blocked = excluded.dns_rebind_blocked,
          captive_portal_detected = excluded.captive_portal_detected,
          open_ports = excluded.open_ports,
          details_json = excluded.details_json
      `)
      .bind(
        stationId,
        ssid,
        timestamp,
        gwIp,
        gwVendor,
        webExposed,
        loginUrl,
        httpsRedirect,
        mtu1500,
        mtu1492,
        mtu1420,
        diag.dns_ipv4_ms ?? null,
        diag.dns_ipv6_ms ?? null,
        dnsIpv6Timeout,
        dnsRebindBlocked,
        captiveDetected,
        openPorts,
        detailsJson
      )
      .run();
  }

  async getLatestDiagnostics(stationId: string): Promise<NetworkDiagnosticsRecord[]> {
    const result = await this.db
      .prepare("SELECT * FROM station_network_diagnostics WHERE station_id = ? ORDER BY timestamp DESC")
      .bind(stationId)
      .all<NetworkDiagnosticsRecord>();
    return result.results || [];
  }

  async saveChannelUtilization(
    stationId: string,
    timestamp: number,
    scanDurationMs: number | null,
    metrics: ChannelUtilizationPayload[]
  ): Promise<number> {
    if (!metrics || metrics.length === 0) return 0;

    const statements: D1PreparedStatement[] = [];
    for (const m of metrics) {
      const rssiStr = Array.isArray(m.rssi_hist) ? JSON.stringify(m.rssi_hist) : "[]";
      statements.push(
        this.db
          .prepare(`
            INSERT INTO station_channel_utilization (
              station_id, timestamp, channel, mgmt_frames, data_frames,
              ctrl_frames, rssi_hist, unique_transmitters, airtime_pct, scan_duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(station_id, timestamp, channel) DO UPDATE SET
              mgmt_frames = excluded.mgmt_frames,
              data_frames = excluded.data_frames,
              ctrl_frames = excluded.ctrl_frames,
              rssi_hist = excluded.rssi_hist,
              unique_transmitters = excluded.unique_transmitters,
              airtime_pct = excluded.airtime_pct,
              scan_duration_ms = excluded.scan_duration_ms
          `)
          .bind(
            stationId,
            timestamp,
            m.channel,
            m.mgmt_frames || 0,
            m.data_frames || 0,
            m.ctrl_frames || 0,
            rssiStr,
            m.unique_transmitters || 0,
            m.airtime_pct || 0,
            scanDurationMs ?? null
          )
      );
    }

    await this.db.batch(statements);
    return metrics.length;
  }

  async getRecentChannelUtilization(stationId: string, hours: number = 24): Promise<ChannelUtilizationRecord[]> {
    const sinceTime = Math.floor(Date.now() / 1000) - (hours * 3600);
    const result = await this.db
      .prepare(`
        SELECT * FROM station_channel_utilization
        WHERE station_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC, channel ASC
      `)
      .bind(stationId, sinceTime)
      .all<ChannelUtilizationRecord>();
    return result.results || [];
  }

  async getLatestChannelUtilization(stationId: string): Promise<ChannelUtilizationRecord[]> {
    const latestTimestampRow = await this.db
      .prepare(`
        SELECT timestamp FROM station_channel_utilization
        WHERE station_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `)
      .bind(stationId)
      .first<{ timestamp: number }>();

    if (!latestTimestampRow || !latestTimestampRow.timestamp) return [];

    const result = await this.db
      .prepare(`
        SELECT * FROM station_channel_utilization
        WHERE station_id = ? AND timestamp = ?
        ORDER BY channel ASC
      `)
      .bind(stationId, latestTimestampRow.timestamp)
      .all<ChannelUtilizationRecord>();
    return result.results || [];
  }

  async getLatestScanDuration(stationId: string): Promise<number | null> {
    const row = await this.db
      .prepare(`
        SELECT scan_duration_ms FROM station_latest_scan
        WHERE station_id = ?
      `)
      .bind(stationId)
      .first<{ scan_duration_ms: number | null }>();
    return row?.scan_duration_ms ?? null;
  }

  async saveBatteryHistory(
    records: { station_id: string; timestamp: number; battery_mv: number }[]
  ): Promise<number> {
    if (!records || records.length === 0) return 0;

    const statements: D1PreparedStatement[] = [];
    for (const r of records) {
      statements.push(
        this.db
          .prepare(`
            INSERT INTO station_battery_history (station_id, timestamp, battery_mv)
            VALUES (?, ?, ?)
            ON CONFLICT(station_id, timestamp) DO UPDATE SET
              battery_mv = excluded.battery_mv
          `)
          .bind(r.station_id, r.timestamp, r.battery_mv)
      );
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      await this.db.batch(statements.slice(i, i + CHUNK_SIZE));
    }
    return records.length;
  }

  async getBatteryHistory(
    stationId: string,
    sinceTimestamp: number
  ): Promise<{ timestamp: number; battery_mv: number }[]> {
    try {
      const result = await this.db
        .prepare(`
          SELECT timestamp, battery_mv FROM station_battery_history
          WHERE station_id = ? AND timestamp >= ?
          ORDER BY timestamp ASC
        `)
        .bind(stationId, sinceTimestamp)
        .all<{ timestamp: number; battery_mv: number }>();
      return result.results || [];
    } catch {
      return [];
    }
  }

  async saveBluetoothTelemetry(
    stationId: string,
    timestamp: number,
    bt: BluetoothPayload
  ): Promise<void> {
    const bleTotalPackets = bt.ble_total_packets ?? 0;
    const bleTotalMacs = bt.ble_total_macs ?? 0;
    const bleUniqueDevices = bt.ble_unique_devices ?? 0;
    const bleRandomMacs = bt.ble_random_macs ?? 0;
    const blePublicMacs = bt.ble_public_macs ?? 0;
    const bleBeacons = bt.ble_categories?.beacons ?? 0;
    const bleSmartphones = bt.ble_categories?.smartphones ?? 0;
    const bleWearables = bt.ble_categories?.wearables ?? 0;
    const bleAudio = bt.ble_categories?.audio ?? 0;
    const bleOther = bt.ble_categories?.other ?? 0;
    const classicTotal = bt.classic_total ?? 0;
    const scanDurationMs = bt.scan_duration_ms ?? null;
    const devicesJson = JSON.stringify({
      ble_devices: bt.ble_devices ?? [],
      classic_devices: bt.classic_devices ?? []
    });

    try {
      await this.db.batch([
        this.db.prepare(`
          INSERT INTO station_bluetooth_summary (
            station_id, timestamp, ble_total_packets, ble_total_macs, ble_unique_devices,
            ble_random_macs, ble_public_macs, ble_beacons, ble_smartphones, ble_wearables,
            ble_audio, ble_other, classic_total, scan_duration_ms, devices_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id, timestamp) DO UPDATE SET
            ble_total_packets = excluded.ble_total_packets,
            ble_total_macs = excluded.ble_total_macs,
            ble_unique_devices = excluded.ble_unique_devices,
            ble_random_macs = excluded.ble_random_macs,
            ble_public_macs = excluded.ble_public_macs,
            ble_beacons = excluded.ble_beacons,
            ble_smartphones = excluded.ble_smartphones,
            ble_wearables = excluded.ble_wearables,
            ble_audio = excluded.ble_audio,
            ble_other = excluded.ble_other,
            classic_total = excluded.classic_total,
            scan_duration_ms = excluded.scan_duration_ms,
            devices_json = excluded.devices_json
        `).bind(
          stationId, timestamp, bleTotalPackets, bleTotalMacs, bleUniqueDevices,
          bleRandomMacs, blePublicMacs, bleBeacons, bleSmartphones, bleWearables,
          bleAudio, bleOther, classicTotal, scanDurationMs, devicesJson
        ),
        this.db.prepare(`
          INSERT INTO station_latest_bluetooth (
            station_id, timestamp, ble_total_packets, ble_total_macs, ble_unique_devices,
            ble_random_macs, ble_public_macs, ble_beacons, ble_smartphones, ble_wearables,
            ble_audio, ble_other, classic_total, scan_duration_ms, devices_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(station_id) DO UPDATE SET
            timestamp = excluded.timestamp,
            ble_total_packets = excluded.ble_total_packets,
            ble_total_macs = excluded.ble_total_macs,
            ble_unique_devices = excluded.ble_unique_devices,
            ble_random_macs = excluded.ble_random_macs,
            ble_public_macs = excluded.ble_public_macs,
            ble_beacons = excluded.ble_beacons,
            ble_smartphones = excluded.ble_smartphones,
            ble_wearables = excluded.ble_wearables,
            ble_audio = excluded.ble_audio,
            ble_other = excluded.ble_other,
            classic_total = excluded.classic_total,
            scan_duration_ms = excluded.scan_duration_ms,
            devices_json = excluded.devices_json
        `).bind(
          stationId, timestamp, bleTotalPackets, bleTotalMacs, bleUniqueDevices,
          bleRandomMacs, blePublicMacs, bleBeacons, bleSmartphones, bleWearables,
          bleAudio, bleOther, classicTotal, scanDurationMs, devicesJson
        )
      ]);
    } catch (err) {
      console.error("[Database] Error saving Bluetooth telemetry:", err);
    }
  }

  async getLatestBluetooth(stationId: string): Promise<BluetoothRecord | null> {
    try {
      const res = await this.db.prepare(`
        SELECT * FROM station_latest_bluetooth
        WHERE station_id = ?
        LIMIT 1
      `).bind(stationId).first<BluetoothRecord>();
      return res;
    } catch {
      return null;
    }
  }

  async getRecentBluetooth(stationId: string, hours: number = 24): Promise<BluetoothRecord[]> {
    const cutoff = Math.floor(Date.now() / 1000) - (hours * 3600);
    try {
      const res = await this.db.prepare(`
        SELECT id, station_id, timestamp, ble_total_packets, ble_total_macs, ble_unique_devices,
               ble_random_macs, ble_public_macs, ble_beacons, ble_smartphones, ble_wearables,
               ble_audio, ble_other, classic_total, scan_duration_ms
        FROM station_bluetooth_summary
        WHERE station_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).bind(stationId, cutoff).all<BluetoothRecord>();
      return res.results || [];
    } catch {
      return [];
    }
  }

  async getInactiveBluetoothDevices(stationId: string, hours: number = 24): Promise<InactiveBluetoothRecord[]> {
    return this.getRecentBluetoothDevices(stationId, hours);
  }

  async getRecentBluetoothDevices(stationId: string, hours: number = 24): Promise<InactiveBluetoothRecord[]> {
    const latestBt = await this.getLatestBluetooth(stationId);
    const activeKeys = new Set<string>();
    const seenMap = new Map<string, InactiveBluetoothRecord>();
    const nowSec = Math.floor(Date.now() / 1000);
    let latestTime = nowSec;

    if (latestBt) {
      if (latestBt.timestamp) latestTime = latestBt.timestamp;
      if (latestBt.devices_json) {
        try {
          const parsed = JSON.parse(latestBt.devices_json);
          for (const d of (parsed.ble_devices || [])) {
            const k = (d.address || d.fingerprint || '').trim().toUpperCase();
            if (k) {
              activeKeys.add(k);
              seenMap.set(k, {
                type: 'ble',
                address: d.address,
                addr_type: d.addr_type,
                name: d.name,
                vendor: d.vendor,
                category: d.category,
                rssi: typeof d.rssi === 'number' ? d.rssi : null,
                fingerprint: d.fingerprint,
                last_seen: latestTime,
                is_active: true
              });
            }
          }
          for (const cd of (parsed.classic_devices || [])) {
            const k = (cd.address || '').trim().toUpperCase();
            if (k) {
              activeKeys.add(k);
              seenMap.set(k, {
                type: 'classic',
                address: cd.address,
                name: cd.name,
                dev_class: cd.dev_class,
                cod: cd.cod,
                rssi: typeof cd.rssi === 'number' ? cd.rssi : null,
                last_seen: latestTime,
                is_active: true
              });
            }
          }
        } catch {}
      }
    }

    const since = nowSec - (hours * 3600);
    try {
      const res = await this.db.prepare(`
        SELECT timestamp, devices_json
        FROM station_bluetooth_summary
        WHERE station_id = ? AND timestamp >= ? AND devices_json IS NOT NULL
        ORDER BY timestamp DESC
      `).bind(stationId, since).all<{ timestamp: number; devices_json: string }>();

      for (const row of (res.results || [])) {
        if (!row.devices_json) continue;
        try {
          const parsed = JSON.parse(row.devices_json);
          // BLE devices
          for (const d of (parsed.ble_devices || [])) {
            const key = (d.address || d.fingerprint || '').trim().toUpperCase();
            if (!key) continue;
            if (!seenMap.has(key)) {
              seenMap.set(key, {
                type: 'ble',
                address: d.address,
                addr_type: d.addr_type,
                name: d.name,
                vendor: d.vendor,
                category: d.category,
                rssi: typeof d.rssi === 'number' ? d.rssi : null,
                fingerprint: d.fingerprint,
                last_seen: row.timestamp,
                is_active: activeKeys.has(key)
              });
            } else {
              const existing = seenMap.get(key)!;
              if (typeof d.rssi === 'number' && (existing.rssi == null || d.rssi > existing.rssi)) {
                existing.rssi = d.rssi;
              }
            }
          }
          // Classic devices
          for (const cd of (parsed.classic_devices || [])) {
            const key = (cd.address || '').trim().toUpperCase();
            if (!key) continue;
            if (!seenMap.has(key)) {
              seenMap.set(key, {
                type: 'classic',
                address: cd.address,
                name: cd.name,
                dev_class: cd.dev_class,
                cod: cd.cod,
                rssi: typeof cd.rssi === 'number' ? cd.rssi : null,
                last_seen: row.timestamp,
                is_active: activeKeys.has(key)
              });
            } else {
              const existing = seenMap.get(key)!;
              if (typeof cd.rssi === 'number' && (existing.rssi == null || cd.rssi > existing.rssi)) {
                existing.rssi = cd.rssi;
              }
            }
          }
        } catch {}
      }

      const list = Array.from(seenMap.values());
      list.sort((a, b) => b.last_seen - a.last_seen);
      return list;
    } catch (e) {
      console.error("[Database] Error getting recent bluetooth devices:", e);
      return Array.from(seenMap.values());
    }
  }

  // ==========================================
  // Fleet Admin & Settings Methods
  // ==========================================

  async getTableStats(): Promise<Array<{ table: string; count: number; bytes_estimate: number; description: string }>> {
    const tableMeta = [
      { table: "measurements", avgBytes: 250, desc: "Raw Wi-Fi station connectivity & latency tests" },
      { table: "station_discovered_aps", avgBytes: 130, desc: "2.4 GHz spectrum AP scan observations & RSSI" },
      { table: "station_bluetooth_summary", avgBytes: 200, desc: "BLE & Classic Bluetooth scans & category KPIs" },
      { table: "daily_30min_summaries", avgBytes: 180, desc: "30-min aggregated channel congestion & RF summaries" },
      { table: "daily_summaries", avgBytes: 420, desc: "24-hour UTC daily rollups" },
      { table: "station_battery_history", avgBytes: 48, desc: "ADC battery voltage & power mode history" },
      { table: "station_network_diagnostics_history", avgBytes: 650, desc: "Firewall & network configuration changes" },
      { table: "station_overview_cache", avgBytes: 2100, desc: "Level 2 fast snapshot cache for UI dashboards" },
      { table: "station_channel_utilization", avgBytes: 200, desc: "13-channel airtime utilization records" },
      { table: "station_network_diagnostics", avgBytes: 400, desc: "Latest network diagnostics snapshot" },
      { table: "station_latest_measurements", avgBytes: 250, desc: "Latest measurement snapshot per network" },
      { table: "station_latest_bluetooth", avgBytes: 300, desc: "Latest Bluetooth scan snapshot per station" },
      { table: "stations", avgBytes: 350, desc: "Fleet registered edge devices & tokens" },
    ];

    const statements = tableMeta.map(t => 
      this.db.prepare(`SELECT count(*) as cnt FROM ${t.table}`)
    );

    const results = await this.db.batch(statements);
    return tableMeta.map((t, idx) => {
      const count = (results[idx].results?.[0] as any)?.cnt ?? 0;
      return {
        table: t.table,
        count: count,
        bytes_estimate: count * t.avgBytes,
        description: t.desc
      };
    });
  }

  async getStationStats(): Promise<Array<any>> {
    const stations = await this.db
      .prepare("SELECT * FROM stations ORDER BY last_seen DESC")
      .all<StationRecord>();

    const timeframeQuery = await this.db
      .prepare(`
        SELECT 
          station_id, 
          MIN(timestamp) as min_ts, 
          MAX(timestamp) as max_ts, 
          COUNT(*) as measurement_count 
        FROM measurements 
        GROUP BY station_id
      `)
      .all<{ station_id: string; min_ts: number; max_ts: number; measurement_count: number }>();

    const registeredMap = new Map((stations.results || []).map(r => [r.station_id, r]));
    const timeframes = new Map((timeframeQuery.results || []).map(r => [r.station_id, r]));

    const result = (stations.results || []).map(st => {
      const tf = timeframes.get(st.station_id);
      return {
        ...st,
        min_timestamp: tf?.min_ts ?? null,
        max_timestamp: tf?.max_ts ?? null,
        measurement_count: tf?.measurement_count ?? 0
      };
    });

    for (const [stId, tf] of timeframes) {
      if (!registeredMap.has(stId)) {
        result.push({
          station_id: stId,
          description: "(Decommissioned Data)",
          device_token: "",
          created_at: tf.min_ts,
          last_seen: tf.max_ts,
          firmware_version: "--",
          target_version: null,
          board_type: "Unknown",
          battery_mv: null,
          is_canary: 0,
          ota_url: null,
          min_timestamp: tf.min_ts,
          max_timestamp: tf.max_ts,
          measurement_count: tf.measurement_count
        });
      }
    }

    return result;
  }

  async getYearlyActivity(year: number, stationId?: string | null): Promise<Array<{ day: string; count: number }>> {
    const startTs = Math.floor(new Date(year, 0, 1).getTime() / 1000);
    const endTs = Math.floor(new Date(year + 1, 0, 1).getTime() / 1000);

    let query = `
      SELECT 
        strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch')) as day, 
        count(*) as count 
      FROM measurements 
      WHERE timestamp >= ? AND timestamp < ?
    `;
    const params: any[] = [startTs, endTs];

    if (stationId && stationId.trim() !== "" && stationId !== "all") {
      query += " AND station_id = ?";
      params.push(stationId);
    }

    query += " GROUP BY day ORDER BY day ASC";

    const results = await this.db.prepare(query).bind(...params).all<{ day: string; count: number }>();
    return results.results || [];
  }

  async updateStationSettings(
    stationId: string,
    description: string,
    isCanary: number,
    targetVersion: string | null
  ): Promise<void> {
    await this.db
      .prepare(`
        UPDATE stations SET
          description = ?,
          is_canary = ?,
          target_version = ?
        WHERE station_id = ?
      `)
      .bind(description, isCanary, targetVersion || null, stationId)
      .run();
    await this.invalidateOverviewCache(stationId);
  }

  async deleteStation(stationId: string, purgeData: boolean = true): Promise<void> {
    if (!stationId) return;

    if (purgeData) {
      const stmts = [
        this.db.prepare("DELETE FROM stations WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM measurements WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_latest_measurements WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_latest_scan WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_discovered_aps WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_channel_utilization WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_network_diagnostics WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_network_diagnostics_history WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_battery_history WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_bluetooth_summary WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_latest_bluetooth WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM daily_summaries WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM daily_30min_summaries WHERE station_id = ?").bind(stationId),
        this.db.prepare("DELETE FROM station_overview_cache WHERE station_id = ?").bind(stationId)
      ];
      await this.db.batch(stmts);
    } else {
      await this.db.prepare("DELETE FROM stations WHERE station_id = ?").bind(stationId).run();
    }
    await this.invalidateOverviewCache(stationId);
  }

  async deleteMeasurementsByTimeframe(
    stationId: string | null,
    fromTs: number,
    toTs: number
  ): Promise<{ deletedMeasurements: number; deletedAps: number; deletedBt: number; deletedChannels: number; deletedBattery: number }> {
    let measQuery = "DELETE FROM measurements WHERE timestamp >= ? AND timestamp <= ?";
    let apsQuery = "DELETE FROM station_discovered_aps WHERE last_seen >= ? AND last_seen <= ?";
    let btQuery = "DELETE FROM station_bluetooth_summary WHERE timestamp >= ? AND timestamp <= ?";
    let chQuery = "DELETE FROM station_channel_utilization WHERE timestamp >= ? AND timestamp <= ?";
    let batQuery = "DELETE FROM station_battery_history WHERE timestamp >= ? AND timestamp <= ?";
    const params: any[] = [fromTs, toTs];

    if (stationId && stationId.trim() !== "" && stationId !== "all") {
      measQuery += " AND station_id = ?";
      apsQuery += " AND station_id = ?";
      btQuery += " AND station_id = ?";
      chQuery += " AND station_id = ?";
      batQuery += " AND station_id = ?";
      params.push(stationId);
    }

    const r1 = await this.db.prepare(measQuery).bind(...params).run();
    const r2 = await this.db.prepare(apsQuery).bind(...params).run();
    const r3 = await this.db.prepare(btQuery).bind(...params).run();
    const r4 = await this.db.prepare(chQuery).bind(...params).run();
    const r5 = await this.db.prepare(batQuery).bind(...params).run();

    if (stationId && stationId !== "all") {
      await this.invalidateOverviewCache(stationId);
    } else {
      await this.db.prepare("DELETE FROM station_overview_cache").run();
    }

    return {
      deletedMeasurements: r1.meta?.changes ?? 0,
      deletedAps: r2.meta?.changes ?? 0,
      deletedBt: r3.meta?.changes ?? 0,
      deletedChannels: r4.meta?.changes ?? 0,
      deletedBattery: r5.meta?.changes ?? 0
    };
  }
}
