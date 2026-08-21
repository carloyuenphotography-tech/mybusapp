from flask import Flask, jsonify, render_template_string
import requests

app = Flask(__name__)

# 首頁：顯示一個漂亮的網頁介面
@app.route('/')
def index():
    html_code = """
    <!DOCTYPE html>
    <html lang="zh-Hant">
    <head>
        <meta charset="UTF-8">
        <title>K76 港鐵巴士即時到站查詢</title>
        <style>
            body { font-family: sans-serif; max-width: 800px; margin: 30px auto; padding: 20px; background: #f9f9f9; }
            h1 { color: #0066cc; }
            button { padding: 10px 20px; background: #0066cc; color: white; border: none; cursor: pointer; font-size: 16px; border-radius: 4px; }
            button:hover { background: #004999; }
            .stop-card { background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .stop-title { font-weight: bold; font-size: 18px; color: #333; margin-bottom: 8px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
            ul { margin: 0; padding-left: 20px; }
            li { margin: 5px 0; color: #555; }
        </style>
    </head>
    <body>
        <h1>K76 港鐵巴士即時班次</h1>
        <button onclick="fetchBusData()">重新整理 / 取得最新班次</button>
        <p id="update-time" style="color: #666; font-size: 14px;"></p>
        <div id="result-container" style="margin-top: 20px;">載入中...</div>

        <script>
            async function fetchBusData() {
                const container = document.getElementById('result-container');
                const timeContainer = document.getElementById('update-time');
                container.innerHTML = "正在向港鐵伺服器查詢...";
                
                try {
                    const response = await fetch('/get_bus_data');
                    const data = await response.json();
                    
                    if (data.status === "error") {
                        container.innerHTML = "取得資料失敗";
                        return;
                    }

                    timeContainer.textContent = "系統更新時間：" + data.routeStatusTime;
                    container.innerHTML = "";

                    // 遍歷所有站點
                    data.busStop.forEach(stop => {
                        let card = document.createElement('div');
                        card.className = 'stop-card';
                        
                        let title = document.createElement('div');
                        title.className = 'stop-title';
                        title.textContent = "車站代碼：" + stop.busStopId;
                        card.appendChild(title);

                        if (stop.bus && stop.bus.length > 0) {
                            let ul = document.createElement('ul');
                            stop.bus.forEach(bus => {
                                let li = document.createElement('li');
                                li.textContent = `車輛編號: ${bus.busId} | 預計到站: ${bus.arrivalTimeText || '即將到達'} (${bus.departureTimeText})`;
                                ul.appendChild(li);
                            });
                            card.appendChild(ul);
                        } else {
                            let p = document.createElement('p');
                            p.textContent = "暫無近期班次";
                            card.appendChild(p);
                        }

                        container.appendChild(card);
                    });

                } catch (err) {
                    container.innerHTML = "發生錯誤：" + err.message;
                }
            }

            // 網頁載入時自動抓取一次
            fetchBusData();
        </script>
    </body>
    </html>
    """
    return render_template_string(html_code)

# 後端 API 路由：負責幫網頁發送 POST 請求給港鐵，避開 CORS 限制
@app.route('/get_bus_data')
def get_bus_data():
    url = "https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule"
    payload = {"language": "zh", "routeName": "K76"}
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(port=5000)

import os

if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5000))
  app.run(host="0.0.0.0", port=port)