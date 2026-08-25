/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 * Version 4.0.0 - 徹底整合單一卡片 + 站名與 Stop ID 標示
 */

let activeMainTab = 'kowloon'; // 'kowloon' or 'tsw'
let timerId = null;

// Stop ID Mapping
const STOP_MAP = {
  '8D56DB404D264D5A': '天富苑欣富閣 (TN503)',
  '73FE2D32F218DA9C': '天恩邨 (TN226)',
  'A86C1D824A405A0A': '天恆邨總站 (TN500)',
  'B52DDECE0BCAD48C': '旺角(柏景灣)總站',
  '912C0B1B3C079C1D': '葵涌(麗瑤邨)總站'
};

// Default preset fallback data with station name and Stop ID
const MOCK_DATA = {
  kowloon: [
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (TN503)', stopId: '8D56DB404D264D5A', rmk: '原定班次', etaSeconds: 537, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', stopName: '天富苑欣富閣 (TN503)', stopId: '8D56DB404D264D5A', rmk: '原定班次', etaSeconds: 1737, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (TN503)', stopId: '8D56DB404D264D5A', rmk: '即時班次', etaSeconds: 0, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', stopName: '天富苑欣富閣 (TN503)', stopId: '8D56DB404D264D5A', rmk: '即時班次', etaSeconds: 837, company: 'KMB', dirTag: 'kowloon' }
  ],
  tsw: [
    { route: '265B', dest: '天水圍 (天恆邨)', stopName: '美孚站 / 美孚轉車站', stopId: 'E92B1C2A34D15E', rmk: '原定班次', etaSeconds: 320, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '天水圍 (天恆邨)', stopName: '美孚站 / 美孚轉車站', stopId: 'E92B1C2A34D15E', rmk: '即時班次', etaSeconds: 980, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', stopName: '葵興站 / 葵興轉車站', stopId: 'F12C3D4A56E78F', rmk: '原定班次', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', stopName: '葵興站 / 葵興轉車站', stopId: 'F12C3D4A56E78F', rmk: '原定班次', etaSeconds: 894, company: 'KMB', dirTag: 'tsw' }
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
    elem.innerText = `最後更新：${timeStr} (動態秒數實時倒數中)`;
  }
}

function formatMainEta(seconds) {
  if (seconds <= 0) {
    return { first: '即將到達', class: 'eta-arriving' };
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return { first: `${secs} 秒`, class: 'eta-arriving' };
  } else {
    return { first: `${mins} 分 ${secs} 秒`, class: '' };
  }
}

function formatSubEtaText(seconds) {
  if (seconds <= 0) return '即將抵達';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}秒`;
  if (secs === 0) return `${mins}分`;
  return `${mins}分${secs}秒`;
}

// Strictly group ETAs into a single object per Route + Destination
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
        stopId: item.stopId || '',
        etas: []
      };
    }
    groups[key].etas.push({
      etaSeconds: item.etaSeconds,
      rmk: item.rmk
    });
  });

  // Sort inside each group and eliminate duplicates
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
    const nextEtas = group.etas.slice(1, 3); // Maximum 2 next ETAs

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
    const stopDisplay = group.stopName ? `🚏 ${group.stopName}${group.stopId ? ` · Stop ID: ${group.stopId}` : ''}` : '';

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
        // Filter for specific stop (e.g. seq === 3: 天富苑欣富閣, or seq === 1: 天恆邨總站)
        kowloonItems = data.data.filter(e => (e.dir === 'O' || e.service_type === 1) && (e.seq === 3 || e.seq === 1)).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          const stopId = e.stop || '8D56DB404D264D5A';
          const stopName = STOP_MAP[stopId] || '天富苑欣富閣 (TN503)';
          return {
            route: '265B',
            dest: e.dest_tc || '旺角(柏景灣)',
            stopName: stopName,
            stopId: stopId,
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
          const stopId = e.stop || '8D56DB404D264D5A';
          const stopName = STOP_MAP[stopId] || '天富苑欣富閣 (TN503)';
          return {
            route: '265M',
            dest: e.dest_tc || '葵涌(麗瑤邨)',
            stopName: stopName,
            stopId: stopId,
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
          const stopId = e.stop || 'B52DDECE0BCAD48C';
          const stopName = STOP_MAP[stopId] || '旺角(柏景灣)總站';
          return {
            route: '265B',
            dest: '天水圍 (天恆邨)',
            stopName: stopName,
            stopId: stopId,
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
          const stopId = e.stop || '912C0B1B3C079C1D';
          const stopName = STOP_MAP[stopId] || '葵涌(麗瑤邨)總站';
          return {
            route: '265M',
            dest: '天水圍 (天恆邨)',
            stopName: stopName,
            stopId: stopId,
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
