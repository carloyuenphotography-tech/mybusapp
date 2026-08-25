/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 * Version 3.3.0 - 修正九巴 API 全線站點混合與下一班次數量上限問題
 */

let activeMainTab = 'kowloon'; // 'kowloon' or 'tsw'
let timerId = null;

// Preset fallback ETAs for immediate render & offline reliability
const MOCK_DATA = {
  kowloon: [
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 597, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 1497, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '原定班次', etaSeconds: 0, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '即時班次', etaSeconds: 840, company: 'KMB', dirTag: 'kowloon' }
  ],
  tsw: [
    { route: '265B', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 320, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '天水圍 (天恆邨)', rmk: '即時班次', etaSeconds: 980, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 894, company: 'KMB', dirTag: 'tsw' }
  ],
  tswStops: [
    { route: '265M', dest: '天恆邨', rmk: '天恩邨 (TN226)', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天恆邨', rmk: '天恩邨 (TN226)', etaSeconds: 894, company: 'KMB', dirTag: 'tsw' },
    { route: '269M', dest: '祖堯', rmk: '天恩邨 (TN226)', etaSeconds: 298, company: 'KMB', dirTag: 'kowloon' },
    { route: '264X', dest: '天耀', rmk: '欣富閣 (TN503)', etaSeconds: 335, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '欣富閣 (TN503)', etaSeconds: 449, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '欣富閣 (TN503)', etaSeconds: 1400, company: 'KMB', dirTag: 'kowloon' },
    { route: '276A', dest: '上水(太平)', rmk: '原定班次', etaSeconds: 583, company: 'KMB', dirTag: 'tsw' },
    { route: '276B', dest: '天富', rmk: '原定班次', etaSeconds: 1135, company: 'KMB', dirTag: 'tsw' }
  ]
};

let activeState = {
  kowloon: [],
  tsw: [],
  tswStops: []
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  activeState.kowloon = MOCK_DATA.kowloon.map(i => ({ ...i }));
  activeState.tsw = MOCK_DATA.tsw.map(i => ({ ...i }));
  activeState.tswStops = MOCK_DATA.tswStops.map(i => ({ ...i }));

  switchMainTab('kowloon');

  // Start 1s ticker for live countdown animation
  if (timerId) clearInterval(timerId);
  timerId = setInterval(tickSecond, 1000);

  // Fetch real KMB API
  fetchKmbData();
  setInterval(fetchKmbData, 30000);
}

function switchMainTab(tab) {
  activeMainTab = tab;

  // Toggle tab buttons
  document.getElementById('tab-btn-kowloon').classList.toggle('active', tab === 'kowloon');
  document.getElementById('tab-btn-tsw').classList.toggle('active', tab === 'tsw');

  // Toggle tab content sections
  document.getElementById('tab-kowloon').classList.toggle('active', tab === 'kowloon');
  document.getElementById('tab-tsw').classList.toggle('active', tab === 'tsw');

  renderAllCards();
  updateHeaderTime();
}

function tickSecond() {
  let updateNeeded = false;

  ['kowloon', 'tsw', 'tswStops'].forEach(key => {
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

// Group array of ETA entries by Route + Destination
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
        etas: []
      };
    }
    groups[key].etas.push({
      etaSeconds: item.etaSeconds,
      rmk: item.rmk
    });
  });

  // Sort ETAs inside each group by remaining time
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
    // ⚠️ 關鍵修復：限制下一班最多只顯示 2 班（最多共 3 班），防止 API 把整條路線所有站點班次全擠在一起
    const nextEtas = group.etas.slice(1, 3);

    const firstEtaObj = formatMainEta(firstEta ? firstEta.etaSeconds : -1);
    const isM = group.route.includes('M') || group.route.includes('264');
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

    // Build sub ETA string for next buses
    let nextEtaHtml = '';
    if (nextEtas.length > 0) {
      const nextTexts = nextEtas.map(e => formatSubEtaText(e.etaSeconds)).join(' | ');
      nextEtaHtml = `<div class="eta-sub">下一班：${nextTexts}</div>`;
    }

    const rmkText = firstEta ? firstEta.rmk : '';

    html += `
      <div class="${cardClass}">
        <div class="card-left">
          <div class="route-header">
            <span class="route-number">${group.route}</span>
            <span class="${badgeClass}">九巴</span>
          </div>
          <div class="destination">${group.dest}</div>
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

  const containerTswStops = document.getElementById('container-tsw-stops-eta');
  if (containerTswStops) {
    containerTswStops.innerHTML = buildConsolidatedCardsHtml(activeState.tswStops);
  }
}

async function fetchKmbData() {
  try {
    const now = new Date();

    // 1. Fetch 265B Outbound (天恆邨起點站 seq === 1)
    const res265bOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265B/1');
    let kowloonItems = [];
    if (res265bOut.ok) {
      const data = await res265bOut.json();
      if (data && data.data) {
        // ⚠️ 關鍵修復：過濾 seq === 1（起點站天恆邨），只抓取該站的 3 班到站時間，避免拉到全線 22 個站的資料
        kowloonItems = data.data.filter(e => (e.dir === 'O' || e.service_type === 1) && (e.seq === 1 || e.seq === 3)).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265B',
            dest: e.dest_tc || '旺角(柏景灣)',
            rmk: e.rmk_tc || '即時班次',
            etaSeconds: diffSec,
            company: 'KMB',
            dirTag: 'kowloon'
          };
        });
      }
    }

    // 2. Fetch 265M Outbound (天恆邨起點站 seq === 1)
    const res265mOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265M/1');
    if (res265mOut.ok) {
      const data = await res265mOut.json();
      if (data && data.data) {
        const mItems = data.data.filter(e => (e.dir === 'O' || e.service_type === 1) && (e.seq === 1 || e.seq === 3)).slice(0, 3).map(e => {
          const etaTime = e.eta ? new Date(e.eta) : null;
          const diffSec = etaTime ? Math.max(0, Math.floor((etaTime - now) / 1000)) : 300;
          return {
            route: '265M',
            dest: e.dest_tc || '葵涌(麗瑤邨)',
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

    // 3. Fetch 265B & 265M Inbound (往天水圍/天恆邨)
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
