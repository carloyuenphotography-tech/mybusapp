// 🗺️ 專線小巴 90M 完整 16 個車站名單
const STOPS_90M = [
  { id: "20015760", name: "荔崗街，浩景臺第一座對面" },
  { id: "20015761", name: "荔崗街，近浩景臺第四座" },
  { id: "20001802", name: "荔景山路，近晨輝學校" },
  { id: "20001428", name: "荔景山路，賢麗苑購物中心外（荔景站）" },
  { id: "20001837", name: "荔景山路，張玉瓊晨輝學校對面" },
  { id: "20020129", name: "荔灣道，荔枝角公園體育館對面" },
  { id: "20013663", name: "美荔道，近蘭秀道（Esso油站）" },
  { id: "20013693", name: "美荔道，近美孚巴士總站（目前站）", isTerminal: true },
  { id: "20020131", name: "美荔道，美孚新邨近第6期" },
  { id: "20013694", name: "荔灣道，近荔枝角公園體育館" },
  { id: "20015763", name: "荔景山路，近荔景邨安景樓（第6座）" },
  { id: "20001418", name: "荔景山路，賢麗苑購物中心外" },
  { id: "20001803", name: "荔景山路，日景樓外" },
  { id: "20001804", name: "荔景山路，和景樓外" },
  { id: "20015761", name: "荔崗街，近浩景臺第四座" },
  { id: "20015760", name: "荔崗街，浩景臺第一座對面" }
];

// 🗺️ 專線小巴 90P 完整 6 個車站名單
const STOPS_90P = [
  { id: "20013695", name: "瑪嘉烈醫院路，近瑪嘉烈醫院G座", isTerminal: true },
  { id: "20020129", name: "荔灣道，荔枝角公園體育館對面" },
  { id: "20020130", name: "美荔道，美孚新邨第6期對出" },
  { id: "20014386", name: "美荔道，近美孚巴士總站", isTerminal: true },
  { id: "20020131", name: "美荔道，美孚新邨近第6期" },
  { id: "20013694", name: "荔灣道，近荔枝角公園體育館" }
];

// 🗺️ 專線小巴 92M 完整 7 個車站名單
const STOPS_92M = [
  { id: "20015765", name: "華員徑，近華員邨華信閣" },
  { id: "20020129", name: "荔灣道，荔枝角公園體育館對面" },
  { id: "20020130", name: "美荔道，美孚新邨第6期對出" },
  { id: "20013693", name: "美荔道，近美孚巴士總站（目前站）", isTerminal: true },
  { id: "20020131", name: "美荔道，美孚新邨近第6期" },
  { id: "20013694", name: "荔灣道，近荔枝角公園體育館" },
  { id: "20015765", name: "華員徑，近華員邨華信閣" }
];

let currentRoute = '90M';
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
    renderTimeline();
  }
  updateDirectionOverviews();
}

function switchRoute(routeName) {
  currentRoute = routeName;
  document.querySelectorAll('.route-sub-tab').forEach(tab => tab.classList.remove('active'));
  
  if (routeName === '90M') {
    document.querySelectorAll('.route-sub-tab')[0].classList.add('active');
  } else if (routeName === '90P') {
    document.querySelectorAll('.route-sub-tab')[1].classList.add('active');
  } else if (routeName === '92M') {
    document.querySelectorAll('.route-sub-tab')[2].classList.add('active');
  }
  renderTimeline();
}
function formatMinutesOnly(targetTimeStr) {
  if (!targetTimeStr) return null;
  const now = new Date();
  const targetTime = new Date(targetTimeStr);
  const diffSec = Math.round((targetTime - now) / 1000);

  // 🌟 小於等於 0 秒顯示即將到站/已離開
  if (diffSec <= 0) {
    return { text: "即將到站/已離開", isArriving: true };
  }
  
  // 🌟 1 至 60 秒之內，精確顯示剩餘秒數
  if (diffSec <= 60) {
    return { text: `${diffSec} 秒`, isArriving: true };
  }
  
  // 🌟 大於 60 秒顯示分鐘數
  const minutes = Math.floor(diffSec / 60);
  return { text: `${minutes} 分鐘`, isArriving: false };
}

