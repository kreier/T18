/**
 * Cloudflare Worker: T18 Network Telemetry Ingestion & Live Buffer
 *
 * Capabilities:
 * - POST /heartbeat : Receives hourly live telemetry (battery mV, RSSI, status, visible networks count)
 *                     and caches in Cloudflare KV without hitting GitHub API limits.
 * - GET /live       : Returns real-time live telemetry for stations (supports CORS for GitHub Pages).
 * - POST /ingest    : Receives daily multi-day batches, aggregates hourly rollups (Green, Orange, Purple, Red),
 *                     and commits updates directly to kreier/T18 on GitHub.
 */

export interface Env {
  AUTH_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  TELEMETRY_KV?: KVNamespace;
}

interface TelemetryRecord {
  timestamp: number;
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

interface HeartbeatPayload {
  station_id: string;
  timestamp: number;
  battery_mv: number;
  battery_pct: number;
  rssi: number;
  visible_networks: number;
  status: 'green' | 'orange' | 'purple' | 'red';
  last_assoc_ms: number;
  last_dhcp_ms: number;
  last_http_latency_ms: number;
}

interface ScannedNetworkRecord {
  ssid: string;
  rssi: number;
  ch?: number;
  channel?: number;
  sec?: string;
  security?: string;
}

interface IngestPayload {
  station_id: string;
  station_name?: string;
  location?: string;
  monitored_networks?: string[];
  visible_networks?: number;
  scan_networks?: ScannedNetworkRecord[];
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
  visible_networks?: number;
}

interface MonthFileContent {
  station: string;
  month: string;
  hours: Record<string, HourlySummary>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check and root overview
    if (request.method === 'GET' && url.pathname === '/') {
      const format = url.searchParams.get('format');
      const accept = request.headers.get('Accept') || '';

      // Return raw JSON if explicitly requested by API clients / health probes
      if (format === 'json' || (accept.includes('application/json') && !accept.includes('text/html'))) {
        return new Response(JSON.stringify({ service: 'T18 Telemetry Gateway', status: 'healthy', version: '0.5.1' }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Otherwise render modern responsive HTML overview portal
      const html = await renderOverviewHtml(env);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...CORS_HEADERS,
        },
      });
    }

