import { Env } from "./types";
import { Database } from "./db";

// Helper for constant-time or secure string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Convert ArrayBuffer to URL-safe Base64
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Convert URL-safe Base64 to ArrayBuffer
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function generateAdminToken(username: string, env: Env): Promise<string> {
  const secret = env.ADMIN_PASSWORD || env.MASTER_PHRASE || "t18-admin-fallback-secret";
  const key = await getHmacKey(secret);
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days valid
  const payload = `${username}:${expiry}`;

  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigB64 = bufferToBase64Url(signature);

  return `${username}.${expiry}.${sigB64}`;
}

export async function verifyAdminToken(token: string | null, env: Env): Promise<{ valid: boolean; username?: string }> {
  if (!token) return { valid: false };

  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false };

  const [username, expiryStr, sigB64] = parts;
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) {
    return { valid: false };
  }

  // Verify username matches configured admin
  const configuredUser = env.ADMIN_USERNAME || "admin";
  if (!timingSafeEqual(username, configuredUser)) {
    return { valid: false };
  }

  const secret = env.ADMIN_PASSWORD || env.MASTER_PHRASE || "t18-admin-fallback-secret";
  const key = await getHmacKey(secret);
  const payload = `${username}:${expiry}`;

  const enc = new TextEncoder();
  try {
    const sigBuffer = base64UrlToBuffer(sigB64);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, enc.encode(payload));
    return { valid: isValid, username };
  } catch {
    return { valid: false };
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token"
    }
  });
}

