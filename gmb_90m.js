const STOPS_90M = [
  { type: "section", text: "🚝 往美孚方向" },
  { id: "20001428", name: "賢麗苑購物中心外（荔景站）", dirArrow: "⬇️" },
  { id: "20001837", name: "荔景山路，張玉瓊晨輝學校對面", dirArrow: "⬇️" },
  { type: "note", text: "⬇️ 經：清麗苑 ➔ 荔灣花園 ➔ 華豐園 ➔ 荔欣苑" },
  { id: "20020129", name: "荔灣道(體育館對面)", dirArrow: "⬇️" },
  { id: "20013663", name: "美荔道（Esso油站）", dirArrow: "⬇️" },
  { id: "20013693", name: "總站（美孚巴士總站）", isTerminal: true, dirArrow: "🔄" },
  { type: "section", text: "↩️ 往荔景方向" },
  { id: "20013694", name: "荔灣道(體育館對面) [回程]", dirArrow: "⬆️" },
  { type: "note", text: "⬆️ 沿途經過（無獨立班次站點）：清麗苑 ➔ 荔灣花園 ➔ 華豐園 ➔ 荔欣苑" },
  { type: "divider", text: "📍 荔灣花園" },
  { id: "20015763", name: "荔景山路，近荔景邨安景樓", dirArrow: "⬆️" },
  { id: "20001418", name: "賢麗苑購物中心外（荔景站）", dirArrow: "⬆️" }
];

const STOPS_90P = [
  { type: "section", text: "🚝 往美孚方向" },
  { id: "20013695", name: "瑪嘉烈醫院路，近瑪嘉烈醫院G座", isTerminal: true, dirArrow: "⬇️" },
  { type: "divider", text: "📍 荔灣花園" },
  { id: "20020129", name: "荔灣道(體育館對面)", dirArrow: "⬇️" },
  { id: "20020130", name: "美荔道（Esso油站）", dirArrow: "⬇️" },
  { id: "20014386", name: "總站（美孚巴士總站）", isTerminal: true, dirArrow: "🔄" }
];

const STOPS_92M = [
  { id: "20015765", name: "華員徑，近華員邨華信閣", dirArrow: "⬇️" },
  { type: "divider", text: "📍 荔灣花園" },
  { id: "20020129", name: "荔灣道(體育館對面)", dirArrow: "⬇️" },
  { id: "20020130", name: "美荔道（Esso油站）", dirArrow: "⬇️" },
  { id: "20013693", name: "總站（美孚巴士總站）", isTerminal: true, dirArrow: "🔄" },
  { id: "20020131", name: "美荔道，美孚新邨第6期", dirArrow: "⬆️" },
  { id: "20013694", name: "荔灣道(體育館對面) [回程]", dirArrow: "⬆️" }
];

let currentRoute = '90M';
let selectedStopId = "20001428";
let cacheData = {};

function switchMainView(viewName) {
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

  if (viewName === 'to-safu') {
    document.querySelectorAll('.mode-tab')[0].classList.add('active');
    document.getElementById('view-to-safu').classList.add('active');
  } else if (viewName === 'to-laiking') {
    document.querySelectorAll('.mode-tab')[1].classList.add('active');
    document.getElementById('view-to-laiking').classList.add('active');
  } else {
    document.querySelectorAll('.mode-tab')[2].classList.add('active');
    document.getElementById('view-full').classList.add('active');
    switchRoute('90M');
  }
  updateDirectionOverviews();
  renderTimeline();
  updateDashboard();
}

