from flask import Flask, jsonify, render_template_string
import requests

app = Flask(__name__)


@app.route('/')
def index():
  html_code = """
    <!DOCTYPE html>
    <html lang="zh-Hant">
    <head>
        <meta charset="UTF-8">
        <title>K76 港鐵巴士即時到站預報</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 650px; margin: 0 auto; }
            
            .header-title { font-size: 14px; color: #666; margin-bottom: 10px; font-weight: bold; }
            
            /* 上方即時看板 */
            .dashboard-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; }
            .current-stop-banner { background: #f0f7f4; border-left: 4px solid #10b981; padding: 12px 15px; border-radius: 6px; font-size: 15px; font-weight: bold; color: #065f46; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            
            .eta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .eta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px 10px; text-align: center; }
            .eta-box.active { border-color: #10b981; background: #ecfdf5; }
            .eta-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
            .eta-time { font-size: 20px; font-weight: bold; color: #1e293b; }
            .eta-time.highlight { color: #059669; }
            .eta-busid { font-size: 11px; color: #94a3b8; margin-top: 4px; }

            /* 下方沿途車站列表 (Timeline) */
            .timeline-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; font-weight: bold; font-size: 16px; }
            
            .timeline { position: relative; padding-left: 30px; }
            .timeline::before { content: ''; position: absolute; left: 10px; top: 10px; bottom: 10px; width: 3px; background: #e2e8f0; }
            
            .station-item { position: relative; margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 8px; transition: background 0.2s; }
            .station-item:hover { background: #f8fafc; }
            .station-item.selected { background: #f0fdf4; border: 1px solid #bbf7d0; }
            
            .station-dot { position: absolute; left: -24px; top: 15px; width: 12px; height: 12px; border-radius: 50%; background: #cbd5e1; border: 2px solid white; box-shadow: 0 0 0 2px #cbd5e1; }
            .station-item.selected .station-dot { background: #10b981; box-shadow: 0 0 0 3px #a7f3d0; }
            
            .station-name { font-size: 15px; font-weight: bold; color: #1e293b; }
            .station-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
            .fare-tag { float: right; font-size: 13px; color: #64748b; font-weight: 500; }
            
            .refresh-btn { width: 100%; background: #2563eb; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; }
            .refresh-btn:hover { background: #1d4ed8; }
        </style>
    </head>
    <body>

    <div class="container">
        <div class="header-title">港鐵巴士 MTRBUS > K76</div>

        <!-- 上方即時看板 -->
        <div class="dashboard-card">
            <div class="current-stop-banner" id="banner-text">
                載入中...
            </div>
            
            <div class="eta-grid">
                <div class="eta-box active" id="box-0">
                    <div class="eta-label">下一班</div>
                    <div class="eta-time highlight" id="time-0">--</div>
                    <div class="eta-busid" id="busid-0">請稍候</div>
                </div>
                <div class="eta-box" id="box-1">
                    <div class="eta-label">第二班</div>
                    <div class="eta-time" id="time-1">--</div>
                    <div class="eta-busid" id="busid-1">--</div>
                </div>
                <div class="eta-box" id="box-2">
                    <div class="eta-label">第三班</div>
                    <div class="eta-time" id="time-2">--</div>
                    <div class="eta-busid" id="busid-2">--</div>
                </div>
            </div>
            
            <button class="refresh-btn" onclick="loadData()">重新整理班次</button>
        </div>

        <!-- 下方沿途車站列表 (Timeline) -->
        <div class="timeline-card">
            <div class="timeline-header">
                <span>沿途車站列表</span>
                <span style="font-size: 13px; color: #64748b;">點擊下方車站切換檢視</span>
            </div>
            
            <div class="timeline" id="timeline-container">
                <!-- 動態載入車站 -->
            </div>
        </div>
    </div>

    <script>
        let globalData = null;
        // 預設選中的車站 ID (預設為天水圍站 K76-U010)
        let selectedStopId = "K76-U010";

        // 我們自定義 K76 沿途顯示的關鍵站點與名稱對應
        // 包含了你特別關注的「天水圍站」與「天富苑欣富閣」
        const stationNames = {
            "K76-D010": { name: "天恒", sub: "Tin Heng" },
            "K76-D020": { name: "天逸邨逸潭樓", sub: "Yat Tam House, Tin Yat Estate" },
            "K76-D030": { name: "天富苑欣富閣", sub: "Yan Fu House, Tin Fu Court" },
            "K76-D040": { name: "天恩邨", sub: "Tin Yan Estate" },
            "K76-U010": { name: "天水圍站 (港鐵天水圍站)", sub: "Tin Shui Wai Station" },
            "K76-U020": { name: "天澤邨", sub: "Tin Chak Estate" },
            // 亦可根據 API 實際回傳擴充
        };

        async function loadData() {
            try {
                const response = await fetch('/get_bus_data');
                globalData = await response.json();
                
                if (globalData.status === "error") {
                    alert("取得資料失敗");
                    return;
                }

                renderUI();
            } catch (err) {
                console.error(err);
            }
        }

        function selectStation(stopId) {
            selectedStopId = stopId;
            renderUI();
        }

        function renderUI() {
            if (!globalData || !globalData.busStop) return;

            const timelineContainer = document.getElementById('timeline-container');
            timelineContainer.innerHTML = "";

            let currentStopData = null;

            // 渲染下方時間軸
            globalData.busStop.forEach(stop => {
                // 如果該站點不在我們的對應表內，給它一個預設名稱
                let info = stationNames[stop.busStopId] || { name: "車站代碼: " + stop.busStopId, sub: stop.busStopId };
                
                let isSelected = (stop.busStopId === selectedStopId);
                if (isSelected) {
                    currentStopData = stop;
                }

                let item = document.createElement('div');
                item.className = `station-item ${isSelected ? 'selected' : ''}`;
                item.onclick = () => selectStation(stop.busStopId);

                item.innerHTML = `
                    <div class="station-dot"></div>
                    <span class="fare-tag">$5.1</span>
                    <div class="station-name">${info.name}</div>
                    <div class="station-sub">${info.sub}</div>
                `;
                timelineContainer.appendChild(item);
            });

            // 更新上方看板
            if (currentStopData) {
                let currentInfo = stationNames[currentStopData.busStopId] || { name: currentStopData.busStopId };
                document.getElementById('banner-text').innerHTML = `<span>目前顯示車站：${currentInfo.name}</span>`;

                // 填入前三班次
                for (let i = 0; i < 3; i++) {
                    let timeEl = document.getElementById(`time-${i}`);
                    let busIdEl = document.getElementById(`busid-${i}`);
                    
                    if (currentStopData.bus && currentStopData.bus[i]) {
                        let bus = currentStopData.bus[i];
                        let text = bus.arrivalTimeText || bus.departureTimeText || '即將到達';
                        timeEl.textContent = text;
                        busIdEl.textContent = `車隊編號: ${bus.busId}`;
                    } else {
                        timeEl.textContent = "--";
                        busIdEl.textContent = "暫無班次";
                    }
                }
            }
        }

        // 頁面載入時抓取一次
        loadData();
    </script>

    </body>
    </html>
    """
  return render_template_string(html_code)


@app.route('/get_bus_data')
def get_bus_data():
  url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule'
  payload = {'language': 'zh', 'routeName': 'K76'}
  headers = {'Content-Type': 'application/json'}

  try:
    response = requests.post(url, json=payload, headers=headers)
    return jsonify(response.json())
  except Exception as e:
    return jsonify({'status': 'error', 'message': str(e)})


if __name__ == '__main__':
  app.run(port=5000)