export async function handleAdminApi(subPath: string, request: Request, env: Env): Promise<Response> {
  const db = new Database(env);

  // 1. Admin Login Endpoint (Unauthenticated)
  if (subPath === "login" && request.method === "POST") {
    try {
      const body = await request.json() as any;
      const username = (body.username || "").trim();
      const password = (body.password || "").trim();

      const expectedUser = (env.ADMIN_USERNAME || "admin").trim();
      const expectedPass = (env.ADMIN_PASSWORD || "change_me_in_production").trim();

      if (!timingSafeEqual(username, expectedUser) || !timingSafeEqual(password, expectedPass)) {
        return jsonResponse({ error: "Invalid username or password" }, 401);
      }

      const token = await generateAdminToken(username, env);
      return jsonResponse({
        success: true,
        token,
        username,
        message: "Authentication successful"
      });
    } catch {
      return jsonResponse({ error: "Malformed login request body" }, 400);
    }
  }

  // 2. Token Extraction & Verification for Protected Admin Routes
  let authHeader = request.headers.get("Authorization");
  let token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : request.headers.get("X-Admin-Token");

  const authResult = await verifyAdminToken(token, env);
  if (!authResult.valid) {
    return jsonResponse({ error: "Unauthorized: Invalid or expired admin session" }, 401);
  }

  // 3. Verify Session Endpoint
  if (subPath === "verify" && request.method === "GET") {
    return jsonResponse({
      valid: true,
      username: authResult.username
    });
  }

  // 4. Admin Overview & Database Statistics
  if (subPath === "overview" && request.method === "GET") {
    const url = new URL(request.url);
    const currentYear = new Date().getFullYear();
    const year = parseInt(url.searchParams.get("year") || `${currentYear}`, 10) || currentYear;
    const stationId = url.searchParams.get("station_id") || "all";

    const [tableStats, stationStats, yearlyActivity] = await Promise.all([
      db.getTableStats(),
      db.getStationStats(),
      db.getYearlyActivity(year, stationId)
    ]);

    // Calculate database totals
    const totalBytes = tableStats.reduce((acc, t) => acc + t.bytes_estimate, 0);
    const totalRows = tableStats.reduce((acc, t) => acc + t.count, 0);

    // Calculate fleet collection timeframes
    let fleetMinTs: number | null = null;
    let fleetMaxTs: number | null = null;
    let totalMeasurements = 0;

    stationStats.forEach(st => {
      if (st.min_timestamp && (fleetMinTs === null || st.min_timestamp < fleetMinTs)) {
        fleetMinTs = st.min_timestamp;
      }
      if (st.max_timestamp && (fleetMaxTs === null || st.max_timestamp > fleetMaxTs)) {
        fleetMaxTs = st.max_timestamp;
      }
      totalMeasurements += st.measurement_count || 0;
    });

    return jsonResponse({
      success: true,
      year,
      selected_station: stationId,
      database: {
        name: "t18-mon-db",
        total_estimated_bytes: totalBytes,
        total_estimated_formatted: totalBytes >= 1048576 
          ? (totalBytes / 1048576).toFixed(2) + " MB" 
          : (totalBytes / 1024).toFixed(1) + " KB",
        total_rows: totalRows,
        tables: tableStats.map(t => ({
          ...t,
          size_formatted: t.bytes_estimate >= 1048576 
            ? (t.bytes_estimate / 1048576).toFixed(2) + " MB" 
            : (t.bytes_estimate / 1024).toFixed(1) + " KB",
          percent_of_total: totalBytes > 0 ? ((t.bytes_estimate / totalBytes) * 100).toFixed(1) : "0.0"
        }))
      },
      fleet_summary: {
        total_stations: stationStats.length,
        total_measurements: totalMeasurements,
        earliest_timestamp: fleetMinTs,
        latest_timestamp: fleetMaxTs,
        operating_days: fleetMinTs && fleetMaxTs ? Math.ceil((fleetMaxTs - fleetMinTs) / 86400) : 0
      },
      stations: stationStats,
      yearly_activity: yearlyActivity
    });
  }

  // 5. Update Station Configuration
  if (subPath === "station/update" && request.method === "POST") {
    try {
      const body = await request.json() as any;
      const stationId = (body.station_id || "").trim();
      const description = (body.description || "").trim();
      const isCanary = body.is_canary ? 1 : 0;
      const targetVersion = body.target_version ? String(body.target_version).trim() : null;

      if (!stationId) {
        return jsonResponse({ error: "Missing required station_id" }, 400);
      }

      await db.updateStationSettings(stationId, description, isCanary, targetVersion);
      return jsonResponse({ success: true, message: `Station '${stationId}' settings updated successfully` });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to update station" }, 500);
    }
  }

  // 6. Delete Station
  if (subPath === "station/delete" && request.method === "POST") {
    try {
      const body = await request.json() as any;
      const stationId = (body.station_id || "").trim();
      const purgeData = body.purge_data !== false; // Default true

      if (!stationId) {
        return jsonResponse({ error: "Missing required station_id" }, 400);
      }

      await db.deleteStation(stationId, purgeData);
      return jsonResponse({
        success: true,
        message: `Station '${stationId}' ${purgeData ? "and all its telemetry" : ""} deleted successfully`
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to delete station" }, 500);
    }
  }

  // 7. Delete Measurements by Timeframe
  if (subPath === "data/delete" && request.method === "POST") {
    try {
      const body = await request.json() as any;
      const stationId = body.station_id && body.station_id !== "all" ? String(body.station_id).trim() : null;
      const fromTs = parseInt(body.from_timestamp, 10);
      const toTs = parseInt(body.to_timestamp, 10);

      if (isNaN(fromTs) || isNaN(toTs) || fromTs < 0 || toTs < fromTs) {
        return jsonResponse({ error: "Invalid timestamp range provided" }, 400);
      }

      const result = await db.deleteMeasurementsByTimeframe(stationId, fromTs, toTs);
      return jsonResponse({
        success: true,
        message: `Deleted ${result.deletedMeasurements} measurements, ${result.deletedChannels} channel records, ${result.deletedAps} AP scans, ${result.deletedBt} Bluetooth summaries, and ${result.deletedBattery} battery entries`,
        details: result
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to delete data" }, 500);
    }
  }

  return jsonResponse({ error: "Unknown admin endpoint" }, 404);
}
