/**
 * T18 Network Reliability Monitor Dashboard
 * Renders 53-day x 24-hour heatmap from static JSON telemetry
 * Supports Local Time (Vietnam ICT / UTC+7) and UTC
 */

const DAYS_TO_SHOW = 53;
const HOURS_IN_DAY = 24;

let stations = [];
let currentStation = null;
let currentTelemetryData = new Map();
let currentTzOffset = 7; // Default: Vietnam UTC+7

// Elements
const stationSelect = document.getElementById('station-select');
const timezoneSelect = document.getElementById('timezone-select');
const metaName = document.getElementById('meta-name');
const metaLocation = document.getElementById('meta-location');
const metaSsid = document.getElementById('meta-ssid');
const metaFallback = document.getElementById('meta-fallback');
const metaBattery = document.getElementById('meta-battery');
const metaNetworks = document.getElementById('meta-networks');
const metaLastSeen = document.getElementById('meta-last-seen');
const heatmapContainer = document.getElementById('heatmap-container');
const detailTitle = document.getElementById('detail-title');
const detailStats = document.getElementById('detail-stats');
const tooltip = document.getElementById('tooltip');
const tzIndicator = document.getElementById('tz-indicator');
const footerAxisNote = document.getElementById('footer-axis-note');

/**
 * Fetch helper with fallback to relative or parent path
 */
async function fetchJsonWithFallback(path) {
  try {
    const res = await fetch(path);
    if (res.ok) return await res.json();
  } catch (e) {
    // try alternative path
  }

  const alternativePath = path.startsWith('../') ? path.replace('../', './') : `../${path}`;
  const res2 = await fetch(alternativePath);
  if (!res2.ok) throw new Error(`Failed to load ${path}`);
  return await res2.json();
}

/**
 * Load stations registry
 */
async function loadStations() {
  try {
    stations = await fetchJsonWithFallback('../data/stations.json');
    stationSelect.innerHTML = '';

    stations.forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st.id;
      opt.textContent = `${st.name || st.id} (${st.id})`;
      stationSelect.appendChild(opt);
    });

    if (stations.length > 0) {
      selectStation(stations[0].id);
    }
  } catch (err) {
    console.warn('Could not load stations.json directly, falling back to mock view', err);
    stationSelect.innerHTML = '<option value="C-703">Room C-703 (Sample)</option>';
    stations = [{
      id: "C-703",
      name: "Room C-703",
      location: "Building C, Room 703",
      monitored_network: "School-Guest",
      fallback_network: "S24",
      battery_mv: 3980,
      battery_pct: 82,
      last_seen: new Date().toISOString()
    }];
    selectStation("C-703");
  }
}

/**
 * Handle station selection
 */
async function selectStation(stationId) {
  currentStation = stations.find(s => s.id === stationId);
  if (!currentStation) return;

  metaName.textContent = currentStation.name || currentStation.id;
  metaLocation.textContent = currentStation.location || 'Unknown';
  metaSsid.textContent = currentStation.monitored_network || 'Default';
  if (metaFallback) metaFallback.textContent = currentStation.fallback_network || 'S24';
  metaBattery.textContent = `${(currentStation.battery_mv / 1000).toFixed(2)}V (${currentStation.battery_pct}%)`;
  if (metaNetworks) metaNetworks.textContent = currentStation.visible_networks ? `${currentStation.visible_networks} SSIDs` : '12 SSIDs';
  metaLastSeen.textContent = currentStation.last_seen ? formatDateTime(new Date(currentStation.last_seen)) : 'N/A';

  await loadStationData(stationId);
  renderHeatmap();
}

/**
 * Format a Date object taking into account the selected timezone offset
 */
