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
const metaSsidContainer = document.getElementById('meta-ssid-container');
const metaBattery = document.getElementById('meta-battery');
const metaNetworks = document.getElementById('meta-networks');
const cardVisibleNetworks = document.getElementById('card-visible-networks');
const metaLastSeen = document.getElementById('meta-last-seen');
const heatmapContainer = document.getElementById('heatmap-container');
const detailTitle = document.getElementById('detail-title');
const detailStats = document.getElementById('detail-stats');
const tooltip = document.getElementById('tooltip');
const tzIndicator = document.getElementById('tz-indicator');
const footerAxisNote = document.getElementById('footer-axis-note');

// Modal Elements
const networksModal = document.getElementById('networks-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCloseFooterBtn = document.getElementById('modal-close-footer-btn');
const surveyDateSelect = document.getElementById('survey-date-select');
const surveyFilterInput = document.getElementById('survey-filter-input');
const surveyStatsPill = document.getElementById('survey-stats-pill');
const surveyTableBody = document.getElementById('survey-table-body');

let stationNetworksData = null;
let currentSurveyDay = null;

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
 * Load version metadata dynamically from repository
 */
async function loadVersion() {
  try {
    const data = await fetchJsonWithFallback('version.json');
    if (data && data.version) {
      const vStr = `v${data.version}`;
      const vBadge = document.getElementById('app-version');
      if (vBadge) vBadge.textContent = vStr;
      const vFooter = document.getElementById('footer-version');
      if (vFooter) vFooter.textContent = vStr;
    }
  } catch (err) {
    console.warn('Could not load version.json', err);
  }
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

  // Render multiple monitored Wi-Fi network pills
  const networks = currentStation.monitored_networks || (currentStation.monitored_network ? [currentStation.monitored_network] : ['Default']);
  if (metaSsidContainer) {
    metaSsidContainer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'wifi-pills-wrap';
    networks.forEach(net => {
      const pill = document.createElement('span');
      pill.className = 'wifi-pill';
      pill.textContent = net;
      wrap.appendChild(pill);
    });
    metaSsidContainer.appendChild(wrap);
  } else if (metaSsid) {
    metaSsid.textContent = networks.join(', ');
  }

  metaBattery.textContent = `${(currentStation.battery_mv / 1000).toFixed(2)}V (${currentStation.battery_pct}%)`;
  if (metaNetworks) metaNetworks.textContent = currentStation.visible_networks ? `${currentStation.visible_networks} SSIDs (Click to view)` : '12 SSIDs';
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
          const normKey = isoHour.slice(0, 13) + ':00:00Z';
          currentTelemetryData.set(normKey, record);
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
      const isoHourUTC = utcSlot.toISOString().slice(0, 13) + ':00:00Z';

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

/**
 * Dark / Light Theme Manager
 */
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');

  function getPreferredTheme() {
    const saved = localStorage.getItem('t18_theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (label) label.textContent = 'Dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (label) label.textContent = 'Light';
    }
    localStorage.setItem('t18_theme', theme);
  }

  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      applyTheme(isLight ? 'dark' : 'light');
    });
  }
}

/**
 * Visible Networks Spectrum Modal
 */
async function openNetworksModal() {
  if (!currentStation) return;
  networksModal.classList.add('open');
  networksModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  modalTitle.textContent = `Visible Wi-Fi Spectrum Survey`;
  modalSubtitle.textContent = `Station ${currentStation.name || currentStation.id} (${currentStation.id}) • Daily Relative Signal Strength & Visibility`;

  surveyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Loading daily network survey...</td></tr>`;
  surveyStatsPill.textContent = 'Scanning...';

  try {
    stationNetworksData = await fetchJsonWithFallback(`../data/${currentStation.id}/networks.json`);
    populateSurveyDates();
  } catch (err) {
    console.warn('Could not load networks.json for station', err);
    surveyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">No network survey data recorded for this station yet.</td></tr>`;
    surveyStatsPill.textContent = '0 networks';
  }
}

