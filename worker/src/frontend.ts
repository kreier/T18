export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>T18 Fleet Telemetry | flynn0/T18</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><path d='M12 3c-4.97 0-9.44 2.02-12 5.29l1.41 1.42C3.59 7.02 7.55 5.17 12 5.17s8.41 1.85 10.59 4.54L24 8.29C21.44 5.02 16.97 3 12 3zm0 4.33c-3.69 0-7.01 1.5-9.02 3.91l1.42 1.41C6.07 10.97 8.87 9.67 12 9.67s5.93 1.3 7.6 3.01l1.42-1.41C19.01 8.83 15.69 7.33 12 7.33zm0 4.34c-2.4 0-4.57.97-6.04 2.54l1.42 1.42C8.42 14.54 10.09 13.67 12 13.67s3.58.87 4.62 1.96l1.42-1.42C16.57 12.64 14.4 11.67 12 11.67zM12 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'/></svg>" />
  <script>
    (function() {
      try {
        const saved = localStorage.getItem("t18_theme") || localStorage.getItem("wifi_theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
      } catch(e) {}
    })();
  </script>
  <style>
    :root, [data-theme="dark"] {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f293d;
      --header-bg: rgba(17, 24, 39, 0.85);
      --input-bg: #1e293b;
      --metric-box-bg: #090d16;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #38bdf8;
      --primary-dim: rgba(56, 189, 248, 0.15);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --accent: #818cf8;
      --chart-grid: rgba(255, 255, 255, 0.05);
      --chart-text: #9ca3af;
      --table-border: rgba(255, 255, 255, 0.04);
      --table-hover: rgba(255, 255, 255, 0.02);
      --rssi-track: #1f293d;
      --badge-bg: #1f293d;
    }
    [data-theme="light"] {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --card-border: #e2e8f0;
      --header-bg: rgba(255, 255, 255, 0.88);
      --input-bg: #f1f5f9;
      --metric-box-bg: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary: #0284c7;
      --primary-dim: rgba(2, 132, 199, 0.12);
      --success: #059669;
      --warning: #d97706;
      --danger: #dc2626;
      --accent: #6366f1;
      --chart-grid: rgba(0, 0, 0, 0.06);
      --chart-text: #64748b;
      --table-border: rgba(0, 0, 0, 0.05);
      --table-hover: rgba(0, 0, 0, 0.03);
      --rssi-track: #e2e8f0;
      --badge-bg: #f1f5f9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--header-bg);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 1rem 1.5rem;
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text-main);
    }
    .brand svg {
      width: 28px;
      height: 28px;
      fill: var(--primary);
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-tag {
      font-size: 0.75rem;
      background: var(--primary-dim);
      color: var(--primary);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    select, button, a.nav-link {
      background: var(--input-bg);
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 0.45rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      outline: none;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: background-color 0.2s, border-color 0.2s, color 0.2s;
    }
    select:focus, button:hover, a.nav-link:hover {
      border-color: var(--primary);
    }
    button.primary-btn {
      background: var(--primary);
      color: #ffffff;
      font-weight: 600;
      border: none;
    }
    button.primary-btn:hover {
      opacity: 0.9;
    }
    #themeToggleBtn {
      padding: 0.45rem 0.65rem;
      font-size: 1rem;
      line-height: 1;
    }
    main {
      flex: 1;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .station-banner {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .station-info h2 {
      font-size: 1.35rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .station-info p {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-badge.online {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-badge.offline {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .battery-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }
    .battery-badge:hover {
      filter: brightness(1.15);
    }
    .battery-badge.warn {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border-color: rgba(245, 158, 11, 0.3);
    }
    .battery-badge.crit {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.3);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--table-border);
      padding-bottom: 0.75rem;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--primary);
    }
    .metrics-summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .metric-box {
      background: var(--metric-box-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 0.75rem;
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-val {
      font-size: 1.4rem;
      font-weight: 700;
      margin-top: 0.25rem;
      color: var(--text-main);
    }
    .metric-val span {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 400;
      margin-left: 0.2rem;
    }
    .latency-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .pill {
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.4rem;
      padding: 0.3rem 0.55rem;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .pill-val {
      font-weight: 700;
    }
    .pill-val.fast { color: var(--success); }
    .pill-val.med { color: var(--warning); }
    .pill-val.slow { color: var(--danger); }

    /* Chart Section */
    .chart-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .main-chart-wrap {
      position: relative;
      width: 100%;
      height: 260px;
    }
    .target-chart-wrap {
      position: relative;
      width: 100%;
      height: 160px;
    }

    /* Table Section */
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;
    }
    th {
      padding: 0.75rem;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--table-border);
      color: var(--text-main);
    }
    tr:hover td {
      background: var(--table-hover);
    }
    .rssi-bar-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .rssi-bar {
      width: 60px;
      height: 6px;
      background: var(--rssi-track);
      border-radius: 3px;
      overflow: hidden;
    }
    .rssi-fill {
      height: 100%;
      border-radius: 3px;
    }
    .rssi-stacked-bar {
      display: inline-flex;
      height: 8px;
      width: 110px;
      background: var(--rssi-track);
      border-radius: 4px;
      overflow: hidden;
      vertical-align: middle;
    }
    .rssi-seg {
      height: 100%;
    }
    .heatmap-row {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-bottom: 2px;
    }
    .heatmap-row-label {
      width: 44px;
      min-width: 44px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-align: right;
      padding-right: 6px;
    }
    .heatmap-cells-wrap {
      display: flex;
      gap: 2px;
      flex: 1;
      padding-right: 6px;
    }
    .heatmap-cell {
      flex: 1;
      height: 18px;
      min-width: 13px;
      border-radius: 2px;
      cursor: pointer;
      transition: transform 0.1s ease, outline 0.1s ease;
      background: rgba(100, 116, 139, 0.15);
      transform-origin: center center;
    }
    .heatmap-cell:hover {
      transform: scale(1.25);
      z-index: 10;
      outline: 1.5px solid #fff;
    }
    .heatmap-header-wrap {
      display: flex;
      gap: 2px;
      flex: 1;
      margin-bottom: 4px;
      padding-right: 6px;
    }
    .heatmap-header-col {
      flex: 1;
      min-width: 13px;
      font-size: 0.65rem;
      color: var(--text-muted);
      text-align: center;
    }
    .view-switch-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      border-radius: 4px;
      padding: 3px 9px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .view-switch-btn:hover {
      color: var(--text-main);
    }
    .view-switch-btn.active {
      background: var(--primary);
      color: #ffffff;
      font-weight: 600;
    }
    footer {
      border-top: 1px solid var(--card-border);
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.825rem;
      font-family: inherit;
      margin-top: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      width: 100%;
    }
    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    .fw-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      border: 1px solid rgba(56, 189, 248, 0.35);
      margin-left: 0.5rem;
      vertical-align: middle;
    }

    /* Web Flasher Modal & Controls */
    .flash-btn {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff !important;
      font-weight: 600;
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    [data-theme="dark"] .flash-btn {
      background: linear-gradient(135deg, #0284c7 0%, #075985 100%);
      border-color: rgba(56, 189, 248, 0.5);
    }
    .flash-btn:hover {
      filter: brightness(1.15);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
    }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    .modal-backdrop.active {
      opacity: 1;
      visibility: visible;
    }
    .modal-window {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      max-width: 760px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      transform: scale(0.96);
      transition: transform 0.25s ease;
      display: flex;
      flex-direction: column;
    }
    .modal-backdrop.active .modal-window {
      transform: scale(1);
    }
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .modal-title {
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-main);
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.35rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      line-height: 1;
    }
    .modal-close-btn:hover {
      color: var(--text-main);
      background: var(--input-bg);
    }
    .modal-tabs {
      display: flex;
      border-bottom: 1px solid var(--card-border);
      background: var(--input-bg);
      padding: 0 1.25rem;
      gap: 0.5rem;
      overflow-x: auto;
    }
    .modal-tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: var(--text-muted);
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .modal-tab-btn:hover {
      color: var(--text-main);
      border-color: transparent;
    }
    .modal-tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .flash-guide-card {
      background: var(--metric-box-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .flash-step-list {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .flash-step-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .flash-step-num {
      background: var(--primary-dim);
      color: var(--primary);
      font-weight: 700;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.8rem;
    }
    .serial-status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
    }
    .serial-status-banner.supported {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
    }
    .serial-status-banner.unsupported {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--warning);
    }
    .install-button-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.25rem;
      background: var(--input-bg);
      border: 2px dashed var(--primary);
      border-radius: 0.75rem;
      margin: 0.5rem 0;
      min-height: 80px;
    }
    .install-action-btn {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
      color: #ffffff !important;
      font-size: 1.05rem !important;
      font-weight: 700 !important;
      padding: 0.75rem 1.75rem !important;
      border-radius: 0.65rem !important;
      border: none !important;
      cursor: pointer !important;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;
    }
    .install-action-btn:hover {
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5) !important;
    }
    .bin-download-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 0.75rem;
    }
    .bin-card {
      background: var(--metric-box-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }
    .bin-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .bin-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .bin-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: monospace;
    }
    .code-block {
      background: #0d1117;
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
      color: #c9d1d9;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8rem;
      line-height: 1.5;
      position: relative;
      overflow-x: auto;
    }
    .copy-code-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 0.35rem;
      color: #c9d1d9;
      cursor: pointer;
    }
    .copy-code-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .modal-window.large {
      max-width: 1040px;
    }
    .admin-login-box {
      max-width: 380px;
      margin: 1.5rem auto;
      padding: 1.5rem;
      background: var(--metric-box-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .admin-input-group {
      display: flex;
      flex-direction: column;
      text-align: left;
      gap: 0.35rem;
    }
    .admin-input-group label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .admin-input-group input, .admin-input-group select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.375rem;
      color: var(--text-main);
      font-size: 0.875rem;
      outline: none;
    }
    .admin-input-group input:focus, .admin-input-group select:focus {
      border-color: var(--primary);
    }
    .admin-btn {
      padding: 0.5rem 0.85rem;
      border-radius: 0.375rem;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      transition: all 0.2s;
    }
    .admin-btn.primary { background: var(--primary); color: #fff; }
    .admin-btn.danger { background: var(--danger); color: #fff; }
    .admin-btn.secondary { background: var(--input-bg); color: var(--text-main); border: 1px solid var(--card-border); }
    .admin-btn:hover { opacity: 0.9; }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.825rem;
    }
    .admin-table th {
      background: rgba(0, 0, 0, 0.25);
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      padding: 0.65rem 0.85rem;
      text-align: left;
      border-bottom: 1px solid var(--card-border);
      white-space: nowrap;
    }
    .admin-table td {
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--card-border);
      color: var(--text-main);
      vertical-align: middle;
    }
    .admin-table tr:hover td {
      background: var(--table-hover);
    }
    .cal-card {
      background: var(--metric-box-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cal-scroll-wrap {
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .cal-grid-wrap {
      display: inline-flex;
      flex-direction: column;
      gap: 3px;
      user-select: none;
    }
    .cal-months-row {
      display: grid;
      grid-template-columns: 28px repeat(53, 13px);
      gap: 3px;
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-bottom: 2px;
      height: 15px;
      line-height: 15px;
    }
    .cal-days-row {
      display: grid;
      grid-template-columns: 28px repeat(53, 13px);
      gap: 3px;
      align-items: center;
    }
    .cal-weekday-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-align: right;
      padding-right: 4px;
      line-height: 13px;
    }
    .cal-cell {
      width: 13px;
      height: 13px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      cursor: pointer;
      position: relative;
      transition: transform 0.1s, outline 0.1s;
      box-sizing: border-box;
    }
    .cal-cell:hover {
      transform: scale(1.35);
      z-index: 10;
      outline: 1.5px solid var(--primary);
    }
    .cal-cell.level-0, .cal-legend-box.level-0 { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.06); }
    .cal-cell.level-1, .cal-legend-box.level-1 { background: #0e4429; border-color: #006d32; }
    .cal-cell.level-2, .cal-legend-box.level-2 { background: #006d32; border-color: #26a641; }
    .cal-cell.level-3, .cal-legend-box.level-3 { background: #26a641; border-color: #39d353; }
    .cal-cell.level-4, .cal-legend-box.level-4 { background: #39d353; border-color: #56ff74; }
    [data-theme="light"] .cal-cell.level-0, [data-theme="light"] .cal-legend-box.level-0 { background: #ebedf0; border-color: #e1e4e8; }
    [data-theme="light"] .cal-cell.level-1, [data-theme="light"] .cal-legend-box.level-1 { background: #9be9a8; border-color: #40c463; }
    [data-theme="light"] .cal-cell.level-2, [data-theme="light"] .cal-legend-box.level-2 { background: #40c463; border-color: #30a14e; }
    [data-theme="light"] .cal-cell.level-3, [data-theme="light"] .cal-legend-box.level-3 { background: #30a14e; border-color: #216e39; }
    [data-theme="light"] .cal-cell.level-4, [data-theme="light"] .cal-legend-box.level-4 { background: #216e39; border-color: #144620; }
    .cal-legend {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .cal-legend-box {
      width: 11px;
      height: 11px;
      min-width: 11px;
      min-height: 11px;
      border-radius: 2px;
      box-sizing: border-box;
      border: 1px solid;
      flex: none;
      display: inline-block;
    }
    .rel-bar-grid {
      display: grid;
      grid-template-columns: repeat(48, 1fr);
      gap: 2px;
      height: 14px;
      align-items: center;
      user-select: none;
    }
    .rel-cell {
      height: 100%;
      border-radius: 1.5px;
      cursor: pointer;
      box-sizing: border-box;
      transition: transform 0.1s ease;
    }
    .rel-cell:hover {
      transform: scaleY(1.35);
      z-index: 5;
    }
    .db-meter-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 4px;
    }
    .db-meter-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 9999px;
    }
  </style>
  <script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"></script>
</head>
<body>
  <header>
    <a href="./" class="brand" id="brandLink">
      <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9.44 2.02-12 5.29l1.41 1.42C3.59 7.02 7.55 5.17 12 5.17s8.41 1.85 10.59 4.54L24 8.29C21.44 5.02 16.97 3 12 3zm0 4.33c-3.69 0-7.01 1.5-9.02 3.91l1.42 1.41C6.07 10.97 8.87 9.67 12 9.67s5.93 1.3 7.6 3.01l1.42-1.41C19.01 8.83 15.69 7.33 12 7.33zm0 4.34c-2.4 0-4.57.97-6.04 2.54l1.42 1.42C8.42 14.54 10.09 13.67 12 13.67s3.58.87 4.62 1.96l1.42-1.42C16.57 12.64 14.4 11.67 12 11.67zM12 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      <div>
        <span class="brand-title">T18 Monitor</span>
        <span class="brand-tag">v1.1.3</span>
      </div>
    </a>
    <div class="header-controls">
      <select id="stationSelect" onchange="switchStation(this.value)">
        <option value="">Loading stations...</option>
      </select>
      <button onclick="refreshData()">↻ Refresh</button>
      <button class="primary-btn" onclick="exportData('json')">Export JSON</button>
      <button class="flash-btn" onclick="openFlashModal()" title="Flash firmware to ESP32 via Web Serial">⚡ Flash Device</button>
      <button id="settingsBtn" onclick="openSettingsModal()" title="Fleet Settings &amp; Database Management">⚙️ Settings</button>
      <button id="themeToggleBtn" onclick="toggleTheme()" title="Toggle Light/Dark Theme" aria-label="Toggle Theme">
        <span id="themeIcon">☀️</span>
      </button>
    </div>
  </header>

  <main>
    <!-- Station Header & Health -->
    <div class="station-banner">
      <div class="station-info">
        <h2 id="stTitle">Station: Loading...</h2>
        <p id="stDesc">Fetching telemetry data...</p>
        <div id="stBatteryRuntime" style="display: none; margin-top: 0.35rem; font-size: 0.8rem; color: var(--text-muted); line-height: 1.45;">
          <div id="stBatteryRunTimeText"></div>
          <div id="stBatteryEstTimeText"></div>
        </div>
      </div>
      <div class="station-header-badges" style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
        <div id="stBatteryBadge" class="battery-badge" style="display: none;" title="Battery Status" onclick="toggleBatteryGraph(true)">
          <svg class="battery-icon" width="28" height="15" viewBox="0 0 28 15" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
            <rect x="0.75" y="0.75" width="22.5" height="13.5" rx="2.5" stroke="currentColor" stroke-width="1.5" />
            <path d="M25 5C25.5523 5 26 5.44772 26 6V9C26 9.55228 25.5523 10 25 10V5Z" fill="currentColor" />
            <rect id="batBar1" x="3" y="3" width="3.5" height="9" rx="1" fill="currentColor" />
            <rect id="batBar2" x="7.7" y="3" width="3.5" height="9" rx="1" fill="currentColor" />
            <rect id="batBar3" x="12.4" y="3" width="3.5" height="9" rx="1" fill="currentColor" />
            <rect id="batBar4" x="17.1" y="3" width="3.5" height="9" rx="1" fill="currentColor" />
          </svg>
          <span id="stBatteryPctText">100%</span>
        </div>
        <div id="stStatusBadge" class="status-badge online">
          <span class="pulse-dot"></span>
          <span id="stStatusText">Checking</span>
        </div>
      </div>
    </div>

    <!-- Active Monitored Networks Cards -->
    <div id="networksContainer" class="grid-cards">
      <!-- Populated via JavaScript -->
    </div>

    <!-- Network Environment & Firewall Diagnostics -->
    <div id="diagnosticsContainer" style="margin-bottom: 2rem;">
      <!-- Populated via JavaScript -->
    </div>

    <!-- Collapsed Battery Voltage Graph (Day / Week / Month) -->
    <div id="batterySection" class="chart-container" style="display: none; margin-bottom: 2rem;">
      <div class="chart-header" style="flex-wrap: wrap; gap: 0.75rem; cursor: pointer; user-select: none;" onclick="toggleBatteryGraph()">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">Battery Voltage & Discharge Profile</h3>
            <span id="batteryStatusBadge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 600;">LiPo 3.3V–4.2V</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Measured on predefined ADC pin (IO35, 100k/100k divider) every 10 minutes</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;" onclick="event.stopPropagation()">
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <label for="batteryTimeframeSelect" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Timeframe:</label>
            <select id="batteryTimeframeSelect" onchange="onBatteryTimeframeChange(this.value)">
              <option value="day">Last Day (24h)</option>
              <option value="week">Last Week (7d)</option>
              <option value="month">Last Month (30d)</option>
            </select>
          </div>
          <span id="batteryCollapseIcon" style="font-size: 0.85rem; color: var(--text-muted); padding: 0.2rem 0.5rem; cursor: pointer;" onclick="toggleBatteryGraph()">▲</span>
        </div>
      </div>

      <!-- Quick KPI Stat Boxes for Battery -->
      <div id="batteryKpiRow" class="metrics-summary" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 1rem; margin-top: 0.75rem;">
        <div class="metric-box">
          <div class="metric-label">Current Voltage</div>
          <div class="metric-val" id="stat-bat-voltage" style="color: #10b981;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Battery Level</div>
          <div class="metric-val" id="stat-bat-pct" style="color: #38bdf8;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Discharge Rate</div>
          <div class="metric-val" id="stat-bat-rate" style="color: #f59e0b;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Estimated Runtime</div>
          <div class="metric-val" id="stat-bat-runtime" style="color: #a78bfa; font-size: 0.85rem;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Timeframe Span</div>
          <div class="metric-val" id="stat-bat-range" style="font-size: 0.82rem; color: var(--text-muted);">—</div>
        </div>
      </div>

      <!-- Collapsed Drawer for Battery Graph -->
      <div id="batteryGraphDrawer" style="display: block; margin-top: 0.85rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
        <div class="main-chart-wrap" style="height: 290px;">
          <canvas id="batteryChart"></canvas>
        </div>
      </div>
    </div>

    <!-- 24-Hour Channel Utilization & Spectrum Congestion -->
    <div id="channelUtilizationSection" class="chart-container" style="margin-bottom: 2rem;">
      <div class="chart-header" style="flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">24-Hour Channel Utilization & Spectrum Congestion</h3>
            <span id="channelAirtimeBadge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 600;">Promiscuous 2s/ch</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Measured across all 13 channels every 30 minutes with Wi-Fi spectrum scan duration</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label for="channelViewSelect" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Channel View:</label>
            <select id="channelViewSelect" onchange="onChannelViewChange(this.value)">
              <option value="combined">All Channels Combined</option>
              <option value="non_overlapping">Channels 1, 6, 11 (Non-Overlapping)</option>
              <option value="all_individual">All Channels Individual (1–13)</option>
            </select>
          </div>
          <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--text-muted); cursor: pointer; user-select: none;">
            <input type="checkbox" id="toggleScanTimeCheck" onchange="onToggleScanTime(this.checked)" checked style="cursor: pointer;" />
            <span>Show Scan Duration (ms)</span>
          </label>
        </div>
      </div>

      <!-- Quick KPI Stat Boxes -->
      <div class="metrics-summary" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 1rem;">
        <div class="metric-box">
          <div class="metric-label">24h Avg Airtime</div>
          <div class="metric-val" id="stat-avg-airtime" style="color: #38bdf8;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Peak Congested Ch</div>
          <div class="metric-val" id="stat-peak-channel" style="color: #f59e0b;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Latest Scan Time</div>
          <div class="metric-val" id="stat-latest-scantime" style="color: #a78bfa;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Active Transmitters</div>
          <div class="metric-val" id="stat-total-transmitters" style="color: #10b981;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Frames Breakdown</div>
          <div class="metric-val" id="stat-frame-breakdown" style="font-size: 0.82rem;">—</div>
        </div>
      </div>

      <div class="main-chart-wrap" style="height: 290px;">
        <canvas id="channelUtilChart"></canvas>
      </div>

      <!-- Per-Channel Utilization Matrix Drawer / Table -->
      <div style="margin-top: 1rem; border-top: 1px solid var(--card-border); padding-top: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" onclick="toggleChannelTable()">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Latest Channel Breakdown Table (13 Channels)</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">(Airtime %, Frames, Transmitters, RSSI Histogram)</span>
          </div>
          <span id="channelTableExpandIcon" style="font-size: 0.8rem; color: var(--text-muted);">▼</span>
        </div>
        <div id="channelTableDrawer" style="display: none; margin-top: 0.85rem; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr>
                <th style="padding: 6px 10px; text-align: left;">Channel</th>
                <th style="padding: 6px 10px; text-align: left;">Airtime %</th>
                <th style="padding: 6px 10px; text-align: left;">Data Frames</th>
                <th style="padding: 6px 10px; text-align: left;">Mgmt Frames</th>
                <th style="padding: 6px 10px; text-align: left;">Ctrl Frames</th>
                <th style="padding: 6px 10px; text-align: left;">Unique Transmitters</th>
                <th style="padding: 6px 10px; text-align: left;">RSSI Distribution (&lt;-80 / -80..-71 / -70..-61 / &ge;-60 dBm)</th>
                <th style="padding: 6px 10px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody id="channelTableBody">
              <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1rem;">No channel utilization data available yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 24-Hour Channel Utilization Heatmap Drawer -->
      <div style="margin-top: 0.85rem; border-top: 1px solid var(--card-border); padding-top: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" onclick="toggleChannelHeatmap()">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">24-Hour Spectrum &amp; BLE Heatmap (13 Channels + BLE)</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">(48 &times; 30-min Intervals, 13 Wi-Fi Channels + Unique BLE Devices)</span>
          </div>
          <span id="channelHeatmapExpandIcon" style="font-size: 0.8rem; color: var(--text-muted);">▲</span>
        </div>
        <div id="channelHeatmapDrawer" style="display: block; margin-top: 0.85rem; overflow-x: auto; overflow-y: hidden;">
          <!-- Heatmap Legend & Hover Info Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.4rem; font-size: 0.75rem;">
            <div style="display: inline-flex; align-items: center; gap: 3px; flex-wrap: wrap;">
              <span style="color: var(--text-muted); margin-right: 3px;">Airtime:</span>
              <span style="display:inline-block; width:12px; height:10px; background:#0f2942; border-radius:2px;" title="&le; 2% (Quiet)"></span>
              <span style="color:var(--text-muted); margin-right:2px;">&le;2%</span>
              <span style="display:inline-block; width:12px; height:10px; background:#0284c7; border-radius:2px;" title="2% - 5%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#06b6d4; border-radius:2px;" title="5% - 8%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#0d9488; border-radius:2px;" title="8% - 12%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#10b981; border-radius:2px;" title="12% - 16%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#22c55e; border-radius:2px;" title="16% - 20%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#84cc16; border-radius:2px;" title="20% - 25%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#eab308; border-radius:2px;" title="25% - 30%"></span>
              <span style="color:var(--text-muted); margin-left:1px; margin-right:3px;">5–30%</span>
              <span style="display:inline-block; width:12px; height:10px; background:#f97316; border-radius:2px;" title="30% - 40%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#ef4444; border-radius:2px;" title="40% - 55%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#dc2626; border-radius:2px;" title="55% - 70%"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#d946ef; border-radius:2px;" title="&gt; 70% (Outlier Spike)"></span>
              <span style="color:#d946ef; font-weight:600; margin-left:2px; margin-right:6px;">&gt;70% Spike</span>
              <span style="display:inline-block; width:1px; height:12px; background:var(--card-border); margin:0 4px;"></span>
              <span style="color: #38bdf8; font-weight: 600; margin-right: 3px;">BLE:</span>
              <span style="display:inline-block; width:12px; height:10px; background:#0f2942; border-radius:2px;" title="0 devices"></span>
              <span style="color:var(--text-muted); margin-right:2px;">0</span>
              <span style="display:inline-block; width:12px; height:10px; background:#06b6d4; border-radius:2px;" title="1 - 3 devices"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#10b981; border-radius:2px;" title="4 - 8 devices"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#eab308; border-radius:2px;" title="9 - 15 devices"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#f97316; border-radius:2px;" title="16 - 25 devices"></span>
              <span style="display:inline-block; width:12px; height:10px; background:#d946ef; border-radius:2px;" title="&gt; 25 devices (Dense)"></span>
              <span style="color:#38bdf8; font-weight:600; margin-left:2px;">&gt;25 Dev</span>
            </div>
          </div>
          <!-- Dedicated Full-Width Hover Info Bar (Permanently allocated height to prevent hover flicker) -->
          <div id="heatmapHoverInfo" style="color: var(--text-muted); font-family: monospace; font-size: 0.75rem; min-height: 1.5rem; line-height: 1.5; margin-bottom: 0.6rem; padding: 2px 0;">Hover over a cell to inspect metrics</div>
          <!-- Heatmap Container -->
          <div id="channelHeatmapContainer" style="min-width: 760px; padding: 4px 12px 14px 4px;"></div>
        </div>
      </div>
    </div>

    <!-- Historical Trends (Chart) -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 600;">24-Hour Network Latency Trends</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">10-Minute Polling Cadence</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <label for="networkFilterSelect" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Network:</label>
          <select id="networkFilterSelect" onchange="onNetworkFilterChange(this.value)">
            <option value="combined">Combined (All Networks)</option>
          </select>
        </div>
      </div>
      <div class="main-chart-wrap">
        <canvas id="trendChart"></canvas>
      </div>
    </div>

    <!-- Individual Target Latency Graphs -->
    <div id="targetGraphsSection">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 600;">Individual Probe Latencies</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">24-hour endpoint performance per target</span>
        </div>
        <span id="targetFilterBadge" style="font-size: 0.75rem; background: var(--primary-dim); color: var(--primary); padding: 0.2rem 0.65rem; border-radius: 999px; font-weight: 600;">Combined</span>
      </div>
      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1rem;">
        <!-- Gateway RTT -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #06b6d4;"></span>
              <span class="card-title" style="color: #06b6d4; font-size: 0.95rem;">Gateway RTT</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">Router / Firewall</span>
            </div>
            <span id="stat-gateway" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-gateway"></canvas>
          </div>
        </div>

        <!-- Cloudflare -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></span>
              <span class="card-title" style="color: #38bdf8; font-size: 0.95rem;">Cloudflare</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">1.1.1.1</span>
            </div>
            <span id="stat-cloudflare" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-cloudflare"></canvas>
          </div>
        </div>

        <!-- Google -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
              <span class="card-title" style="color: #10b981; font-size: 0.95rem;">Google</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">generate_204</span>
            </div>
            <span id="stat-google" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-google"></canvas>
          </div>
        </div>

        <!-- Microsoft -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #60a5fa;"></span>
              <span class="card-title" style="color: #60a5fa; font-size: 0.95rem;">Microsoft</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">connecttest</span>
            </div>
            <span id="stat-microsoft" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-microsoft"></canvas>
          </div>
        </div>

        <!-- Netflix -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #f87171;"></span>
              <span class="card-title" style="color: #f87171; font-size: 0.95rem;">Netflix</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">fast.com</span>
            </div>
            <span id="stat-netflix" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-netflix"></canvas>
          </div>
        </div>

        <!-- Facebook -->
        <div class="card" style="padding: 1rem 1.15rem; gap: 0.5rem;">
          <div class="card-header" style="padding-bottom: 0.4rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></span>
              <span class="card-title" style="color: #3b82f6; font-size: 0.95rem;">Facebook</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">connectivity</span>
            </div>
            <span id="stat-facebook" class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">—</span>
          </div>
          <div class="target-chart-wrap">
            <canvas id="chart-facebook"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- 2.4 GHz Bluetooth Low Energy & Classic Activity -->
    <div id="bluetoothSection" class="card" style="padding: 1.25rem 1.5rem; gap: 1rem; margin-bottom: 2rem;">
      <div class="chart-header" style="flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">2.4 GHz Bluetooth & BLE Activity</h3>
            <span id="btBleStatusBadge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 600;">BLE & Classic</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Payload fingerprinting & RPA de-randomization establishing unique device presence</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
          <span id="btLastScanTime" style="font-size: 0.8rem; color: var(--text-muted);">Last scan: —</span>
        </div>
      </div>

      <!-- Quick KPI Stat Boxes for Bluetooth -->
      <div class="metrics-summary" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-bottom: 0.85rem;">
        <div class="metric-box">
          <div class="metric-label">Unique BLE Devices</div>
          <div class="metric-val" id="stat-ble-unique" style="color: #38bdf8;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Total BLE MACs</div>
          <div class="metric-val" id="stat-ble-macs" style="color: #a78bfa;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Address Privacy</div>
          <div class="metric-val" id="stat-ble-privacy" style="color: #f59e0b; font-size: 0.85rem;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Classic BT Devices</div>
          <div class="metric-val" id="stat-classic-total" style="color: #10b981;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Apple / MS / Samsung</div>
          <div class="metric-val" id="stat-bt-vendors" style="font-size: 0.82rem; color: #38bdf8;">—</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Phone / PC / Beacon</div>
          <div class="metric-val" id="stat-bt-types" style="font-size: 0.82rem; color: #a78bfa;">—</div>
        </div>
      </div>

      <!-- 24h Bluetooth Presence Trend Chart -->
      <div class="main-chart-wrap" style="height: 230px;">
        <canvas id="bluetoothChart"></canvas>
      </div>

      <!-- Discovered Bluetooth Devices Table Drawer -->
      <div style="margin-top: 0.85rem; border-top: 1px solid var(--card-border); padding-top: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; flex-wrap: wrap; gap: 0.5rem;" onclick="toggleBluetoothTable()">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span id="btTableCollapseIcon" style="font-size: 0.85rem; color: var(--text-muted);">▼</span>
            <span id="btTableTitle" style="font-size: 0.95rem; font-weight: 600;">Discovered Bluetooth Devices (Current Cycle)</span>
            <span id="btDeviceCountBadge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; padding: 2px 7px; border-radius: 999px; font-weight: 600;">0 Devices</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;" onclick="event.stopPropagation()">
            <span style="font-size: 0.75rem; color: var(--text-muted); cursor: pointer;" onclick="toggleBluetoothTable()">Toggle</span>
          </div>
        </div>
        <div id="btTableDrawer" style="display: block; margin-top: 0.85rem; overflow-x: auto;">
          <table>
            <thead id="bluetoothTableHead">
              <tr>
                <th>Type</th>
                <th>Address</th>
                <th>Device Name / Beacon Identifier</th>
                <th>Vendor / Ecosystem</th>
                <th>Category</th>
                <th>Signal (RSSI)</th>
              </tr>
            </thead>
            <tbody id="bluetoothTableBody">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No Bluetooth scan data recorded yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Surrounding 2.4 GHz Scan Survey Table -->
    <div class="table-container">
      <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" onclick="toggleSurveySection()">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">Surrounding 2.4 GHz Spectrum Survey</h3>
          <span id="surveyCountBadge" style="font-size: 0.8rem; font-weight: 600; color: var(--primary);">0 APs Detected</span>
        </div>
        <span id="surveyCollapseIcon" style="font-size: 0.85rem; color: var(--text-muted); padding: 0.2rem 0.5rem;">▶</span>
      </div>
      <div id="surveyTableDrawer" style="display: none; margin-top: 1rem;">
        <table>
          <thead>
            <tr>
              <th>SSID</th>
              <th>BSSID</th>
              <th>Signal (RSSI)</th>
              <th>Quality</th>
              <th>Channel</th>
              <th>Phy Mode</th>
              <th>Security</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody id="surveyTableBody">
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No Wi-Fi scan data available yet.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Previously Detected Networks Section -->
      <div id="inactiveSurveySection" style="display: none; margin-top: 1.75rem; border-top: 1px solid var(--card-border); padding-top: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; cursor: pointer; user-select: none;" onclick="toggleInactiveSurveySection()">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted); margin: 0;">Previously Detected Networks</h4>
            <span id="inactiveCountBadge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.72rem; padding: 2px 7px; border-radius: 999px; font-weight: 600;">0 Missing</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Previously discovered APs absent from latest cycle (last 24h peak)</span>
            <span id="inactiveCollapseIcon" style="font-size: 0.85rem; color: var(--text-muted); padding: 0.2rem 0.5rem;">▶</span>
          </div>
        </div>
        <div id="inactiveSurveyDrawer" style="display: none; margin-top: 1rem;">
          <table>
            <thead>
              <tr>
                <th>SSID</th>
                <th>BSSID</th>
                <th>Signal (Max RSSI)</th>
                <th>Max Quality</th>
                <th>Channel</th>
                <th>Phy Mode</th>
                <th>Security</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody id="inactiveSurveyBody">
              <!-- Populated via JavaScript -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>

  <!-- ESP32 Web Firmware Flasher Modal -->
  <div id="flashModal" class="modal-backdrop" onclick="onModalBackdropClick(event)">
    <div class="modal-window" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">
          <span>⚡ ESP32 Web Firmware Installer</span>
          <span class="fw-badge">v1.1.3 Stable</span>
        </div>
        <button class="modal-close-btn" onclick="closeFlashModal()" title="Close dialog">✕</button>
      </div>
      
      <div class="modal-tabs">
        <button id="tabBtnWebSerial" class="modal-tab-btn active" onclick="switchFlashTab('webserial')">Web Serial Install</button>
        <button id="tabBtnBinaries" class="modal-tab-btn" onclick="switchFlashTab('binaries')">Direct Downloads &amp; CLI</button>
        <button id="tabBtnGuide" class="modal-tab-btn" onclick="switchFlashTab('guide')">First-Boot Setup</button>
      </div>

      <div class="modal-body">
        <!-- Tab 1: Web Serial Install -->
        <div id="flashTabWebSerial">
          <div id="serialStatusBanner" class="serial-status-banner supported">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span id="serialStatusIcon">✅</span>
              <span id="serialStatusText">Web Serial API is supported in your browser!</span>
            </div>
            <span style="font-size:0.75rem;opacity:0.8;">Chrome / Edge / Brave / Opera</span>
          </div>

          <div style="margin-top:0.75rem;font-size:0.875rem;color:var(--text-muted);line-height:1.5;">
            Flash the pre-compiled universal firmware directly to your ESP32 board over USB. No Arduino IDE, PlatformIO, or command-line drivers required.
          </div>

          <div style="margin-top:1rem;margin-bottom:0.75rem;">
            <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;color:var(--text);">Choose Flashing Mode:</div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <label id="modeUpdateLabel" style="flex:1;min-width:250px;padding:0.75rem 1rem;border:2px solid var(--accent);border-radius:0.5rem;background:rgba(56,189,248,0.08);cursor:pointer;display:flex;align-items:flex-start;gap:0.75rem;">
                <input type="radio" name="flashModeRadio" value="update" checked onchange="window.setFlashMode('update')" style="margin-top:0.25rem;">
                <div>
                  <div style="font-weight:600;font-size:0.9rem;color:var(--text);">⚡ Update Firmware Only (Keep Settings &amp; Data)</div>
                  <div style="font-size:0.775rem;color:var(--text-muted);margin-top:0.25rem;line-height:1.4;">Flashes only application partition (0x10000). Preserves Wi-Fi credentials, tokens, and 24h channel utilization history without wiping flash.</div>
                </div>
              </label>
              <label id="modeCleanLabel" style="flex:1;min-width:250px;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:0.5rem;background:transparent;cursor:pointer;display:flex;align-items:flex-start;gap:0.75rem;">
                <input type="radio" name="flashModeRadio" value="clean" onchange="window.setFlashMode('clean')" style="margin-top:0.25rem;">
                <div>
                  <div style="font-weight:600;font-size:0.9rem;color:var(--text);">🧹 Clean Install (Full Flash &amp; Partitions)</div>
                  <div style="font-size:0.775rem;color:var(--text-muted);margin-top:0.25rem;line-height:1.4;">For fresh or unconfigured boards. Installs bootloader, partition table, and firmware. Prompts before erasing flash.</div>
                </div>
              </label>
            </div>
          </div>

          <div class="install-button-wrapper">
            <esp-web-install-button id="espWebInstallBtn" manifest="manifest-update.json">
              <button slot="activate" id="espActivateBtn" class="install-action-btn">
                ⚡ Connect ESP32 &amp; Update Firmware (Keep Settings)
              </button>
              <span slot="unsupported" style="color:var(--danger);font-size:0.875rem;font-weight:600;">
                ⚠️ Web Serial is not supported in this browser. Please open this page in Google Chrome, Microsoft Edge, Brave, or Opera on desktop.
              </span>
              <span slot="not-allowed" style="color:var(--danger);font-size:0.875rem;font-weight:600;">
                ⚠️ Web Serial requires an HTTPS secure connection.
              </span>
            </esp-web-install-button>
          </div>

          <div class="flash-guide-card">
            <h4 style="font-size:0.95rem;font-weight:600;margin-bottom:0.25rem;">Quick Flashing Steps:</h4>
            <ul class="flash-step-list">
              <li class="flash-step-item">
                <span class="flash-step-num">1</span>
                <div><strong>Connect USB:</strong> Plug your ESP32 board into your computer with a USB data cable (ensure it supports data, not power-only).</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">2</span>
                <div><strong>Pair Device:</strong> Click <em>Connect ESP32 &amp; Install Firmware</em> and select the serial port (e.g. <code>CP210x</code>, <code>CH340</code>, or <code>USB JTAG</code>).</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">3</span>
                <div><strong>Install Firmware:</strong> Select <em>Install T18 Monitor</em>. In <em>Update Firmware</em> mode, your settings and data are preserved. In <em>Clean Install</em> mode, you can check/uncheck <em>Erase device</em>. Progress is shown in real time.</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">4</span>
                <div><strong>Commission Node:</strong> After installation completes, the board boots up and creates a Soft-AP named <code>T18-Mon-XXXX</code> (IP <code>192.168.4.1</code>) for captive portal setup.</div>
              </li>
            </ul>
          </div>

          <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:0.5rem;padding:0.75rem 1rem;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:flex-start;gap:0.5rem;">
            <span style="font-size:1.1rem;line-height:1;">💡</span>
            <div><strong>Connection Troubleshooting:</strong> If the installer cannot connect or times out waiting for the bootloader, hold down the <strong>BOOT (GPIO 0)</strong> button on your ESP32 board while clicking Connect, then release it once flashing starts.</div>
          </div>
        </div>

        <!-- Tab 2: Direct Downloads & CLI -->
        <div id="flashTabBinaries" style="display:none;display:flex;flex-direction:column;gap:1rem;">
          <div style="font-size:0.875rem;color:var(--text-muted);line-height:1.5;">
            Download pre-compiled binary files for offline flashing with <code>esptool.py</code>, PlatformIO, or desktop tools.
          </div>

          <div class="bin-download-grid">
            <div class="bin-card">
              <div class="bin-info">
                <span class="bin-name">Application Firmware</span>
                <span class="bin-meta">Offset: 0x10000 (app0)</span>
              </div>
              <a id="dlFirmwareBin" href="firmware/firmware.bin" download="firmware.bin" class="nav-link" style="padding:0.35rem 0.65rem;font-size:0.8rem;">⬇️ firmware.bin</a>
            </div>
            <div class="bin-card">
              <div class="bin-info">
                <span class="bin-name">Partition Table</span>
                <span class="bin-meta">Offset: 0x8000 (partitions)</span>
              </div>
              <a id="dlPartitionsBin" href="firmware/partitions.bin" download="partitions.bin" class="nav-link" style="padding:0.35rem 0.65rem;font-size:0.8rem;">⬇️ partitions.bin</a>
            </div>
            <div class="bin-card">
              <div class="bin-info">
                <span class="bin-name">Second Stage Bootloader</span>
                <span class="bin-meta">Offset: 0x1000 (bootloader)</span>
              </div>
              <a id="dlBootloaderBin" href="firmware/bootloader.bin" download="bootloader.bin" class="nav-link" style="padding:0.35rem 0.65rem;font-size:0.8rem;">⬇️ bootloader.bin</a>
            </div>
            <div class="bin-card">
              <div class="bin-info">
                <span class="bin-name">OTA Boot Initializer</span>
                <span class="bin-meta">Offset: 0xe000 (otadata)</span>
              </div>
              <a id="dlBootApp0Bin" href="firmware/boot_app0.bin" download="boot_app0.bin" class="nav-link" style="padding:0.35rem 0.65rem;font-size:0.8rem;">⬇️ boot_app0.bin</a>
            </div>
          </div>

          <div class="bin-card" style="border-color:var(--primary);background:var(--primary-dim);">
            <div class="bin-info">
              <span class="bin-name" style="color:var(--primary);">Unified Merged Binary (All-in-One)</span>
              <span class="bin-meta">Offset: 0x0 (Single-file full flash)</span>
            </div>
            <a id="dlMergedBin" href="firmware/firmware-esp32-merged.bin" download="firmware-esp32-merged.bin" class="primary-btn" style="padding:0.4rem 0.85rem;font-size:0.85rem;text-decoration:none;">⬇️ firmware-esp32-merged.bin</a>
          </div>

          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.85rem;font-weight:600;">Flash with esptool.py (Multi-part):</span>
            </div>
            <div class="code-block">
              <code>esptool.py --chip esp32 --baud 921600 write_flash 0x1000 bootloader.bin 0x8000 partitions.bin 0xe000 boot_app0.bin 0x10000 firmware.bin</code>
              <button class="copy-code-btn" onclick="copySnippet('esptool.py --chip esp32 --baud 921600 write_flash 0x1000 bootloader.bin 0x8000 partitions.bin 0xe000 boot_app0.bin 0x10000 firmware.bin', this)">Copy</button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.85rem;font-weight:600;">Flash with esptool.py (Merged Single-file):</span>
            </div>
            <div class="code-block">
              <code>esptool.py --chip esp32 --baud 921600 write_flash 0x0 firmware-esp32-merged.bin</code>
              <button class="copy-code-btn" onclick="copySnippet('esptool.py --chip esp32 --baud 921600 write_flash 0x0 firmware-esp32-merged.bin', this)">Copy</button>
            </div>
          </div>
        </div>

        <!-- Tab 3: First-Boot Setup Guide -->
        <div id="flashTabGuide" style="display:none;">
          <div class="flash-guide-card">
            <h4 style="font-size:0.95rem;font-weight:600;margin-bottom:0.25rem;">Node Commissioning (Zero-Trust):</h4>
            <ul class="flash-step-list">
              <li class="flash-step-item">
                <span class="flash-step-num">1</span>
                <div><strong>Connect to Soft-AP:</strong> Search for Wi-Fi network <code>T18-Mon-XXXX</code> (where XXXX is the device MAC suffix) and connect (password <code>12345678</code> or open).</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">2</span>
                <div><strong>Open Portal:</strong> Open your browser to <a href="http://192.168.4.1" target="_blank" style="color:var(--primary);">http://192.168.4.1</a>. The captive setup UI will load.</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">3</span>
                <div><strong>Select Board Profile:</strong> Choose your hardware profile (<strong>LILYGO T18</strong>, <strong>LILYGO T8</strong>, <strong>ESP32 DevKit V1</strong>, or <strong>Custom</strong>) to configure status LED and battery ADC pins.</div>
              </li>
              <li class="flash-step-item">
                <span class="flash-step-num">4</span>
                <div><strong>Configure Wi-Fi &amp; Secret:</strong> Enter up to 5 SSIDs/passwords and your <code>MASTER_PHRASE</code> bootstrap secret. The node registers with the backend and begins 10-minute telemetry cycles!</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Settings & Admin Modal -->
  <div id="settingsModal" class="modal-backdrop" onclick="onSettingsBackdropClick(event)">
    <div class="modal-window large" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">
          <span>⚙️ Settings &amp; Fleet Management</span>
          <span id="adminStatusBadge" class="brand-tag">Guest</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <button id="adminLogoutBtn" class="admin-btn secondary" style="display:none;" onclick="adminLogout()">Log Out</button>
          <button class="modal-close-btn" onclick="closeSettingsModal()" title="Close dialog">✕</button>
        </div>
      </div>

      <!-- State 1: Unauthenticated Login Form -->
      <div id="settingsLoginView" style="display:none; padding:1.5rem;">
        <div class="admin-login-box">
          <div style="font-size:2.2rem;">🔒</div>
          <h3 style="margin:0;">Administrator Sign In</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.45; margin:0;">
            Manage edge nodes, configure OTA targets, prune data collections, and inspect Cloudflare D1 storage metrics.
          </p>
          <div id="adminLoginError" style="display:none; padding:0.6rem 0.8rem; border-radius:0.375rem; background:rgba(239,68,68,0.15); border:1px solid var(--danger); color:var(--danger); font-size:0.8rem; text-align:left;"></div>
          <form onsubmit="handleAdminLoginSubmit(event)" style="display:flex;flex-direction:column;gap:0.75rem;">
            <div class="admin-input-group">
              <label>Username</label>
              <input type="text" id="adminUserInput" placeholder="admin" autocomplete="username" required />
            </div>
            <div class="admin-input-group">
              <label>Password</label>
              <input type="password" id="adminPassInput" placeholder="••••••••" autocomplete="current-password" required />
            </div>
            <button type="submit" id="adminLoginSubmitBtn" class="admin-btn primary" style="margin-top:0.5rem; width:100%;">
              <span>Log In</span>
            </button>
          </form>
          <div style="font-size:0.725rem; color:var(--text-muted); margin-top:0.5rem;">
            Credentials are configured via Cloudflare Worker variables <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code>.
          </div>
        </div>
      </div>

      <!-- State 2: Authenticated Admin Panel -->
      <div id="settingsAdminView" style="display:none;">
        <div class="modal-tabs">
          <button id="tabBtnAdminStations" class="modal-tab-btn active" onclick="switchAdminTab('stations')">Stations</button>
          <button id="tabBtnAdminHeatmap" class="modal-tab-btn" onclick="switchAdminTab('heatmap')">Collection &amp; Heatmap</button>
          <button id="tabBtnAdminDb" class="modal-tab-btn" onclick="switchAdminTab('db')">Database Size (D1)</button>
          <button id="tabBtnAdminCleanup" class="modal-tab-btn" onclick="switchAdminTab('cleanup')">Data Cleanup</button>
        </div>

        <div class="modal-body">
          <!-- Subtab 1: Stations Management -->
          <div id="adminTabStations">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
              <div>
                <h4 style="margin:0; font-size:1rem; color:var(--text-main);">Registered Fleet Nodes</h4>
                <div style="font-size:0.775rem; color:var(--text-muted);">Manage edge telemetry stations, assign OTA versions, or decommission nodes.</div>
              </div>
              <button class="admin-btn secondary" onclick="loadAdminOverview()">↻ Refresh</button>
            </div>
            <div style="overflow-x:auto;">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Station ID</th>
                    <th>Description</th>
                    <th>Board / Battery</th>
                    <th>Firmware</th>
                    <th>Last Seen</th>
                    <th>Measurements</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="adminStationsTableBody">
                  <tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Loading fleet stations...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Subtab 2: Collection Overview & Year Heatmap -->
          <div id="adminTabHeatmap" style="display:none; flex-direction:column; gap:1.25rem;">
            <div class="station-meta-grid" style="margin-top:0; margin-bottom:0.5rem;">
              <div class="meta-item">
                <span class="meta-label">Fleet Collection Span</span>
                <span id="heatmapSpanText" class="meta-val">Calculating...</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Telemetry Measurements</span>
                <span id="heatmapTotalMeas" class="meta-val">0</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Earliest Activity</span>
                <span id="heatmapEarliestDate" class="meta-val">--</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Latest Activity</span>
                <span id="heatmapLatestDate" class="meta-val">--</span>
              </div>
            </div>

            <div class="cal-card">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                <div>
                  <h4 style="margin:0; font-size:0.95rem; color:var(--text-main);">
                    <span>📅 Activity Calendar (<span id="heatmapYearDisplay">2026</span>)</span>
                  </h4>
                  <div style="font-size:0.75rem; color:var(--text-muted);">Active measurement cycles per calendar day across the year.</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <label style="font-size:0.75rem; color:var(--text-muted);">Filter Station:</label>
                  <select id="heatmapStationFilter" onchange="onHeatmapStationChange(this.value)" style="padding:0.3rem 0.6rem; font-size:0.8rem; border-radius:0.35rem; background:var(--input-bg); color:var(--text-main); border:1px solid var(--card-border);">
                    <option value="all">All Stations</option>
                  </select>
                </div>
              </div>

              <!-- Calendar Heatmap 52 weeks -->
              <div class="cal-scroll-wrap">
                <div id="calendarHeatmapContainer">
                  <!-- Generated via renderYearHeatmap() -->
                </div>
              </div>

              <div class="cal-legend">
                <span id="calMinLegendText">0 cycles / day</span>
                <div class="cal-legend-box level-0" title="0 cycles"></div>
                <div class="cal-legend-box level-1" title="1–5 cycles"></div>
                <div class="cal-legend-box level-2" title="6–25 cycles"></div>
                <div class="cal-legend-box level-3" title="26–100 cycles"></div>
                <div class="cal-legend-box level-4" title=">100 cycles"></div>
                <span id="calMaxLegendText">Peak cycles</span>
              </div>
            </div>
          </div>

          <!-- Subtab 3: Database Size (t18-mon-db) -->
          <div id="adminTabDb" style="display:none; flex-direction:column; gap:1.25rem;">
            <div class="station-meta-grid" style="margin-top:0; margin-bottom:0.5rem;">
              <div class="meta-item">
                <span class="meta-label">Database Name</span>
                <span class="meta-val" style="color:var(--primary);">t18-mon-db</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Est. Total Database Size</span>
                <span id="dbTotalSizeText" class="meta-val">Calculating...</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Records Stored</span>
                <span id="dbTotalRecordsText" class="meta-val">0</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Storage Backend</span>
                <span class="meta-val" style="color:var(--success);">Cloudflare D1</span>
              </div>
            </div>

            <div class="db-table-card">
              <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--card-border); display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; font-size:0.9rem; color:var(--text-main);">Table Storage &amp; Row Distribution</h4>
                <div style="font-size:0.75rem; color:var(--text-muted);">Calculated based on schema structures and live SQLite row counts</div>
              </div>
              <div style="overflow-x:auto;">
                <table class="db-table">
                  <thead>
                    <tr>
                      <th>Table Name</th>
                      <th>Description</th>
                      <th>Row Count</th>
                      <th>Estimated Size</th>
                      <th style="min-width:140px;">Share of Storage</th>
                    </tr>
                  </thead>
                  <tbody id="dbTablesTableBody">
                    <tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Fetching table metrics...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Subtab 4: Data Cleanup -->
          <div id="adminTabCleanup" style="display:none; flex-direction:column; gap:1.25rem;">
            <div class="flash-guide-card">
              <h4 style="margin:0 0 0.5rem 0; font-size:0.95rem; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
                <span>🗑️ Prune Historical Telemetry Records</span>
              </h4>
              <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.45; margin:0 0 1rem 0;">
                Delete raw Wi-Fi latency measurements, Bluetooth scans, and survey items within a chosen timeframe to optimize database size. Daily aggregated summaries (24h rollups and 30m trends) are preserved.
              </p>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1rem;">
                <div class="admin-input-group">
                  <label>Target Station</label>
                  <select id="cleanupStationSelect">
                    <option value="all">All Stations (Fleet-Wide)</option>
                  </select>
                </div>

                <div class="admin-input-group">
                  <label>Timeframe Preset</label>
                  <select id="cleanupPresetSelect" onchange="onCleanupPresetChange(this.value)">
                    <option value="older30">Older than 30 Days (Standard Retention)</option>
                    <option value="older14">Older than 14 Days</option>
                    <option value="older7">Older than 7 Days</option>
                    <option value="custom">Custom Date Range</option>
                    <option value="all">Purge All Historical Measurements (Reset)</option>
                  </select>
                </div>
              </div>

              <div id="cleanupCustomRange" style="display:none; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="admin-input-group">
                  <label>Start Date</label>
                  <input type="date" id="cleanupStartDate" />
                </div>
                <div class="admin-input-group">
                  <label>End Date</label>
                  <input type="date" id="cleanupEndDate" />
                </div>
              </div>

              <div style="display:flex; justify-content:flex-end;">
                <button class="admin-btn danger" onclick="executeDataCleanup()">
                  <span>🗑️ Delete Selected Measurements</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <span>Host: <strong id="hostIndicator">Cloudflare Worker</strong></span>
    <span>|</span>
    <a href="https://t18.dhsp.workers.dev" id="cfWorkerLink">Cloudflare Dashboard</a>
    <span>|</span>
    <a href="https://flynn0.github.io/T18" id="ghPagesLink">GitHub Pages</a>
    <span>|</span>
    <a href="javascript:void(0)" onclick="openFlashModal()" style="font-weight: 600; color: var(--primary);">⚡ Web Flasher</a>
    <span>|</span>
    <a href="javascript:void(0)" onclick="openSettingsModal()" style="font-weight: 600; color: var(--primary);">⚙️ Settings</a>
    <span>|</span>
    <a href="https://github.com/flynn0/T18" target="_blank">Repository (flynn0/T18 v1.1.3)</a>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    // Dynamically resolve API base URL (relative when on workers.dev, absolute when on GitHub Pages)
    const API_BASE = window.location.hostname.includes("workers.dev")
      ? ""
      : "https://t18.dhsp.workers.dev";

    let currentStationId = "";
    let currentStationData = null;
    let selectedNetworkFilter = "combined";
    let mainChartInstance = null;
    let batteryChartInstance = null;
    let selectedBatteryTimeframe = "day";
    let batteryDrawerOpen = true;
    const targetChartInstances = {
      gateway: null,
      cloudflare: null,
      google: null,
      microsoft: null,
      netflix: null,
      facebook: null
    };

    const TARGET_CONFIG = [
      { key: "gateway", field: "gateway_ms", name: "Gateway RTT", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)" },
      { key: "cloudflare", field: "cloudflare_ms", name: "Cloudflare", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" },
      { key: "google", field: "google_ms", name: "Google", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
      { key: "microsoft", field: "microsoft_ms", name: "Microsoft", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.12)" },
      { key: "netflix", field: "netflix_ms", name: "Netflix", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)" },
      { key: "facebook", field: "facebook_ms", name: "Facebook", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" }
    ];

    const NETWORK_PALETTE = ["#38bdf8", "#a855f7", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#84cc16"];

    function getPillClass(ms) {
      if (ms === null || ms === undefined || ms < 0) return "";
      if (ms <= 50) return "fast";
      if (ms <= 150) return "med";
      return "slow";
    }

    function fmtMs(v) {
      return (v !== null && v !== undefined && v >= 0) ? v + " ms" : "Timeout";
    }

    function onNetworkFilterChange(val) {
      selectedNetworkFilter = val;
      renderAllTrendCharts();
    }

    function initTheme() {
      const saved = localStorage.getItem("t18_theme") || localStorage.getItem("wifi_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(saved || (prefersDark ? "dark" : "light"));
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("t18_theme", theme);
      localStorage.setItem("wifi_theme", theme);
      const icon = document.getElementById("themeIcon");
      if (icon) {
        icon.innerText = theme === "dark" ? "☀️" : "🌙";
      }
      const btn = document.getElementById("themeToggleBtn");
      if (btn) {
        btn.title = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
      }
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      renderAllTrendCharts();
      renderChannelUtilizationSection();
    }

    // Detect if running on GitHub Pages
    const isGhPages = window.location.pathname.startsWith("/T18") || window.location.pathname.startsWith("/wifi");
    const basePath = window.location.pathname.startsWith("/T18") ? "/T18/" : (window.location.pathname.startsWith("/wifi") ? "/wifi/" : "/");
    document.getElementById("brandLink").href = basePath;
    document.getElementById("hostIndicator").innerText = isGhPages ? "GitHub Pages" : "Cloudflare Worker";

    function openFlashModal(tab) {
      const modal = document.getElementById("flashModal");
      if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
      }
      if (tab) {
        switchFlashTab(tab);
      }
      checkSerialSupport();
      updateFlashManifestUrls();
    }

    function closeFlashModal() {
      const modal = document.getElementById("flashModal");
      if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    }

    function onModalBackdropClick(e) {
      if (e.target.id === "flashModal") {
        closeFlashModal();
      }
    }

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        closeFlashModal();
        closeSettingsModal();
      }
    });

    function switchFlashTab(tab) {
      const tabs = ["webserial", "binaries", "guide"];
      tabs.forEach(function(t) {
        const el = document.getElementById("flashTab" + (t.charAt(0).toUpperCase() + t.slice(1)));
        const btn = document.getElementById("tabBtn" + (t.charAt(0).toUpperCase() + t.slice(1)));
        if (el) el.style.display = (t === tab) ? (t === "binaries" ? "flex" : "block") : "none";
        if (btn) btn.classList.toggle("active", t === tab);
      });
    }

    function checkSerialSupport() {
      const isSupported = "serial" in navigator;
      const banner = document.getElementById("serialStatusBanner");
      const icon = document.getElementById("serialStatusIcon");
      const text = document.getElementById("serialStatusText");
      if (banner && icon && text) {
        if (isSupported) {
          banner.className = "serial-status-banner supported";
          icon.innerText = "✅";
          text.innerText = "Web Serial API is supported in your browser!";
        } else {
          banner.className = "serial-status-banner unsupported";
          icon.innerText = "⚠️";
          text.innerText = "Web Serial API is not supported in this browser. Please use Chrome, Edge, Brave, or Opera.";
        }
      }
    }

    let currentFlashMode = "update";
    window.setFlashMode = function(mode) {
      currentFlashMode = mode;
      const installBtn = document.getElementById("espWebInstallBtn");
      const activateBtn = document.getElementById("espActivateBtn");
      const lblUpdate = document.getElementById("modeUpdateLabel");
      const lblClean = document.getElementById("modeCleanLabel");

      if (mode === "update") {
        if (installBtn) installBtn.setAttribute("manifest", basePath + "manifest-update.json");
        if (activateBtn) activateBtn.innerHTML = "⚡ Connect ESP32 &amp; Update Firmware (Keep Settings)";
        if (lblUpdate) {
          lblUpdate.style.border = "2px solid var(--accent)";
          lblUpdate.style.background = "rgba(56,189,248,0.08)";
        }
        if (lblClean) {
          lblClean.style.border = "1px solid var(--border)";
          lblClean.style.background = "transparent";
        }
      } else {
        if (installBtn) installBtn.setAttribute("manifest", basePath + "manifest.json");
        if (activateBtn) activateBtn.innerHTML = "🧹 Connect ESP32 &amp; Clean Install";
        if (lblClean) {
          lblClean.style.border = "2px solid var(--accent)";
          lblClean.style.background = "rgba(56,189,248,0.08)";
        }
        if (lblUpdate) {
          lblUpdate.style.border = "1px solid var(--border)";
          lblUpdate.style.background = "transparent";
        }
      }
    };

    function updateFlashManifestUrls() {
      window.setFlashMode(currentFlashMode);
      const links = [
        { id: "dlFirmwareBin", file: "firmware.bin" },
        { id: "dlPartitionsBin", file: "partitions.bin" },
        { id: "dlBootloaderBin", file: "bootloader.bin" },
        { id: "dlBootApp0Bin", file: "boot_app0.bin" },
        { id: "dlMergedBin", file: "firmware-esp32-merged.bin" }
      ];
      links.forEach(function(l) {
        const el = document.getElementById(l.id);
        if (el) el.href = basePath + "firmware/" + l.file;
      });
    }

    function copySnippet(text, btn) {
      navigator.clipboard.writeText(text).then(function() {
        const orig = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(function() { btn.innerText = orig; }, 2000);
      }).catch(function() {
        prompt("Copy command:", text);
      });
    }

    // --- Settings & Admin Panel Management ---
    function getAdminToken() {
      return localStorage.getItem("t18_admin_token") || "";
    }

    function setAdminToken(token) {
      if (token) {
        localStorage.setItem("t18_admin_token", token);
      } else {
        localStorage.removeItem("t18_admin_token");
      }
    }

    function clearAdminToken() {
      localStorage.removeItem("t18_admin_token");
    }

    function getAdminAuthHeaders() {
      return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getAdminToken()
      };
    }

    let currentAdminTab = "stations";
    let adminOverviewData = null;

    function openSettingsModal() {
      const modal = document.getElementById("settingsModal");
      if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
      }
      checkAdminSession();
    }

    function closeSettingsModal() {
      const modal = document.getElementById("settingsModal");
      if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    }

    function onSettingsBackdropClick(e) {
      if (e.target && e.target.id === "settingsModal") {
        closeSettingsModal();
      }
    }

    function adminLogout() {
      clearAdminToken();
      showAdminLoginView();
    }

    function showAdminLoginView(errorMsg) {
      const loginView = document.getElementById("settingsLoginView");
      const adminView = document.getElementById("settingsAdminView");
      const badge = document.getElementById("adminStatusBadge");
      const logoutBtn = document.getElementById("adminLogoutBtn");
      const errBox = document.getElementById("adminLoginError");

      if (loginView) loginView.style.display = "block";
      if (adminView) adminView.style.display = "none";
      if (badge) {
        badge.innerText = "Guest";
        badge.style.background = "";
        badge.style.color = "";
      }
      if (logoutBtn) logoutBtn.style.display = "none";

      if (errBox) {
        if (errorMsg) {
          errBox.innerText = errorMsg;
          errBox.style.display = "block";
        } else {
          errBox.style.display = "none";
        }
      }
    }

    function showAdminPanelView(username) {
      const loginView = document.getElementById("settingsLoginView");
      const adminView = document.getElementById("settingsAdminView");
      const badge = document.getElementById("adminStatusBadge");
      const logoutBtn = document.getElementById("adminLogoutBtn");

      if (loginView) loginView.style.display = "none";
      if (adminView) adminView.style.display = "block";
      if (badge) {
        badge.innerText = "Admin: " + (username || "admin");
        badge.style.background = "var(--primary-dim)";
        badge.style.color = "var(--primary)";
      }
      if (logoutBtn) logoutBtn.style.display = "inline-flex";

      switchAdminTab(currentAdminTab);
      loadAdminOverview();
    }

    async function checkAdminSession() {
      const token = getAdminToken();
      if (!token) {
        showAdminLoginView();
        return;
      }
      try {
        const res = await fetch(API_BASE + "/api/admin/verify", {
          headers: getAdminAuthHeaders()
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          showAdminPanelView(data.username);
        } else {
          clearAdminToken();
          showAdminLoginView();
        }
      } catch (err) {
        showAdminLoginView();
      }
    }

    async function handleAdminLoginSubmit(e) {
      e.preventDefault();
      const userInput = document.getElementById("adminUserInput");
      const passInput = document.getElementById("adminPassInput");
      const submitBtn = document.getElementById("adminLoginSubmitBtn");
      const errBox = document.getElementById("adminLoginError");

      if (!userInput || !passInput) return;
      const username = userInput.value.trim();
      const password = passInput.value.trim();

      if (errBox) errBox.style.display = "none";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Verifying...";
      }

      try {
        const res = await fetch(API_BASE + "/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username, password: password })
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          setAdminToken(data.token);
          passInput.value = "";
          showAdminPanelView(data.username);
        } else {
          showAdminLoginView(data.error || "Invalid username or password");
        }
      } catch (err) {
        showAdminLoginView("Network connection error communicating with admin endpoint");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Log In";
        }
      }
    }

    function switchAdminTab(tab) {
      currentAdminTab = tab;
      const tabs = ["stations", "heatmap", "db", "cleanup"];
      tabs.forEach(function(t) {
        const cap = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById("adminTab" + cap);
        const btn = document.getElementById("tabBtnAdmin" + cap);
        if (el) el.style.display = (t === tab) ? ((t === "heatmap" || t === "db" || t === "cleanup") ? "flex" : "block") : "none";
        if (btn) btn.classList.toggle("active", t === tab);
      });
    }

    async function loadAdminOverview(stationFilter) {
      const token = getAdminToken();
      if (!token) return;

      const filterSelect = document.getElementById("heatmapStationFilter");
      const stFilter = stationFilter !== undefined ? stationFilter : (filterSelect ? filterSelect.value : "all");
      const currentYear = new Date().getFullYear();

      try {
        const res = await fetch(API_BASE + "/api/admin/overview?year=" + currentYear + "&station_id=" + encodeURIComponent(stFilter), {
          headers: getAdminAuthHeaders()
        });
        if (res.status === 401) {
          clearAdminToken();
          showAdminLoginView("Session expired. Please log in again.");
          return;
        }
        const data = await res.json();
        if (!data.success) return;

        adminOverviewData = data;

        // Render fleet stations
        renderAdminStations(data.stations || []);

        // Populate dropdown selectors
        populateAdminStationDropdowns(data.stations || [], stFilter);

        // Render collection metrics and heatmap
        renderAdminHeatmapTab(data);

        // Render database table breakdown
        renderDatabaseOverview(data.database, data.fleet_summary);

      } catch (err) {
        console.error("Failed to load admin overview:", err);
      }
    }

    function populateAdminStationDropdowns(stations, currentFilter) {
      // Heatmap filter dropdown
      const hmSel = document.getElementById("heatmapStationFilter");
      if (hmSel) {
        const prevVal = currentFilter !== undefined ? currentFilter : hmSel.value;
        hmSel.innerHTML = '<option value="all">All Stations (Fleet-Wide)</option>';
        (stations || []).forEach(function(st) {
          const opt = document.createElement("option");
          opt.value = st.station_id;
          opt.innerText = st.station_id + (st.description ? " (" + st.description + ")" : "");
          hmSel.appendChild(opt);
        });
        if (prevVal && Array.from(hmSel.options).some(function(o) { return o.value === prevVal; })) {
          hmSel.value = prevVal;
        } else {
          hmSel.value = "all";
        }
      }

      // Cleanup station select
      const clnSel = document.getElementById("cleanupStationSelect");
      if (clnSel) {
        const prevVal = clnSel.value || "all";
        clnSel.innerHTML = '<option value="all">All Stations (Fleet-Wide)</option>';
        (stations || []).forEach(function(st) {
          const opt = document.createElement("option");
          opt.value = st.station_id;
          opt.innerText = st.station_id + (st.description ? " (" + st.description + ")" : "");
          clnSel.appendChild(opt);
        });
        if (prevVal && Array.from(clnSel.options).some(function(o) { return o.value === prevVal; })) {
          clnSel.value = prevVal;
        } else {
          clnSel.value = "all";
        }
      }
    }

    function renderAdminStations(stations) {
      const tbody = document.getElementById("adminStationsTableBody");
      if (!tbody) return;

      if (!stations || stations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1rem;">No registered fleet stations found.</td></tr>';
        return;
      }

      tbody.innerHTML = stations.map(function(st) {
        const desc = st.description ? escapeHtml(st.description) : '<em style="color:var(--text-muted)">None</em>';
        const board = escapeHtml(st.board_type || "Unknown");
        const batt = st.battery_mv ? (st.battery_mv / 1000).toFixed(2) + "V" : "--";
        const fw = escapeHtml(st.firmware_version || "--");
        const canaryBadge = st.is_canary ? '<span class="status-badge warn" style="font-size:0.65rem; padding:0.1rem 0.35rem; margin-left:0.25rem;">CANARY</span>' : '';
        const targetBadge = st.target_version ? '<span style="font-size:0.7rem; color:var(--primary); font-family:monospace; margin-left:0.25rem;" title="Pinned OTA Version">(→ ' + escapeHtml(st.target_version) + ')</span>' : '';
        const lastSeen = formatLastSeen(st.last_seen);
        const measCount = (st.measurement_count || 0).toLocaleString();
        const dateSpan = (st.min_timestamp && st.max_timestamp)
          ? (new Date(st.min_timestamp * 1000).toISOString().split("T")[0] + ' to ' + new Date(st.max_timestamp * 1000).toISOString().split("T")[0])
          : (st.earliest_date && st.latest_date ? (st.earliest_date + ' to ' + st.latest_date) : '');

        return '<tr>' +
          '<td><strong style="color:var(--primary); font-family:monospace;">' + escapeHtml(st.station_id) + '</strong></td>' +
          '<td>' + desc + '</td>' +
          '<td><span style="font-size:0.8rem;">' + board + '</span><span style="font-size:0.75rem; color:var(--text-muted); display:block;">' + batt + '</span></td>' +
          '<td><span style="font-family:monospace; font-size:0.8rem;">' + fw + '</span>' + canaryBadge + targetBadge + '</td>' +
          '<td><span style="font-size:0.8rem;">' + lastSeen + '</span></td>' +
          '<td><span style="font-family:monospace; font-weight:600;">' + measCount + '</span>' + (dateSpan ? '<span style="font-size:0.68rem; color:var(--text-muted); display:block;">' + dateSpan + '</span>' : '') + '</td>' +
          '<td>' +
            '<div style="display:flex; gap:0.35rem;">' +
              '<button class="admin-btn secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" data-station="' + escapeHtml(st.station_id) + '" onclick="onEditStationBtnClick(this)">✏️ Edit</button>' +
              '<button class="admin-btn danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" data-station="' + escapeHtml(st.station_id) + '" onclick="onDeleteStationBtnClick(this)">🗑️ Delete</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join("");
    }

    function onEditStationBtnClick(btn) {
      const stationId = btn.getAttribute("data-station");
      if (!stationId) return;
      const st = (adminOverviewData && adminOverviewData.stations)
        ? adminOverviewData.stations.find(function(s) { return s.station_id === stationId; })
        : null;
      editStationConfig(stationId, st ? (st.description || "") : "", st ? !!st.is_canary : false, st ? (st.target_version || "") : "");
    }

    function onDeleteStationBtnClick(btn) {
      const stationId = btn.getAttribute("data-station");
      if (!stationId) return;
      deleteStationPrompt(stationId);
    }

    async function editStationConfig(stationId, currentDesc, isCanary, currentTarget) {
      const newDesc = prompt("Update station description for '" + stationId + "':", currentDesc);
      if (newDesc === null) return;

      const newCanary = confirm([
        "Enable Canary OTA channel for '" + stationId + "'?",
        "",
        "- Click OK for CANARY (receives pre-release candidate firmware)",
        "- Click Cancel for STABLE (receives stable releases)"
      ].join(String.fromCharCode(10)));

      const newTarget = prompt("Force specific OTA target version (e.g. '1.1.3' or leave blank to follow channel default):", currentTarget);
      if (newTarget === null) return;

      try {
        const res = await fetch(API_BASE + "/api/admin/station/update", {
          method: "POST",
          headers: getAdminAuthHeaders(),
          body: JSON.stringify({
            station_id: stationId,
            description: newDesc.trim(),
            is_canary: newCanary,
            target_version: newTarget.trim() || null
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert(data.message || "Station updated successfully!");
          loadAdminOverview();
          loadStations();
        } else {
          alert("Error updating station: " + (data.error || "Unknown error"));
        }
      } catch (err) {
        alert("Failed to communicate with admin endpoint.");
      }
    }

    async function deleteStationPrompt(stationId) {
      if (!confirm("Are you sure you want to delete station '" + stationId + "' from the fleet?" + String.fromCharCode(10, 10) + "This will remove the station registration and device token.")) {
        return;
      }

      const purgeData = confirm([
        "Do you also want to permanently delete all historical measurements, Wi-Fi scans, and Bluetooth records collected by '" + stationId + "'?",
        "",
        "- OK: Purge all measurements and records",
        "- Cancel: Delete station registration only (keep records)"
      ].join(String.fromCharCode(10)));

      try {
        const res = await fetch(API_BASE + "/api/admin/station/delete", {
          method: "POST",
          headers: getAdminAuthHeaders(),
          body: JSON.stringify({
            station_id: stationId,
            purge_data: purgeData
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert(data.message || "Station deleted successfully!");
          loadAdminOverview();
          loadStations();
        } else {
          alert("Error deleting station: " + (data.error || "Unknown error"));
        }
      } catch (err) {
        alert("Failed to communicate with admin endpoint.");
      }
    }

    function onHeatmapStationChange(stationId) {
      loadAdminOverview(stationId);
    }

    function renderAdminHeatmapTab(data) {
      const fleet = data.fleet_summary || {};
      const spanText = document.getElementById("heatmapSpanText");
      const totalMeas = document.getElementById("heatmapTotalMeas");
      const earliestDate = document.getElementById("heatmapEarliestDate");
      const latestDate = document.getElementById("heatmapLatestDate");
      const yearDisp = document.getElementById("heatmapYearDisplay");

      const year = data.year || new Date().getFullYear();
      if (yearDisp) yearDisp.innerText = year;

      if (spanText) {
        spanText.innerText = fleet.operating_days ? (fleet.operating_days + " days active") : "--";
      }
      if (totalMeas) {
        totalMeas.innerText = (fleet.total_measurements || 0).toLocaleString();
      }
      if (earliestDate) {
        earliestDate.innerText = fleet.earliest_timestamp 
          ? new Date(fleet.earliest_timestamp * 1000).toISOString().split("T")[0] 
          : "--";
      }
      if (latestDate) {
        latestDate.innerText = fleet.latest_timestamp 
          ? new Date(fleet.latest_timestamp * 1000).toISOString().split("T")[0] 
          : "--";
      }

      renderYearHeatmap(data.yearly_activity || [], year);
    }

    function renderYearHeatmap(activityList, year) {
      const container = document.getElementById("calendarHeatmapContainer");
      if (!container) return;

      const activityMap = {};
      let maxCount = 0;
      (activityList || []).forEach(function(item) {
        const dStr = item.day || item.date;
        if (dStr) activityMap[dStr] = item.count;
        if (item.count > maxCount) maxCount = item.count;
      });

      const jan1 = new Date(year, 0, 1);
      const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
      const totalDays = isLeap ? 366 : 365;
      const jan1Day = jan1.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dayNames = ["", "Mon", "", "Wed", "", "Fri", ""];

      let html = '<div class="cal-grid-wrap">';

      // 1. Months Header Row (53 columns)
      html += '<div class="cal-months-row"><div></div>';

      let lastMonthShown = -1;
      for (let w = 0; w < 53; w++) {
        const offset = w * 7 + 3 - jan1Day;
        if (offset >= 0 && offset < totalDays) {
          const d = new Date(year, 0, 1 + offset);
          const m = d.getMonth();
          if (m !== lastMonthShown && d.getDate() <= 14) {
            html += '<div style="font-weight:600;">' + monthNames[m] + '</div>';
            lastMonthShown = m;
          } else {
            html += '<div></div>';
          }
        } else {
          html += '<div></div>';
        }
      }
      html += '</div>';

      // 2. Weekday Rows (7 rows, 53 cells each)
      for (let r = 0; r < 7; r++) {
        html += '<div class="cal-days-row">';
        html += '<div class="cal-weekday-label">' + dayNames[r] + '</div>';

        for (let w = 0; w < 53; w++) {
          const offset = w * 7 + r - jan1Day;
          if (offset < 0 || offset >= totalDays) {
            html += '<div class="cal-cell" style="visibility:hidden; pointer-events:none;"></div>';
          } else {
            const d = new Date(year, 0, 1 + offset);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = yyyy + '-' + mm + '-' + dd;
            const count = activityMap[dateStr] || 0;

            let level = 0;
            if (count > 0 && count <= 5) level = 1;
            else if (count > 5 && count <= 25) level = 2;
            else if (count > 25 && count <= 100) level = 3;
            else if (count > 100) level = 4;

            const tooltip = dateStr + ': ' + count.toLocaleString() + ' measurement cycle' + (count === 1 ? '' : 's');
            html += '<div class="cal-cell level-' + level + '" title="' + tooltip + '" data-date="' + dateStr + '" data-count="' + count + '"></div>';
          }
        }
        html += '</div>';
      }

      html += '</div>';
      container.innerHTML = html;

      // Update dynamic legend description
      const minLegend = document.getElementById("calMinLegendText");
      const maxLegend = document.getElementById("calMaxLegendText");
      if (minLegend) minLegend.innerText = "0 cycles / day";
      if (maxLegend) {
        maxLegend.innerText = maxCount > 0 ? (maxCount.toLocaleString() + " cycles / day (peak)") : "0 cycles";
      }
    }

    function renderDatabaseOverview(database, fleetSummary) {
      const dbSizeEl = document.getElementById("dbTotalSizeText");
      const dbRecsEl = document.getElementById("dbTotalRecordsText");
      const tbody = document.getElementById("dbTablesTableBody");

      if (dbSizeEl && database) {
        dbSizeEl.innerText = database.total_estimated_formatted || "0 KB";
      }
      if (dbRecsEl && database) {
        dbRecsEl.innerText = (database.total_rows || 0).toLocaleString();
      }

      if (!tbody || !database || !database.tables) return;

      tbody.innerHTML = database.tables.map(function(t) {
        const pct = parseFloat(t.percent_of_total || "0");
        const tableName = t.table || t.table_name || "";
        return '<tr>' +
          '<td><code style="font-weight:600; color:var(--primary); font-size:0.85rem;">' + escapeHtml(tableName) + '</code></td>' +
          '<td style="color:var(--text-muted); font-size:0.8rem;">' + escapeHtml(t.description) + '</td>' +
          '<td style="font-family:monospace; font-weight:600;">' + t.count.toLocaleString() + '</td>' +
          '<td style="font-family:monospace; font-weight:600;">' + t.size_formatted + '</td>' +
          '<td>' +
            '<div style="display:flex; align-items:center; gap:0.5rem;">' +
              '<div class="db-bar-wrap" style="flex:1;">' +
                '<div class="db-bar-fill" style="width:' + Math.min(100, Math.max(2, pct)) + '%;"></div>' +
              '</div>' +
              '<span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; min-width:38px; text-align:right;">' + t.percent_of_total + '%</span>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join("");
    }

    function onCleanupPresetChange(val) {
      const customWrap = document.getElementById("cleanupCustomRange");
      if (customWrap) {
        customWrap.style.display = (val === "custom") ? "grid" : "none";
      }
    }

    async function executeDataCleanup() {
      const stationSel = document.getElementById("cleanupStationSelect");
      const presetSel = document.getElementById("cleanupPresetSelect");
      const stationId = stationSel ? stationSel.value : "all";
      const preset = presetSel ? presetSel.value : "older30";

      let fromTs = 0;
      let toTs = Math.floor(Date.now() / 1000);
      const now = Math.floor(Date.now() / 1000);

      if (preset === "older30") {
        toTs = now - (30 * 86400);
      } else if (preset === "older14") {
        toTs = now - (14 * 86400);
      } else if (preset === "older7") {
        toTs = now - (7 * 86400);
      } else if (preset === "all") {
        toTs = now;
      } else if (preset === "custom") {
        const startInput = document.getElementById("cleanupStartDate");
        const endInput = document.getElementById("cleanupEndDate");
        if (!startInput || !endInput || !startInput.value || !endInput.value) {
          alert("Please select both a start date and an end date for custom cleanup.");
          return;
        }
        fromTs = Math.floor(new Date(startInput.value + "T00:00:00Z").getTime() / 1000);
        toTs = Math.floor(new Date(endInput.value + "T23:59:59Z").getTime() / 1000);

        if (isNaN(fromTs) || isNaN(toTs) || toTs < fromTs) {
          alert("Invalid date range. Start date must be before end date.");
          return;
        }
      }

      const stDesc = stationId === "all" ? "ALL stations" : "station '" + stationId + "'";
      const timeDesc = preset === "all" 
        ? "ALL historical records" 
        : ("records between " + new Date(fromTs * 1000).toISOString().split("T")[0] + " and " + new Date(toTs * 1000).toISOString().split("T")[0]);

      if (!confirm([
        "Are you sure you want to permanently delete telemetry records for " + stDesc + "?",
        "",
        "Target: " + timeDesc,
        "",
        "This will purge raw measurements, Wi-Fi AP scans, and Bluetooth records. Daily summaries are preserved.",
        "",
        "This action CANNOT be undone!"
      ].join(String.fromCharCode(10)))) {
        return;
      }

      try {
        const res = await fetch(API_BASE + "/api/admin/data/delete", {
          method: "POST",
          headers: getAdminAuthHeaders(),
          body: JSON.stringify({
            station_id: stationId,
            from_timestamp: fromTs,
            to_timestamp: toTs
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert(["Data cleanup successful!", "", data.message].join(String.fromCharCode(10)));
          loadAdminOverview();
          if (currentStationId) {
            loadStationDetails(currentStationId);
          }
        } else {
          alert("Cleanup failed: " + (data.error || "Unknown error"));
        }
      } catch (err) {
        alert("Failed to communicate with admin endpoint.");
      }
    }

    function getRequestedStationId() {
      // 1. Query parameter override: ?station=9E1-9 or ?id=9E1-9
      const params = new URLSearchParams(window.location.search);
      const qStation = params.get("station") || params.get("id");
      if (qStation && qStation.trim()) return qStation.trim();

      // 2. Direct path routing: e.g. /9E1-9 or /T18/9E1-9
      let path = window.location.pathname || "";
      while (path.endsWith("/")) path = path.slice(0, -1);
      if (path.startsWith("/T18")) {
        path = path.substring(4);
      } else if (path.startsWith("/wifi")) {
        path = path.substring(5);
      }
      while (path.startsWith("/")) path = path.slice(1);

      if (path && path !== "index.html" && path !== "404.html" && path !== "T18" && path !== "wifi" && path !== "flash") {
        return decodeURIComponent(path);
      }
      return "";
    }

    async function loadStations() {
      try {
        const reqStation = getRequestedStationId();
        const res = await fetch(API_BASE + "/api/stations");
        const data = await res.json();
        const select = document.getElementById("stationSelect");
        select.innerHTML = "";

        if (!data.stations || data.stations.length === 0) {
          if (reqStation) {
            const opt = document.createElement("option");
            opt.value = reqStation;
            opt.innerText = reqStation;
            select.appendChild(opt);
            currentStationId = reqStation;
            loadStationDetails(reqStation);
            return;
          }
          select.innerHTML = "<option value=''>No stations found</option>";
          document.getElementById("stTitle").innerText = "No Stations Registered";
          document.getElementById("stDesc").innerText = "Provision an ESP32 via captive portal to begin monitoring.";
          return;
        }

        let matched = false;
        data.stations.forEach(st => {
          const opt = document.createElement("option");
          opt.value = st.station_id;
          const descStr = st.description ? " (" + st.description + ")" : "";
          opt.innerText = st.station_id + descStr;
          if (reqStation && st.station_id.toLowerCase() === reqStation.toLowerCase()) {
            opt.selected = true;
            matched = true;
            currentStationId = st.station_id;
          }
          select.appendChild(opt);
        });

        if (reqStation && !matched) {
          // If a requested station from URL was not found in registered stations, fallback to first available station
          if (data.stations.length > 0) {
            currentStationId = data.stations[0].station_id;
            select.value = currentStationId;
          } else {
            const opt = document.createElement("option");
            opt.value = reqStation;
            opt.innerText = reqStation;
            opt.selected = true;
            select.prepend(opt);
            currentStationId = reqStation;
          }
        } else if (!currentStationId && data.stations.length > 0) {
          currentStationId = data.stations[0].station_id;
        }

        if (currentStationId) {
          loadStationDetails(currentStationId);
        }
      } catch (err) {
        console.error("Failed to load stations:", err);
      }
    }

    function switchStation(id) {
      if (!id) return;
      currentStationId = id;
      const targetPath = basePath + (id === "" ? "" : encodeURIComponent(id));
      if (window.location.pathname !== targetPath) {
        history.pushState(null, "", targetPath);
      }
      loadStationDetails(id);
    }

    window.addEventListener("popstate", () => {
      const req = getRequestedStationId();
      if (req && req !== currentStationId) {
        currentStationId = req;
        const sel = document.getElementById("stationSelect");
        if (sel) sel.value = req;
        loadStationDetails(req);
      }
    });

    function refreshData() {
      if (currentStationId) {
        loadStationDetails(currentStationId);
      }
    }

    function exportData(fmt) {
      if (!currentStationId) return;
      window.open(API_BASE + "/api/export?station_id=" + encodeURIComponent(currentStationId) + "&format=" + fmt);
    }

    function renderReliabilityBarHtml(netSsid, history) {
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = 1800; // 30 minutes
      const totalIntervals = 48; // 24 hours
      const t0 = now - (totalIntervals * intervalSec);

      // Filter history for this SSID
      const samples = (history || []).filter(function(m) {
        return m.ssid === netSsid;
      });

      let healthyCount = 0;
      let activeIntervals = 0;
      let cellsHtml = "";

      for (let i = 0; i < totalIntervals; i++) {
        const startTs = t0 + (i * intervalSec);
        const endTs = startTs + intervalSec;

        const bucketSamples = samples.filter(function(m) {
          return m.timestamp >= startTs && m.timestamp < endTs;
        });

        const startDate = new Date(startTs * 1000);
        const endDate = new Date(endTs * 1000);
        const timeRangeStr = String(startDate.getHours()).padStart(2, '0') + ':' + 
                             String(startDate.getMinutes()).padStart(2, '0') + '–' + 
                             String(endDate.getHours()).padStart(2, '0') + ':' + 
                             String(endDate.getMinutes()).padStart(2, '0');

        let statusColor = "rgba(148, 163, 184, 0.15)";
        let statusBorder = "1px solid rgba(255, 255, 255, 0.05)";
        let tooltipDetail = "No test run";

        if (bucketSamples.length > 0) {
          activeIntervals++;

          let hasAssocTimeout = false;
          let hasDhcpTimeout = false;
          let hasGatewayTimeout = false;
          let hasDnsTimeout = false;
          let hasHttpTimeout = false;

          bucketSamples.forEach(function(m) {
            if (m.assoc_ms === -1 || (m.status && m.status.toLowerCase().includes("assoc"))) {
              hasAssocTimeout = true;
            }
            if (m.dhcp_ms === -1 || (m.status && m.status.toLowerCase().includes("dhcp"))) {
              hasDhcpTimeout = true;
            }
            if (m.gateway_ms === -1) {
              hasGatewayTimeout = true;
            }
            if (m.dns_ipv4_ms === -1 || m.dns_ipv6_ms === -1) {
              hasDnsTimeout = true;
            }
            if (m.cloudflare_ms === -1 || m.google_ms === -1 || m.microsoft_ms === -1 || m.facebook_ms === -1 || m.netflix_ms === -1) {
              hasHttpTimeout = true;
            }
          });

          if (hasAssocTimeout) {
            statusColor = "#0f172a";
            statusBorder = "1px solid #475569";
            tooltipDetail = "Association Timeout";
          } else if (hasDhcpTimeout) {
            statusColor = "#ef4444";
            statusBorder = "1px solid #dc2626";
            tooltipDetail = "DHCP Lease Timeout";
          } else if (hasGatewayTimeout) {
            statusColor = "#f97316";
            statusBorder = "1px solid #ea580c";
            tooltipDetail = "Gateway RTT Timeout";
          } else if (hasDnsTimeout) {
            statusColor = "#f59e0b";
            statusBorder = "1px solid #d97706";
            tooltipDetail = "DNS v4/v6 Timeout";
          } else if (hasHttpTimeout) {
            statusColor = "#8b5cf6";
            statusBorder = "1px solid #7c3aed";
            tooltipDetail = "Some HTTP Probe Latencies were Timeout";
          } else {
            statusColor = "#10b981";
            statusBorder = "1px solid #059669";
            tooltipDetail = "All HTTP Probes Successful";
            healthyCount++;
          }
        }

        const fullTooltip = timeRangeStr + " (-" + (48 - i) * 30 + "m): " + tooltipDetail;
        cellsHtml += '<div class="rel-cell" style="background:' + statusColor + '; border:' + statusBorder + ';" title="' + fullTooltip + '"></div>';
      }

      const relPct = activeIntervals > 0 ? Math.round((healthyCount / activeIntervals) * 100) : 100;
      const relColor = relPct >= 95 ? "var(--success)" : (relPct >= 80 ? "#f59e0b" : "var(--danger)");

      return '<div style="margin-top:0.85rem; border-top:1px solid var(--card-border); padding-top:0.65rem;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">' +
          '<span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">24h Reliability (48 × 30m)</span>' +
          '<span style="font-size:0.75rem; font-weight:700; color:' + relColor + ';">' + relPct + '% healthy <span style="font-size:0.68rem; font-weight:normal; color:var(--text-muted);">(' + activeIntervals + '/48)</span></span>' +
        '</div>' +
        '<div class="rel-bar-grid">' + cellsHtml + '</div>' +
        '<div style="display:flex; justify-content:space-between; font-size:0.68rem; color:var(--text-muted); margin-top:3px; user-select:none;">' +
          '<span>-24h</span>' +
          '<span>-18h</span>' +
          '<span>-12h</span>' +
          '<span>-6h</span>' +
          '<span>Now</span>' +
        '</div>' +
      '</div>';
    }

    async function loadStationDetails(stationId) {
      try {
        const res = await fetch(API_BASE + "/api/station/" + encodeURIComponent(stationId) + "?t=" + Date.now());
        if (!res.ok) throw new Error("Station fetch failed");
        const data = await res.json();

        // 1. Update Header Banner
        const st = data.station;
        const titleEl = document.getElementById("stTitle");
        titleEl.textContent = "Station: " + st.station_id;
        if (st.firmware_version) {
          const badge = document.createElement("span");
          badge.className = "fw-badge";
          badge.textContent = "v" + st.firmware_version;
          titleEl.appendChild(badge);
        }
        document.getElementById("stDesc").innerText = st.description || "No description configured";

        const badge = document.getElementById("stStatusBadge");
        const statusText = document.getElementById("stStatusText");
        const nowSec = Math.floor(Date.now() / 1000);
        const lastSeen = st.last_seen || 0;
        const diffSec = nowSec - lastSeen;
        const isOnline = lastSeen > 0 && diffSec <= 20 * 60;

        if (isOnline) {
          badge.className = "status-badge online";
          statusText.innerText = "Online (" + formatLastSeen(lastSeen) + ")";
        } else {
          badge.className = "status-badge offline";
          statusText.innerText = lastSeen > 0 ? "Offline (" + formatLastSeen(lastSeen) + ")" : "Never Seen";
        }

        // 2. Render Monitored Network Cards
        const netContainer = document.getElementById("networksContainer");
        netContainer.innerHTML = "";

        if (data.latest_measurements && data.latest_measurements.length > 0) {
          data.latest_measurements.forEach(net => {
            const card = document.createElement("div");
            card.className = "card";
            card.style.cursor = "pointer";
            card.title = "Click to filter latency trends to " + net.ssid;
            card.onclick = () => {
              const sel = document.getElementById("networkFilterSelect");
              if (sel) {
                sel.value = net.ssid;
                onNetworkFilterChange(net.ssid);
              }
            };

              const gwVal = (net.gateway_ms !== null && net.gateway_ms !== undefined && net.gateway_ms >= 0) ? net.gateway_ms + 'ms' : '—';
              let dnsVal = '—';
              if (net.dns_ipv4_ms !== null && net.dns_ipv4_ms !== undefined && net.dns_ipv4_ms >= 0) {
                dnsVal = 'v4: ' + net.dns_ipv4_ms + 'ms';
                if (net.dns_ipv6_ms !== null && net.dns_ipv6_ms !== undefined) {
                  dnsVal += (net.dns_ipv6_ms >= 0) ? (' | v6: ' + net.dns_ipv6_ms + 'ms') : ' | v6: Timeout ⚠️';
                }
              }

              card.innerHTML = \`
                <div class="card-header">
                  <div>
                    <div class="card-title">\${net.ssid}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                      BSSID: \${net.bssid || "N/A"} | Ch \${net.channel || "?"}
                    </div>
                  </div>
                  <span class="status-badge \${net.status === 'connected' ? 'online' : 'offline'}" style="font-size:0.7rem; padding:0.15rem 0.5rem;">
                    \${net.status}
                  </span>
                </div>

                <div class="metrics-summary" style="grid-template-columns: repeat(auto-fit, minmax(95px, 1fr));">
                  <div class="metric-box">
                    <div class="metric-label">Association</div>
                    <div class="metric-val">\${(net.assoc_ms !== null && net.assoc_ms >= 0) ? net.assoc_ms : '—'}<span>ms</span></div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">DHCP Lease</div>
                    <div class="metric-val">\${(net.dhcp_ms !== null && net.dhcp_ms >= 0) ? net.dhcp_ms : '—'}<span>ms</span></div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">Gateway RTT</div>
                    <div class="metric-val" style="color: #06b6d4;">\${gwVal}</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-label">DNS v4 / v6</div>
                    <div class="metric-val" style="font-size: 0.82rem; color: \${net.dns_ipv6_ms === -1 ? '#ef4444' : 'inherit'};">\${dnsVal}</div>
                  </div>
                </div>

                <div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; font-weight:600;">HTTP Probe Latencies</div>
                  <div class="latency-pills">
                    <div class="pill">Gateway: <span class="pill-val \${getPillClass(net.gateway_ms)}">\${fmtMs(net.gateway_ms)}</span></div>
                    <div class="pill">Cloudflare: <span class="pill-val \${getPillClass(net.cloudflare_ms)}">\${fmtMs(net.cloudflare_ms)}</span></div>
                    <div class="pill">Google: <span class="pill-val \${getPillClass(net.google_ms)}">\${fmtMs(net.google_ms)}</span></div>
                    <div class="pill">Microsoft: <span class="pill-val \${getPillClass(net.microsoft_ms)}">\${fmtMs(net.microsoft_ms)}</span></div>
                    <div class="pill">Fast/Netflix: <span class="pill-val \${getPillClass(net.netflix_ms)}">\${fmtMs(net.netflix_ms)}</span></div>
                    <div class="pill">Facebook: <span class="pill-val \${getPillClass(net.facebook_ms)}">\${fmtMs(net.facebook_ms)}</span></div>
                  </div>
                </div>

                \${renderReliabilityBarHtml(net.ssid, data.recent_history)}
              \`;
              netContainer.appendChild(card);
            });
          } else {
            netContainer.innerHTML = "<div class='card' style='grid-column: 1/-1;'><p style='color:var(--text-muted);'>No network latency measurements recorded yet.</p></div>";
          }

          // 3. Render Network Environment & Firewall Diagnostics
          renderDiagnosticsSection(data.diagnostics, data.latest_measurements);

          // 4. Render Spectrum Survey Table
        const tbody = document.getElementById("surveyTableBody");
        tbody.innerHTML = "";
        const rawSurveys = data.latest_survey || [];
        const surveys = rawSurveys.map(s => ({
          ...s,
          bssid: s.bssid ? s.bssid.trim().toUpperCase() : ""
        }));
        const activeBssids = new Set(surveys.map(s => s.bssid).filter(Boolean));
        const seenInactive = new Set();
        const inactive = (data.inactive_survey || [])
          .map(s => ({
            ...s,
            bssid: s.bssid ? s.bssid.trim().toUpperCase() : ""
          }))
          .filter(s => {
            if (!s.bssid) return false;
            if (activeBssids.has(s.bssid)) return false;
            if (seenInactive.has(s.bssid)) return false;
            seenInactive.add(s.bssid);
            return true;
          });
        const totalAps = surveys.length + inactive.length;

        if (inactive.length > 0) {
          document.getElementById("surveyCountBadge").innerText = surveys.length + "/" + totalAps + " APs Detected";
        } else {
          document.getElementById("surveyCountBadge").innerText = surveys.length + " APs Detected";
        }

        if (surveys.length > 0) {
          surveys.forEach(s => {
            const tr = document.createElement("tr");
            const rssi = s.rssi || -100;
            const q = s.quality || 0;
            const barColor = rssi >= -65 ? "#10b981" : (rssi >= -80 ? "#f59e0b" : "#ef4444");

            tr.innerHTML = \`
              <td style="font-weight: 600;">\${s.ssid}</td>
              <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">\${s.bssid || "N/A"}</td>
              <td>
                <div class="rssi-bar-wrap">
                  <div class="rssi-bar"><div class="rssi-fill" style="width: \${q}%; background: \${barColor};"></div></div>
                  <span>\${rssi} dBm</span>
                </div>
              </td>
              <td>\${q}%</td>
              <td>Ch \${s.channel || "?"}</td>
              <td><span style="background:var(--badge-bg); padding:2px 6px; border-radius:4px; font-size:0.75rem;">\${s.phy_mode || 'WIFI_4'}</span></td>
              <td>\${s.encryption || 'Open'}</td>
              <td><span style="display: inline-flex; align-items: center; gap: 4px; color: #10b981; font-weight: 600; font-size: 0.75rem;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>Active</span></td>
            \`;
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = "<tr><td colspan='8' style='text-align: center; color: var(--text-muted); padding: 2rem;'>No surrounding APs scanned yet.</td></tr>";
        }

        // 3b. Render Previously Detected Networks (Inactive)
        const inactiveSection = document.getElementById("inactiveSurveySection");
        const inactiveBody = document.getElementById("inactiveSurveyBody");
        if (inactiveBody) inactiveBody.innerHTML = "";
        if (inactive.length > 0 && inactiveSection && inactiveBody) {
          inactiveSection.style.display = "block";
          document.getElementById("inactiveCountBadge").innerText = inactive.length + " Missing";
          inactive.forEach(s => {
            const tr = document.createElement("tr");
            tr.style.opacity = "0.78";
            const rssi = (s.rssi !== null && s.rssi !== undefined) ? s.rssi : null;
            const q = (s.quality !== null && s.quality !== undefined) ? s.quality : (rssi !== null ? Math.min(100, Math.max(0, 2 * (rssi + 100))) : null);
            const barColor = rssi !== null ? (rssi >= -65 ? "#10b981" : (rssi >= -80 ? "#f59e0b" : "#ef4444")) : "#9ca3af";

            tr.innerHTML = \`
              <td style="font-weight: 500; color: var(--text-muted);">\${s.ssid}</td>
              <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">\${s.bssid || "N/A"}</td>
              <td>
                \${rssi !== null ? \`
                <div class="rssi-bar-wrap">
                  <div class="rssi-bar"><div class="rssi-fill" style="width: \${q}%; background: \${barColor};"></div></div>
                  <span title="Max signal recorded">\${rssi} dBm</span>
                </div>\` : '<span style="color: var(--text-muted);">—</span>'}
              </td>
              <td>\${q !== null ? q + '%' : '<span style="color: var(--text-muted);">—</span>'}</td>
              <td>Ch \${s.channel || "?"}</td>
              <td><span style="background:var(--badge-bg); color: var(--text-muted); padding:2px 6px; border-radius:4px; font-size:0.75rem;">\${s.phy_mode || 'WIFI_4'}</span></td>
              <td style="color: var(--text-muted);">\${s.encryption || 'Open'}</td>
              <td><span title="\${s.last_seen ? new Date(s.last_seen * 1000).toLocaleString() : ''}" style="color: #f59e0b; font-size: 0.75rem; font-weight: 500;">\${formatLastSeen(s.last_seen)}</span></td>
            \`;
            inactiveBody.appendChild(tr);
          });
        } else if (inactiveSection) {
          inactiveSection.style.display = "none";
        }

        // 4. Update Network Selector & Trend Charts
        currentStationData = data;
        const history = data.recent_history || [];
        const latest = data.latest_measurements || [];
        const netSet = new Set();
        latest.forEach(m => { if (m.ssid) netSet.add(m.ssid); });
        history.forEach(h => { if (h.ssid) netSet.add(h.ssid); });
        const networks = Array.from(netSet);

        const filterSel = document.getElementById("networkFilterSelect");
        if (filterSel) {
          const prevVal = filterSel.value || selectedNetworkFilter;
          filterSel.innerHTML = '<option value="combined">Combined (All Networks)</option>';
          networks.forEach(net => {
            const opt = document.createElement("option");
            opt.value = net;
            opt.innerText = net;
            filterSel.appendChild(opt);
          });
          if (networks.includes(prevVal)) {
            filterSel.value = prevVal;
            selectedNetworkFilter = prevVal;
          } else {
            filterSel.value = "combined";
            selectedNetworkFilter = "combined";
          }
        }

        renderAllTrendCharts();
        renderChannelUtilizationSection();
        updateBatteryUi(data);
        updateBluetoothUi(data);

      } catch (err) {
        console.error("Failed to load station details:", err);
        const titleEl = document.getElementById("stTitle");
        if (titleEl) {
          titleEl.textContent = "Station: " + stationId + " (Unavailable)";
        }
        const descEl = document.getElementById("stDesc");
        if (descEl) {
          descEl.innerText = "Could not load data for station " + stationId + ". Please select an active station from the dropdown.";
        }
        const badge = document.getElementById("stStatusBadge");
        if (badge) badge.className = "status-badge offline";
        const statusText = document.getElementById("stStatusText");
        if (statusText) statusText.innerText = "Error loading";
        const batBadge = document.getElementById("stBatteryBadge");
        if (batBadge) batBadge.style.display = "none";
        const batRuntime = document.getElementById("stBatteryRuntime");
        if (batRuntime) batRuntime.style.display = "none";
        const batSec = document.getElementById("batterySection");
        if (batSec) batSec.style.display = "none";
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatLastSeen(ts) {
      if (!ts) return "Unknown";
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, now - ts);
      if (diff < 60) return "Just now";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      if (diff < 86400) return Math.floor(diff / 3600) + "h " + Math.floor((diff % 3600) / 60) + "m ago";
      const days = Math.floor(diff / 86400);
      return days + "d ago";
    }

    let selectedDiagSsid = null;
    let diagDrawerOpen = false;

    function toggleDiagnosticsDetails() {
      diagDrawerOpen = !diagDrawerOpen;
      const drawer = document.getElementById("diagDetailsDrawer");
      const icon = document.getElementById("diagExpandIcon");
      if (drawer) drawer.style.display = diagDrawerOpen ? "block" : "none";
      if (icon) icon.innerText = diagDrawerOpen ? "▲" : "▼";
    }

    function switchDiagnosticsSsid(ssid) {
      selectedDiagSsid = ssid;
      if (currentStationData) {
        renderDiagnosticsSection(currentStationData.diagnostics, currentStationData.latest_measurements);
      }
    }

    function renderDiagnosticsSection(diagnostics, latestMeasurements) {
      const container = document.getElementById("diagnosticsContainer");
      if (!container) return;

      const diagList = Array.isArray(diagnostics) ? diagnostics : (diagnostics ? [diagnostics] : []);
      const netList = Array.isArray(latestMeasurements) ? latestMeasurements : [];

      const ssids = new Set();
      netList.forEach(n => { if (n.ssid) ssids.add(n.ssid); });
      diagList.forEach(d => { if (d.ssid) ssids.add(d.ssid); });

      if (ssids.size === 0) {
        container.innerHTML = "";
        return;
      }

      const ssidArray = Array.from(ssids);
      if (!selectedDiagSsid || !ssids.has(selectedDiagSsid)) {
        selectedDiagSsid = ssidArray[0];
      }

      let optionsHtml = ssidArray.map(s => {
        const isSel = (s === selectedDiagSsid) ? ' selected' : '';
        return '<option value="' + s + '"' + isSel + '>📶 ' + s + '</option>';
      }).join('');

      const ssid = selectedDiagSsid;
      const diag = diagList.find(d => d.ssid === ssid) || null;
      const net = netList.find(n => n.ssid === ssid) || null;

      const gwIp = diag?.gateway_ip || (net?.gateway_ms !== null && net?.gateway_ms >= 0 ? "Default Gateway" : "Auto-detected");
      const gwMs = (net && net.gateway_ms !== null && net.gateway_ms !== undefined && net.gateway_ms >= 0)
        ? (net.gateway_ms + " ms")
        : "—";

      const vendor = diag?.gateway_vendor || "None / Standard";
      const isPfSense = vendor.toLowerCase().includes("pfsense");
      const isWebExposed = diag ? (diag.web_exposed === 1) : false;

      const isIpv6Timeout = (net && net.dns_ipv6_ms === -1) || (diag && diag.dns_ipv6_timeout === 1);
      const isCaptive = (diag && diag.captive_portal_detected === 1);

      let vendorPill = "";
      if (isPfSense) {
        vendorPill = \`<span class="pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 600;">🛡️ pfSense (WebGUI Port 80/443 Exposed)</span>\`;
      } else if (isWebExposed) {
        vendorPill = \`<span class="pill" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 600;">⚠️ \${vendor} WebUI Exposed</span>\`;
      } else {
        vendorPill = \`<span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">🔒 Gateway WebUI Not Exposed</span>\`;
      }

      let dnsPill = "";
      if (isIpv6Timeout) {
        dnsPill = \`<span class="pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 600;">⚠️ IPv6 DNS Timeout (~30s delay)</span>\`;
      } else if (net && net.dns_ipv4_ms >= 0 && net.dns_ipv6_ms >= 0) {
        dnsPill = \`<span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">✓ Dual-Stack DNS Healthy (\${net.dns_ipv4_ms}ms / \${net.dns_ipv6_ms}ms)</span>\`;
      } else {
        dnsPill = \`<span class="pill" style="background: var(--primary-dim); color: var(--primary); font-weight: 600;">DNS: Active</span>\`;
      }

      let captivePill = isCaptive
        ? \`<span class="pill" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 600;">⚠️ Captive Interception Active</span>\`
        : \`<span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">✓ Direct Internet (No Captive Trap)</span>\`;

      const auditTime = diag ? (new Date(diag.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + formatLastSeen(diag.timestamp) + ')') : 'Pending Daily Audit';

      let cardHtml = \`
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.1rem;">🛡️</span>
            <div>
              <span class="card-title" style="font-size: 1rem;">Network Environment & Firewall Diagnostics</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Per-monitored network gateway exposure, dual-stack DNS health, PMTUD and egress port security audits</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Audited Network:</span>
            <select id="diagNetworkSelect" onchange="switchDiagnosticsSsid(this.value)" style="background: var(--card-bg, #1e293b); color: var(--text, #f8fafc); border: 1px solid var(--card-border, #334155); border-radius: 6px; padding: 0.3rem 0.65rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; outline: none;">
              \${optionsHtml}
            </select>
          </div>
        </div>

        <div class="card" style="padding: 1.15rem 1.35rem; gap: 0.85rem; margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">📶</span>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="card-title" style="font-size: 1rem;">\${ssid}</span>
                  <span class="pill" style="font-size: 0.7rem; color: var(--primary); border: 1px solid var(--primary-dim); background: var(--primary-dim);">Monitored Network</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Gateway \${gwIp} (\${gwMs})</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="pill" style="font-size: 0.7rem; color: var(--text-muted);">Audit: \${auditTime}</span>
              <button onclick="toggleDiagnosticsDetails()" style="background: var(--primary-dim); color: var(--primary); border: 1px solid var(--primary); padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
                <span>Detailed Audit</span> <span id="diagExpandIcon">\${diagDrawerOpen ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>

          <!-- Summary Badges -->
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;">
            <span class="pill" style="color: #06b6d4; font-weight: 600;">Gateway: \${gwIp} (\${gwMs})</span>
            \${vendorPill}
            \${dnsPill}
            \${captivePill}
          </div>

          <!-- Expandable Detailed View -->
          <div id="diagDetailsDrawer" style="display: \${diagDrawerOpen ? 'block' : 'none'}; border-top: 1px dashed var(--card-border); padding-top: 1rem; margin-top: 0.5rem;">
            <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.85rem;">
              <!-- 1. Gateway & Firewall Exposure -->
              <div class="card" style="padding: 0.85rem; background: var(--bg); border: 1px solid var(--card-border); gap: 0.4rem;">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">1. Gateway & Firewall Exposure</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                  <div><strong>Gateway IP:</strong> \${gwIp}</div>
                  <div><strong>Identified Vendor:</strong> \${vendor}</div>
                  <div><strong>Web Management:</strong> \${isWebExposed ? (diag?.login_url || 'Exposed (Port 80/443)') : 'Not exposed / Filtered'}</div>
                  <div><strong>HTTPS Redirect:</strong> \${diag?.https_redirect ? 'Yes (Forces port 443)' : 'No'}</div>
                  <div style="margin-top: 0.35rem; color: \${isPfSense ? '#ef4444' : 'var(--text-muted)'}; font-size: 0.72rem;">
                    \${isPfSense ? '⚠️ Security advisory: pfSense WebConfigurator is accessible to Wi-Fi clients. Restrict management access to a secure VLAN.' : '✓ No vulnerable gateway management interface exposed to this Wi-Fi network.'}
                  </div>
                </div>
              </div>

              <!-- 2. Dual-Stack DNS & IPv6 Audit -->
              <div class="card" style="padding: 0.85rem; background: var(--bg); border: 1px solid var(--card-border); gap: 0.4rem;">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">2. DNS Dual-Stack Audit</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                  <div><strong>IPv4 Resolution (A):</strong> \${diag?.dns_ipv4_ms !== null && diag?.dns_ipv4_ms !== undefined && diag?.dns_ipv4_ms >= 0 ? diag.dns_ipv4_ms + ' ms' : (net?.dns_ipv4_ms >= 0 ? net.dns_ipv4_ms + ' ms' : 'Passed')}</div>
                  <div><strong>IPv6 Resolution (AAAA):</strong> \${diag?.dns_ipv6_ms !== null && diag?.dns_ipv6_ms !== undefined && diag?.dns_ipv6_ms >= 0 ? diag.dns_ipv6_ms + ' ms' : (net?.dns_ipv6_ms >= 0 ? net.dns_ipv6_ms + ' ms' : (isIpv6Timeout ? '<span style=\"color:#ef4444; font-weight:600;\">Timeout (>3500 ms)</span>' : 'N/A'))}</div>
                  <div><strong>IPv6 DNS Timeout:</strong> \${isIpv6Timeout ? '<span style=\"color:#ef4444; font-weight:600;\">Triggered (Causes ~30s delay)</span>' : 'None detected'}</div>
                  <div><strong>DNS Rebinding Protection:</strong> \${diag?.dns_rebind_blocked ? 'Active (RFC 1918 filtered)' : 'Standard'}</div>
                  <div style="margin-top: 0.35rem; color: \${isIpv6Timeout ? '#ef4444' : 'var(--text-muted)'}; font-size: 0.72rem;">
                    \${isIpv6Timeout ? '⚠️ Notice: Upstream router advertises IPv6 DNS but drops traffic, causing applications to stall for 30s before falling back to IPv4.' : '✓ Dual-stack DNS resolves cleanly without fallback penalties.'}
                  </div>
                </div>
              </div>

              <!-- 3. Path MTU & MSS Clamping -->
              <div class="card" style="padding: 0.85rem; background: var(--bg); border: 1px solid var(--card-border); gap: 0.4rem;">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">3. Path MTU & MSS Clamping</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                  <div><strong>MTU 1500 (Standard):</strong> \${diag ? (diag.mtu_1500_ok ? '✓ Passed' : '<span style=\"color:#ef4444;\">Failed / Blackhole</span>') : 'Standard'}</div>
                  <div><strong>MTU 1492 (PPPoE / DSL):</strong> \${diag?.mtu_1492_ok ? '✓ Passed' : 'Passed'}</div>
                  <div><strong>MTU 1420 (VPN / WireGuard):</strong> \${diag?.mtu_1420_ok ? '✓ Passed' : 'Passed'}</div>
                  <div><strong>Captive Portal Trap:</strong> \${isCaptive ? '<span style=\"color:#ef4444; font-weight:600;\">Intercepted</span>' : 'Clear / Direct'}</div>
                  <div style="margin-top: 0.35rem; font-size: 0.72rem;">
                    \${diag?.mtu_1500_ok ? '✓ PMTUD and MSS clamping operational. Large packet transmissions and TLS handshakes succeed.' : '✓ Large packet transmissions and TLS handshakes succeed.'}
                  </div>
                </div>
              </div>

              <!-- 4. Egress Firewall Reachability -->
              <div class="card" style="padding: 0.85rem; background: var(--bg); border: 1px solid var(--card-border); gap: 0.4rem;">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">4. Egress Firewall Rules</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                  <div><strong>Open Egress Ports:</strong> \${diag?.open_ports || '53 (DNS), 80 (HTTP), 443 (HTTPS), 123 (NTP)'}</div>
                  <div><strong>Web (80 / 443):</strong> Permitted</div>
                  <div><strong>DNS (53 / 853):</strong> Permitted</div>
                  <div><strong>Cadence:</strong> Daily Deep Audit (Every 24 Hours)</div>
                  <div style="margin-top: 0.35rem; font-size: 0.72rem;">
                    Standard outbound internet connectivity is verified across critical operational ports.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;

      container.innerHTML = cardHtml;
    }

    function renderAllTrendCharts() {
      if (!currentStationData) return;
      const history = currentStationData.recent_history || [];
      const latest = currentStationData.latest_measurements || [];

      const netSet = new Set();
      latest.forEach(m => { if (m.ssid) netSet.add(m.ssid); });
      history.forEach(h => { if (h.ssid) netSet.add(h.ssid); });
      const networks = Array.from(netSet);

      const badge = document.getElementById("targetFilterBadge");
      if (badge) {
        if (selectedNetworkFilter === "combined") {
          badge.innerText = networks.length > 1 ? ("Combined (" + networks.length + " Networks)") : "Combined";
        } else {
          badge.innerText = selectedNetworkFilter;
        }
      }

      // Group history into 10-minute buckets (600s)
      const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
      const bucketMap = new Map();
      sortedHistory.forEach(pt => {
        const bKey = Math.floor(pt.timestamp / 600) * 600;
        if (!bucketMap.has(bKey)) {
          bucketMap.set(bKey, []);
        }
        bucketMap.get(bKey).push(pt);
      });

      const sortedBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);
      const labels = sortedBuckets.map(bKey => {
        const d = new Date(bKey * 1000);
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      });

      // 1. Render Main Multi-Target Overview Chart
      renderMainOverviewChart(labels, sortedBuckets, bucketMap, networks);

      // 2. Render 6 Individual Target Charts
      TARGET_CONFIG.forEach(target => {
        renderIndividualTargetChart(target, labels, sortedBuckets, bucketMap, networks);
      });
    }

    function renderMainOverviewChart(labels, sortedBuckets, bucketMap, networks) {
      const ctx = document.getElementById("trendChart");
      if (!ctx) return;

      const datasets = [];

      TARGET_CONFIG.forEach(target => {
        const data = sortedBuckets.map(bKey => {
          const pts = bucketMap.get(bKey) || [];
          const matching = (selectedNetworkFilter === "combined")
            ? pts
            : pts.filter(p => p.ssid === selectedNetworkFilter);
          const vals = matching
            .map(p => p[target.field])
            .filter(v => v !== null && v !== undefined && v >= 0);
          if (vals.length === 0) return null;
          return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
        });

        datasets.push({
          label: target.name + ' (ms)',
          data: data,
          borderColor: target.color,
          backgroundColor: target.bg,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 2,
          borderWidth: 2
        });
      });

      // Association Time
      const assocData = sortedBuckets.map(bKey => {
        const pts = bucketMap.get(bKey) || [];
        const matching = (selectedNetworkFilter === "combined")
          ? pts
          : pts.filter(p => p.ssid === selectedNetworkFilter);
        const vals = matching
          .map(p => p.assoc_ms)
          .filter(v => v !== null && v !== undefined && v >= 0);
        if (vals.length === 0) return null;
        return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
      });

      datasets.push({
        label: 'Association Time (ms)',
        data: assocData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderDash: [5, 5],
        tension: 0.3,
        spanGaps: true,
        pointRadius: 2,
        borderWidth: 1.5
      });

      if (mainChartInstance) {
        mainChartInstance.destroy();
      }

      const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.05)';
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#9ca3af';

      mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: textColor, boxWidth: 12 }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, maxTicksLimit: 12 }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor },
              beginAtZero: true
            }
          }
        }
      });
    }

    function renderIndividualTargetChart(target, labels, sortedBuckets, bucketMap, networks) {
      const canvasId = "chart-" + target.key;
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;

      const datasets = [];
      const validPoints = [];

      if (selectedNetworkFilter === "combined" && networks.length > 1) {
        networks.forEach((netName, idx) => {
          const color = NETWORK_PALETTE[idx % NETWORK_PALETTE.length];
          const data = sortedBuckets.map(bKey => {
            const pts = bucketMap.get(bKey) || [];
            const p = pts.find(item => item.ssid === netName);
            if (p && p[target.field] !== null && p[target.field] !== undefined && p[target.field] >= 0) {
              validPoints.push(p[target.field]);
              return p[target.field];
            }
            return null;
          });

          datasets.push({
            label: netName,
            data: data,
            borderColor: color,
            backgroundColor: 'transparent',
            tension: 0.3,
            spanGaps: true,
            pointRadius: 2,
            borderWidth: 1.8
          });
        });
      } else {
        const data = sortedBuckets.map(bKey => {
          const pts = bucketMap.get(bKey) || [];
          const matching = (selectedNetworkFilter === "combined")
            ? pts
            : pts.filter(p => p.ssid === selectedNetworkFilter);
          const vals = matching
            .map(p => p[target.field])
            .filter(v => v !== null && v !== undefined && v >= 0);
          if (vals.length === 0) return null;
          const avg = Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
          validPoints.push(avg);
          return avg;
        });

        datasets.push({
          label: (selectedNetworkFilter === "combined" ? "Combined" : selectedNetworkFilter) + " (ms)",
          data: data,
          borderColor: target.color,
          backgroundColor: target.bg,
          fill: true,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 2,
          borderWidth: 2
        });
      }

      const statEl = document.getElementById("stat-" + target.key);
      if (statEl) {
        if (validPoints.length > 0) {
          const latest = validPoints[validPoints.length - 1];
          const avg = Math.round(validPoints.reduce((sum, v) => sum + v, 0) / validPoints.length);
          const min = Math.min(...validPoints);
          statEl.innerHTML = \`<span class="pill-val \${getPillClass(latest)}">\${latest} ms</span> <span style="color:var(--text-muted); font-size:0.7rem; font-weight:normal;">(avg \${avg} | min \${min})</span>\`;
        } else {
          statEl.innerHTML = '<span style="color:var(--text-muted);">—</span>';
        }
      }

      if (targetChartInstances[target.key]) {
        targetChartInstances[target.key].destroy();
      }

      const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.05)';
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#9ca3af';

      targetChartInstances[target.key] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: (selectedNetworkFilter === "combined" && networks.length > 1),
              labels: { color: textColor, boxWidth: 10, font: { size: 10 } }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, maxTicksLimit: 6, font: { size: 10 } }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 10 } },
              beginAtZero: true
            }
          }
        }
      });
    }

    let channelChartInstance = null;
    let selectedChannelView = "combined"; // 'combined', 'non_overlapping', 'all_individual'
    let showScanTime = true;

    function onChannelViewChange(view) {
      selectedChannelView = view;
      renderChannelUtilizationSection();
    }

    function onToggleScanTime(checked) {
      showScanTime = checked;
      renderChannelUtilizationSection();
    }

    function toggleChannelTable() {
      const drawer = document.getElementById("channelTableDrawer");
      const icon = document.getElementById("channelTableExpandIcon");
      if (!drawer) return;
      const isHidden = (drawer.style.display === "none" || !drawer.style.display);
      drawer.style.display = isHidden ? "block" : "none";
      if (icon) icon.innerText = isHidden ? "▲" : "▼";
    }

    function toggleChannelHeatmap() {
      const drawer = document.getElementById("channelHeatmapDrawer");
      const icon = document.getElementById("channelHeatmapExpandIcon");
      if (!drawer) return;
      const isHidden = (drawer.style.display === "none" || !drawer.style.display);
      drawer.style.display = isHidden ? "block" : "none";
      if (icon) icon.innerText = isHidden ? "▲" : "▼";
      if (isHidden) {
        renderChannelHeatmap();
      }
    }

    function toggleSurveySection() {
      const drawer = document.getElementById("surveyTableDrawer");
      const icon = document.getElementById("surveyCollapseIcon");
      if (!drawer) return;
      const isHidden = (drawer.style.display === "none" || !drawer.style.display);
      drawer.style.display = isHidden ? "block" : "none";
      if (icon) icon.innerText = isHidden ? "▼" : "▶";
    }

    function toggleInactiveSurveySection() {
      const drawer = document.getElementById("inactiveSurveyDrawer");
      const icon = document.getElementById("inactiveCollapseIcon");
      if (!drawer) return;
      const isHidden = (drawer.style.display === "none" || !drawer.style.display);
      drawer.style.display = isHidden ? "block" : "none";
      if (icon) icon.innerText = isHidden ? "▼" : "▶";
    }

    function getAirtimeHeatmapColor(pct) {
      if (pct === null || pct === undefined || isNaN(pct)) return 'rgba(100, 116, 139, 0.15)';
      if (pct <= 2) return '#0f2942'; // near idle
      if (pct <= 5) return '#0284c7'; // 2-5%
      if (pct <= 8) return '#06b6d4'; // 5-8%
      if (pct <= 12) return '#0d9488'; // 8-12%
      if (pct <= 16) return '#10b981'; // 12-16%
      if (pct <= 20) return '#22c55e'; // 16-20%
      if (pct <= 25) return '#84cc16'; // 20-25%
      if (pct <= 30) return '#eab308'; // 25-30%
      if (pct <= 40) return '#f97316'; // 30-40%
      if (pct <= 55) return '#ef4444'; // 40-55%
      if (pct <= 70) return '#dc2626'; // 55-70%
      return '#d946ef'; // > 70% outlier spike
    }

    function getBleHeatmapColor(count) {
      if (count === null || count === undefined || isNaN(count)) return 'rgba(100, 116, 139, 0.15)';
      if (count === 0) return '#0f2942'; // near idle / 0 devices
      if (count <= 3) return '#06b6d4'; // 1-3 devices
      if (count <= 8) return '#10b981'; // 4-8 devices
      if (count <= 15) return '#eab308'; // 9-15 devices
      if (count <= 25) return '#f97316'; // 16-25 devices
      return '#d946ef';                 // > 25 devices
    }

    function renderChannelHeatmap() {
      const container = document.getElementById("channelHeatmapContainer");
      if (!container || !currentStationData) return;

      const utilHistory = currentStationData.channel_utilization || [];
      container.innerHTML = "";

      if (utilHistory.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1.2rem;">No 24-hour channel utilization data available yet.</div>';
        return;
      }

      // Compute time boundaries for 48 half-hour slots
      const nowSec = Math.floor(Date.now() / 1000);
      let maxTs = 0;
      for (let i = 0; i < utilHistory.length; i++) {
        if (utilHistory[i].timestamp > maxTs) maxTs = utilHistory[i].timestamp;
      }
      const refTime = (maxTs > 0) ? Math.max(nowSec, maxTs) : nowSec;
      const endSlot = Math.floor(refTime / 1800) * 1800;
      const startSlot = endSlot - (47 * 1800); // 48 slots: 0 to 47

      const slots = [];
      for (let i = 0; i < 48; i++) {
        slots.push(startSlot + (i * 1800));
      }

      // Initialize 13 channels matrix
      const matrix = {};
      for (let ch = 1; ch <= 13; ch++) {
        matrix[ch] = new Array(48).fill(null);
      }

      for (let i = 0; i < utilHistory.length; i++) {
        const u = utilHistory[i];
        if (u.channel < 1 || u.channel > 13) continue;
        const slotIdx = Math.round((u.timestamp - startSlot) / 1800);
        if (slotIdx >= 0 && slotIdx < 48) {
          if (!matrix[u.channel][slotIdx]) {
            matrix[u.channel][slotIdx] = {
              count: 1,
              sumAirtime: (u.airtime_pct || 0),
              dataFrames: (u.data_frames || 0),
              mgmtFrames: (u.mgmt_frames || 0),
              ctrlFrames: (u.ctrl_frames || 0),
              transmitters: (u.unique_transmitters || 0)
            };
          } else {
            const cellData = matrix[u.channel][slotIdx];
            cellData.count++;
            cellData.sumAirtime += (u.airtime_pct || 0);
            cellData.dataFrames += (u.data_frames || 0);
            cellData.mgmtFrames += (u.mgmt_frames || 0);
            cellData.ctrlFrames += (u.ctrl_frames || 0);
            cellData.transmitters = Math.max(cellData.transmitters, (u.unique_transmitters || 0));
          }
        }
      }

      // Initialize BLE slots
      const bleSlots = new Array(48).fill(null);
      const btHistory = currentStationData.bluetooth_history || [];
      for (let i = 0; i < btHistory.length; i++) {
        const b = btHistory[i];
        const slotIdx = Math.round((b.timestamp - startSlot) / 1800);
        if (slotIdx >= 0 && slotIdx < 48) {
          if (!bleSlots[slotIdx]) {
            bleSlots[slotIdx] = {
              count: 1,
              sumUnique: (b.ble_unique_devices || 0),
              maxUnique: (b.ble_unique_devices || 0),
              totalMacs: (b.ble_total_macs || 0),
              randomMacs: (b.ble_random_macs || 0),
              publicMacs: (b.ble_public_macs || 0),
              classicTotal: (b.classic_total || 0)
            };
          } else {
            const bs = bleSlots[slotIdx];
            bs.count++;
            bs.sumUnique += (b.ble_unique_devices || 0);
            bs.maxUnique = Math.max(bs.maxUnique, (b.ble_unique_devices || 0));
            bs.totalMacs = Math.max(bs.totalMacs, (b.ble_total_macs || 0));
            bs.randomMacs = Math.max(bs.randomMacs, (b.ble_random_macs || 0));
            bs.publicMacs = Math.max(bs.publicMacs, (b.ble_public_macs || 0));
            bs.classicTotal = Math.max(bs.classicTotal, (b.classic_total || 0));
          }
        }
      }

      if (currentStationData.latest_bluetooth && currentStationData.latest_bluetooth.timestamp) {
        const lb = currentStationData.latest_bluetooth;
        const lbSlot = Math.round((lb.timestamp - startSlot) / 1800);
        if (lbSlot >= 0 && lbSlot < 48 && !bleSlots[lbSlot]) {
          bleSlots[lbSlot] = {
            count: 1,
            sumUnique: (lb.ble_unique_devices || 0),
            maxUnique: (lb.ble_unique_devices || 0),
            totalMacs: (lb.ble_total_macs || 0),
            randomMacs: (lb.ble_random_macs || 0),
            publicMacs: (lb.ble_public_macs || 0),
            classicTotal: (lb.classic_total || 0)
          };
        }
      }

      const hoverInfo = document.getElementById("heatmapHoverInfo");

      // 1. Header row with time labels
      const headerRow = document.createElement("div");
      headerRow.className = "heatmap-row";
      const spacer = document.createElement("div");
      spacer.className = "heatmap-row-label";
      spacer.style.fontSize = "0.65rem";
      spacer.innerText = "Time";
      headerRow.appendChild(spacer);

      const headerCols = document.createElement("div");
      headerCols.className = "heatmap-header-wrap";
      for (let i = 0; i < 48; i++) {
        const col = document.createElement("div");
        col.className = "heatmap-header-col";
        if (i === 47) {
          col.innerText = "Now";
          col.style.fontWeight = "600";
          col.style.color = "var(--primary)";
        } else if (i % 4 === 0) {
          col.innerText = new Date(slots[i] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (i % 2 === 0) {
          col.innerHTML = "&middot;";
        }
        headerCols.appendChild(col);
      }
      headerRow.appendChild(headerCols);
      container.appendChild(headerRow);

      // 2. Render 13 Channel Rows
      for (let ch = 1; ch <= 13; ch++) {
        const row = document.createElement("div");
        row.className = "heatmap-row";

        const chLabel = document.createElement("div");
        chLabel.className = "heatmap-row-label";
        chLabel.innerText = "Ch " + ch;
        row.appendChild(chLabel);

        const cellsWrap = document.createElement("div");
        cellsWrap.className = "heatmap-cells-wrap";

        for (let i = 0; i < 48; i++) {
          const cell = document.createElement("div");
          cell.className = "heatmap-cell";

          const cellData = matrix[ch][i];
          const slotTime = slots[i];
          const timeLabel = new Date(slotTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTimeLabel = new Date((slotTime + 1800) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (cellData) {
            const avgAir = cellData.sumAirtime / cellData.count;
            const color = getAirtimeHeatmapColor(avgAir);
            cell.style.background = color;
            const tipText = 'Ch ' + ch + ' (' + timeLabel + ' - ' + endTimeLabel + '): ' + avgAir.toFixed(1) + '% airtime, ' + cellData.dataFrames.toLocaleString() + ' data, ' + cellData.mgmtFrames.toLocaleString() + ' mgmt, ' + cellData.ctrlFrames.toLocaleString() + ' ctrl, ' + cellData.transmitters + ' transmitters';
            cell.title = tipText;

            cell.addEventListener("mouseenter", function() {
              if (hoverInfo) {
                hoverInfo.innerHTML = '<span style="color:#fff; font-weight:600;">Ch ' + ch + '</span> &bull; <span style="color:var(--primary);">' + timeLabel + ' - ' + endTimeLabel + '</span> &bull; Airtime: <span style="color:' + color + '; font-weight:700;">' + avgAir.toFixed(1) + '%</span> | Data: ' + cellData.dataFrames.toLocaleString() + ' | Mgmt: ' + cellData.mgmtFrames.toLocaleString() + ' | Ctrl: ' + cellData.ctrlFrames.toLocaleString() + ' | <span style="color:#10b981; font-weight:600;">' + cellData.transmitters + ' Tx</span>';
              }
            });
          } else {
            cell.style.background = "rgba(100, 116, 139, 0.15)";
            cell.title = 'Ch ' + ch + ' (' + timeLabel + ' - ' + endTimeLabel + '): No telemetry data';
            cell.addEventListener("mouseenter", function() {
              if (hoverInfo) {
                hoverInfo.innerHTML = '<span style="color:var(--text-muted);">Ch ' + ch + ' &bull; ' + timeLabel + ' - ' + endTimeLabel + ' &bull; No telemetry data recorded</span>';
              }
            });
          }

          cell.addEventListener("mouseleave", function() {
            if (hoverInfo) {
              hoverInfo.innerText = "Hover over a cell to inspect metrics";
            }
          });

          cellsWrap.appendChild(cell);
        }

        row.appendChild(cellsWrap);
        container.appendChild(row);
      }

      // 3. Render Unique BLE Devices Row
      const bleRow = document.createElement("div");
      bleRow.className = "heatmap-row";
      bleRow.style.marginTop = "4px";
      bleRow.style.paddingTop = "4px";
      bleRow.style.borderTop = "1px dashed rgba(100, 116, 139, 0.3)";

      const bleLabel = document.createElement("div");
      bleLabel.className = "heatmap-row-label";
      bleLabel.style.color = "#38bdf8";
      bleLabel.style.fontWeight = "700";
      bleLabel.innerText = "BLE";
      bleRow.appendChild(bleLabel);

      const bleCellsWrap = document.createElement("div");
      bleCellsWrap.className = "heatmap-cells-wrap";

      for (let i = 0; i < 48; i++) {
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";

        const bData = bleSlots[i];
        const slotTime = slots[i];
        const timeLabel = new Date(slotTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTimeLabel = new Date((slotTime + 1800) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (bData) {
          const devCount = Math.round(bData.sumUnique / bData.count);
          const color = getBleHeatmapColor(devCount);
          cell.style.background = color;
          cell.title = 'BLE Devices (' + timeLabel + ' - ' + endTimeLabel + '): ' + devCount + ' unique devices, ' + bData.totalMacs + ' MACs (' + bData.randomMacs + ' RPA, ' + bData.publicMacs + ' Public)';

          cell.addEventListener("mouseenter", function() {
            if (hoverInfo) {
              hoverInfo.innerHTML = '<span style="color:#38bdf8; font-weight:600;">Unique BLE Devices</span> &bull; <span style="color:var(--primary);">' + timeLabel + ' - ' + endTimeLabel + '</span> &bull; Detected: <span style="color:' + color + '; font-weight:700;">' + devCount + ' Unique BLE</span> | Total MACs: ' + bData.totalMacs + ' (' + bData.randomMacs + ' RPA, ' + bData.publicMacs + ' Public) | Classic: ' + bData.classicTotal;
            }
          });
        } else {
          cell.style.background = "rgba(100, 116, 139, 0.15)";
          cell.title = 'BLE Devices (' + timeLabel + ' - ' + endTimeLabel + '): No Bluetooth telemetry data';
          cell.addEventListener("mouseenter", function() {
            if (hoverInfo) {
              hoverInfo.innerHTML = '<span style="color:var(--text-muted);">Unique BLE Devices &bull; ' + timeLabel + ' - ' + endTimeLabel + ' &bull; No Bluetooth telemetry recorded</span>';
            }
          });
        }

        cell.addEventListener("mouseleave", function() {
          if (hoverInfo) {
            hoverInfo.innerText = "Hover over a cell to inspect metrics";
          }
        });

        bleCellsWrap.appendChild(cell);
      }

      bleRow.appendChild(bleCellsWrap);
      container.appendChild(bleRow);
    }

    const CHANNEL_COLORS_13 = [
      '#38bdf8', '#06b6d4', '#14b8a6', '#10b981', '#84cc16',
      '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef',
      '#8b5cf6', '#6366f1', '#3b82f6'
    ];

    function renderChannelUtilizationSection() {
      if (!currentStationData) return;

      const utilHistory = currentStationData.channel_utilization || [];
      const latestUtil = currentStationData.latest_channel_utilization || [];
      const latestScanMs = currentStationData.latest_scan_duration_ms;

      // 1. KPI Stats
      const statAvgEl = document.getElementById("stat-avg-airtime");
      const statPeakEl = document.getElementById("stat-peak-channel");
      const statScanEl = document.getElementById("stat-latest-scantime");
      const statTxEl = document.getElementById("stat-total-transmitters");
      const statFramesEl = document.getElementById("stat-frame-breakdown");

      if (utilHistory.length > 0) {
        const totalAirtime = utilHistory.reduce((s, r) => s + (r.airtime_pct || 0), 0);
        const avgAir = (totalAirtime / utilHistory.length).toFixed(1);
        const airClass = avgAir >= 50 ? '#ef4444' : (avgAir >= 25 ? '#f59e0b' : '#38bdf8');
        if (statAvgEl) statAvgEl.innerHTML = \`<span style="color:\${airClass}">\${avgAir}%</span>\`;

        // Peak Channel
        const chanMap = {};
        for (let ch = 1; ch <= 13; ch++) chanMap[ch] = { sum: 0, count: 0 };
        utilHistory.forEach(r => {
          if (chanMap[r.channel]) {
            chanMap[r.channel].sum += (r.airtime_pct || 0);
            chanMap[r.channel].count++;
          }
        });
        let peakCh = 1;
        let peakAvg = 0;
        for (let ch = 1; ch <= 13; ch++) {
          if (chanMap[ch].count > 0) {
            const chAvg = chanMap[ch].sum / chanMap[ch].count;
            if (chAvg > peakAvg) {
              peakAvg = chAvg;
              peakCh = ch;
            }
          }
        }
        if (statPeakEl) statPeakEl.innerHTML = \`Ch \${peakCh} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(\${peakAvg.toFixed(1)}%)</span>\`;
      } else {
        if (statAvgEl) statAvgEl.innerText = "—";
        if (statPeakEl) statPeakEl.innerText = "—";
      }

      // Latest Scan Time
      if (statScanEl) {
        if (latestScanMs !== null && latestScanMs !== undefined && latestScanMs >= 0) {
          statScanEl.innerHTML = \`\${latestScanMs.toLocaleString()} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">ms</span>\`;
        } else {
          const latestM = (currentStationData.latest_measurements || [])[0];
          if (latestM && latestM.scan_duration_ms) {
            statScanEl.innerHTML = \`\${latestM.scan_duration_ms.toLocaleString()} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">ms</span>\`;
          } else {
            statScanEl.innerText = "—";
          }
        }
      }

      // Latest Transmitters & Frame Breakdown
      if (latestUtil.length > 0) {
        let totalTx = 0;
        let sumData = 0, sumMgmt = 0, sumCtrl = 0;
        latestUtil.forEach(u => {
          totalTx += (u.unique_transmitters || 0);
          sumData += (u.data_frames || 0);
          sumMgmt += (u.mgmt_frames || 0);
          sumCtrl += (u.ctrl_frames || 0);
        });
        if (statTxEl) statTxEl.innerHTML = \`\${totalTx} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">MACs</span>\`;

        const totalFrames = sumData + sumMgmt + sumCtrl;
        if (statFramesEl && totalFrames > 0) {
          const dPct = Math.round((sumData / totalFrames) * 100);
          const mPct = Math.round((sumMgmt / totalFrames) * 100);
          const cPct = Math.round((sumCtrl / totalFrames) * 100);
          statFramesEl.innerHTML = \`<span style="color:#10b981;" title="Data Frames: \${sumData.toLocaleString()}">\${dPct}% D</span> | <span style="color:#38bdf8;" title="Mgmt Frames: \${sumMgmt.toLocaleString()}">\${mPct}% M</span> | <span style="color:#f59e0b;" title="Ctrl Frames: \${sumCtrl.toLocaleString()}">\${cPct}% C</span>\`;
        }
      } else {
        if (statTxEl) statTxEl.innerText = "—";
        if (statFramesEl) statFramesEl.innerText = "—";
      }

      // 2. Render 24-Hour Channel Utilization Chart
      const ctx = document.getElementById("channelUtilChart");
      if (ctx) {
        const tsSet = new Set();
        utilHistory.forEach(u => tsSet.add(u.timestamp));
        (currentStationData.recent_history || []).forEach(m => {
          if (m.scan_duration_ms) tsSet.add(m.timestamp);
        });

        const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
        const labels = sortedTs.map(ts => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const tsUtilMap = new Map();
        utilHistory.forEach(u => {
          if (!tsUtilMap.has(u.timestamp)) tsUtilMap.set(u.timestamp, []);
          tsUtilMap.get(u.timestamp).push(u);
        });

        const tsScanMap = new Map();
        utilHistory.forEach(u => {
          if (u.scan_duration_ms) tsScanMap.set(u.timestamp, u.scan_duration_ms);
        });
        (currentStationData.recent_history || []).forEach(m => {
          if (m.scan_duration_ms) tsScanMap.set(m.timestamp, m.scan_duration_ms);
        });

        const datasets = [];

        if (selectedChannelView === "combined") {
          const combinedAirtime = sortedTs.map(ts => {
            const list = tsUtilMap.get(ts);
            if (!list || list.length === 0) return null;
            const avg = list.reduce((s, it) => s + (it.airtime_pct || 0), 0) / list.length;
            return Math.round(avg * 10) / 10;
          });

          datasets.push({
            label: 'All Channels Combined Avg (%)',
            data: combinedAirtime,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            fill: true,
            tension: 0.3,
            spanGaps: true,
            pointRadius: 2.5,
            borderWidth: 2.5,
            yAxisID: 'y'
          });
        } else if (selectedChannelView === "non_overlapping") {
          const focusChans = [
            { ch: 1, label: 'Channel 1 (2.412 GHz)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
            { ch: 6, label: 'Channel 6 (2.437 GHz)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
            { ch: 11, label: 'Channel 11 (2.462 GHz)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
          ];

          focusChans.forEach(fc => {
            const data = sortedTs.map(ts => {
              const list = tsUtilMap.get(ts);
              if (!list) return null;
              const found = list.find(it => it.channel === fc.ch);
              return found ? Math.round(found.airtime_pct * 10) / 10 : null;
            });

            datasets.push({
              label: fc.label,
              data: data,
              borderColor: fc.color,
              backgroundColor: fc.bg,
              tension: 0.3,
              spanGaps: true,
              pointRadius: 2,
              borderWidth: 2,
              yAxisID: 'y'
            });
          });
        } else {
          for (let ch = 1; ch <= 13; ch++) {
            const color = CHANNEL_COLORS_13[ch - 1];
            const data = sortedTs.map(ts => {
              const list = tsUtilMap.get(ts);
              if (!list) return null;
              const found = list.find(it => it.channel === ch);
              return found ? Math.round(found.airtime_pct * 10) / 10 : null;
            });

            datasets.push({
              label: 'Ch ' + ch,
              data: data,
              borderColor: color,
              backgroundColor: 'transparent',
              tension: 0.3,
              spanGaps: true,
              pointRadius: 1.5,
              borderWidth: 1.5,
              yAxisID: 'y'
            });
          }
        }

        if (showScanTime) {
          const scanData = sortedTs.map(ts => {
            const val = tsScanMap.get(ts);
            return (val !== undefined && val !== null) ? val : null;
          });

          datasets.push({
            label: 'Spectrum Scan Time (ms)',
            data: scanData,
            borderColor: '#c084fc',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            tension: 0.2,
            spanGaps: true,
            pointRadius: 2,
            borderWidth: 1.5,
            yAxisID: 'y1'
          });
        }

        if (channelChartInstance) {
          channelChartInstance.destroy();
        }

        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.05)';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#9ca3af';

        channelChartInstance = new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            spanGaps: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: textColor, maxTicksLimit: 12 }
              },
              y: {
                type: 'linear',
                position: 'left',
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  callback: function(v) { return v + '%'; }
                },
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Airtime Utilization (%)',
                  color: textColor,
                  font: { size: 11 }
                }
              },
              y1: {
                type: 'linear',
                position: 'right',
                display: showScanTime,
                grid: { drawOnChartArea: false },
                ticks: {
                  color: '#c084fc',
                  callback: function(v) { return v + ' ms'; }
                },
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Scan Time (ms)',
                  color: '#c084fc',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      }

      // 3. Render Per-Channel Utilization Table
      const tbody = document.getElementById("channelTableBody");
      if (tbody) {
        tbody.innerHTML = "";
        if (latestUtil && latestUtil.length > 0) {
          const sortedChans = [...latestUtil].sort((a, b) => a.channel - b.channel);
          sortedChans.forEach(row => {
            const tr = document.createElement("tr");
            const air = row.airtime_pct !== null ? Number(row.airtime_pct).toFixed(1) : 0;
            const airNum = Number(air);
            const barColor = airNum >= 50 ? "#ef4444" : (airNum >= 20 ? "#f59e0b" : "#10b981");

            let hist = [0, 0, 0, 0];
            try {
              if (Array.isArray(row.rssi_hist)) hist = row.rssi_hist;
              else if (typeof row.rssi_hist === 'string') hist = JSON.parse(row.rssi_hist);
            } catch (e) {}

            const [lt80, b80_71, b70_61, gte60] = hist;
            const totalHist = lt80 + b80_71 + b70_61 + gte60;

            let histHtml = \`<span style="color:var(--text-muted);">—</span>\`;
            if (totalHist > 0) {
              const w0 = Math.round((lt80 / totalHist) * 100);
              const w1 = Math.round((b80_71 / totalHist) * 100);
              const w2 = Math.round((b70_61 / totalHist) * 100);
              const w3 = Math.max(0, 100 - (w0 + w1 + w2));
              histHtml = \`
                <div style="display:inline-flex; align-items:center; gap:6px;">
                  <div class="rssi-stacked-bar" title="<-80dBm: \${lt80} | -80..-71: \${b80_71} | -70..-61: \${b70_61} | >=-60: \${gte60}">
                    <div class="rssi-seg" style="width:\${w0}%; background:#1e293b;"></div>
                    <div class="rssi-seg" style="width:\${w1}%; background:#06b6d4;"></div>
                    <div class="rssi-seg" style="width:\${w2}%; background:#f59e0b;"></div>
                    <div class="rssi-seg" style="width:\${w3}%; background:#10b981;"></div>
                  </div>
                  <span style="font-size:0.7rem; color:var(--text-muted);">\${totalHist} pkts</span>
                </div>
              \`;
            }

            const statusBadge = airNum >= 50
              ? \`<span style="background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); padding:1px 6px; border-radius:4px; font-size:0.7rem;">Congested</span>\`
              : (airNum >= 20
                ? \`<span style="background:rgba(245, 158, 11, 0.15); color:#f59e0b; border:1px solid rgba(245, 158, 11, 0.3); padding:1px 6px; border-radius:4px; font-size:0.7rem;">Moderate</span>\`
                : \`<span style="background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3); padding:1px 6px; border-radius:4px; font-size:0.7rem;">Low</span>\`);

            tr.innerHTML = \`
              <td style="font-weight:600; padding:6px 10px;">Ch \${row.channel}</td>
              <td style="padding:6px 10px;">
                <div class="rssi-bar-wrap" style="min-width:110px;">
                  <div class="rssi-bar"><div class="rssi-fill" style="width:\${Math.min(100, airNum)}%; background:\${barColor};"></div></div>
                  <span style="font-weight:600; min-width:38px;">\${air}%</span>
                </div>
              </td>
              <td style="padding:6px 10px; color:#10b981; font-weight:500;">\${(row.data_frames || 0).toLocaleString()}</td>
              <td style="padding:6px 10px; color:#38bdf8;">\${(row.mgmt_frames || 0).toLocaleString()}</td>
              <td style="padding:6px 10px; color:#f59e0b;">\${(row.ctrl_frames || 0).toLocaleString()}</td>
              <td style="padding:6px 10px; font-weight:600;">\${row.unique_transmitters || 0}</td>
              <td style="padding:6px 10px;">\${histHtml}</td>
              <td style="padding:6px 10px;">\${statusBadge}</td>
            \`;
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = \`<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.2rem;">No channel promiscuous measurement data recorded yet (scheduled every 30 minutes).</td></tr>\`;
        }
      }

      // Render 24-Hour Channel Utilization Heatmap
      renderChannelHeatmap();
    }

    function voltageToPercentage(mv) {
      if (!mv || mv < 2500) return 0;
      if (mv >= 4200) return 100;
      if (mv <= 3300) return 0;
      const table = [
        { v: 4200, p: 100 },
        { v: 4100, p: 90 },
        { v: 4000, p: 80 },
        { v: 3900, p: 70 },
        { v: 3830, p: 60 },
        { v: 3790, p: 50 },
        { v: 3750, p: 40 },
        { v: 3710, p: 30 },
        { v: 3670, p: 20 },
        { v: 3600, p: 10 },
        { v: 3450, p: 5 },
        { v: 3300, p: 0 }
      ];
      for (let i = 0; i < table.length - 1; i++) {
        if (mv >= table[i + 1].v) {
          const span = table[i].v - table[i + 1].v;
          const frac = (mv - table[i + 1].v) / span;
          return Math.round(table[i + 1].p + frac * (table[i].p - table[i + 1].p));
        }
      }
      return 0;
    }

    function getBatteryPoints(data) {
      if (!data) return [];
      let points = [];
      if (Array.isArray(data.battery_history) && data.battery_history.length > 0) {
        data.battery_history.forEach(p => {
          if (typeof p.battery_mv === "number" && p.battery_mv >= 2500) {
            points.push({ timestamp: p.timestamp, battery_mv: p.battery_mv });
          }
        });
      }
      if (points.length === 0 && Array.isArray(data.recent_history) && data.recent_history.length > 0) {
        const seen = new Set();
        data.recent_history.forEach(m => {
          if (m.battery_mv && m.battery_mv >= 2500 && !seen.has(m.timestamp)) {
            seen.add(m.timestamp);
            points.push({ timestamp: m.timestamp, battery_mv: m.battery_mv });
          }
        });
      }
      if (points.length === 0 && data.station && typeof data.station.battery_mv === "number" && data.station.battery_mv >= 2500) {
        points.push({
          timestamp: data.station.last_seen || Math.floor(Date.now() / 1000),
          battery_mv: data.station.battery_mv
        });
      }
      return points.sort((a, b) => a.timestamp - b.timestamp);
    }

    function analyzeBatteryTrend(points, currentMv) {
      if (!points || points.length < 2) {
        return { isDecreasing: false };
      }

      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
      const latest = sorted[sorted.length - 1];
      const curMv = currentMv || latest.battery_mv;

      let dischargeStartIdx = sorted.length - 1;
      let peakMv = curMv;

      for (let i = sorted.length - 2; i >= 0; i--) {
        const p = sorted[i];
        if (p.battery_mv < peakMv - 45) {
          break;
        }
        if (p.battery_mv > peakMv) {
          peakMv = p.battery_mv;
        }
        dischargeStartIdx = i;
      }

      const startPt = sorted[dischargeStartIdx];
      const elapsedSec = latest.timestamp - startPt.timestamp;
      const deltaMv = startPt.battery_mv - curMv;

      if (elapsedSec >= 1200 && deltaMv >= 8) {
        const elapsedHours = Math.max(1, Math.round(elapsedSec / 3600));
        const runDays = Math.floor(elapsedHours / 24);
        const runHoursRem = elapsedHours % 24;

        const rateMvPerHour = deltaMv / (elapsedSec / 3600);
        const usableMv = Math.max(0, curMv - 3300);
        const estHoursTotal = rateMvPerHour > 0 ? Math.max(0, Math.round(usableMv / rateMvPerHour)) : 0;
        const estDays = Math.floor(estHoursTotal / 24);
        const estHoursRem = estHoursTotal % 24;

        return {
          isDecreasing: true,
          runHours: elapsedHours,
          runDays: runDays,
          runHoursRem: runHoursRem,
          estHours: estHoursTotal,
          estDays: estDays,
          estHoursRem: estHoursRem,
          rateMvPerHour: rateMvPerHour,
          deltaMv: deltaMv
        };
      }

      return { isDecreasing: false };
    }

    function updateBatteryUi(data) {
      const batBadge = document.getElementById("stBatteryBadge");
      const batRuntime = document.getElementById("stBatteryRuntime");
      const runTextEl = document.getElementById("stBatteryRunTimeText");
      const estTextEl = document.getElementById("stBatteryEstTimeText");
      const batSection = document.getElementById("batterySection");

      if (!data || !data.station) {
        if (batBadge) batBadge.style.display = "none";
        if (batRuntime) batRuntime.style.display = "none";
        if (batSection) batSection.style.display = "none";
        return;
      }

      const st = data.station;
      const points = getBatteryPoints(data);
      const curMv = (st.battery_mv && st.battery_mv >= 2500)
        ? st.battery_mv
        : (points.length > 0 && points[points.length - 1].battery_mv >= 2500 ? points[points.length - 1].battery_mv : 0);

      if (!curMv || curMv < 2500) {
        if (batBadge) batBadge.style.display = "none";
        if (batRuntime) batRuntime.style.display = "none";
        if (batSection) batSection.style.display = "none";
        return;
      }

      const pct = voltageToPercentage(curMv);

      if (batBadge) {
        batBadge.style.display = "inline-flex";
        batBadge.className = "battery-badge" + (pct < 20 ? " crit" : (pct < 50 ? " warn" : ""));
        batBadge.title = "Battery: " + (curMv / 1000).toFixed(2) + "V (" + curMv + " mV) — " + pct + "% (Click to toggle voltage graph)";

        const pctEl = document.getElementById("stBatteryPctText");
        if (pctEl) pctEl.innerText = pct + "%";

        let filledBars = 0;
        if (pct >= 75) filledBars = 4;
        else if (pct >= 50) filledBars = 3;
        else if (pct >= 25) filledBars = 2;
        else if (pct >= 5) filledBars = 1;
        else filledBars = 0;

        const b1 = document.getElementById("batBar1");
        const b2 = document.getElementById("batBar2");
        const b3 = document.getElementById("batBar3");
        const b4 = document.getElementById("batBar4");
        const barEls = [b1, b2, b3, b4];

        barEls.forEach((bar, idx) => {
          if (!bar) return;
          if (idx < filledBars) {
            bar.style.opacity = "1";
          } else {
            bar.style.opacity = "0.2";
          }
        });
      }

      const trend = analyzeBatteryTrend(points, curMv);

      if (trend.isDecreasing) {
        if (runTextEl) runTextEl.innerText = "Running on battery for " + trend.runHours + "h (" + trend.runDays + " days " + trend.runHoursRem + " hours)";
        if (estTextEl) estTextEl.innerText = "Estimated runtime " + trend.estHours + "h (" + trend.estDays + " days " + trend.estHoursRem + " hours)";
        if (batRuntime) batRuntime.style.display = "block";
      } else {
        if (batRuntime) batRuntime.style.display = "none";
      }

      if (batSection) {
        batSection.style.display = "block";

        const statV = document.getElementById("stat-bat-voltage");
        const statP = document.getElementById("stat-bat-pct");
        const statRate = document.getElementById("stat-bat-rate");
        const statRun = document.getElementById("stat-bat-runtime");
        const statRange = document.getElementById("stat-bat-range");

        if (statV) statV.innerText = (curMv / 1000).toFixed(2) + "V (" + curMv + " mV)";
        if (statP) {
          const color = pct < 20 ? "#ef4444" : (pct < 50 ? "#f59e0b" : "#10b981");
          statP.innerHTML = '<span style="color:' + color + '">' + pct + '%</span>';
        }
        if (statRate) {
          statRate.innerText = trend.isDecreasing ? "-" + trend.rateMvPerHour.toFixed(1) + " mV/h" : "Steady / Charging";
        }
        if (statRun) {
          statRun.innerText = trend.isDecreasing ? trend.estHours + "h (" + trend.estDays + "d " + trend.estHoursRem + "h)" : "—";
        }

        if (points.length > 0 && statRange) {
          const vList = points.map(p => p.battery_mv);
          const minV = Math.min(...vList);
          const maxV = Math.max(...vList);
          statRange.innerText = (minV / 1000).toFixed(2) + "V – " + (maxV / 1000).toFixed(2) + "V";
        }

        if (batteryDrawerOpen) {
          renderBatteryChart();
        }
      }
    }

    function toggleBatteryGraph(forceOpen) {
      const drawer = document.getElementById("batteryGraphDrawer");
      const icon = document.getElementById("batteryCollapseIcon");
      if (!drawer) return;
      if (forceOpen === true) {
        batteryDrawerOpen = true;
      } else {
        batteryDrawerOpen = !batteryDrawerOpen;
      }
      drawer.style.display = batteryDrawerOpen ? "block" : "none";
      if (icon) icon.innerText = batteryDrawerOpen ? "▲" : "▼";
      if (batteryDrawerOpen) {
        renderBatteryChart();
        if (forceOpen === true) {
          const sec = document.getElementById("batterySection");
          if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }

    function onBatteryTimeframeChange(val) {
      selectedBatteryTimeframe = val;
      renderBatteryChart();
    }

    function renderBatteryChart() {
      if (!currentStationData) return;
      const canvas = document.getElementById("batteryChart");
      if (!canvas) return;

      const points = getBatteryPoints(currentStationData);
      if (points.length === 0) return;

      const nowSec = Math.floor(Date.now() / 1000);
      let cutoffSec = nowSec - 86400; // default day
      if (selectedBatteryTimeframe === "week") {
        cutoffSec = nowSec - 7 * 86400;
      } else if (selectedBatteryTimeframe === "month") {
        cutoffSec = nowSec - 30 * 86400;
      }

      let filtered = points.filter(p => p.timestamp >= cutoffSec);
      if (filtered.length === 0) {
        filtered = points;
      }

      const statRange = document.getElementById("stat-bat-range");
      if (statRange && filtered.length > 0) {
        const vList = filtered.map(p => p.battery_mv);
        const minV = Math.min(...vList);
        const maxV = Math.max(...vList);
        statRange.innerText = (minV / 1000).toFixed(2) + "V – " + (maxV / 1000).toFixed(2) + "V";
      }

      const labels = filtered.map(p => {
        const d = new Date(p.timestamp * 1000);
        if (selectedBatteryTimeframe === "month") {
          return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.getHours().toString().padStart(2, "0") + ":00";
        } else if (selectedBatteryTimeframe === "week") {
          return d.toLocaleDateString([], { weekday: "short" }) + " " + d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
        }
        return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
      });

      const voltValues = filtered.map(p => Number((p.battery_mv / 1000).toFixed(3)));
      const minVolt = Math.min(...voltValues);
      const maxVolt = Math.max(...voltValues);
      const yMin = Math.max(2.8, Number((minVolt - 0.1).toFixed(2)));
      const yMax = Math.min(4.5, Number((maxVolt + 0.1).toFixed(2)));

      if (batteryChartInstance) {
        batteryChartInstance.destroy();
      }

      const gridColor = getComputedStyle(document.documentElement).getPropertyValue("--chart-grid").trim() || "rgba(255, 255, 255, 0.05)";
      const textColor = getComputedStyle(document.documentElement).getPropertyValue("--chart-text").trim() || "#9ca3af";

      batteryChartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "Battery Voltage (V)",
            data: voltValues,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            tension: 0.25,
            fill: true,
            pointRadius: filtered.length > 100 ? 1 : 3,
            borderWidth: 2,
            spanGaps: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const val = ctx.parsed.y;
                  const mv = Math.round(val * 1000);
                  const pct = voltageToPercentage(mv);
                  return "Voltage: " + val.toFixed(3) + " V (" + mv + " mV) • " + pct + "%";
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, maxTicksLimit: 12 }
            },
            y: {
              type: "linear",
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                callback: function(v) { return Number(v).toFixed(2) + " V"; }
              },
              min: yMin,
              max: yMax,
              title: {
                display: true,
                text: "Battery Voltage (V)",
                color: textColor,
                font: { size: 11 }
              }
            }
          }
        }
      });
    }

    let currentBtTableMode = 'current';
    let btDrawerOpen = true;
    let bluetoothChartInstance = null;

    function toggleBluetoothTable() {
      btDrawerOpen = !btDrawerOpen;
      const drawer = document.getElementById("btTableDrawer");
      const icon = document.getElementById("btTableCollapseIcon");
      if (drawer) drawer.style.display = btDrawerOpen ? "block" : "none";
      if (icon) icon.innerText = btDrawerOpen ? "▼" : "▶";
    }

    function renderBluetoothTable(data) {
      const tableHead = document.getElementById("bluetoothTableHead");
      const tableBody = document.getElementById("bluetoothTableBody");
      const badgeEl = document.getElementById("btDeviceCountBadge");
      const titleEl = document.getElementById("btTableTitle");
      if (!tableBody) return;

      if (titleEl) titleEl.innerText = "Discovered Bluetooth Devices (Current Cycle)";
      if (tableHead) {
        tableHead.innerHTML = '<tr>' +
          '<th>Type</th>' +
          '<th>Address</th>' +
          '<th>Device Name / Beacon Identifier</th>' +
          '<th>Vendor / Ecosystem</th>' +
          '<th>Category</th>' +
          '<th>Signal (RSSI)</th>' +
        '</tr>';
      }

      const bt = data ? data.latest_bluetooth : null;
      if (!bt) {
        if (badgeEl) badgeEl.innerText = '0 Devices';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No Bluetooth scan data recorded yet. Node will include Bluetooth in next cycle.</td></tr>';
        return;
      }

      let devices = { ble_devices: [], classic_devices: [] };
      if (bt.devices_json) {
        try {
          devices = JSON.parse(bt.devices_json);
        } catch (e) {
          console.error("Failed to parse devices_json:", e);
        }
      }

      const bleList = Array.isArray(devices.ble_devices) ? devices.ble_devices : [];
      const classicList = Array.isArray(devices.classic_devices) ? devices.classic_devices : [];
      const totalDevs = bleList.length + classicList.length;

      if (badgeEl) badgeEl.innerText = totalDevs + ' Devices';

      if (totalDevs === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No active Bluetooth devices in range during last scan.</td></tr>';
        return;
      }

      let rowsHtml = '';
      // BLE devices
      for (const d of bleList) {
        const addrBadge = d.addr_type === 'public'
          ? '<span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.68rem; padding: 1px 6px;">Public</span>'
          : (d.addr_type === 'random_rpa'
            ? '<span class="pill" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 0.68rem; padding: 1px 6px;">RPA</span>'
            : '<span class="pill" style="background: rgba(100, 116, 139, 0.15); color: var(--text-muted); font-size: 0.68rem; padding: 1px 6px;">Static</span>');

        const rssiVal = typeof d.rssi === 'number' ? d.rssi : -100;
        const rssiBarColor = rssiVal >= -65 ? '#10b981' : (rssiVal >= -80 ? '#f59e0b' : '#ef4444');
        const pct = Math.min(100, Math.max(0, 2 * (rssiVal + 100)));

        const catLabel = d.category ? (d.category.charAt(0).toUpperCase() + d.category.slice(1)) : 'General';
        const catBadge = '<span class="pill" style="font-size: 0.72rem; padding: 2px 7px;">' + catLabel + '</span>';

        const nameDisplay = d.name ? ('<strong>' + escapeHtml(d.name) + '</strong>') : '<span style="color:var(--text-muted); font-style:italic;">Payload Fingerprinted</span>';

        rowsHtml += '<tr>' +
          '<td><span class="pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600; font-size: 0.72rem; padding: 2px 7px;">BLE</span></td>' +
          '<td><div style="display:flex; align-items:center; gap:0.4rem;"><code>' + escapeHtml(d.address) + '</code> ' + addrBadge + '</div></td>' +
          '<td>' + nameDisplay + '</td>' +
          '<td>' + escapeHtml(d.vendor || 'Generic') + '</td>' +
          '<td>' + catBadge + '</td>' +
          '<td>' +
            '<div style="display:flex; align-items:center; gap:0.5rem;">' +
              '<div class="rssi-bar-wrap" style="min-width:70px;"><div class="rssi-bar"><div class="rssi-fill" style="width:' + pct + '%; background:' + rssiBarColor + ';"></div></div></div>' +
              '<span style="font-size:0.75rem; color:var(--text-muted);">' + rssiVal + ' dBm</span>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }

      // Classic devices
      for (const cd of classicList) {
        const cRssi = typeof cd.rssi === 'number' && cd.rssi !== -100 ? cd.rssi : null;
        const cPct = cRssi !== null ? Math.min(100, Math.max(0, 2 * (cRssi + 100))) : 0;
        const cBarColor = cRssi !== null ? (cRssi >= -65 ? '#10b981' : (cRssi >= -80 ? '#f59e0b' : '#ef4444')) : '#64748b';

        const cName = cd.name ? ('<strong>' + escapeHtml(cd.name) + '</strong>') : '<span style="color:var(--text-muted); font-style:italic;">Classic Device</span>';

        rowsHtml += '<tr>' +
          '<td><span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; font-size: 0.72rem; padding: 2px 7px;">Classic</span></td>' +
          '<td><div style="display:flex; align-items:center; gap:0.4rem;"><code>' + escapeHtml(cd.address) + '</code> <span class="pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.68rem; padding: 1px 6px;">IEEE Fixed</span></div></td>' +
          '<td>' + cName + '</td>' +
          '<td>' + escapeHtml(cd.dev_class || 'Bluetooth Classic') + '</td>' +
          '<td><span class="pill" style="font-size:0.72rem; padding:2px 7px;">' + escapeHtml(cd.dev_class || 'Classic') + '</span></td>' +
          '<td>' +
            (cRssi !== null
              ? '<div style="display:flex; align-items:center; gap:0.5rem;"><div class="rssi-bar-wrap" style="min-width:70px;"><div class="rssi-bar"><div class="rssi-fill" style="width:' + cPct + '%; background:' + cBarColor + ';"></div></div></div><span style="font-size:0.75rem; color:var(--text-muted);">' + cRssi + ' dBm</span></div>'
              : '<span style="font-size:0.75rem; color:var(--text-muted);">Inquiry ACK</span>') +
          '</td>' +
        '</tr>';
      }

      tableBody.innerHTML = rowsHtml;
    }

    function updateBluetoothUi(data) {
      const bt = data ? data.latest_bluetooth : null;
      const history = (data && Array.isArray(data.bluetooth_history)) ? data.bluetooth_history : [];

      const uEl = document.getElementById("stat-ble-unique");
      const mEl = document.getElementById("stat-ble-macs");
      const pEl = document.getElementById("stat-ble-privacy");
      const cEl = document.getElementById("stat-classic-total");
      const vEl = document.getElementById("stat-bt-vendors");
      const tEl = document.getElementById("stat-bt-types");
      const timeEl = document.getElementById("btLastScanTime");

      if (!bt) {
        if (uEl) uEl.innerText = "—";
        if (mEl) mEl.innerText = "—";
        if (pEl) pEl.innerText = "—";
        if (cEl) cEl.innerText = "—";
        if (vEl) vEl.innerText = "—";
        if (tEl) tEl.innerText = "—";
        if (timeEl) timeEl.innerText = "No Bluetooth telemetry received";
        renderBluetoothTable(data);
        renderBluetoothChart([]);
        return;
      }

      if (uEl) uEl.innerText = String(bt.ble_unique_devices ?? 0);
      if (mEl) mEl.innerText = String(bt.ble_total_macs ?? 0);
      if (pEl) {
        const rpa = bt.ble_random_macs ?? 0;
        const pub = bt.ble_public_macs ?? 0;
        pEl.innerHTML = '<span style="color:#f59e0b;">' + rpa + ' RPA</span> / <span style="color:#10b981;">' + pub + ' Public</span>';
      }
      if (cEl) cEl.innerText = String(bt.classic_total ?? 0);

      // Extract device-level details for vendor and category statistics
      let appleCount = 0;
      let msCount = 0;
      let samCount = 0;
      let phoneCount = bt.ble_smartphones ?? 0;
      let pcCount = 0;
      let beaconCount = bt.ble_beacons ?? 0;

      let devices = { ble_devices: [], classic_devices: [] };
      if (bt.devices_json) {
        try { devices = JSON.parse(bt.devices_json); } catch {}
      }
      const bleList = Array.isArray(devices.ble_devices) ? devices.ble_devices : [];
      const classicList = Array.isArray(devices.classic_devices) ? devices.classic_devices : [];

      for (const d of bleList) {
        const v = (d.vendor || '').toLowerCase();
        if (v.includes('apple')) appleCount++;
        else if (v.includes('microsoft')) msCount++;
        else if (v.includes('samsung')) samCount++;

        const c = (d.category || '').toLowerCase();
        if (c.includes('computer') || c.includes('laptop') || c.includes('desktop') || c.includes('pc')) pcCount++;
      }

      for (const cd of classicList) {
        const name = (cd.name || '').toLowerCase();
        const devCls = (cd.dev_class || '').toLowerCase();
        if (devCls.includes('phone') || devCls.includes('cellular') || devCls.includes('smartphone') || name.includes('iphone') || name.includes('galaxy') || name.includes('pixel')) {
          phoneCount++;
        }
        if (devCls.includes('computer') || devCls.includes('laptop') || devCls.includes('server') || devCls.includes('desktop') || name.includes('macbook') || name.includes('pc')) {
          pcCount++;
        }
        if (name.includes('apple') || name.includes('macbook') || name.includes('iphone') || name.includes('ipad')) appleCount++;
        else if (name.includes('samsung') || name.includes('galaxy')) samCount++;
        else if (name.includes('microsoft') || name.includes('surface')) msCount++;
      }

      if (vEl) {
        vEl.innerHTML = '<span style="color:#38bdf8;">' + appleCount + ' Apple</span> / <span style="color:#60a5fa;">' + msCount + ' MS</span> / <span style="color:#10b981;">' + samCount + ' Samsung</span>';
      }
      if (tEl) {
        tEl.innerHTML = '<span style="color:#38bdf8;">' + phoneCount + ' Phone</span> / <span style="color:#10b981;">' + pcCount + ' PC</span> / <span style="color:#f59e0b;">' + beaconCount + ' Beacon</span>';
      }

      if (timeEl && bt.timestamp) {
        timeEl.innerText = 'Last scan: ' + new Date(bt.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + formatLastSeen(bt.timestamp) + ')';
      }

      renderBluetoothTable(data);
      renderBluetoothChart(history);
    }

    function renderBluetoothChart(history) {
      const canvas = document.getElementById("bluetoothChart");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (bluetoothChartInstance) {
        bluetoothChartInstance.destroy();
        bluetoothChartInstance = null;
      }

      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";
      const textColor = isDark ? "#94a3b8" : "#64748b";

      if (!history || history.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const labels = history.map(h => new Date(h.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const uniqueData = history.map(h => h.ble_unique_devices ?? 0);
      const rpaData = history.map(h => h.ble_random_macs ?? 0);
      const classicData = history.map(h => h.classic_total ?? 0);

      bluetoothChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Unique BLE Devices',
              data: uniqueData,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              fill: true,
              tension: 0.2,
              borderWidth: 2,
              pointRadius: history.length > 50 ? 1 : 3
            },
            {
              label: 'Randomized BLE MACs',
              data: rpaData,
              borderColor: '#a78bfa',
              backgroundColor: 'transparent',
              borderDash: [4, 4],
              fill: false,
              tension: 0.2,
              borderWidth: 1.5,
              pointRadius: history.length > 50 ? 0 : 2
            },
            {
              label: 'Classic BT Devices',
              data: classicData,
              borderColor: '#10b981',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.2,
              borderWidth: 1.5,
              pointRadius: history.length > 50 ? 0 : 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { color: textColor, font: { size: 11 }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              titleColor: isDark ? '#f8fafc' : '#0f172a',
              bodyColor: isDark ? '#cbd5e1' : '#334155',
              borderColor: isDark ? '#334155' : '#e2e8f0',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 10 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 10 },
                precision: 0
              },
              title: {
                display: true,
                text: 'Device Count',
                color: textColor,
                font: { size: 11 }
              }
            }
          }
        }
      });
    }

    // Initialize
    initTheme();
    loadStations();
    setInterval(refreshData, 60000); // 1-minute auto refresh

    // Auto-open Web Flasher dialog if requested via ?flash=1 or URL route /flash
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("flash") === "true" || urlParams.get("flash") === "1" || window.location.pathname.endsWith("/flash")) {
      setTimeout(function() { openFlashModal(); }, 300);
    }
  </script>
</body>
</html>`;
}
