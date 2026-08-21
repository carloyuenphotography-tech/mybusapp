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
        <title>K76 巴士到站預報</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #ffd400; margin: 0; padding: 0; }
            header { background-color: #ffd400; padding: 15px; text-align: center; border-bottom: 2px solid #e5bd00; position: sticky; top: 0; z-index: 10; }
            h1 { margin: 0; font-size: 22px; color: #111; }
            .container { max-width: 600px; margin: 10px auto; padding: 10px; }
            .update-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 0 5px; font-size: 14px; color: #333; }
            button { background: #111; color: #ffd400; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
            button:hover { background: #333; }
            
            .stop-card { background: white; margin-bottom: 10px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .stop-header { padding: 12px 15px; font-size: 16px; font-weight: bold; color: #222; background: #fff; border-bottom: 1px solid #eee; }
            .stop-sub { font-size: 12px; color: #666; font-weight: normal; margin-top: 3px; }
            
            .bus-list { padding: 0; margin: 0; list-style: none; }
            .bus-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #f5f5f5; font-size: 15px; }
            .bus-item:last-child { border-bottom: none; }
            .time-tag { color: #0055ff; font-weight: bold; font-size: 18px; }
            .type-tag { color: #666; font-size: 13px; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
            .no-bus { padding: 15px; color: #888; font-size: 14px; text-align: center; }
        </style>
    </head>
    <body>

    <header>
        <h1>K76 巴士到站預報</h1>
    </header>

    <div class="container">
        <div class="update-bar">
            <span id="update-time">更新中...</span>
            <button onclick="fetchBusData()">重新整理</button>
        </div>
        <div id="result-container">載入中...</div>
    </div>

    <script>
        // 我們指定要特別關注的站點 ID 對應名稱
        const targetStops = {
            "K76-U010": "1. 天水圍站 (港鐵天水圍站)",
            "K76-D030": "3. 天富苑欣富閣" // 依據實際回傳對應欣富閣站點
        };

        async function fetchBusData() {
            const container = document.getElementById('result-container');
            const timeContainer = document.getElementById('update-time');
            container.innerHTML = "<div class='stop-card' style='padding:20px; text-align:center;'>正在查詢即時班次...</div>";
            
            try {
                const response = await fetch('/get_bus_data');
                const data = await response.json();
                
                if (data.status === "error") {
                    container.innerHTML = "<div class='stop-card' style='padding:20px; text-align:center;'>取得資料失敗</div>";
                    return;
                }

                timeContainer.textContent = "更新時間：" + (data.routeStatusTime || "--");
                container.innerHTML = "";

                // 過濾出我們想要的站點
                data.busStop.forEach(stop => {
                    // 為了示範，如果 ID 符合我們關注的清單，或者你想全部顯示但把這兩個置頂
                    let stopName = targetStops[stop.busStopId];
                    
                    // 如果只想看特定兩站，可以用下面這行篩選；若想看全部可把條件放寬
                    if (!stopName) return; 

                    let card = document.createElement('div');
                    card.className = 'stop-card';
                    
                    let header = document.createElement('div');
                    header.className = 'stop-header';
                    header.innerHTML = `${stopName} <div class="stop-sub">車費: $5.1 | 樂悠車費: $2.0</div>`;
                    card.appendChild(header);

                    if (stop.bus && stop.bus.length > 0) {
                        let ul = document.createElement('ul');
                        ul.className = 'bus-list';
                        
                        stop.bus.forEach(bus => {
                            let li = document.createElement('li');
                            li.className = 'bus-item';
                            
                            let timeText = bus.arrivalTimeText || bus.departureTimeText || '即將到達';
                            li.innerHTML = `
                                <div>
                                    <span class="time-tag">${timeText}</span>
                                    <span style="color: #444; margin-left: 10px;">預定班次</span>
                                </div>
                                <span class="type-tag">車隊編號 ${bus.busId}</span>
                            `;
                            ul.appendChild(li);
                        });
                        card.appendChild(ul);
                    } else {
                        let noBus = document.createElement('div');
                        noBus.className = 'no-bus';
                        noBus.textContent = "暫無近期預報班次";
                        card.appendChild(noBus);
                    }

                    container.appendChild(card);
                });

            } catch (err) {
                container.innerHTML = "<div class='stop-card' style='padding:20px; text-align:center;'>發生錯誤：" + err.message + "</div>";
            }
        }

        fetchBusData();
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