function closeNetworksModal() {
  networksModal.classList.remove('open');
  networksModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function populateSurveyDates() {
  surveyDateSelect.innerHTML = '';
  if (!stationNetworksData || !stationNetworksData.daily) {
    surveyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">No network survey data recorded.</td></tr>`;
    return;
  }

  const days = Object.keys(stationNetworksData.daily).sort().reverse();
  if (days.length === 0) {
    surveyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">No network survey data recorded.</td></tr>`;
    return;
  }

  days.forEach(day => {
    const opt = document.createElement('option');
    opt.value = day;
    const count = stationNetworksData.daily[day].networks ? stationNetworksData.daily[day].networks.length : 0;
    opt.textContent = `${day} (${count} SSIDs detected)`;
    surveyDateSelect.appendChild(opt);
  });

  currentSurveyDay = days[0];
  surveyDateSelect.value = currentSurveyDay;
  renderSurveyTable();
}

function renderSurveyTable() {
  if (!stationNetworksData || !stationNetworksData.daily || !currentSurveyDay) return;
  const dayData = stationNetworksData.daily[currentSurveyDay];
  if (!dayData || !dayData.networks) return;

  const query = (surveyFilterInput.value || '').trim().toLowerCase();
  const filtered = dayData.networks.filter(net => !query || net.ssid.toLowerCase().includes(query));

  surveyStatsPill.textContent = `${filtered.length} of ${dayData.networks.length} networks • ${dayData.total_scans || 144} scans`;

  surveyTableBody.innerHTML = '';
  if (filtered.length === 0) {
    surveyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">No matching Wi-Fi networks found.</td></tr>`;
    return;
  }

  filtered.forEach((net, index) => {
    const tr = document.createElement('tr');

    // Rank
    const tdRank = document.createElement('td');
    tdRank.style.textAlign = 'center';
    tdRank.style.fontFamily = 'var(--font-mono)';
    tdRank.style.color = 'var(--text-muted)';
    tdRank.textContent = index + 1;
    tr.appendChild(tdRank);

    // SSID Name & Monitored Badge
    const tdSsid = document.createElement('td');
    const ssidWrap = document.createElement('div');
    ssidWrap.className = 'ssid-cell';
    const ssidName = document.createElement('span');
    ssidName.textContent = net.ssid;
    ssidWrap.appendChild(ssidName);
    if (net.is_monitored) {
      const monBadge = document.createElement('span');
      monBadge.className = 'badge-monitored';
      monBadge.textContent = 'Monitored';
      ssidWrap.appendChild(monBadge);
    }
    tdSsid.appendChild(ssidWrap);
    tr.appendChild(tdSsid);

    // Average Signal (dBm) with Signal Meter Bar
    const tdSignal = document.createElement('td');
    const sigContainer = document.createElement('div');
    sigContainer.className = 'signal-container';
    
    const sigVal = document.createElement('span');
    sigVal.className = 'signal-val';
    sigVal.textContent = `${net.avg_rssi} dBm`;
    sigContainer.appendChild(sigVal);

    const sigMeter = document.createElement('div');
    sigMeter.className = 'signal-meter';
    const sigFill = document.createElement('div');
    sigFill.className = 'signal-meter-fill';
    
    // Map -95 dBm (0%) to -30 dBm (100%)
    const pct = Math.max(5, Math.min(100, Math.round(((net.avg_rssi + 95) / 65) * 100)));
    sigFill.style.width = `${pct}%`;
    if (net.avg_rssi >= -50) sigFill.classList.add('excellent');
    else if (net.avg_rssi >= -67) sigFill.classList.add('good');
    else if (net.avg_rssi >= -79) sigFill.classList.add('fair');
    else sigFill.classList.add('weak');
    
    sigMeter.appendChild(sigFill);
    sigContainer.appendChild(sigMeter);
    tdSignal.appendChild(sigContainer);
    tr.appendChild(tdSignal);

    // Daily Visibility with Progress Meter
    const tdVis = document.createElement('td');
    const visContainer = document.createElement('div');
    visContainer.className = 'visibility-container';
    
    const visVal = document.createElement('span');
    visVal.className = 'visibility-val';
    visVal.textContent = `${net.visibility_pct}%`;
    visContainer.appendChild(visVal);

    const visMeter = document.createElement('div');
    visMeter.className = 'visibility-meter';
    const visFill = document.createElement('div');
    visFill.className = 'visibility-meter-fill';
    visFill.style.width = `${net.visibility_pct}%`;
    visMeter.appendChild(visFill);
    visContainer.appendChild(visMeter);
    tdVis.appendChild(visContainer);
    tr.appendChild(tdVis);

    // Presence Status Badge
    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge-status';
    if (net.visibility_pct >= 90) {
      statusBadge.classList.add('badge-continuous');
      statusBadge.textContent = 'Continuous';
    } else if (net.visibility_pct >= 30) {
      statusBadge.classList.add('badge-intermittent');
      statusBadge.textContent = 'Intermittent';
    } else {
      statusBadge.classList.add('badge-transient');
      statusBadge.textContent = 'Transient';
    }
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    // Channel
    const tdCh = document.createElement('td');
    tdCh.style.textAlign = 'center';
    tdCh.style.fontFamily = 'var(--font-mono)';
    tdCh.style.color = 'var(--text-muted)';
    tdCh.textContent = net.channel || '-';
    tr.appendChild(tdCh);

    surveyTableBody.appendChild(tr);
  });
}

// Event Listeners
stationSelect.addEventListener('change', (e) => selectStation(e.target.value));
timezoneSelect.addEventListener('change', (e) => {
  currentTzOffset = parseInt(e.target.value, 10);
  if (currentStation) {
    if (metaLastSeen) metaLastSeen.textContent = currentStation.last_seen ? formatDateTime(new Date(currentStation.last_seen)) : 'N/A';
  }
  renderHeatmap();
});

// Modal Event Listeners
if (cardVisibleNetworks) {
  cardVisibleNetworks.addEventListener('click', openNetworksModal);
  cardVisibleNetworks.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openNetworksModal();
    }
  });
}
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeNetworksModal);
if (modalCloseFooterBtn) modalCloseFooterBtn.addEventListener('click', closeNetworksModal);
if (networksModal) {
  networksModal.addEventListener('click', (e) => {
    if (e.target === networksModal) closeNetworksModal();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && networksModal && networksModal.classList.contains('open')) {
    closeNetworksModal();
  }
});
if (surveyDateSelect) {
  surveyDateSelect.addEventListener('change', (e) => {
    currentSurveyDay = e.target.value;
    renderSurveyTable();
  });
}
if (surveyFilterInput) {
  surveyFilterInput.addEventListener('input', renderSurveyTable);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadVersion();
  loadStations();
});
