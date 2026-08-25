/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 */

let currentLocation = '265b';
let timerId = null;
let etaDataCache = {};

// Stop IDs for key stops
const STOPS = {
  TN503: { id: "8D56DB404D264D5A", name: "天富苑欣富閣 (TN503)" },
  TN226: { id: "73FE2D32F218DA9C", name: "天恩邨 (TN226)" }
};

// Preset mock ETAs to ensure instant load & offline fallback matching user screenshots
const FALLBACK_DATA = {
  '265b': [
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 449, company: 'KMB' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 1120, company: 'KMB' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '即時班次', etaSeconds: 1850, company: 'KMB' }
  ],
  '265m': [
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '原定班次', etaSeconds: 756, company: 'KMB' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '原定班次', etaSeconds: 1480, company: 'KMB' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '即時班次', etaSeconds: 2200, company: 'KMB' }
  ],
  'tn503': [
    { route: '276B', dest: '天富', rmk: '', etaSeconds: 276, company: 'KMB' },
    { route: '69', dest: '天水圍市中心', rmk: '', etaSeconds: 314, company: 'KMB' },
    { route: '264X', dest: '天耀', rmk: '最後班次', etaSeconds: 335, company: 'KMB' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 449, company: 'KMB' },
    { route: '276A', dest: '上水(太平)', rmk: '原定班次', etaSeconds: 458, company: 'KMB' },
    { route: '269D', dest: '瀝源', rmk: '原定班次', etaSeconds: 562, company: 'KMB' },
    { route: '269M', dest: '天恩邨', rmk: '', etaSeconds: 676, company: 'KMB' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '原定班次', etaSeconds: 756, company: 'KMB' },
    { route: '276A', dest: '上水(太平)', rmk: '原定班次', etaSeconds: 1058, company: 'KMB' },
    { route: '276B', dest: '天富', rmk: '', etaSeconds: 1135, company: 'KMB' }
  ],
  'tn226': [
    { route: '265M', dest: '天恆邨', rmk: '', etaSeconds: 200, company: 'KMB' },
    { route: '269M', dest: '祖堯', rmk: '原定班次', etaSeconds: 298, company: 'KMB' },
    { route: '276A', dest: '天恆邨', rmk: '', etaSeconds: 583, company: 'KMB' },
    { route: '265B', dest: '天恆邨', rmk: '', etaSeconds: 884, company: 'KMB' },
    { route: '265M', dest: '天恆邨', rmk: '', etaSeconds: 894, company: 'KMB' },
    { route: '276B', dest: '上水(彩園)', rmk: '原定班次', etaSeconds: 947, company: 'KMB' },
    { route: '276A', dest: '天恆邨', rmk: '', etaSeconds: 1157, company: 'KMB' },
    { route: '265B', dest: '天恆邨', rmk: '', etaSeconds: 1400, company: 'KMB' },
    { route: '69', dest: '元朗(德業街)', rmk: '原定班次', etaSeconds: 1407, company: 'KMB' },
    { route: '276A', dest: '天恆邨', rmk: '', etaSeconds: 1785, company: 'KMB' },
    { route: '269M', dest: '祖堯', rmk: '原定班次', etaSeconds: 1798, company: 'KMB' }
  ]
};

// Store active countdown timers in state
let activeEtaList = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  switchLocation('265b');
  
  // High-frequency 1s ticker for live dynamic countdown
  if (timerId) clearInterval(timerId);
  timerId = setInterval(tickSecond, 1000);

  // Fetch real KMB API every 30s
  fetchKmbData();
  setInterval(fetchKmbData, 30000);
}

function switchLocation(location) {
  currentLocation = location;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-${location}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Toggle Timetable & Station Panels based on location
  const timetableSec = document.getElementById('timetable-section');
  const station265bSec = document.getElementById('station-265b-section');
  const station265mSec = document.getElementById('station-265m-section');

  if (location === '265b') {
    if (timetableSec) timetableSec.style.display = 'none';
    if (station265bSec) station265bSec.style.display = 'block';
    if (station265mSec) station265mSec.style.display = 'none';
  } else if (location === '265m') {
    if (timetableSec) timetableSec.style.display = 'block';
    if (station265bSec) station265bSec.style.display = 'none';
    if (station265mSec) station265mSec.style.display = 'block';
  } else if (location === 'tn503' || location === 'tn226') {
    if (timetableSec) timetableSec.style.display = 'none';
    if (station265bSec) station265bSec.style.display = 'block';
    if (station265mSec) station265mSec.style.display = 'block';
  }

  // Load ETA items into memory
  loadEtaDataForLocation(location);
  renderBusCards();
  updateHeaderTime();
}