    // -----------------------------------------------------------------------
    // GET /live - Real-time Live Telemetry Query (Cached in KV)
    // -----------------------------------------------------------------------
    if (request.method === 'GET' && url.pathname === '/live') {
      if (!env.TELEMETRY_KV) {
        return new Response(JSON.stringify({ error: 'Cloudflare KV is not configured on this worker' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const requestedStation = url.searchParams.get('station');
      if (requestedStation) {
        const data = await env.TELEMETRY_KV.get(`live:${requestedStation}`, { type: 'json' });
        return new Response(JSON.stringify(data || { station: requestedStation, status: 'offline' }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // List all live stations
      const list = await env.TELEMETRY_KV.list({ prefix: 'live:' });
      const results: Record<string, any> = {};
      for (const key of list.keys) {
        const stId = key.name.replace('live:', '');
        const val = await env.TELEMETRY_KV.get(key.name, { type: 'json' });
        if (val) results[stId] = val;
      }

      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Authenticate POST endpoints with Bearer token
    if (request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing Bearer authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const expectedToken = (env.AUTH_TOKEN || '').trim();
      if (!expectedToken) {
        return new Response(JSON.stringify({ error: 'Server misconfiguration: AUTH_TOKEN secret is not set' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      if (token !== expectedToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    // -----------------------------------------------------------------------
    // POST /heartbeat - Hourly Live Telemetry Update (Stored in KV)
    // -----------------------------------------------------------------------
    if (request.method === 'POST' && url.pathname === '/heartbeat') {
      try {
        const payload: HeartbeatPayload = await request.json();
        if (!payload.station_id) {
          return new Response(JSON.stringify({ error: 'Missing station_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        if (env.TELEMETRY_KV) {
          // Store live status with a 48-hour expiration
          await env.TELEMETRY_KV.put(`live:${payload.station_id}`, JSON.stringify(payload), {
            expirationTtl: 172800,
          });

          // Append to station's hourly buffer for the day
          const date = new Date(payload.timestamp * 1000);
          const dayKey = `buffer:${payload.station_id}:${date.toISOString().slice(0, 10)}`;
          const existingBuffer = (await env.TELEMETRY_KV.get(dayKey, { type: 'json' })) as HeartbeatPayload[] | null || [];
          existingBuffer.push(payload);
          await env.TELEMETRY_KV.put(dayKey, JSON.stringify(existingBuffer), { expirationTtl: 604800 });
        }

        return new Response(JSON.stringify({ success: true, station: payload.station_id, cached: !!env.TELEMETRY_KV }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    // -----------------------------------------------------------------------
    // POST /ingest - Daily Batch Ingestion (Commits to GitHub)
    // -----------------------------------------------------------------------
    if (request.method === 'POST' && url.pathname === '/ingest') {
      try {
        const payload: IngestPayload = await request.json();
        if (!payload.station_id || !Array.isArray(payload.records) || payload.records.length === 0) {
          return new Response(JSON.stringify({ error: 'Payload must contain station_id and non-empty records array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        // Group records into hourly buckets
        const hourlyBuckets = new Map<string, TelemetryRecord[]>();

        for (const rec of payload.records) {
          if (!rec.timestamp || rec.timestamp < 1000000000) continue;

          const date = new Date(rec.timestamp * 1000);
          date.setUTCMinutes(0, 0, 0);
          const isoHour = date.toISOString().slice(0, 13) + ':00:00Z';

          const bucket = hourlyBuckets.get(isoHour) || [];
          bucket.push(rec);
          hourlyBuckets.set(isoHour, bucket);
        }

        if (hourlyBuckets.size === 0) {
          return new Response(JSON.stringify({ error: 'No valid timestamped records found in batch' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        // Compute hourly rollup aggregates
        const aggregatedHours: Record<string, HourlySummary> = {};
        for (const [isoHour, records] of hourlyBuckets.entries()) {
          const samples = records.length;
          const successful = records.filter(r => r.assoc_ms > 0 && (r.dhcp_ms === undefined || r.dhcp_ms >= 0) && (!r.status || r.status === 'ok')).length;

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

        // Update data/stations.json metadata in GitHub
        await updateStationsRegistry(env, payload);

        // Update data/<station_id>/networks.json survey in GitHub if scan results are provided
        if (payload.scan_networks && payload.scan_networks.length > 0) {
          try {
            await updateNetworksSurvey(env, payload);
          } catch (surveyErr) {
            console.error('Failed to update networks survey in GitHub', surveyErr);
          }
        }

        // Update live status cache in KV
        if (env.TELEMETRY_KV) {
          try {
            await env.TELEMETRY_KV.put(`live:${payload.station_id}`, JSON.stringify({
              station_id: payload.station_id,
              station_name: payload.station_name || payload.station_id,
              location: payload.location,
              monitored_networks: payload.monitored_networks,
              timestamp: Math.floor(Date.now() / 1000),
              battery_mv: payload.battery_mv || 0,
              battery_pct: payload.battery_pct || 0,
              visible_networks: payload.visible_networks || 0,
              status: 'green',
            }), { expirationTtl: 172800 });
          } catch (kvErr) {
            console.warn('Failed to update live KV in ingest', kvErr);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          station_id: payload.station_id,
          records_processed: payload.records.length,
          hours_aggregated: Object.keys(aggregatedHours).length,
          months_affected: Array.from(updatesByMonth.keys()),
        }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
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
 * Update data/stations.json metadata in GitHub
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
        if (payload.monitored_networks && payload.monitored_networks.length > 0) {
          list[idx].monitored_networks = payload.monitored_networks;
          list[idx].monitored_network = payload.monitored_networks[0];
        }
        if (payload.location && payload.location.trim().length > 0) {
          list[idx].location = payload.location.trim();
        }
        if (payload.station_name && payload.station_name.trim().length > 0) {
          list[idx].name = payload.station_name.trim();
        }
        if (typeof payload.visible_networks === 'number') {
          list[idx].visible_networks = payload.visible_networks;
        }
        list[idx].status = 'online';
      } else {
        const nets = (payload.monitored_networks && payload.monitored_networks.length > 0)
          ? payload.monitored_networks
          : [payload.records[0]?.ssid || 'Unknown'];
        list.push({
          id: payload.station_id,
          name: payload.station_name || payload.station_id,
          location: (payload.location && payload.location.trim().length > 0) ? payload.location.trim() : 'Science Building C',
          monitored_networks: nets,
          monitored_network: nets[0] || 'Unknown',
          first_seen: now,
          last_seen: now,
          battery_mv: payload.battery_mv || 0,
          battery_pct: payload.battery_pct || 0,
          visible_networks: typeof payload.visible_networks === 'number' ? payload.visible_networks : 0,
          status: 'online',
        });
      }
      return list;
    },
    `chore(registry): update station ${payload.station_id} heartbeat`
  );
}

interface NetworkSurveyItem {
  ssid: string;
  is_monitored: boolean;
  avg_rssi: number;
  min_rssi: number;
  max_rssi: number;
  visibility_pct: number;
  observed_scans: number;
  total_scans: number;
  channel: number;
  security: string;
  last_seen: string;
}

interface DailySurvey {
  date: string;
  total_scans: number;
  networks_count: number;
  networks: NetworkSurveyItem[];
}

interface NetworksFileContent {
  station: string;
  monitored_networks: string[];
  daily: Record<string, DailySurvey>;
}

/**
 * Update data/<station_id>/networks.json daily visible spectrum survey in GitHub
 */
async function updateNetworksSurvey(env: Env, payload: IngestPayload): Promise<void> {
  if (!payload.scan_networks || payload.scan_networks.length === 0) return;

  const filePath = `data/${payload.station_id}/networks.json`;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  await updateGitHubFile<NetworksFileContent>(
    env,
    filePath,
    (existingContent) => {
      const doc: NetworksFileContent = existingContent || {
        station: payload.station_id,
        monitored_networks: payload.monitored_networks || [],
        daily: {},
      };

      if (payload.monitored_networks && payload.monitored_networks.length > 0) {
        doc.monitored_networks = payload.monitored_networks;
      }

      if (!doc.daily) doc.daily = {};

      const currentDaily: DailySurvey = doc.daily[today] || {
        date: today,
        total_scans: 0,
        networks_count: 0,
        networks: [],
      };

      currentDaily.total_scans = (currentDaily.total_scans || 0) + 1;
      const totalScans = currentDaily.total_scans;

      const monitoredSet = new Set(doc.monitored_networks || []);

      for (const item of payload.scan_networks!) {
        if (!item.ssid || item.ssid.trim().length === 0) continue;
        const ssid = item.ssid.trim();
        const rssi = typeof item.rssi === 'number' ? item.rssi : -90;
        const channel = item.channel || item.ch || 1;
        const security = item.security || item.sec || 'WPA2-PSK';

        const existingNet = currentDaily.networks.find(n => n.ssid === ssid);
        if (existingNet) {
          existingNet.observed_scans = (existingNet.observed_scans || 0) + 1;
          existingNet.total_scans = totalScans;
          existingNet.min_rssi = Math.min(existingNet.min_rssi, rssi);
          existingNet.max_rssi = Math.max(existingNet.max_rssi, rssi);
          existingNet.avg_rssi = Math.round(
            (existingNet.avg_rssi * (existingNet.observed_scans - 1) + rssi) / existingNet.observed_scans
          );
          existingNet.visibility_pct = Math.round((existingNet.observed_scans / totalScans) * 100);
          existingNet.channel = channel;
          existingNet.security = security;
          existingNet.last_seen = now;
          existingNet.is_monitored = monitoredSet.has(ssid);
        } else {
          currentDaily.networks.push({
            ssid,
            is_monitored: monitoredSet.has(ssid),
            avg_rssi: rssi,
            min_rssi: rssi,
            max_rssi: rssi,
            visibility_pct: Math.round((1 / totalScans) * 100),
            observed_scans: 1,
            total_scans: totalScans,
            channel,
            security,
            last_seen: now,
          });
        }
      }

      // Update visibility_pct for all networks in today's survey
      for (const net of currentDaily.networks) {
        net.total_scans = totalScans;
        net.visibility_pct = Math.round(((net.observed_scans || 1) / totalScans) * 100);
      }

      // Sort networks: monitored first, then by avg_rssi descending
      currentDaily.networks.sort((a, b) => {
        if (a.is_monitored && !b.is_monitored) return -1;
        if (!a.is_monitored && b.is_monitored) return 1;
        return b.avg_rssi - a.avg_rssi;
      });

      currentDaily.networks_count = currentDaily.networks.length;
      doc.daily[today] = currentDaily;

      return doc;
    },
    `telemetry: update ${payload.station_id} visible networks survey for ${today}`
  );
}

// ---------------------------------------------------------------------------
// HTML Portal & Station Overview Rendering
// ---------------------------------------------------------------------------

interface RegisteredStationMeta {
  id: string;
  name?: string;
  location?: string;
  monitored_networks?: string[];
  monitored_network?: string;
  fallback_network?: string;
  probe_interval_min?: number;
  first_seen?: string;
  last_seen?: string;
  battery_mv?: number;
  battery_pct?: number;
  visible_networks?: number;
  status?: string;
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 0 || isNaN(secondsAgo)) return 'just now';
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
  const mins = Math.floor(secondsAgo / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function renderOverviewHtml(env: Env): Promise<string> {
  const now = new Date();
  const nowEpoch = Math.floor(now.getTime() / 1000);

  // 1. Fetch live stations from Cloudflare KV (if available)
  const liveMap = new Map<string, any>();
  if (env.TELEMETRY_KV) {
    try {
      const list = await env.TELEMETRY_KV.list({ prefix: 'live:' });
      for (const key of list.keys) {
        const val = await env.TELEMETRY_KV.get(key.name, { type: 'json' });
        if (val) {
          const stId = key.name.replace('live:', '');
          liveMap.set(stId, val);
        }
      }
    } catch (e) {
      console.warn('Failed to query live KV entries', e);
    }
  }

  // 2. Fetch stations.json from GitHub repository
  let githubStations: RegisteredStationMeta[] = [];
  try {
    const ghUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/data/stations.json`;
    const res = await fetch(ghUrl, {
      headers: {
        'User-Agent': 'T18-Telemetry-Gateway',
        ...(env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (res.ok) {
      githubStations = await res.json();
    }
  } catch (e) {
    console.warn('Failed to fetch stations.json from GitHub', e);
  }

  // 3. Merge GitHub metadata and Live KV records
  const stationMap = new Map<string, {
    id: string;
    name: string;
    location: string;
    monitored_networks: string[];
    fallback_network?: string;
    battery_mv?: number;
    battery_pct?: number;
    visible_networks?: number;
    rssi?: number;
    last_epoch: number;
    last_seen_formatted: string;
    age_seconds: number;
    status: 'online' | 'idle' | 'offline';
  }>();

  for (const gh of githubStations) {
    if (!gh.id) continue;
    const epoch = gh.last_seen ? Math.floor(new Date(gh.last_seen).getTime() / 1000) : 0;
    const networks = gh.monitored_networks || (gh.monitored_network ? [gh.monitored_network] : []);
    const age = epoch > 0 ? (nowEpoch - epoch) : 999999999;

    let status: 'online' | 'idle' | 'offline' = 'offline';
    if (age <= 7200) status = 'online';
    else if (age <= 86400) status = 'idle';

    stationMap.set(gh.id, {
      id: gh.id,
      name: gh.name || gh.id,
      location: gh.location || 'Unknown',
      monitored_networks: networks,
      fallback_network: gh.fallback_network,
      battery_mv: gh.battery_mv,
      battery_pct: gh.battery_pct,
      visible_networks: gh.visible_networks,
      rssi: undefined,
      last_epoch: epoch,
      last_seen_formatted: gh.last_seen || 'Never',
      age_seconds: age,
      status,
    });
  }

  for (const [stId, live] of liveMap.entries()) {
    const existing = stationMap.get(stId);
    const liveEpoch = typeof live.timestamp === 'number' ? live.timestamp : nowEpoch;
    const age = nowEpoch - liveEpoch;

    let status: 'online' | 'idle' | 'offline' = 'offline';
    if (age <= 7200) status = 'online';
    else if (age <= 86400) status = 'idle';

    const mergedNetworks = (live.monitored_networks && live.monitored_networks.length > 0)
      ? live.monitored_networks
      : (existing?.monitored_networks || []);

    stationMap.set(stId, {
      id: stId,
      name: live.station_name || existing?.name || stId,
      location: live.location || existing?.location || 'Unknown',
      monitored_networks: mergedNetworks,
      fallback_network: existing?.fallback_network,
      battery_mv: live.battery_mv || existing?.battery_mv,
      battery_pct: live.battery_pct !== undefined ? live.battery_pct : existing?.battery_pct,
      visible_networks: live.visible_networks !== undefined ? live.visible_networks : existing?.visible_networks,
      rssi: live.rssi,
      last_epoch: Math.max(liveEpoch, existing?.last_epoch || 0),
      last_seen_formatted: new Date(liveEpoch * 1000).toISOString(),
      age_seconds: Math.min(age, existing?.age_seconds !== undefined ? existing.age_seconds : age),
      status,
    });
  }

  const stations = Array.from(stationMap.values()).sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1;
    if (b.status === 'online' && a.status !== 'online') return 1;
    return b.last_epoch - a.last_epoch;
  });

  const totalStations = stations.length;
  const onlineStations = stations.filter(s => s.status === 'online').length;
  const avgBatteryPct = stations.filter(s => s.battery_pct !== undefined).length > 0
    ? Math.round(stations.filter(s => s.battery_pct !== undefined).reduce((acc, s) => acc + (s.battery_pct || 0), 0) / stations.filter(s => s.battery_pct !== undefined).length)
    : 100;
  const totalMonitoredNetworks = new Set(stations.flatMap(s => s.monitored_networks)).size;

  const rowsHtml = stations.map(s => {
    const relTime = formatRelativeTime(s.age_seconds);
    const badgeClass = s.status === 'online' ? 'badge-healthy' : (s.status === 'idle' ? 'badge-idle' : 'badge-offline');
    const badgeLabel = s.status === 'online' ? '<span class="pulse-dot"></span> Online' : (s.status === 'idle' ? 'Idle' : 'Offline');

    const netPills = s.monitored_networks.map(n => `<span class="wifi-pill">${escapeHtml(n)}</span>`).join('');
    const fallbackPill = s.fallback_network ? `<span class="wifi-pill wifi-fallback" title="Fallback network (backup uplink only)">${escapeHtml(s.fallback_network)} (backup)</span>` : '';

    const battPct = s.battery_pct !== undefined ? s.battery_pct : (s.battery_mv ? Math.min(100, Math.max(0, Math.round((s.battery_mv - 3300) / (4200 - 3300) * 100))) : 0);
    const battVolts = s.battery_mv ? (s.battery_mv / 1000).toFixed(2) + ' V' : '--';
    const battColor = battPct >= 60 ? '#10b981' : (battPct >= 25 ? '#f59e0b' : '#ef4444');

    const rssiHtml = s.rssi !== undefined
      ? `<span style="font-family: var(--font-mono); font-weight: 600;">${s.rssi}</span> <span style="color: var(--text-muted); font-size: 11px;">dBm</span>`
      : '<span style="color: var(--text-muted);">--</span>';

    const visibleCount = s.visible_networks !== undefined
      ? `<span style="font-family: var(--font-mono); font-weight: 600;">${s.visible_networks}</span> <span style="color: var(--text-muted); font-size: 11px;">SSIDs</span>`
      : '<span style="color: var(--text-muted);">--</span>';

    return `
      <tr>
        <td>
          <div class="station-id">${escapeHtml(s.id)}</div>
          <div class="station-name">${escapeHtml(s.name !== s.id ? s.name : s.location)}</div>
        </td>
        <td>
          <div class="location-box">
            <svg class="icon-svg" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            <span>${escapeHtml(s.location)}</span>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </td>
        <td>
          <div class="pills-container">
            ${netPills}
            ${fallbackPill}
          </div>
        </td>
        <td>
          <div class="battery-wrap">
            <div class="battery-bar-bg">
              <div class="battery-bar-fill" style="width: ${battPct}%; background-color: ${battColor};"></div>
            </div>
            <div class="battery-text">${battPct}% · ${battVolts}</div>
          </div>
        </td>
        <td>${visibleCount}</td>
        <td>${rssiHtml}</td>
        <td>
          <div class="timestamp-box">
            <div class="timestamp-rel">${relTime}</div>
            <div class="timestamp-full" title="${escapeHtml(s.last_seen_formatted)}">${s.last_epoch > 0 ? new Date(s.last_epoch * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Never'}</div>
          </div>
        </td>
        <td style="text-align: right;">
          <a href="/live?station=${encodeURIComponent(s.id)}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; font-family: var(--font-mono);" target="_blank">Live JSON ↗</a>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>T18 Telemetry Gateway · Healthy (v0.5.1)</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%233b82f6%22><path d=%22M12 3C6.95 3 2.56 5.6 0 9.53l2.45 2.45C4.38 8.65 7.94 6.5 12 6.5s7.62 2.15 9.55 5.48L24 9.53C21.44 5.6 17.05 3 12 3zm0 7c-3.1 0-5.83 1.4-7.66 3.61l2.46 2.46c1.27-1.58 3.14-2.57 5.2-2.57s3.93.99 5.2 2.57l2.46-2.46C17.83 11.4 15.1 10 12 10zm0 7c-1.38 0-2.5 1.12-2.5 2.5S10.62 22 12 22s2.5-1.12 2.5-2.5S13.38 17 12 17z%22/></svg>">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f293d;
      --card-hover: #1a2333;
      --text-main: #f9fafb;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --green: #10b981;
      --green-bg: rgba(16, 185, 129, 0.12);
      --green-border: rgba(16, 185, 129, 0.3);
      --orange: #f59e0b;
      --orange-bg: rgba(245, 158, 11, 0.12);
      --orange-border: rgba(245, 158, 11, 0.3);
      --red: #ef4444;
      --red-bg: rgba(239, 68, 68, 0.12);
      --red-border: rgba(239, 68, 68, 0.3);
      --gray: #64748b;
      --gray-bg: rgba(100, 116, 139, 0.12);
      --gray-border: rgba(100, 116, 139, 0.3);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 24px 20px 48px;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1240px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 28px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #1e3a8a, #3b82f6);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px var(--accent-glow);
    }
    .brand-icon svg { width: 24px; height: 24px; fill: white; }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-sub { font-size: 13px; color: var(--text-muted); }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn-primary { background: #2563eb; color: white; border: 1px solid #3b82f6; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .btn-secondary:hover { background: #334155; color: white; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-mono);
      letter-spacing: 0.02em;
    }
    .badge-healthy { background: var(--green-bg); color: #34d399; border: 1px solid var(--green-border); }
    .badge-version { background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-idle { background: var(--orange-bg); color: #fbbf24; border: 1px solid var(--orange-border); }
    .badge-offline { background: var(--gray-bg); color: #94a3b8; border: 1px solid var(--gray-border); }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-main);
      font-family: var(--font-mono);
      letter-spacing: -0.03em;
    }
    .stat-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 16px;
      gap: 12px;
    }
    .section-title { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    .section-subtitle { font-size: 13px; color: var(--text-muted); }
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow-x: auto;
      margin-bottom: 36px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      background: rgba(15, 23, 42, 0.7);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 14px 18px;
      border-bottom: 1px solid var(--card-border);
      white-space: nowrap;
    }
    td { padding: 16px 18px; border-bottom: 1px solid var(--card-border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--card-hover); }
    .station-id { font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: #60a5fa; }
    .station-name { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .location-box { display: flex; align-items: center; gap: 6px; color: #cbd5e1; font-size: 12px; }
    .icon-svg { width: 13px; height: 13px; fill: #94a3b8; flex-shrink: 0; }
    .pills-container { max-width: 280px; }
    .wifi-pill {
      display: inline-block;
      padding: 3px 8px;
      margin: 2px 4px 2px 0;
      border-radius: 6px;
      font-size: 11px;
      font-family: var(--font-mono);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
      white-space: nowrap;
    }
    .wifi-fallback {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.25);
      color: #fbbf24;
    }
    .battery-wrap { display: flex; flex-direction: column; gap: 4px; min-width: 100px; }
    .battery-bar-bg { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; }
    .battery-bar-fill { height: 100%; border-radius: 3px; }
    .battery-text { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
    .timestamp-box { white-space: nowrap; }
    .timestamp-rel { font-weight: 600; color: var(--text-main); }
    .timestamp-full { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
    .docs-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .endpoint-item {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }
    .endpoint-item:last-child { border-bottom: none; }
    .method-badge {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      min-width: 48px;
      text-align: center;
    }
    .method-get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .method-post { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .endpoint-path { font-family: var(--font-mono); color: #f1f5f9; font-weight: 600; min-width: 140px; }
    .endpoint-desc { color: var(--text-muted); }
    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-top: 24px;
      border-top: 1px solid var(--card-border);
      font-size: 12px;
      color: var(--text-muted);
    }
    .footer-link { color: #60a5fa; text-decoration: none; }
    .footer-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24"><path d="M12 3C6.95 3 2.56 5.6 0 9.53l2.45 2.45C4.38 8.65 7.94 6.5 12 6.5s7.62 2.15 9.55 5.48L24 9.53C21.44 5.6 17.05 3 12 3zm0 7c-3.1 0-5.83 1.4-7.66 3.61l2.46 2.46c1.27-1.58 3.14-2.57 5.2-2.57s3.93.99 5.2 2.57l2.46-2.46C17.83 11.4 15.1 10 12 10zm0 7c-1.38 0-2.5 1.12-2.5 2.5S10.62 22 12 22s2.5-1.12 2.5-2.5S13.38 17 12 17z"/></svg>
        </div>
        <div>
          <div class="brand-title">
            <span>T18 Telemetry Gateway</span>
            <span class="badge badge-healthy"><span class="pulse-dot"></span> Healthy</span>
            <span class="badge badge-version">v0.5.1</span>
          </div>
          <div class="brand-sub">Cloudflare Edge Ingestion &amp; Real-time Monitoring Node</div>
        </div>
      </div>
      <div class="header-actions">
        <a href="https://kreier.github.io/T18" target="_blank" class="btn btn-primary">Web Dashboard ↗</a>
        <a href="https://github.com/kreier/T18" target="_blank" class="btn btn-secondary">GitHub ↗</a>
        <a href="/?format=json" class="btn btn-secondary" style="font-family: var(--font-mono);">JSON API</a>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Registered Stations</div>
        <div class="stat-value">${totalStations}</div>
        <div class="stat-desc">Provisioned ESP32 probes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Online Stations</div>
        <div class="stat-value" style="color: #34d399;">${onlineStations}</div>
        <div class="stat-desc">Reported within last 2 hours</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monitored Networks</div>
        <div class="stat-value" style="color: #60a5fa;">${totalMonitoredNetworks}</div>
        <div class="stat-desc">Target Wi-Fi SSIDs monitored</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Battery</div>
        <div class="stat-value" style="color: ${avgBatteryPct >= 50 ? '#34d399' : '#f59e0b'};">${avgBatteryPct}%</div>
        <div class="stat-desc">Fleet power health status</div>
      </div>
    </div>

    <div class="section-header">
      <div>
        <div class="section-title">Registered IoT Stations</div>
        <div class="section-subtitle">Real-time health, multi-network probing state, and battery telemetry</div>
      </div>
      <div style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
        Auto-refreshes every 60s
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Station</th>
            <th>Location</th>
            <th>Status</th>
            <th>Monitored Networks</th>
            <th>Battery</th>
            <th>Visible</th>
            <th>Signal</th>
            <th>Latest Submission</th>
            <th style="text-align: right;">Endpoint</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">No stations currently registered.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="docs-card">
      <div style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">Gateway Endpoints Quick Reference</div>
      <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Core REST endpoints served by this edge gateway:</div>
      <div class="endpoint-item">
        <span class="method-badge method-get">GET</span>
        <span class="endpoint-path">/</span>
        <span class="endpoint-desc">This overview website (or raw JSON when requested via <code>?format=json</code> or <code>Accept: application/json</code>)</span>
      </div>
      <div class="endpoint-item">
        <span class="method-badge method-get">GET</span>
        <span class="endpoint-path">/live</span>
        <span class="endpoint-desc">Live status for all stations cached in KV (or <code>/live?station=&lt;id&gt;</code> for single probe)</span>
      </div>
      <div class="endpoint-item">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/heartbeat</span>
        <span class="endpoint-desc">Hourly station heartbeat (voltage, visible networks count, RSSI, status)</span>
      </div>
      <div class="endpoint-item">
        <span class="method-badge method-post">POST</span>
        <span class="endpoint-path">/ingest</span>
        <span class="endpoint-desc">Batch rollups submission, commits daily/monthly telemetry and networks survey directly to GitHub</span>
      </div>
    </div>

    <footer>
      <div>T18 Wi-Fi Quality Telemetry System · Open Source under MIT · Deployed via Cloudflare Workers</div>
      <div>Edge Server UTC: <span style="font-family: var(--font-mono);">${escapeHtml(now.toISOString().replace('T', ' ').slice(0, 19))} UTC</span></div>
    </footer>
  </div>
</body>
</html>`;
}
