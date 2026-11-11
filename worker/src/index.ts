/**
 * Cloudflare Worker: T18 Network Telemetry Ingestion Endpoint
 *
 * Receives batched records from ESP32 stations (including multi-day backlogs),
 * aggregates hourly rollups (Green, Orange, Purple, Red),
 * and commits updates directly into the kreier/T18 GitHub repository.
 */

export interface Env {
  AUTH_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

interface TelemetryRecord {
  timestamp: number; // Unix epoch in seconds
  ssid: string;
  rssi?: number;
  channel?: number;
  assoc_ms: number;
  dhcp_ms: number;
  ip?: string;
  targets?: {
    google?: number;
    fast?: number;
    one_one_one_one?: number;
    cloudflare?: number;
    [key: string]: number | undefined;
  };
  status?: string;
  battery_mv?: number;
}

interface IngestPayload {
  station_id: string;
  firmware?: string;
  battery_mv?: number;
  battery_pct?: number;
  records: TelemetryRecord[];
}

interface HourlySummary {
  samples: number;
  successful: number;
  avg_assoc_ms: number;
  avg_dhcp_ms: number;
  avg_http_latency_ms: number;
  status: 'green' | 'orange' | 'purple' | 'red';
  avg_rssi?: number;
  avg_battery_mv?: number;
}

interface MonthFileContent {
  station: string;
  month: string;
  hours: Record<string, HourlySummary>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(JSON.stringify({ service: 'T18 Telemetry Ingest', status: 'healthy', version: '1.0.0' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/ingest') {
      return new Response('Not Found', { status: 404 });
    }

    // Authenticate device token via Bearer header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Bearer authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== env.AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const payload: IngestPayload = await request.json();
      if (!payload.station_id || !Array.isArray(payload.records) || payload.records.length === 0) {
        return new Response(JSON.stringify({ error: 'Payload must contain station_id and non-empty records array' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Group records into hourly buckets (UTC ISO strings)
      // Supports multi-day batches spanning across days or month boundaries
      const hourlyBuckets = new Map<string, TelemetryRecord[]>();

      for (const rec of payload.records) {
        if (!rec.timestamp || rec.timestamp < 1000000000) {
          // Skip invalid or unmapped timestamps
          continue;
        }

        const date = new Date(rec.timestamp * 1000);
        date.setUTCMinutes(0, 0, 0);
        const isoHour = date.toISOString().replace(/:\d\d\.\d\d\dZ$/, ':00:00Z');

        const bucket = hourlyBuckets.get(isoHour) || [];
        bucket.push(rec);
        hourlyBuckets.set(isoHour, bucket);
      }

      if (hourlyBuckets.size === 0) {
        return new Response(JSON.stringify({ error: 'No valid timestamped records found in batch' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Compute hourly rollup aggregates
      const aggregatedHours: Record<string, HourlySummary> = {};
      for (const [isoHour, records] of hourlyBuckets.entries()) {
        const samples = records.length;
        const successful = records.filter(r => r.assoc_ms > 0 && r.dhcp_ms > 0 && (!r.status || r.status === 'ok')).length;

        let totalAssoc = 0;
        let totalDhcp = 0;
        let totalLatency = 0;
        let latencyCount = 0;
        let totalRssi = 0;
        let rssiCount = 0;
        let totalVbat = 0;

        for (const r of records) {
          totalAssoc += r.assoc_ms || 0;
          totalDhcp += r.dhcp_ms || 0;
          if (r.targets) {
            Object.values(r.targets).forEach(lat => {
              if (typeof lat === 'number' && lat > 0) {
                totalLatency += lat;
                latencyCount++;
              }
            });
          }
          if (typeof r.rssi === 'number') {
            totalRssi += r.rssi;
            rssiCount++;
          }
          if (r.battery_mv) totalVbat += r.battery_mv;
        }

        const avg_assoc_ms = successful > 0 ? Math.round(totalAssoc / successful) : 0;
        const avg_dhcp_ms = successful > 0 ? Math.round(totalDhcp / successful) : 0;
        const avg_http_latency_ms = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

        // Apply health classification rules:
        // - Red: 0 successful connections
        // - Orange: 1 or more failures, or high HTTP latency (> 150ms)
        // - Purple: Connection succeeded, but association (> 4000ms) or DHCP (> 3000ms) had high delay
        // - Green: All probes fast and successful
        let status: 'green' | 'orange' | 'purple' | 'red' = 'green';
        if (successful === 0) {
          status = 'red';
        } else if (successful < samples || avg_http_latency_ms > 150) {
          status = 'orange';
        } else if (avg_assoc_ms > 4000 || avg_dhcp_ms > 3000) {
          status = 'purple';
        }

        aggregatedHours[isoHour] = {
          samples,
          successful,
          avg_assoc_ms,
          avg_dhcp_ms,
          avg_http_latency_ms,
          status,
          avg_rssi: rssiCount > 0 ? Math.round(totalRssi / rssiCount) : undefined,
          avg_battery_mv: samples > 0 && totalVbat > 0 ? Math.round(totalVbat / samples) : payload.battery_mv,
        };
      }

      // Group hourly summaries by month (YYYY-MM)
      const updatesByMonth = new Map<string, Record<string, HourlySummary>>();
      for (const [isoHour, summary] of Object.entries(aggregatedHours)) {
        const ym = isoHour.slice(0, 7);
        const group = updatesByMonth.get(ym) || {};
        group[isoHour] = summary;
        updatesByMonth.set(ym, group);
      }

      // Commit to GitHub for each affected monthly partition
      for (const [ym, hoursMap] of updatesByMonth.entries()) {
        const filePath = `data/${payload.station_id}/${ym}.json`;
        await updateGitHubFile(env, filePath, (existingContent: MonthFileContent | null) => {
          const merged: MonthFileContent = existingContent || {
            station: payload.station_id,
            month: ym,
            hours: {},
          };

          Object.assign(merged.hours, hoursMap);
          return merged;
        }, `telemetry: sync ${payload.station_id} for ${ym}`);
      }

      // Update stations index with latest metadata
      await updateStationsRegistry(env, payload);

      return new Response(JSON.stringify({
        success: true,
        station_id: payload.station_id,
        records_processed: payload.records.length,
        hours_aggregated: Object.keys(aggregatedHours).length,
        months_affected: Array.from(updatesByMonth.keys()),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Fetch and atomically commit an updated file in GitHub via contents API
 */
async function updateGitHubFile<T>(
  env: Env,
  path: string,
  modify: (current: T | null) => T,
  commitMessage: string
): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'T18-Cloudflare-Worker',
    'Accept': 'application/vnd.github.v3+json',
  };

  let sha: string | undefined;
  let currentObj: T | null = null;

  const getRes = await fetch(url, { headers });
  if (getRes.status === 200) {
    const fileData: any = await getRes.json();
    sha = fileData.sha;
    const decoded = atob(fileData.content.replace(/\n/g, ''));
    currentObj = JSON.parse(decoded);
  }

  const updatedObj = modify(currentObj);
  const jsonString = JSON.stringify(updatedObj, null, 2);
  const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

  const putRes = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      content: base64Content,
      branch: env.GITHUB_BRANCH,
      sha,
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub commit failed for ${path}: ${putRes.status} ${errText}`);
  }
}

/**
 * Update data/stations.json metadata
 */
async function updateStationsRegistry(env: Env, payload: IngestPayload): Promise<void> {
  await updateGitHubFile<any[]>(
    env,
    'data/stations.json',
    (stationsList) => {
      const list = stationsList || [];
      const idx = list.findIndex(s => s.id === payload.station_id);
      const now = new Date().toISOString();

      if (idx >= 0) {
        list[idx].last_seen = now;
        if (payload.battery_mv) list[idx].battery_mv = payload.battery_mv;
        if (payload.battery_pct) list[idx].battery_pct = payload.battery_pct;
        list[idx].status = 'online';
      } else {
        list.push({
          id: payload.station_id,
          name: payload.station_id,
          location: 'Auto-registered Station',
          monitored_network: payload.records[0]?.ssid || 'Unknown',
          fallback_network: 'S24',
          first_seen: now,
          last_seen: now,
          battery_mv: payload.battery_mv || 0,
          battery_pct: payload.battery_pct || 0,
          status: 'online',
        });
      }
      return list;
    },
    `chore(registry): update station ${payload.station_id} heartbeat`
  );
}
