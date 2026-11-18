import { Env } from "./types";
import { handleRegister } from "./register";
import { handleTelemetry } from "./telemetry";
import { handleApiStations, handleApiStationDetail, handleApiExport } from "./api";
import { handleOta, handleSetStationTargetVersion, handleFirmwareDownload } from "./ota";
import { handleScheduledMaintenance } from "./cron";
import { renderDashboardHtml } from "./frontend";
import { handleAdminApi } from "./admin";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    try {
      // 1. Zero-Trust Station Registration
      if (path === "/register") {
        return await handleRegister(request, env);
      }

      // 2. Telemetry Ingestion
      if (path === "/data") {
        return await handleTelemetry(request, env);
      }

      // 3. OTA Firmware Updates and Downloads
      if (path === "/api/ota" || path.startsWith("/api/ota/")) {
        return await handleOta(request, env);
      }

      // 4. Web Flasher Manifest & Firmware Assets
      if (path === "/manifest-update.json" || path === "/firmware/manifest-update.json") {
        const manifest = {
          name: "T18 Wi-Fi Monitor (Update Only)",
          version: env.STABLE_VERSION || "1.1.3",
          funding_url: "https://github.com/flynn0/T18",
          new_install_prompt_erase: false,
          builds: [
            {
              chipFamily: "ESP32",
              parts: [
                { path: "firmware/firmware.bin", offset: 65536 }
              ]
            }
          ]
        };
        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }

      if (path === "/manifest.json" || path === "/firmware/manifest.json") {
        const manifest = {
          name: "T18 Wi-Fi Monitor (flynn0/T18)",
          version: env.STABLE_VERSION || "1.1.3",
          funding_url: "https://github.com/flynn0/T18",
          new_install_prompt_erase: true,
          builds: [
            {
              chipFamily: "ESP32",
              parts: [
                { path: "firmware/bootloader.bin", offset: 4096 },
                { path: "firmware/partitions.bin", offset: 32768 },
                { path: "firmware/boot_app0.bin", offset: 57344 },
                { path: "firmware/firmware.bin", offset: 65536 }
              ]
            }
          ]
        };
        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }

      if (path.startsWith("/firmware/")) {
        const filename = decodeURIComponent(path.substring("/firmware/".length));
        return await handleFirmwareDownload(filename, request, env);
      }

      if (path.startsWith("/api/station/") && path.endsWith("/target-version")) {
        const parts = path.split("/");
        const stationId = decodeURIComponent(parts[3]);
        return await handleSetStationTargetVersion(stationId, request, env);
      }

      // 3. Public Read-only APIs
      if (path === "/api/stations" && request.method === "GET") {
        return await handleApiStations(request, env);
      }

      if (path.startsWith("/api/station/") && request.method === "GET") {
        const stationId = decodeURIComponent(path.substring("/api/station/".length));
        return await handleApiStationDetail(stationId, request, env);
      }

      if (path === "/api/export" && request.method === "GET") {
        return await handleApiExport(request, env);
      }

      // 4. Admin & Fleet Management APIs
      if (path.startsWith("/api/admin/")) {
        const subPath = path.substring("/api/admin/".length);
        return await handleAdminApi(subPath, request, env);
      }

      // 5. Web Dashboard Frontend (Root or direct station route e.g. /9E1-9)
      if ((request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/")) {
        return new Response(request.method === "HEAD" ? null : renderDashboardHtml(), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60"
          }
        });
      }

      // 404 Fallback
      return new Response(JSON.stringify({ error: "Not Found", path }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: unknown) {
      console.error("[Worker Error]", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: "Internal Server Error", message: errMsg }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleScheduledMaintenance(event, env);
  }
};
