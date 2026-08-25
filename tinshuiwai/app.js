/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 * Version 4.8.0 - 定位及車站標籤只顯示各路線「最近 1 個班次」，徹底消除重複與複雜資訊
 */

let activeMainTab = 'kowloon'; // 'kowloon' or 'tsw'
let timerId = null;

const MOCK_DATA = {
  kowloon: [
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '原定班次', etaSeconds: 0, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '原定班次', etaSeconds: 1380, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '即時班次', etaSeconds: 180, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (#3 TN503)', rmk: '即時班次', etaSeconds: 1980, company: 'KMB', dirTag: 'kowloon' }
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
 * ⏱️ 最近一個班次：當時間 <= 120 秒時顯示秒數，否則顯示整數分鐘
 */
function formatMainEta(seconds) {
  if (seconds <= 0) {
    return { first: '即將到達', class: 'eta-arriving' };
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

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

/**
 * ⏱️ 其餘班次（下一班/第三班）：只顯示分鐘，不顯示秒數
 */
function formatSubEtaText(seconds) {
  if (seconds <= 0) return '即將抵達';
  const mins = Math.floor(seconds / 60);
  if (mins === 0) return '1分內';
  return `${mins}分`;
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
 * 📍 定位功能：取得離用戶最近車站
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

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
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

/**
 * 🎯 關鍵修正：只取每個路線【最近的一個班次】(1st ETA only)，徹底解決畫面出現 6 個班次排成兩行的複雜狀況
 */
function getSingleNearestEtaSummary() {
  const currentItems = activeState[activeMainTab] || [];
  if (currentItems.length === 0) return '暫無數據';

  // 按路線分組 (Group by route) 並按時間由近至遠排序
  const grouped = groupEtasByRoute(currentItems);

  // 每一條路線只保留 index 0（最近的那一班）
  const singleEtas = grouped.map(g => {
    const first = g.etas[0];
    if (!first) return null;
    const timeText = first.etaSeconds <= 0 ? '即將到站' : `${Math.floor(first.etaSeconds / 60)}分`;
    return {
      route: g.route,
      sec: first.etaSeconds,
      text: `${g.route}: ${timeText}`
    };
  }).filter(Boolean);

  // 依時間排序（最快到的路線排前面）
  singleEtas.sort((a, b) => a.sec - b.sec);

  return singleEtas.map(e => e.text).join(' | ');
}

function findAndHighlightNearest(userLat, userLng) {
  // 清除先前的標籤與高亮
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
    
    const stationName = nearestElem.getAttribute('data-name') || '附近車站';
    const distText = minDistance > 1000 ? `${(minDistance / 1000).toFixed(1)}公里` : `${minDistance}米`;
    
    // 只保留每個路線最接近的 1 個班次（如：265B: 即將到站 | 265M: 3分）
    const nearestEta = getSingleNearestEtaSummary();

    // 1. 車站列表中高亮站點旁的 Badge 標籤：簡潔顯示每個路線最近一班
    const badge = document.createElement('span');
    badge.className = 'nearest-badge';
    badge.innerText = `📍 ${nearestEta}`;
    nearestElem.appendChild(badge);

    // 2. 頂部綠色 Banner 顯示最簡明資訊
    if (banner) {
      banner.style.display = 'block';
      banner.innerText = `📍 最近車站：${stationName} (${distText}) ➔ ${nearestEta}`;
    }

    nearestElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (banner) {
    banner.innerText = '⚠️ 找不到附近的車站資料';
  }
}
