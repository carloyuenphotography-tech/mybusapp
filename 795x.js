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
  phase4: {
    type: "multi_route",
    title: "🏢 美孚第四期對開"
  },
  mtr_combo: {
    type: "combo",
    title: "🚇 港鐵 + 108A 小巴接駁"
  }
};

let currentLocation = 'meifoo';
let autoRefreshTimer = null;
let isFirstLoad = true; // 用於控制首次載入與後續平滑更新

function switchLocation(locKey) {
  if (currentLocation === locKey) return;
  currentLocation = locKey;
  isFirstLoad = true; // 切換頁籤時重新顯示 loading 避免畫面殘留

  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => tab.classList.remove('active'));

  if (locKey === 'meifoo') tabs[0].classList.add('active');
  else if (locKey === 'evangel') tabs[1].classList.add('active');
  else if (locKey === 'tkopaza') tabs[2].classList.add('active');
  else if (locKey === 'phase4') tabs[3].classList.add('active');
  else if (locKey === 'mtr_combo') tabs[4].classList.add('active');

  document.getElementById('bus-container').innerHTML = '<p class="loading">載入數據中...</p>';
  
  if (locKey === 'mtr_combo') {
    fetchComboETA();
  } else if (locKey === 'phase4') {
    fetchPhase4ETA();
  } else {
    fetchCitybusETA();
  }
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 🌟 核心升級：少於 2 分鐘（120秒）顯示精準秒數，超過則顯示分鐘
function formatEtaDisplay(etaString, actionWord = "到達") {
  if (!etaString) return { text: "暫無資料", isArriving: false };
  const now = new Date();
  const targetTime = new Date(etaString);
  const diffSec = Math.round((targetTime - now) / 1000);
  const clockTime = formatTime(etaString);

  if (diffSec <= 0) {
    return { text: `即將${actionWord} (${clockTime})`, isArriving: true };
  }
  
  // 少於 120 秒（2分鐘）顯示分秒
  if (diffSec < 120) {
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    const text = min > 0 ? `${min}分 ${sec}秒 (${clockTime})` : `${sec} 秒 (${clockTime})`;
    return { text, isArriving: true }; // 2分鐘內轉為醒目紅色閃爍
  }

  // 超過 2 分鐘顯示分鐘
  const diffMin = Math.round(diffSec / 60);
  return { text: `${diffMin} 分鐘 (${clockTime})`, isArriving: false };
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

    const firstBus = firstTwoBuses[0];
    const secondBus = firstTwoBuses[1];
    let displayDest = firstBus.dest_tc || config.defaultDest;

    const eta1Obj = formatEtaDisplay(firstBus.eta);
    const arrivalTime = new Date(new Date(firstBus.eta).getTime() + config.travelTimeMin * 60000);
    const arrivalClockTime = formatTime(arrivalTime.toISOString());
    const totalDiffToDest = Math.round((arrivalTime - new Date()) / 60000);
    const targetStationName = currentLocation === 'meifoo' ? '播道書院' : '美孚';
    
    let arrivalNoticeHTML = '';
    if (currentLocation !== 'tkopaza') {
      arrivalNoticeHTML = `<div style="font-size: 0.8rem; color: #0284c7; margin-top: 4px; font-weight: bold;">預計約 ${totalDiffToDest <= 0 ? '即將' : totalDiffToDest + '分鐘後'} (${arrivalClockTime}) 抵達${targetStationName}</div>`;
    }

    let secondText = '';
    if (secondBus) {
      const eta2Obj = formatEtaDisplay(secondBus.eta);
      secondText = `下班: ${eta2Obj.text}`;
    }

    // 🌟 平滑局部更新：如果是首次載入才重建 DOM，之後只更新內容，徹底消除畫面跳動！
    let card = container.querySelector('.card');
    if (isFirstLoad || !card) {
      container.innerHTML = '';
      card = document.createElement('div');
      card.className = 'card';
      container.appendChild(card);
      isFirstLoad = false;
    }

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
        <div class="eta-first ${eta1Obj.isArriving ? 'eta-arriving' : ''}">${eta1Obj.text}</div>
        <div class="eta-second">${secondText}</div>
      </div>
    `;
    updateTimestamp();

  } catch (error) {
    console.error('獲取 795X API 數據失敗:', error);
    if (isFirstLoad) {
      document.getElementById('bus-container').innerHTML = '<p class="loading">數據載入失敗，請檢查網絡連接</p>';
    }
  }
}

// 🌟 美孚第四期對開：平滑局部更新（不閃爍、不跳動）
async function fetchPhase4ETA() {
  try {
    const container = document.getElementById('bus-container');

    // 1. 同步抓取小巴與巴士資料
    const [gmb90mTimes, gmb90pTimes, gmb92mTimes] = await Promise.all([
      fetchGmbEtas("20013693"),
      fetchGmbEtas("20014386"),
      fetchGmbEtas("20013693")
    ]);

    const gmbRoutesConfig = [
      { route: "90M", times: gmb90mTimes, dest: "荔景 / 浩景臺" },
      { route: "90P", times: gmb90pTimes, dest: "瑪嘉烈醫院 / 荔景" },
      { route: "92M", times: gmb92mTimes, dest: "華員徑" }
    ];

    const targetRoutes = ['905', '904', '171', '46', '45', '6', '42', '30'];
    const kmbRoutes = ['6', '46', '45', '42', '30', '905', '904', '171'];
    const ctbRoutes = ['905', '904', '171'];
    let allEta = [];

    const kmbPromises = kmbRoutes.map(route =>
      fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/70349D91EC82AFE1/${route}/1`)
        .then(res => res.json())
        .then(res => (res.data || []).map(item => ({
          route: String(route),
          dest_tc: item.dest_tc,
          eta: item.eta,
          co: '九巴'
        })))
        .catch(() => [])
    );

    const ctbPromises = ctbRoutes.map(route =>
      fetch(`https://rt.data.gov.hk/v1/transport/citybus-nwfb/eta/CTB/001517/${route}`)
        .then(res => res.json())
        .then(res => (res.data || []).map(item => ({
          route: String(route),
          dest_tc: item.dest_tc || '荔枝角',
          eta: item.eta,
          co: '城巴'
        })))
        .catch(() => [])
    );

    const kmbResults = await Promise.all(kmbPromises);
    const ctbResults = await Promise.all(ctbPromises);

    kmbResults.forEach(list => { if (Array.isArray(list)) allEta = allEta.concat(list); });
    ctbResults.forEach(list => { if (Array.isArray(list)) allEta = allEta.concat(list); });

    allEta = allEta.filter(item => item.eta);
    allEta.sort((a, b) => new Date(a.eta) - new Date(b.eta));

    // 如果是第一次載入，先清空 loading 狀態
    if (isFirstLoad) {
      container.innerHTML = '';
      isFirstLoad = false;
    }

    // 建立一個暫存容器來組合所有 HTML，再一次過更新（避免畫面逐個元素跳動）
    let fragmentHTML = '';

    // 小巴區塊
    fragmentHTML += `<div class="section-title" style="margin-top: 0;">🚐 美孚巴士總站 ➔ 往荔景方向小巴</div>`;
    gmbRoutesConfig.forEach(gmb => {
      const validTimes = gmb.times.filter(t => t).slice(0, 2);
      let etaObj = { text: "暫無班次", isArriving: false };
      let secondText = "";

      if (validTimes.length > 0) {
        etaObj = formatEtaDisplay(validTimes[0], "開出");
        if (validTimes[1]) {
          const eta2Obj = formatEtaDisplay(validTimes[1], "開出");
          secondText = `<div class="eta-second">下班: ${eta2Obj.text}</div>`;
        }
      }

      fragmentHTML += `
        <div class="card gmb">
          <div class="route-info">
            <div class="route-header">
              <span class="route-number" style="font-size: 1.5rem;">${gmb.route}</span>
              <span class="company-badge badge-gmb">專線小巴</span>
            </div>
            <span class="destination">往 ${gmb.dest}</span>
          </div>
          <div class="eta-container">
            <div class="eta-first ${etaObj.isArriving ? 'eta-arriving' : ''}">${etaObj.text}</div>
            ${secondText}
          </div>
        </div>
      `;
    });

    // 巴士區塊
    if (allEta.length > 0) {
      fragmentHTML += `<div class="section-title">🚏 美孚第四期對開站點 (巴士)</div>`;

      const routeMap = {};
      allEta.forEach(item => {
        const r = item.route;
        if (!routeMap[r]) routeMap[r] = [];
        const exists = routeMap[r].some(existing => Math.abs(new Date(existing.eta) - new Date(item.eta)) < 30000);
        if (!exists) routeMap[r].push(item);
      });

      let activeRoutes = Object.keys(routeMap).map(routeNum => ({
        routeNum,
        firstEta: new Date(routeMap[routeNum][0].eta),
        items: routeMap[routeNum]
      }));

      activeRoutes.sort((a, b) => a.firstEta - b.firstEta);

      activeRoutes.forEach(({ routeNum, items }) => {
        const first = items[0];
        const second = items[1];

        const eta1Obj = formatEtaDisplay(first.eta);
        let secondHTML = '';
        if (second) {
          const eta2Obj = formatEtaDisplay(second.eta);
          secondHTML = `<div class="eta-second">下班 (${second.co})：${eta2Obj.text}</div>`;
        }

        const isKmb = first.co === '九巴';
        const cardClass = isKmb ? 'card kmb' : 'card';
        const badgeClass = isKmb ? 'badge-kmb' : '';
        let companyText = first.co;
        if (second && second.co !== first.co) {
          companyText = `${first.co} / ${second.co}`;
        }

        fragmentHTML += `
          <div class="${cardClass}">
            <div class="route-info" style="flex: 1;">
              <div class="route-header">
                <span class="route-number">${routeNum}</span>
                <span class="company-badge ${badgeClass}">${companyText}</span>
              </div>
              <span class="destination">往 ${first.dest_tc}</span>
            </div>
            <div class="eta-container">
              <div class="eta-first ${eta1Obj.isArriving ? 'eta-arriving' : ''}">${eta1Obj.text}</div>
              ${secondHTML}
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = fragmentHTML;
    updateTimestamp();

  } catch (error) {
    console.error('獲取資料失敗:', error);
    if (isFirstLoad) {
      container.innerHTML = '<p class="loading">數據載入失敗，請檢查網絡連接</p>';
    }
  }
}

async function fetchGmbEtas(stopId) {
  try {
    const res = await fetch(`https://data.etagmb.gov.hk/eta/stop/${stopId}`);
    const result = await res.json();
    let etas = [];
    (result.data || []).forEach(g => (g.eta || []).forEach(e => etas.push(e.timestamp || e.time)));
    etas.sort((a, b) => new Date(a) - new Date(b));
    return etas;
  } catch(e) {
    return [];
  }
}

async function fetchComboETA() {
  try {
    const container = document.getElementById('bus-container');
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
        const etaObj = formatEtaDisplay(tkoArrTime.toISOString());

        mtrMeiFooToTkoHTML = `
          <div class="card mtr">
            <div class="route-info" style="flex: 1;">
              <div class="route-header">
                <span class="route-number" style="font-size: 1.15rem;">港鐵 (美孚起步 ➔ 將軍澳)</span>
                <span class="company-badge badge-mtr">MTR</span>
              </div>
              <span class="destination">由美孚站上車 (經荔枝角/長沙灣往太子轉綫)</span>
            </div>
            <div class="eta-container">
              <div class="eta-first ${etaObj.isArriving ? 'eta-arriving' : ''}">${etaObj.text}</div>
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
        const etaObj = formatEtaDisplay(mefArrTime.toISOString());

        mtrTkoToMeiFooHTML = `
          <div class="card mtr">
            <div class="route-info" style="flex: 1;">
              <div class="route-header">
                <span class="route-number" style="font-size: 1.15rem;">港鐵 (將軍澳起步 ➔ 美孚)</span>
                <span class="company-badge badge-mtr">MTR</span>
              </div>
              <span class="destination">由將軍澳站上車 (實時推算)</span>
            </div>
            <div class="eta-container">
              <div class="eta-first ${etaObj.isArriving ? 'eta-arriving' : ''}">${etaObj.text}</div>
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

    const gmb108APromise = fetch("https://data.etagmb.gov.hk/eta/stop/20006977")
      .then(res => res.json())
      .then(data => {
        if (!data || !data.data) return [];
        let targetRoute = Array.isArray(data.data) ? data.data.find(item => item.eta && item.eta.length > 0) : data.data;
        if (targetRoute && targetRoute.eta) {
           return targetRoute.eta.map(i => i.timestamp || i.time).filter(t => t);
        }
        return [];
      }).catch(err => []);

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

    if (isFirstLoad) {
      container.innerHTML = htmlContent;
      isFirstLoad = false;
    } else {
      // 局部保留標題更新
      const existingCombo = container.querySelector('.section-title');
      if (!existingCombo) container.innerHTML = htmlContent;
    }

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

  let etaObj = { text: "無班次資料", isArriving: false };
  let secondHTML = "";

  if (validTimes.length > 0) {
    etaObj = formatEtaDisplay(validTimes[0]);
    if (validTimes[1]) {
      const eta2Obj = formatEtaDisplay(validTimes[1]);
      secondHTML = `<div class="eta-second">下班: ${eta2Obj.text}</div>`;
    }
  }

  const badgeClass = cardType === 'mtr' ? 'badge-mtr' : 'badge-gmb';
  const card = document.createElement('div');
  card.className = `card ${cardType}`;
  card.innerHTML = `
    <div class="route-info" style="flex: 1;">
      <div class="route-header">
        <span class="route-number" style="font-size: 1.2rem;">${title}</span>
        <span class="company-badge ${badgeClass}">${badgeText}</span>
      </div>
      <span class="destination">${dest}</span>
    </div>
    <div class="eta-container">
      <div class="eta-first ${etaObj.isArriving ? 'eta-arriving' : ''}">${etaObj.text}</div>
      ${secondHTML}
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
  } else if (currentLocation === 'phase4') {
    fetchPhase4ETA();
  } else {
    fetchCitybusETA();
  }
}

refreshData();
if (autoRefreshTimer) clearInterval(autoRefreshTimer);
// 🌟 縮短至每 5 秒刷新一次秒數倒數，且因為有防閃爍機制，畫面完全不會跳動！
autoRefreshTimer = setInterval(refreshData, 5000);