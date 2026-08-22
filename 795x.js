const LOCATIONS = {
  meifoo: {
    type: "citybus",
    title: "🚉 美孚",
    defaultDest: "清水灣半島",
    citybus_stops: [{ stop: "001517", route: "795X" }],
    travelTimeMin: 38
  },
  evangel: {
    type: "citybus",
    title: "🏫 播道書院",
    defaultDest: "蘇屋",
    citybus_stops: [{ stop: "003472", route: "795X" }],
    travelTimeMin: 38
  },
  tkopaza: {
    type: "citybus",
    title: "🏢 將軍澳廣場",
    defaultDest: "蘇屋",
    citybus_stops: [{ stop: "001826", route: "795X" }],
    travelTimeMin: 42
  },
  mtr_combo: {
    type: "combo",
    title: "🚇 港鐵 + 108A 小巴接駁"
  }
};

let currentLocation = 'meifoo';
let autoRefreshTimer = null;

function switchLocation(locKey) {
  if (currentLocation === locKey) return;
  currentLocation = locKey;

  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => tab.classList.remove('active'));

  if (locKey === 'meifoo') tabs[0].classList.add('active');
  else if (locKey === 'evangel') tabs[1].classList.add('active');
  else if (locKey === 'tkopaza') tabs[2].classList.add('active');
  else if (locKey === 'mtr_combo') tabs[3].classList.add('active');

  document.getElementById('bus-container').innerHTML = '<p class="loading">載入數據中...</p>';
  
  if (locKey === 'mtr_combo') {
    fetchComboETA();
  } else {
    fetchCitybusETA();
  }
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function fetchCitybusETA() {
  try {
    const container = document.getElementById('bus-container');
    const config = LOCATIONS[currentLocation];
    let allEtaData = [];

    const promises = config.citybus_stops.map(item => 
      fetch(`https://rt.data.gov.hk/v1/transport/citybus-nwfb/eta/CTB/${item.stop}/${item.route}`)
        .then(res => res.json())
        .then(res => res.data || [])
        .catch(() => [])
    );

    const results = await Promise.all(promises);
    results.forEach(data => { allEtaData = allEtaData.concat(data); });

    let filteredList = allEtaData.filter(item => item.eta !== null && item.eta !== "");

    filteredList = filteredList.filter(item => {
      if (currentLocation === 'meifoo') return !item.dest_tc.includes('蘇屋');
      if (currentLocation === 'tkopaza') return item.dest_tc.includes('蘇屋') || item.dest_tc.includes('美孚');
      return !item.dest_tc.includes('清水灣');
    });

    filteredList.sort((a, b) => new Date(a.eta) - new Date(b.eta));
    const firstTwoBuses = filteredList.slice(0, 2);

    if (firstTwoBuses.length === 0) {
      container.innerHTML = '<p class="loading">暫無 795X 班次資料或未到營運時間</p>';
      updateTimestamp();
      return;
    }

    container.innerHTML = '';
    const firstBus = firstTwoBuses[0];
    const secondBus = firstTwoBuses[1];

    const now = new Date();
    const departureTime = new Date(firstBus.eta);
    const diff1 = Math.round((departureTime - now) / 60000);
    const clockTime1 = formatTime(firstBus.eta);
    
    let etaDisplay1 = diff1 <= 0 ? `即將到達 (${clockTime1})` : `${diff1} 分鐘 (${clockTime1})`;
    let isArriving1 = diff1 <= 0;

    const arrivalTime = new Date(departureTime.getTime() + config.travelTimeMin * 60000);
    const arrivalClockTime = formatTime(arrivalTime.toISOString());
    const totalDiffToDest = Math.round((arrivalTime - now) / 60000);
    const targetStationName = currentLocation === 'meifoo' ? '播道書院' : '美孚';
    
    let arrivalNoticeHTML = '';
    if (currentLocation !== 'tkopaza') {
      arrivalNoticeHTML = `<div style="font-size: 0.8rem; color: #0284c7; margin-top: 4px; font-weight: bold;">預計約 ${totalDiffToDest <= 0 ? '即將' : totalDiffToDest + '分鐘後'} (${arrivalClockTime}) 抵達${targetStationName}</div>`;
    }

    let etaDisplay2HTML = '';
    if (secondBus) {
      const diff2 = Math.round((new Date(secondBus.eta) - now) / 60000);
      const clockTime2 = formatTime(secondBus.eta);
      const text2 = diff2 <= 0 ? `即將到達 (${clockTime2})` : `${diff2} 分鐘 (${clockTime2})`;
      etaDisplay2HTML = `<div class="eta-second">下班: ${text2}</div>`;
    }

    let displayDest = firstBus.dest_tc || config.defaultDest;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="route-info" style="flex: 1;">
        <div class="route-header">
          <span class="route-number">795X</span>
          <span class="company-badge">城巴</span>
        </div>
        <span class="destination">往 ${displayDest}</span>
        ${arrivalNoticeHTML}
      </div>
      <div class="eta-container">
        <div class="eta-first ${isArriving1 ? 'eta-arriving' : ''}">${etaDisplay1}</div>
        ${etaDisplay2HTML}
      </div>
    `;
    container.appendChild(card);
    updateTimestamp();

  } catch (error) {
    console.error('獲取 795X API 數據失敗:', error);
    document.getElementById('bus-container').innerHTML = '<p class="loading">數據載入失敗，請檢查網絡連接</p>';
  }
}

async function fetchComboETA() {
  try {
    const container = document.getElementById('bus-container');
    container.innerHTML = '';
    const now = new Date();

    let mtrMeiFooToTkoHTML = '';
    let mtrTkoToMeiFooHTML = '';

    try {
      const mtrRes = await fetch("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TWL&sta=MEF");
      const mtrData = await mtrRes.json();
      const mefTimes = mtrData.data["TWL-MEF"].DOWN || [];
      if (mefTimes.length > 0 && mefTimes[0].time) {
        const mtrDepTime = new Date(mefTimes[0].time);
        const tkoArrTime = new Date(mtrDepTime.getTime() + 40 * 60000);
        const diffMtr = Math.round((tkoArrTime - now) / 60000);
        const mtrText = diffMtr <= 0 ? `即將到達 (${formatTime(tkoArrTime.toISOString())})` : `${diffMtr} 分鐘 (${formatTime(tkoArrTime.toISOString())})`;

        mtrMeiFooToTkoHTML = `
          <div class="card mtr">
            <div class="route-info">
              <div class="route-header">
                <span class="route-number" style="font-size: 1.15rem;">港鐵 (美孚起步 ➔ 將軍澳)</span>
                <span class="company-badge badge-mtr">MTR</span>
              </div>
              <span class="destination">由美孚站上車 (經荔枝角/長沙灣往太子轉綫)</span>
            </div>
            <div class="eta-container">
              <div class="eta-first">${mtrText}</div>
              <div class="eta-second">美孚發車: ${formatTime(mefTimes[0].time)}</div>
            </div>
          </div>
        `;
      }
    } catch(e) {}

    try {
      const mtrRes = await fetch("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO");
      const mtrData = await mtrRes.json();
      const tkoTimes = mtrData.data["TKL-TKO"].UP || [];
      if (tkoTimes.length > 0 && tkoTimes[0].time) {
        const mtrDepTime = new Date(tkoTimes[0].time);
        const mefArrTime = new Date(mtrDepTime.getTime() + 35 * 60000);
        const diffMtr = Math.round((mefArrTime - now) / 60000);
        const mtrText = diffMtr <= 0 ? `即將到達 (${formatTime(mefArrTime.toISOString())})` : `${diffMtr} 分鐘 (${formatTime(mefArrTime.toISOString())})`;

        mtrTkoToMeiFooHTML = `
          <div class="card mtr">
            <div class="route-info">
              <div class="route-header">
                <span class="route-number" style="font-size: 1.15rem;">港鐵 (將軍澳起步 ➔ 美孚)</span>
                <span class="company-badge badge-mtr">MTR</span>
              </div>
              <span class="destination">由將軍澳站上車 (實時推算)</span>
            </div>
            <div class="eta-container">
              <div class="eta-first">${mtrText}</div>
              <div class="eta-second">將軍澳發車: ${formatTime(tkoTimes[0].time)}</div>
            </div>
          </div>
        `;
      }
    } catch(e) {}

    const mtrMeiFooPromise = fetch("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TWL&sta=MEF")
      .then(res => res.json())
      .then(data => data.data["TWL-MEF"].DOWN?.map(i => i.time) || []).catch(() => []);

    const mtrTiuKengLengPromise = fetch("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TIK")
      .then(res => res.json())
      .then(data => data.data["TKL-TIK"].UP?.map(i => i.time) || []).catch(() => []);

    // 🌟 已修正小巴時間的解析邏輯：欄位名稱改為 timestamp 
    const gmb108APromise = fetch("https://data.etagmb.gov.hk/eta/stop/20006977")
      .then(res => res.json())
      .then(data => {
        if (!data || !data.data) return [];
        // 尋找陣列中第一筆包含 eta 資料的路線
        let targetRoute = Array.isArray(data.data) ? data.data.find(item => item.eta && item.eta.length > 0) : data.data;
        
        if (targetRoute && targetRoute.eta) {
           // GMB 小巴 API 的時間欄位是 timestamp
           return targetRoute.eta.map(i => i.timestamp || i.time).filter(t => t);
        }
        return [];
      }).catch(err => {
        console.error("小巴 API 解析失敗:", err);
        return [];
      });

    const [mefTimes, tikTimes, gmbTimes] = await Promise.all([
      mtrMeiFooPromise, mtrTiuKengLengPromise, gmb108APromise
    ]);

    let htmlContent = '';
    if (mtrMeiFooToTkoHTML || mtrTkoToMeiFooHTML) {
      htmlContent += `<div class="section-title" style="margin-top: 0;">🚀 港鐵跨綫預計到達時間</div>`;
      if (mtrMeiFooToTkoHTML) htmlContent += mtrMeiFooToTkoHTML;
      if (mtrTkoToMeiFooHTML) htmlContent += mtrTkoToMeiFooHTML;
    }

    htmlContent += `<div class="section-title">⏱️ 港鐵實時開出班次</div>`;
    container.innerHTML = htmlContent;

    renderCard(container, "美孚站 (荃灣綫)", "往 荔枝角 / 太子", mefTimes, "MTR", "mtr");
    renderCard(container, "調景嶺站 (將軍澳綫)", "往 將軍澳 / 康城", tikTimes, "MTR", "mtr");

    let gmbHeader = document.createElement('div');
    gmbHeader.className = 'section-title';
    gmbHeader.innerHTML = `🚐 接駁專線小巴`;
    container.appendChild(gmbHeader);

    renderCard(container, "108A 小巴 (調景嶺站)", "往 播道書院 / 坑口", gmbTimes, "小巴", "gmb");
    updateTimestamp();

  } catch (error) {
    console.error('獲取港鐵/小巴 API 數據失敗:', error);
  }
}

function renderCard(container, title, dest, timesList, badgeText, cardType) {
  const validTimes = timesList.filter(t => t).slice(0, 2);
  const now = new Date();

  let etaDisplay1 = "無班次資料";
  let etaDisplay2HTML = "";
  let isArriving1 = false;

  if (validTimes.length > 0) {
    const diff1 = Math.round((new Date(validTimes[0]) - now) / 60000);
    const clockTime1 = formatTime(validTimes[0]);
    etaDisplay1 = diff1 <= 0 ? `即將到達 (${clockTime1})` : `${diff1} 分鐘 (${clockTime1})`;
    isArriving1 = diff1 <= 0;

    if (validTimes[1]) {
      const diff2 = Math.round((new Date(validTimes[1]) - now) / 60000);
      const clockTime2 = formatTime(validTimes[1]);
      const text2 = diff2 <= 0 ? `即將到達 (${clockTime2})` : `${diff2} 分鐘 (${clockTime2})`;
      etaDisplay2HTML = `<div class="eta-second">下班: ${text2}</div>`;
    }
  }

  const badgeClass = cardType === 'mtr' ? 'badge-mtr' : 'badge-gmb';
  const card = document.createElement('div');
  card.className = `card ${cardType}`;
  card.innerHTML = `
    <div class="route-info">
      <div class="route-header">
        <span class="route-number" style="font-size: 1.2rem;">${title}</span>
        <span class="company-badge ${badgeClass}">${badgeText}</span>
      </div>
      <span class="destination">${dest}</span>
    </div>
    <div class="eta-container">
      <div class="eta-first ${isArriving1 ? 'eta-arriving' : ''}">${etaDisplay1}</div>
      ${etaDisplay2HTML}
    </div>
  `;
  container.appendChild(card);
}

function updateTimestamp() {
  const now = new Date();
  document.getElementById('update-time').innerText = `最後更新時間：${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function refreshData() {
  if (currentLocation === 'mtr_combo') {
    fetchComboETA();
  } else {
    fetchCitybusETA();
  }
}

refreshData();
if (autoRefreshTimer) clearInterval(autoRefreshTimer);
autoRefreshTimer = setInterval(refreshData, 30000);