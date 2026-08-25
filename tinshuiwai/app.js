/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 * Version 4.5.0 - 兩分鐘內顯秒 + 隱藏StopID + 站點GPS定位 + WebApp小字微調
 */

let activeMainTab = 'kowloon'; // 'kowloon' or 'tsw'
let timerId = null;

// Default preset fallback data (Removed Stop ID display)
const MOCK_DATA = {
  kowloon: [
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '原定班次', etaSeconds: 537, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '原定班次', etaSeconds: 1737, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '即時班次', etaSeconds: 0, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '即時班次', etaSeconds: 837, company: 'KMB', dirTag: 'kowloon' }
  ],
  tsw: [
    { route: '265B', dest: '天水圍 (天恆邨)', stopName: '美孚站 / 美孚轉車站 (#9)', rmk: '原定班次', etaSeconds: 320, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '天水圍 (天恆邨)', stopName: '美孚站 / 美孚轉車站 (#9)', rmk: '即時班次', etaSeconds: 980, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', stopName: '葵興站 / 葵興轉車站 (#3)', rmk: '原定班次', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', stopName: '葵興站 / 葵興轉車站 (#3)', rmk: '原定班次', etaSeconds: 894, company: 'KMB', dirTag: 'tsw' }
  ]
};

let activeState = {
  kowloon: [],
  tsw: []
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  activeState.kowloon = MOCK_DATA.kowloon.map(i => ({ ...i }));
  activeState.tsw = MOCK_DATA.tsw.map(i => ({ ...i }));

  switchMainTab('kowloon');

  if (timerId) clearInterval(timerId);
  timerId = setInterval(tickSecond, 1000);

  fetchKmbData();
  setInterval(fetchKmbData, 30000);
}

function switchMainTab(tab) {
  activeMainTab = tab;

  document.getElementById('tab-btn-kowloon').classList.toggle('active', tab === 'kowloon');
  document.getElementById('tab-btn-tsw').classList.toggle('active', tab === 'tsw');

  document.getElementById('tab-kowloon').classList.toggle('active', tab === 'kowloon');
  document.getElementById('tab-tsw').classList.toggle('active', tab === 'tsw');

  renderAllCards();
  updateHeaderTime();
}

function tickSecond() {
  let updateNeeded = false;

  ['kowloon', 'tsw'].forEach(key => {
    activeState[key].forEach(item => {
      if (item.etaSeconds > 0) {
        item.etaSeconds -= 1;
        updateNeeded = true;
      }
    });
  });

  if (updateNeeded) {
    renderAllCards();
  }
  updateHeaderTime();
}

function manualRefresh() {
  fetchKmbData();
  updateHeaderTime();
}

function updateHeaderTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-HK', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const elem = document.getElementById('update-time');
  if (elem) {
    elem.innerText = `最後更新：${timeStr} (倒數中)`;
  }
}

/**
 * ⏱️ 兩分鐘以內 (<= 120 秒) 才顯示秒數，否則僅顯示「X 分」
 */