function switchRoute(routeName) {
  currentRoute = routeName;
  document.querySelectorAll('.route-sub-tab').forEach(tab => tab.classList.remove('active'));
  
  if (routeName === '90M') {
    document.querySelectorAll('.route-sub-tab')[0].classList.add('active');
    selectedStopId = STOPS_90M.find(s => s.id)?.id;
  } else if (routeName === '90P') {
    document.querySelectorAll('.route-sub-tab')[1].classList.add('active');
    selectedStopId = STOPS_90P.find(s => s.id)?.id;
  } else if (routeName === '92M') {
    document.querySelectorAll('.route-sub-tab')[2].classList.add('active');
    selectedStopId = STOPS_92M.find(s => s.id)?.id;
  }
  renderTimeline();
  updateDashboard();
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatEtaDisplay(targetTimeStr, showSeconds = false) {
  if (!targetTimeStr) return "--";
  const now = new Date();
  const targetTime = new Date(targetTimeStr);
  const diffSec = Math.round((targetTime - now) / 1000);
  const clock = formatTime(targetTimeStr);

  if (diffSec <= 0) return showSeconds ? `即將` : `即將 (${clock})`;
  
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;

  if (showSeconds) {
    if (minutes === 0) return `${seconds}秒`;
    return `${minutes}分${seconds}秒`;
  }

  if (diffSec < 60) return `${diffSec}秒 (${clock})`;
  return `${minutes}分鐘 (${clock})`;
}

async function fetchAllData() {
  const allStopIds = new Set([
    "20013693", 
    "20014386", 
    "20013694", 
    "20001418", 
    "20001428"  
  ]);

  [...STOPS_90M, ...STOPS_90P, ...STOPS_92M].forEach(s => {
    if (s.id) allStopIds.add(s.id);
  });

  let fetchPromises = [...allStopIds].map(async (stopId) => {
    try {
      const res = await fetch(`https://data.etagmb.gov.hk/eta/stop/${stopId}`);
      const result = await res.json();
      let allEtas = [];
      (result.data || []).forEach(g => (g.eta || []).forEach(e => allEtas.push({ time: e.timestamp })));
      allEtas.sort((a, b) => new Date(a.time) - new Date(b.time));
      cacheData[stopId] = allEtas;
    } catch (e) {}
  });

  // 🌟 直接以獨立路線 API 抓取開往荔景的發車班次
  const separateRequests = [
    fetch("https://data.etagmb.gov.hk/eta/route-stop/90M/1/1")
      .then(res => res.json())
      .then(result => {
        let etas = [];
        (result.data?.eta || []).forEach(e => etas.push({ time: e.timestamp }));
        return { key: "laiking-90m-20013693", etas };
      }).catch(() => ({ key: "laiking-90m-20013693", etas: [] })),

    fetch("https://data.etagmb.gov.hk/eta/route-stop/90P/1/1")
      .then(res => res.json())
      .then(result => {
        let etas = [];
        (result.data?.eta || []).forEach(e => etas.push({ time: e.timestamp }));
        return { key: "laiking-90p-20014386", etas };
      }).catch(() => ({ key: "laiking-90p-20014386", etas: [] })),

    fetch("https://data.etagmb.gov.hk/eta/route-stop/92M/1/1")
      .then(res => res.json())
      .then(result => {
        let etas = [];
        (result.data?.eta || []).forEach(e => etas.push({ time: e.timestamp }));
        return { key: "laiking-92m-20013693", etas };
      }).catch(() => ({ key: "laiking-92m-20013693", etas: [] }))
  ];

  await Promise.all([
    ...fetchPromises,
    Promise.all(separateRequests).then(results => {
      results.forEach(r => {
        r.etas.sort((a, b) => new Date(a.time) - new Date(b.time));
        cacheData[r.key] = r.etas;
      });
    })
  ]);

  renderTimeline();
  updateDirectionOverviews();
  updateDashboard();
  updateTimestamp();
}

function updateDirectionOverviews() {
  // 🚝 往美孚方向
  updateFrequentRow('safu-90m-20001428', '20001428'); 
  updateFrequentRow('safu-90m-20001837', '20001837'); 
  updateFrequentRow('safu-90m-20020129', '20020129'); 
  updateFrequentRow('safu-90p-20020129', '20020129'); 
  updateFrequentRow('safu-92m-20020129', '20020129'); 

  // 🚝 往美孚方向 - 美孚總站 (到達)
  updateFrequentRow('safu-90m-20013693', '20013693'); 
  updateFrequentRow('safu-90p-20014386', '20014386'); 
  updateFrequentRow('safu-92m-20013693', '20013693'); 

  // ↩️ 往荔景方向 - 美孚總站 (直接採用與「各站查詢」相同、最穩定的車站 API 數據)
  updateFrequentRow('laiking-90m-20013693', '20013693'); 
  updateFrequentRow('laiking-90p-20014386', '20014386'); 
  updateFrequentRow('laiking-92m-20013693', '20013693'); 

  // ↩️ 往荔景方向 - 其餘車站
  updateFrequentRow('laiking-90m-20013694', '20013694'); 
  updateFrequentRow('laiking-92m-20013694', '20013694'); 
  updateFrequentRow('laiking-90m-20001418', '20001418'); 
}

function updateFrequentRow(elementId, stopId) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const etas = cacheData[stopId] || [];
  const topEtas = etas.slice(0, 3);

  if (topEtas.length === 0) {
    container.innerHTML = `<span class="no-eta-text">暫無班次</span>`;
    return;
  }

  let html = '';
  topEtas.forEach(item => {
    const text = formatEtaDisplay(item.time, true);
    const isArriving = text.includes('即將') || text.includes('秒');
    html += `<span class="mini-pill ${isArriving ? 'arriving' : ''}">${text}</span>`;
  });
  container.innerHTML = html;
}