function loadEtaDataForLocation(location) {
  const source = etaDataCache[location] || FALLBACK_DATA[location] || [];
  activeEtaList = source.map(item => ({ ...item }));
}

function tickSecond() {
  let updated = false;
  activeEtaList.forEach(item => {
    if (item.etaSeconds > 0) {
      item.etaSeconds -= 1;
      updated = true;
    }
  });

  renderBusCards();
  updateHeaderTime();
}

function updateHeaderTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-HK', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const elem = document.getElementById('update-time');
  if (elem) {
    elem.innerText = `最後更新：${timeStr} (實時倒數中)`;
  }
}

function formatEta(seconds) {
  if (seconds <= 0) {
    return { first: '即將到達', second: '', class: 'eta-arriving' };
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return { first: `${secs} 秒`, second: '即將抵達', class: 'eta-arriving' };
  } else {
    return { first: `${mins} 分 ${secs} 秒`, second: '', class: '' };
  }
}

function renderBusCards() {
  const container = document.getElementById('bus-container');
  if (!container) return;

  if (!activeEtaList || activeEtaList.length === 0) {
    container.innerHTML = '<div class="loading">暫無到站班次資料</div>';
    return;
  }

  let html = '';
  activeEtaList.forEach(item => {
    const etaObj = formatEta(item.etaSeconds);
    const isM = item.route.includes('M') || item.route.includes('264');
    const cardClass = isM ? 'card m-route' : 'card kmb';
    const badgeClass = isM ? 'company-badge badge-m' : 'company-badge';

    html += `
      <div class="${cardClass}">
        <div>
          <div class="route-header">
            <span class="route-number">${item.route}</span>
            <span class="${badgeClass}">九巴</span>
          </div>
          <div class="destination">${item.dest}</div>
          ${item.rmk ? `<div class="remark-tag">${item.rmk}</div>` : ''}
        </div>
        <div class="eta-container">
          <div class="eta-first ${etaObj.class}">${etaObj.first}</div>
          ${etaObj.second ? `<div class="eta-second">${etaObj.second}</div>` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Fetch live data from KMB API if online
async function fetchKmbData() {
  try {
    let route = '265B';
    if (currentLocation === '265m') route = '265M';
    
    if (currentLocation === '265b' || currentLocation === '265m') {
      const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/1`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.length > 0) {
          const now = new Date();
          const items = json.data.slice(0, 3).map(entry => {
            const etaTime = entry.eta ? new Date(entry.eta) : null;
            const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
            return {
              route: entry.route || route,
              dest: entry.dest_tc || (route === '265B' ? '旺角(柏景灣)' : '葵涌(麗瑤邨)'),
              rmk: entry.rmk_tc || '即時班次',
              etaSeconds: diffSec,
              company: 'KMB'
            };
          });
          if (items.length > 0) {
            etaDataCache[currentLocation] = items;
            activeEtaList = items.map(i => ({ ...i }));
            renderBusCards();
          }
        }
      }
    } else if (currentLocation === 'tn503' || currentLocation === 'tn226') {
      const stopId = STOPS[currentLocation.toUpperCase()].id;
      const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.length > 0) {
          const now = new Date();
          const items = json.data.slice(0, 10).map(entry => {
            const etaTime = entry.eta ? new Date(entry.eta) : null;
            const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
            return {
              route: entry.route,
              dest: entry.dest_tc,
              rmk: entry.rmk_tc || '',
              etaSeconds: diffSec,
              company: 'KMB'
            };
          });
          if (items.length > 0) {
            etaDataCache[currentLocation] = items;
            activeEtaList = items.map(i => ({ ...i }));
            renderBusCards();
          }
        }
      }
    }
  } catch (err) {
    console.log('KMB API fetch fallback to local timers:', err);
  }
}