function formatDateTime(date) {
  const localMs = date.getTime() + currentTzOffset * 3600000;
  const d = new Date(localMs);
  const tzSuffix = currentTzOffset === 7 ? 'ICT (UTC+7)' : 'UTC';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} ${tzSuffix}`;
}

/**
 * Load monthly JSON files for the 53-day window
 */
async function loadStationData(stationId) {
  currentTelemetryData.clear();
  const monthsToLoad = new Set();

  // Determine reference dates from current station metadata and browser time
  const refDates = [new Date()];
  if (currentStation && currentStation.last_seen) {
    const lsDate = new Date(currentStation.last_seen);
    if (!isNaN(lsDate.getTime())) {
      refDates.push(lsDate);
    }
  }

  for (const ref of refDates) {
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const d = new Date(ref);
      d.setDate(d.getDate() - i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      monthsToLoad.add(`${yyyy}-${mm}`);
    }
  }

  for (const ym of monthsToLoad) {
    try {
      const data = await fetchJsonWithFallback(`../data/${stationId}/${ym}.json`);
      if (data && data.hours) {
        Object.entries(data.hours).forEach(([isoHour, record]) => {
          currentTelemetryData.set(isoHour, record);
        });
      }
    } catch (e) {
      // Month file may not exist yet
    }
  }
}

/**
 * Render the 53-day x 24-hour grid in the selected timezone
 */
function renderHeatmap() {
  heatmapContainer.innerHTML = '';

  const tzLabel = currentTzOffset === 7 ? 'Local Time (ICT / UTC+7)' : 'Universal Time (UTC)';
  tzIndicator.textContent = currentTzOffset === 7
    ? 'Showing local time (UTC+7) • 08:00–18:00 High Activity / Working Hours'
    : 'Showing UTC • 01:00–11:00 corresponds to Vietnam working hours';
  footerAxisNote.textContent = `Rows 00:00 – 23:00 (${tzLabel})`;

  // 1. Hour axis (00 to 23)
  const hourAxis = document.createElement('div');
  hourAxis.className = 'hour-axis-column';
  
  const axisHeader = document.createElement('div');
  axisHeader.className = 'day-header';
  axisHeader.textContent = '';
  hourAxis.appendChild(axisHeader);

  for (let h = 0; h < HOURS_IN_DAY; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'hour-axis-label';
    const isDaytime = (currentTzOffset === 7) ? (h >= 8 && h < 18) : (h >= 1 && h < 11);
    if (isDaytime) lbl.classList.add('daytime');

    if (h % 3 === 0 || h === 8 || h === 18) {
      lbl.textContent = `${String(h).padStart(2, '0')}:00`;
    }
    hourAxis.appendChild(lbl);
  }
  heatmapContainer.appendChild(hourAxis);

  // 2. 53 Day Columns
  // Anchor the 53-day grid to the station's latest recorded telemetry or last_seen
  let anchorDate = new Date();
  if (currentTelemetryData.size > 0) {
    let maxTs = 0;
    for (const isoKey of currentTelemetryData.keys()) {
      const ts = new Date(isoKey).getTime();
      if (ts > maxTs) maxTs = ts;
    }
    if (maxTs > 0) anchorDate = new Date(maxTs);
  } else if (currentStation && currentStation.last_seen) {
    const parsed = new Date(currentStation.last_seen);
    if (!isNaN(parsed.getTime())) anchorDate = parsed;
  }

  // Adjust anchor to local calendar date
  const localNow = new Date(anchorDate.getTime() + currentTzOffset * 3600000);
  const localTodayMidnight = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, 0, 0));

  for (let dayOffset = DAYS_TO_SHOW - 1; dayOffset >= 0; dayOffset--) {
    const colDate = new Date(localTodayMidnight);
    colDate.setUTCDate(colDate.getUTCDate() - dayOffset);

    const dayCol = document.createElement('div');
    dayCol.className = 'day-column';

    // Day Header
    const header = document.createElement('div');
    header.className = 'day-header';
    if (dayOffset % 7 === 0 || dayOffset === 0) {
      header.textContent = `${colDate.getUTCMonth() + 1}/${colDate.getUTCDate()}`;
    }
    dayCol.appendChild(header);

    // 24 Hour cells
    for (let h = 0; h < HOURS_IN_DAY; h++) {
      // Local date & hour
      const localSlot = new Date(colDate);
      localSlot.setUTCHours(h);

      // Convert back to UTC to match JSON hour keys
      const utcSlot = new Date(localSlot.getTime() - currentTzOffset * 3600000);
      const isoHourUTC = utcSlot.toISOString().replace(/:\d\d\.\d\d\dZ$/, ':00:00Z');

      const cell = document.createElement('div');
      cell.className = 'cell';

      const isDaytime = (currentTzOffset === 7) ? (h >= 8 && h < 18) : (h >= 1 && h < 11);
      if (isDaytime) cell.classList.add('daytime-cell');

      const record = currentTelemetryData.get(isoHourUTC);
      if (record) {
        cell.classList.add(`color-${record.status || 'gray'}`);
      } else {
        cell.classList.add('color-gray');
      }

      cell.addEventListener('mouseenter', (e) => showTooltip(e, localSlot, isoHourUTC, record));
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', () => showDetail(localSlot, isoHourUTC, record));

      dayCol.appendChild(cell);
    }

    heatmapContainer.appendChild(dayCol);
  }
}

function showTooltip(e, localSlot, isoHourUTC, record) {
  const tzSuffix = currentTzOffset === 7 ? 'ICT (UTC+7)' : 'UTC';
  const localFormatted = `${localSlot.getUTCFullYear()}-${String(localSlot.getUTCMonth()+1).padStart(2,'0')}-${String(localSlot.getUTCDate()).padStart(2,'0')} ${String(localSlot.getUTCHours()).padStart(2,'0')}:00 ${tzSuffix}`;

  if (!record) {
    tooltip.innerHTML = `<strong>${localFormatted}</strong><br><span style="color:#8b949e">No telemetry data recorded</span>`;
  } else {
    tooltip.innerHTML = `
      <strong>${localFormatted}</strong><br>
      Status: <span style="text-transform:capitalize;font-weight:600">${record.status}</span><br>
      Success Rate: ${record.successful} / ${record.samples} probes<br>
      Assoc Time: ${record.avg_assoc_ms || 0} ms<br>
      DHCP Time: ${record.avg_dhcp_ms || 0} ms<br>
      HTTP Latency: ${record.avg_http_latency_ms || 0} ms<br>
      Battery: ${(record.avg_battery_mv / 1000).toFixed(2)} V
    `;
  }

  tooltip.style.display = 'block';
  tooltip.style.left = `${e.clientX + 12}px`;
  tooltip.style.top = `${e.clientY + 12}px`;
}

function hideTooltip() {
  tooltip.style.display = 'none';
}

function showDetail(localSlot, isoHourUTC, record) {
  const tzSuffix = currentTzOffset === 7 ? 'ICT (UTC+7)' : 'UTC';
  const localFormatted = `${localSlot.getUTCFullYear()}-${String(localSlot.getUTCMonth()+1).padStart(2,'0')}-${String(localSlot.getUTCDate()).padStart(2,'0')} @ ${String(localSlot.getUTCHours()).padStart(2,'0')}:00 ${tzSuffix}`;
  detailTitle.textContent = `Telemetry Detail for ${localFormatted} [${isoHourUTC}]`;

  if (!record) {
    detailStats.innerHTML = `<p class="muted">No probe data recorded for this hourly slot.</p>`;
    return;
  }

  detailStats.innerHTML = `
    <div class="stat-pill">
      <div class="stat-label">Hourly Health Status</div>
      <div class="stat-val" style="color: var(--color-${record.status})">${record.status.toUpperCase()}</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Probe Success Rate</div>
      <div class="stat-val">${record.successful} / ${record.samples} (${Math.round((record.successful / record.samples) * 100)}%)</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Avg Wi-Fi Assoc Time</div>
      <div class="stat-val">${record.avg_assoc_ms} ms</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Avg DHCP Lease Time</div>
      <div class="stat-val">${record.avg_dhcp_ms} ms</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Avg HTTP Roundtrip</div>
      <div class="stat-val">${record.avg_http_latency_ms} ms</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Average Signal (RSSI)</div>
      <div class="stat-val">${record.avg_rssi ? record.avg_rssi + ' dBm' : 'N/A'}</div>
    </div>
    <div class="stat-pill">
      <div class="stat-label">Battery Voltage</div>
      <div class="stat-val">${(record.avg_battery_mv / 1000).toFixed(2)} V</div>
    </div>
  `;
}

// Event Listeners
stationSelect.addEventListener('change', (e) => selectStation(e.target.value));
timezoneSelect.addEventListener('change', (e) => {
  currentTzOffset = parseInt(e.target.value, 10);
  renderHeatmap();
});

// Init
document.addEventListener('DOMContentLoaded', loadStations);