async function fetchAllData() {
  const allStopIds = new Set([
    "20013693", "20014386", "20013694", "20001418", "20001428", "20013695"
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

  await Promise.all(fetchPromises);

  renderTimeline();
  updateDirectionOverviews();
  updateTimestamp();
}

function updateDirectionOverviews() {
  // 🚝 往美孚方向
  updateFrequentRow('safu-90m-20001428', '20001428'); 
  updateFrequentRow('safu-90m-20001837', '20001837'); 
  updateFrequentRow('safu-90p-20013695', '20013695'); 
  updateFrequentRow('safu-90m-20020129', '20020129'); 
  updateFrequentRow('safu-90p-20020129', '20020129'); 
  updateFrequentRow('safu-92m-20020129', '20020129'); 

  // 🚝 往美孚方向 - 美孚總站
  updateFrequentRow('safu-90m-20013693', '20013693'); 
  updateFrequentRow('safu-90p-20014386', '20014386'); 
  updateFrequentRow('safu-92m-20013693', '20013693'); 

  // ↩️ 往荔景方向 - 美孚總站
  updateFrequentRow('laiking-90m-20013693', '20013693'); 
  updateFrequentRow('laiking-90p-20014386', '20014386'); 
  updateFrequentRow('laiking-92m-20013693', '20013693'); 

  // ↩️ 往荔景方向 - 荔灣道(體育館外)
  updateFrequentRow('laiking-90m-20013694', '20013694'); 
  updateFrequentRow('laiking-90p-20013694', '20013694'); 
  updateFrequentRow('laiking-92m-20013694', '20013694'); 

  // ↩️ 往荔景方向 - 賢麗苑
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
    const timeObj = formatMinutesOnly(item.time);
    if (!timeObj) return;
    html += `<span class="mini-pill ${timeObj.isArriving ? 'arriving' : ''}">${timeObj.text}</span>`;
  });
  container.innerHTML = html;
}

// 🎨 渲染如同設計圖的各站列表（含小巴位置與膠囊）
function renderTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  
  let stopsList = currentRoute === '90M' ? STOPS_90M : currentRoute === '90P' ? STOPS_90P : STOPS_92M;
  let html = '';

  stopsList.forEach((stop, index) => {
    const etas = cacheData[stop.id] || [];
    const topEtas = etas.slice(0, 3);
    
    let pillsHtml = '';
    let hasBusArriving = false;

    if (topEtas.length === 0) {
      pillsHtml = `<span class="no-eta-text">暫無班次資料</span>`;
    } else {
      topEtas.forEach(e => {
        const t = formatMinutesOnly(e.time);
        if (t) {
          if (t.isArriving) hasBusArriving = true;
          pillsHtml += `<span class="eta-pill ${t.isArriving ? 'arriving' : ''}">${t.text}</span>`;
        }
      });
    }

    // 當有小巴即將抵達時，顯示黃藍小巴圖示 🚌
    const badgeContent = hasBusArriving ? '🚌' : (index + 1);
    const badgeClass = hasBusArriving ? 'node-badge has-bus' : 'node-badge';

    html += `
      <div class="station-node">
        <div class="${badgeClass}">${badgeContent}</div>
        <div class="node-content">
          <div class="node-title">${stop.name}</div>
          <div class="node-pills">${pillsHtml}</div>
          <div class="node-id">${stop.id}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateTimestamp() {
  const now = new Date();
  const timeEl = document.getElementById('update-time');
  if (timeEl) {
    timeEl.innerText = `最後更新時間：${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
}

fetchAllData();
setInterval(fetchAllData, 3000);