function formatMainEta(seconds) {
  if (seconds <= 0) {
    return { first: '即將到達', class: 'eta-arriving' };
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // 兩分鐘以內 (<= 120 秒) 才顯示秒數
  if (seconds <= 120) {
    if (mins === 0) {
      return { first: `${secs} 秒`, class: 'eta-arriving' };
    } else {
      return { first: `${mins} 分 ${secs} 秒`, class: 'eta-arriving' };
    }
  } else {
    return { first: `${mins} 分`, class: '' };
  }
}

function formatSubEtaText(seconds) {
  if (seconds <= 0) return '即將抵達';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (seconds <= 120) {
    if (mins === 0) return `${secs}秒`;
    return `${mins}分${secs}秒`;
  } else {
    return `${mins}分`;
  }
}

// Group ETAs into a single card per Route + Destination
function groupEtasByRoute(items) {
  const groups = {};
  items.forEach(item => {
    const key = `${item.route}_${item.dest}`;
    if (!groups[key]) {
      groups[key] = {
        route: item.route,
        dest: item.dest,
        company: item.company,
        dirTag: item.dirTag,
        stopName: item.stopName || '',
        etas: []
      };
    }
    groups[key].etas.push({
      etaSeconds: item.etaSeconds,
      rmk: item.rmk
    });
  });

  Object.values(groups).forEach(g => {
    g.etas.sort((a, b) => a.etaSeconds - b.etaSeconds);
  });

  return Object.values(groups);
}

function buildConsolidatedCardsHtml(items) {
  if (!items || items.length === 0) {
    return '<div style="text-align:center; color:#94a3b8; padding:16px 0; font-size:0.8rem;">暫無班次資料</div>';
  }

  const groupedList = groupEtasByRoute(items);
  let html = '';

  groupedList.forEach(group => {
    const firstEta = group.etas[0];
    const nextEtas = group.etas.slice(1, 3);

    const firstEtaObj = formatMainEta(firstEta ? firstEta.etaSeconds : -1);
    const isM = group.route.includes('M');
    const isTswDir = group.dirTag === 'tsw' || group.dest.includes('天恆') || group.dest.includes('天水圍');

    let cardClass = 'card';
    let badgeClass = 'company-badge';
    if (isTswDir) {
      cardClass = 'card tsw-route';
      badgeClass = 'company-badge badge-tsw';
    } else if (isM) {
      cardClass = 'card m-route';
      badgeClass = 'company-badge badge-m';
    }

    let nextEtaHtml = '';
    if (nextEtas.length > 0) {
      const nextTexts = nextEtas.map(e => formatSubEtaText(e.etaSeconds)).join(' | ');
      nextEtaHtml = `<div class="eta-sub">下一班：${nextTexts}</div>`;
    }

    const rmkText = firstEta ? firstEta.rmk : '';
    // 保留車站名字與編號，已完全刪除 Stop ID
    const stopDisplay = group.stopName ? `🚏 ${group.stopName}` : '';

    html += `
      <div class="${cardClass}">
        <div class="card-left">
          <div class="route-header">
            <span class="route-number">${group.route}</span>
            <span class="${badgeClass}">九巴</span>
          </div>
          <div class="destination">${group.dest}</div>
          ${stopDisplay ? `<div class="stop-info">${stopDisplay}</div>` : ''}
          ${rmkText ? `<div class="remark-tag">${rmkText}</div>` : ''}
        </div>
        <div class="eta-container">
          <div class="eta-first ${firstEtaObj.class}">${firstEtaObj.first}</div>
          ${nextEtaHtml}
        </div>
      </div>
    `;
  });

  return html;
}

function renderAllCards() {
  const containerKowloon = document.getElementById('container-kowloon-eta');
  if (containerKowloon) {
    containerKowloon.innerHTML = buildConsolidatedCardsHtml(activeState.kowloon);
  }

  const containerTsw = document.getElementById('container-tsw-eta');
  if (containerTsw) {
    containerTsw.innerHTML = buildConsolidatedCardsHtml(activeState.tsw);
  }
}

async function fetchKmbData() {
  try {
    const now = new Date();

    // 1. Fetch 265B Outbound
    const res265bOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265B/1');
    let kowloonItems = [];
    if (res265bOut.ok) {
      const data = await res265bOut.json();
      if (data && data.data) {
        kowloonItems = data.data.filter(e => (e.dir === 'O' || e.service_type === 1) && (e.seq === 3 || e.seq === 1)).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265B',
            dest: e.dest_tc || '旺角(柏景灣)',
            stopName: '天富苑欣富閣 (#3 TN503)',
            rmk: e.rmk_tc || '即時班次',
            etaSeconds: diffSec,
            company: 'KMB',
            dirTag: 'kowloon'
          };
        });
      }
    }

    // 2. Fetch 265M Outbound
    const res265mOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265M/1');
    if (res265mOut.ok) {
      const data = await res265mOut.json();
      if (data && data.data) {
        const mItems = data.data.filter(e => (e.dir === 'O' || e.service_type === 1) && (e.seq === 3 || e.seq === 1)).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265M',
            dest: e.dest_tc || '葵涌(麗瑤邨)',
            stopName: '天富苑欣富閣 (#3 TN503)',
            rmk: e.rmk_tc || '即時班次',
            etaSeconds: diffSec,
            company: 'KMB',
            dirTag: 'kowloon'
          };
        });
        kowloonItems = kowloonItems.concat(mItems);
      }
    }

    if (kowloonItems.length > 0) {
      activeState.kowloon = kowloonItems;
    }

    // 3. Fetch 265B & 265M Inbound (Return to TSW)
    const res265bIn = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265B/1');
    let tswItems = [];
    if (res265bIn.ok) {
      const data = await res265bIn.json();
      if (data && data.data) {
        tswItems = data.data.filter(e => e.dir === 'I' && e.seq === 1).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265B',
            dest: '天水圍 (天恆邨)',
            stopName: '旺角(柏景灣)總站 (#1)',
            rmk: e.rmk_tc || '返天水圍方向',
            etaSeconds: diffSec,
            company: 'KMB',
            dirTag: 'tsw'
          };
        });
      }
    }

    const res265mIn = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265M/1');
    if (res265mIn.ok) {
      const data = await res265mIn.json();
      if (data && data.data) {
        const mInItems = data.data.filter(e => e.dir === 'I' && e.seq === 1).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265M',
            dest: '天水圍 (天恆邨)',
            stopName: '葵涌(麗瑤邨)總站 (#1)',
            rmk: e.rmk_tc || '返天水圍方向',
            etaSeconds: diffSec,
            company: 'KMB',
            dirTag: 'tsw'
          };
        });
        tswItems = tswItems.concat(mInItems);
      }
    }

    if (tswItems.length > 0) {
      activeState.tsw = tswItems;
    }

    renderAllCards();
  } catch (err) {
    console.log('API fetch fallback to current state timers:', err);
  }
}