function updateFrequentCustomRow(elementId, cacheKey) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const etas = cacheData[cacheKey] || [];
  const topEtas = etas.slice(0, 3);

  if (topEtas.length === 0) {
    container.innerHTML = `<span class="no-eta-text">暫無班次</span>`;
    return;
  }

  let html = '';
  topEtas.forEach(item => {
    const text = formatEtaDisplay(item.time, true);
    const isArriving = text.includes('即將') || text.includes('秒');
    html += `<span class="mini-pill ${isArriving ? 'arriving' : ''}">${text}</span>`;
  });
  container.innerHTML = html;
}

function renderTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  
  container.innerHTML = '';
  let stopsList = currentRoute === '90M' ? STOPS_90M : currentRoute === '90P' ? STOPS_90P : STOPS_92M;
  let validIndex = 0;
  const now = new Date();

  stopsList.forEach((stop) => {
    if (stop.type === "divider") {
      const div = document.createElement('div');
      div.className = 'route-divider';
      div.innerText = stop.text;
      container.appendChild(div);
      return;
    }
    if (stop.type === "section") {
      const sec = document.createElement('div');
      sec.className = 'route-section-header';
      sec.innerText = stop.text;
      container.appendChild(sec);
      return;
    }
    if (stop.type === "note") {
      const noteDiv = document.createElement('div');
      noteDiv.style.cssText = "font-size: 0.78rem; color: #64748b; background: #f1f5f9; padding: 6px 10px; border-radius: 6px; margin: 8px 0 14px 20px; font-weight: bold;";
      noteDiv.innerText = stop.text;
      container.appendChild(noteDiv);
      return;
    }

    validIndex++;
    const item = document.createElement('div');
    item.className = `station-item`;
    item.id = `node-${stop.id}`;
    item.onclick = () => {
      selectedStopId = stop.id;
      updateDashboard();
    };

    let hasApproachingBus = false;
    const etas = cacheData[stop.id] || [];
    if (etas.length > 0 && etas[0].time) {
        const diffSec = Math.round((new Date(etas[0].time) - now) / 1000);
        if (diffSec <= 60) {
            hasApproachingBus = true;
        }
    }

    const terminalBadge = stop.isTerminal ? `<span style="font-size:0.6rem; background:#7c3aed; color:white; padding:1px 4px; border-radius:3px; margin-left:4px;">總站</span>` : '';
    item.innerHTML = `
      <div class="station-badge">${validIndex}</div>
      <div class="station-info">
        <div class="station-name">${stop.name}${terminalBadge}</div>
        <div class="station-id">ID: ${stop.id}</div>
        ${hasApproachingBus ? `<div class="bus-approaching-badge">🚐 小巴接近中</div>` : ''}
      </div>
      <div class="direction-arrow">${stop.dirArrow || "⬆️"}</div>
    `;
    container.appendChild(item);
  });
}

function updateDashboard() {
  document.querySelectorAll('.station-item').forEach(el => el.classList.remove('selected'));
  const activeEl = document.getElementById(`node-${selectedStopId}`);
  if (activeEl) activeEl.classList.add('selected');

  let currentStops = currentRoute === '90M' ? STOPS_90M : currentRoute === '90P' ? STOPS_90P : STOPS_92M;
  let targetStop = currentStops.find(s => s.id === selectedStopId);
  
  if (targetStop) {
    document.getElementById('banner-text').innerText = `目前顯示車站：${targetStop.name}`;
  }

  const etas = cacheData[selectedStopId] || [];
  for (let i = 0; i < 3; i++) {
    const timeEl = document.getElementById(`time-${i}`);
    if (timeEl) {
      if (etas[i]) {
        timeEl.textContent = formatEtaDisplay(etas[i].time);
      } else {
        timeEl.textContent = "暫無班次";
      }
    }
  }
}

function updateTimestamp() {
  const now = new Date();
  const timeEl = document.getElementById('update-time');
  if (timeEl) {
    timeEl.innerText = `最後更新時間：${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
}

renderTimeline();
fetchAllData();
setInterval(fetchAllData, 3000);