/**
 * 265B & 265M 巴士到站時間及路線資訊 App JS
 * Version 3.0.0 - 雙分頁（往九龍/葵青 vs 往天水圍）
 */

let activeMainTab = 'kowloon'; // 'kowloon' or 'tsw'
let timerId = null;

// Preset fallback ETAs for immediate render & offline reliability
const MOCK_DATA = {
  kowloon: [
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 276, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '原定班次', etaSeconds: 880, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '原定班次', etaSeconds: 449, company: 'KMB', dirTag: 'kowloon' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '即時班次', etaSeconds: 1120, company: 'KMB', dirTag: 'kowloon' }
  ],
  tsw: [
    { route: '265B', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 320, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '天水圍 (天恆邨)', rmk: '即時班次', etaSeconds: 980, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '天水圍 (天恆邨)', rmk: '原定班次', etaSeconds: 894, company: 'KMB', dirTag: 'tsw' }
  ],
  tswStops: [
    { route: '265M', dest: '天恆邨', rmk: '天恩邨 (TN226)', etaSeconds: 200, company: 'KMB', dirTag: 'tsw' },
    { route: '269M', dest: '祖堯', rmk: '原定班次', etaSeconds: 298, company: 'KMB', dirTag: 'kowloon' },
    { route: '264X', dest: '天耀', rmk: '天富苑 (TN503)', etaSeconds: 335, company: 'KMB', dirTag: 'tsw' },
    { route: '265B', dest: '旺角(柏景灣)', rmk: '天富苑 (TN503)', etaSeconds: 449, company: 'KMB', dirTag: 'kowloon' },
    { route: '276A', dest: '上水(太平)', rmk: '原定班次', etaSeconds: 583, company: 'KMB', dirTag: 'tsw' },
    { route: '265M', dest: '葵涌(麗瑤邨)', rmk: '天富苑 (TN503)', etaSeconds: 756, company: 'KMB', dirTag: 'kowloon' },
    { route: '265B', dest: '天恆邨', rmk: '天恩邨 (TN226)', etaSeconds: 884, company: 'KMB', dirTag: 'tsw' },
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
  // Deep clone fallback data
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

function buildCardsHtml(items) {
  if (!items || items.length === 0) {
    return '<div style="text-align:center; color:#94a3b8; padding:20px 0;">暫無班次資料</div>';
  }

  let html = '';
  items.forEach(item => {
    const etaObj = formatEta(item.etaSeconds);
    const isM = item.route.includes('M') || item.route.includes('264');
    const isTswDir = item.dirTag === 'tsw' || item.dest.includes('天恆') || item.dest.includes('天水圍');
    
    let cardClass = 'card';
    let badgeClass = 'company-badge';
    if (isTswDir) {
      cardClass = 'card tsw-route';
      badgeClass = 'company-badge badge-tsw';
    } else if (isM) {
      cardClass = 'card m-route';
      badgeClass = 'company-badge badge-m';
    }

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
  return html;
}

function renderAllCards() {
  const containerKowloon = document.getElementById('container-kowloon-eta');
  if (containerKowloon) {
    containerKowloon.innerHTML = buildCardsHtml(activeState.kowloon);
  }

  const containerTsw = document.getElementById('container-tsw-eta');
  if (containerTsw) {
    containerTsw.innerHTML = buildCardsHtml(activeState.tsw);
  }

  const containerTswStops = document.getElementById('container-tsw-stops-eta');
  if (containerTswStops) {
    containerTswStops.innerHTML = buildCardsHtml(activeState.tswStops);
  }
}

async function fetchKmbData() {
  try {
    const now = new Date();

    // 1. Fetch 265B Outbound (天恆 -> 旺角)
    const res265bOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265B/1');
    let kowloonItems = [];
    if (res265bOut.ok) {
      const data = await res265bOut.json();
      if (data && data.data) {
        kowloonItems = data.data.filter(e => e.dir === 'O' || e.service_type === 1).slice(0, 2).map(e => {
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

    // 2. Fetch 265M Outbound (天恆 -> 葵涌麗瑤)
    const res265mOut = await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-eta/265M/1');
    if (res265mOut.ok) {
      const data = await res265mOut.json();
      if (data && data.data) {
        const mItems = data.data.filter(e => e.dir === 'O' || e.service_type === 1).slice(0, 2).map(e => {
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
        tswItems = data.data.filter(e => e.dir === 'I').slice(0, 2).map(e => {
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
        const mInItems = data.data.filter(e => e.dir === 'I').slice(0, 2).map(e => {
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
