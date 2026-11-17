import { Env } from "./types";

export async function handleScheduledMaintenance(_event: ScheduledEvent, env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  console.log(`[Cron] Starting daily telemetry maintenance at timestamp ${now}...`);

  // Calculate yesterday's UTC boundaries
  const yesterday = new Date(Date.now() - 86400 * 1000);
  const yYear = yesterday.getUTCFullYear();
  const yMonth = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
  const yDay = String(yesterday.getUTCDate()).padStart(2, "0");
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

  const startOfYesterday = Math.floor(Date.UTC(yYear, yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0) / 1000);
  const endOfYesterday = startOfYesterday + 86400;

  console.log(`[Cron] Aggregating daily summaries for date ${yesterdayStr} (${startOfYesterday} to ${endOfYesterday})...`);

  // 1. Aggregate yesterday's measurements into daily_summaries
  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO daily_summaries (
        station_id, date, ssid, sample_count,
        assoc_min, assoc_avg, assoc_max,
        dhcp_min, dhcp_avg, dhcp_max,
        cf_min, cf_avg, cf_max,
        google_min, google_avg, google_max
      )
      SELECT
        station_id,
        ? as date,
        ssid,
        COUNT(*) as sample_count,
        MIN(CASE WHEN assoc_ms >= 0 THEN assoc_ms END) as assoc_min,
        ROUND(AVG(CASE WHEN assoc_ms >= 0 THEN assoc_ms END), 1) as assoc_avg,
        MAX(CASE WHEN assoc_ms >= 0 THEN assoc_ms END) as assoc_max,
        MIN(CASE WHEN dhcp_ms >= 0 THEN dhcp_ms END) as dhcp_min,
        ROUND(AVG(CASE WHEN dhcp_ms >= 0 THEN dhcp_ms END), 1) as dhcp_avg,
        MAX(CASE WHEN dhcp_ms >= 0 THEN dhcp_ms END) as dhcp_max,
        MIN(CASE WHEN cloudflare_ms >= 0 THEN cloudflare_ms END) as cf_min,
        ROUND(AVG(CASE WHEN cloudflare_ms >= 0 THEN cloudflare_ms END), 1) as cf_avg,
        MAX(CASE WHEN cloudflare_ms >= 0 THEN cloudflare_ms END) as cf_max,
        MIN(CASE WHEN google_ms >= 0 THEN google_ms END) as google_min,
        ROUND(AVG(CASE WHEN google_ms >= 0 THEN google_ms END), 1) as google_avg,
        MAX(CASE WHEN google_ms >= 0 THEN google_ms END) as google_max
      FROM measurements
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY station_id, ssid
    `)
    .bind(yesterdayStr, startOfYesterday, endOfYesterday)
    .run();

    console.log(`[Cron] Daily summaries aggregated successfully for ${yesterdayStr}.`);
  } catch (err) {
    console.error("[Cron] Error aggregating daily summaries:", err);
  }

  // 1b. Aggregate yesterday's 48 30-minute intervals into daily_30min_summaries
  try {
    console.log(`[Cron] Aggregating 48 30-minute intervals for ${yesterdayStr}...`);
    // Find all active stations from yesterday
    const stationsResult = await env.DB.prepare(`
      SELECT DISTINCT station_id FROM (
        SELECT station_id FROM measurements WHERE timestamp >= ? AND timestamp < ?
        UNION
        SELECT station_id FROM station_channel_utilization WHERE timestamp >= ? AND timestamp < ?
        UNION
        SELECT station_id FROM station_bluetooth_summary WHERE timestamp >= ? AND timestamp < ?
      )
    `)
    .bind(startOfYesterday, endOfYesterday, startOfYesterday, endOfYesterday, startOfYesterday, endOfYesterday)
    .all<{ station_id: string }>();

    const stationList = stationsResult.results || [];
    for (const st of stationList) {
      const stationId = st.station_id;

      // Group channel max utilization by 30-minute slot
      const chanRes = await env.DB.prepare(`
        SELECT
          CAST((timestamp - ?) / 1800 AS INTEGER) as slot_idx,
          channel,
          MAX(airtime_pct) as max_airtime
        FROM station_channel_utilization
        WHERE station_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY slot_idx, channel
      `)
      .bind(startOfYesterday, stationId, startOfYesterday, endOfYesterday)
      .all<{ slot_idx: number; channel: number; max_airtime: number }>();

      const chanBySlot: Record<number, number[]> = {};
      for (const r of (chanRes.results || [])) {
        if (!chanBySlot[r.slot_idx]) {
          chanBySlot[r.slot_idx] = new Array(13).fill(0);
        }
        if (r.channel >= 1 && r.channel <= 13) {
          chanBySlot[r.slot_idx][r.channel - 1] = r.max_airtime;
        }
      }

      // Group bluetooth max unique BLE and Classic by 30-minute slot
      const btRes = await env.DB.prepare(`
        SELECT
          CAST((timestamp - ?) / 1800 AS INTEGER) as slot_idx,
          MAX(ble_unique_devices) as max_ble,
          MAX(classic_total) as max_classic
        FROM station_bluetooth_summary
        WHERE station_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY slot_idx
      `)
      .bind(startOfYesterday, stationId, startOfYesterday, endOfYesterday)
      .all<{ slot_idx: number; max_ble: number; max_classic: number }>();

      const btBySlot: Record<number, { max_ble: number; max_classic: number }> = {};
      for (const r of (btRes.results || [])) {
        btBySlot[r.slot_idx] = { max_ble: r.max_ble ?? 0, max_classic: r.max_classic ?? 0 };
      }

      // Group battery voltage max by 30-minute slot
      const batRes = await env.DB.prepare(`
        SELECT
          CAST((timestamp - ?) / 1800 AS INTEGER) as slot_idx,
          MAX(battery_mv) as max_bat
        FROM station_battery_history
        WHERE station_id = ? AND timestamp >= ? AND timestamp < ?
        GROUP BY slot_idx
      `)
      .bind(startOfYesterday, stationId, startOfYesterday, endOfYesterday)
      .all<{ slot_idx: number; max_bat: number }>();

      const batBySlot: Record<number, number> = {};
      for (const r of (batRes.results || [])) {
        batBySlot[r.slot_idx] = r.max_bat;
      }

      // Build 48 statements and batch insert
      const stmts: D1PreparedStatement[] = [];
      for (let slot = 0; slot < 48; slot++) {
        const slotStartTs = startOfYesterday + (slot * 1800);
        const chanArr = chanBySlot[slot] || new Array(13).fill(0);
        const btData = btBySlot[slot] || { max_ble: 0, max_classic: 0 };
        const batMv = batBySlot[slot] ?? null;

        const hasData = chanBySlot[slot] || btBySlot[slot] || batBySlot[slot] !== undefined;
        if (hasData) {
          stmts.push(
            env.DB.prepare(`
              INSERT OR REPLACE INTO daily_30min_summaries (
                station_id, date, interval_index, start_timestamp,
                channel_max_airtime, ble_max_unique, classic_max, battery_mv
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              stationId,
              yesterdayStr,
              slot,
              slotStartTs,
              JSON.stringify(chanArr),
              btData.max_ble,
              btData.max_classic,
              batMv
            )
          );
        }
      }

      if (stmts.length > 0) {
        await env.DB.batch(stmts);
      }
    }
    console.log(`[Cron] 48 30-minute intervals aggregated successfully for ${yesterdayStr}.`);
  } catch (err) {
    console.error("[Cron] Error aggregating 48 30-minute summaries:", err);
  }

  // 2. Purge raw measurements and scan surveys older than 30 days
  const retentionCutoff = now - (30 * 86400);
  console.log(`[Cron] Purging raw records older than ${retentionCutoff} (30 days retention)...`);

  try {
    const purgeM = await env.DB.prepare("DELETE FROM measurements WHERE timestamp < ?")
      .bind(retentionCutoff)
      .run();
    console.log(`[Cron] Purged ${purgeM.meta?.changes ?? 0} expired measurements.`);

    // Purge discovered APs not seen in 30 days
    const purgeAps = await env.DB.prepare("DELETE FROM station_discovered_aps WHERE last_seen < ?")
      .bind(retentionCutoff)
      .run();
    console.log(`[Cron] Purged ${purgeAps.meta?.changes ?? 0} expired discovered APs.`);

    // Purge battery history older than 30 days
    try {
      const purgeBat = await env.DB.prepare("DELETE FROM station_battery_history WHERE timestamp < ?")
        .bind(retentionCutoff)
        .run();
      console.log(`[Cron] Purged ${purgeBat.meta?.changes ?? 0} expired battery history records.`);
    } catch {
      // Table may not exist yet if migration pending
    }

    // Purge bluetooth summary older than 30 days
    try {
      const purgeBt = await env.DB.prepare("DELETE FROM station_bluetooth_summary WHERE timestamp < ?")
        .bind(retentionCutoff)
        .run();
      console.log(`[Cron] Purged ${purgeBt.meta?.changes ?? 0} expired bluetooth summary records.`);
    } catch {
      // Table may not exist yet if migration pending
    }

    // Purge cached overviews older than 1 day
    const purgeCache = await env.DB.prepare("DELETE FROM station_overview_cache WHERE cached_at < ?")
      .bind(now - 86400)
      .run();
    console.log(`[Cron] Purged ${purgeCache.meta?.changes ?? 0} expired cached overviews.`);

  } catch (err) {
    console.error("[Cron] Error purging old telemetry records:", err);
  }

  console.log("[Cron] Daily maintenance routine completed.");
}
