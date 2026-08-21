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
        <title>港鐵巴士 K76 即時到站預報</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f9; margin: 0; padding: 15px; color: #333; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; }
            
            /* 頂部標題與返回按鈕 */
            .header-box { padding: 20px; border-bottom: 1px solid #eee; background: #fff; }
            .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .home-link { text-decoration: none; color: #2563eb; font-size: 14px; font-weight: bold; background: #eff6ff; padding: 5px 10px; border-radius: 6px; }
            .home-link:hover { background: #dbeafe; }
            
            .title-row { display: flex; justify-content: space-between; align-items: center; }
            h2 { margin: 0; font-size: 20px; color: #111; }
            .sub-info { font-size: 13px; color: #666; margin-top: 5px; }
            
            .dir-tabs { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; margin-top: 15px; }
            .dir-tab { flex: 1; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; color: #64748b; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
            .dir-tab.active { background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

            /* 時間軸列表 */
            .timeline-container { padding: 20px; }
            .station-item { position: relative; padding-left: 45px; margin-bottom: 25px; padding-top: 8px; padding-bottom: 8px; border-radius: 8px; transition: background 0.2s; }
            .station-item:last-child { margin-bottom: 0; }
            
            /* 重點標註常搭站點的高亮樣式 */
            .station-item.highlight-station { background: #fef08a; border: 1px solid #fde047; padding-left: 53px; }
            
            /* 連線與圓點 */
            .station-item::before { content: ''; position: absolute; left: 19px; top: 40px; bottom: -25px; width: 2px; background: #e2e8f0; }
            .station-item.highlight-station::before { left: 27px; }
            .station-item:last-child::before { display: none; }
            
            .station-badge { position: absolute; left: 0; top: 10px; width: 38px; height: 38px; border-radius: 50%; background: #e2e8f0; color: #475569; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.05); z-index: 2; }
            .station-item.highlight-station .station-badge { left: 8px; background: #eab308; color: white; }
            .station-item.has-bus .station-badge { background: #0284c7; color: white; }
            .station-item.highlight-station.has-bus .station-badge { background: #ca8a04; color: white; }
            
            .station-name { font-size: 16px; font-weight: bold; color: #1e293b; display: flex; align-items: center; }
            .frequent-tag { font-size: 11px; background: #ca8a04; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: normal; }
            
            .station-id { font-size: 12px; color: #94a3b8; margin-top: 2px; font-family: monospace; }

            /* 倒數時間按鈕群組 */
            .eta-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
            .eta-pill { background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 15px; font-size: 13px; font-weight: bold; border: 1px solid #bae6fd; }
            .eta-pill.urgent { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
            .no-eta { font-size: 13px; color: #94a3b8; font-style: italic; margin-top: 5px; }
            
            .loading { text-align: center; padding: 40px; color: #666; font-size: 15px; }
        </style>
    </head>
    <body>

    <div class="container">
        <div class="header-box">
            <div class="top-nav">
                <a href="https://carloyuenphotography-tech.github.io/mybusapp/index.html" class="home-link">← 返回主頁</a>
                <button onclick="loadBusData()" style="background:none; border:1px solid #cbd5e1; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:13px;">重新整理</button>
            </div>
            
            <div class="title-row">
                <h2>港鐵巴士 K76</h2>
            </div>
            <div class="sub-info" id="route-summary">載入中...</div>
            
            <!-- 往返方向切換按鈕 -->
            <div class="dir-tabs">
                <div class="dir-tab active" id="tab-th" onclick="switchDirection('th')">往 天恆</div>
                <div class="dir-tab" id="tab-tsw" onclick="switchDirection('tsw')">往 天水圍站</div>
            </div>
        </div>

        <div class="timeline-container" id="timeline">
            <div class="loading">正在向港鐵伺服器取得最新班次...</div>
        </div>
    </div>

    <script>
        let apiData = null;
        let currentDir = 'th'; // 'th' = 往天恆 (D開頭), 'tsw' = 往天水圍站 (U開頭)

        const stopNames = {
            "K76-D010": "天水圍站 (港鐵天水圍站)",
            "K76-D020": "天恩邨",
            "K76-D030": "天澤邨",
            "K76-D040": "天恆 (天恆站)",
            
            "K76-U010": "天恒",
            "K76-U020": "天逸邨逸潭樓",
            "K76-U030": "天富苑欣富閣",
            "K76-U040": "天盛苑 (港鐵天水圍站)",
            "K76-U050": "天水圍站 (港鐵天水圍站)"
        };

        async function loadBusData() {
            try {
                const response = await fetch('/get_bus_data');
                apiData = await response.json();
                render();
            } catch (err) {
                document.getElementById('timeline').innerHTML = `<div class="loading">連線錯誤: ${err.message}</div>`;
            }
        }

        function switchDirection(dir) {
            currentDir = dir;
            document.getElementById('tab-th').className = `dir-tab ${dir === 'th' ? 'active' : ''}`;
            document.getElementById('tab-tsw').className = `dir-tab ${dir === 'tsw' ? 'active' : ''}`;
            render();
        }

        function render() {
            if (!apiData || !apiData.busStop) return;

            const timeline = document.getElementById('timeline');
            timeline.innerHTML = '';

            const filteredStops = apiData.busStop.filter(stop => {
                if (currentDir === 'th') {
                    return stop.busStopId.startsWith('K76-D');
                } else {
                    return stop.busStopId.startsWith('K76-U');
                }
            });

            document.getElementById('route-summary').textContent = `${filteredStops.length} 個巴士站 · 終點站：${currentDir === 'th' ? '天恆' : '天水圍站'}`;

            filteredStops.forEach((stop, index) => {
                let name = stopNames[stop.busStopId] || stop.busStopId;
                let hasBus = stop.bus && stop.bus.length > 0;

                // 判斷是否為常用常搭站點需要特別高亮
                // 往天恆(th)高亮「天水圍站」, 往天水圍站(tsw)高亮「天富苑欣富閣」
                let isHighlight = false;
                if (currentDir === 'th' && stop.busStopId === 'K76-D010') {
                    isHighlight = true;
                } else if (currentDir === 'tsw' && stop.busStopId === 'K76-U030') {
                    isHighlight = true;
                }

                let item = document.createElement('div');
                item.className = `station-item ${hasBus ? 'has-bus' : ''} ${isHighlight ? 'highlight-station' : ''}`;

                let pillsHtml = '';
                if (hasBus) {
                    stop.bus.forEach(bus => {
                        let text = bus.arrivalTimeText || bus.departureTimeText || '即將到達';
                        let isUrgent = text.includes('即將') || (text.includes('分鐘') && parseInt(text) <= 3);
                        pillsHtml += `<span class="eta-pill ${isUrgent ? 'urgent' : ''}">${text}</span>`;
                    });
                } else {
                    pillsHtml = `<div class="no-eta">暫無近期班次預報</div>`;
                }

                item.innerHTML = `
                    <div class="station-badge">${index + 1}</div>
                    <div class="station-name">
                        ${name} ${isHighlight ? '<span class="frequent-tag">常搭站</span>' : ''}
                    </div>
                    <div class="station-id">${stop.busStopId}</div>
                    <div class="eta-pills">${pillsHtml}</div>
                `;

                timeline.appendChild(item);
            });
        }

        loadBusData();
        setInterval(loadBusData, 30000);
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