/**
 * 📍 GPS 定位功能：尋找離用戶最近的車站並於底部的路線列表高亮顯示
 */
function getUserLocation() {
  const banner = document.getElementById('geo-status');
  if (banner) {
    banner.style.display = 'block';
    banner.innerText = '📡 定位中，請稍候...';
  }

  if (!navigator.geolocation) {
    if (banner) banner.innerText = '❌ 您的裝置不支援 GPS 定位功能';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      findAndHighlightNearest(userLat, userLng);
    },
    (error) => {
      if (banner) banner.innerText = '⚠️ 無法取得定位權限或訊號微弱';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Distance formula (Haversine in meters)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function findAndHighlightNearest(userLat, userLng) {
  // Clear existing highlights
  document.querySelectorAll('.station-item').forEach(el => {
    el.classList.remove('nearest-station');
    const badge = el.querySelector('.nearest-badge');
    if (badge) badge.remove();
  });

  const stationElements = document.querySelectorAll('.station-item[data-lat]');
  let minDistance = Infinity;
  let nearestElem = null;

  stationElements.forEach(elem => {
    const lat = parseFloat(elem.getAttribute('data-lat'));
    const lng = parseFloat(elem.getAttribute('data-lng'));
    if (!isNaN(lat) && !isNaN(lng)) {
      const dist = getDistanceMeters(userLat, userLng, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestElem = elem;
      }
    }
  });

  const banner = document.getElementById('geo-status');
  if (nearestElem) {
    nearestElem.classList.add('nearest-station');
    
    const badge = document.createElement('span');
    badge.className = 'nearest-badge';
    badge.innerText = '📍 離您最近';
    nearestElem.appendChild(badge);

    const stationName = nearestElem.getAttribute('data-name') || '附近車站';
    const distText = minDistance > 1000 ? `${(minDistance / 1000).toFixed(1)} 公里` : `${minDistance} 米`;

    if (banner) {
      banner.style.display = 'block';
      banner.innerText = `📍 定位成功：最近車站為「${stationName}」（距離約 ${distText}）`;
    }

    // Smooth scroll to the nearest station
    nearestElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (banner) {
    banner.innerText = '⚠️ 找不到附近的車站資料';
  }
}
