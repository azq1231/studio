import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime, timezone, timedelta

def get_taipei_time():
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')

def update_portfolio_data():
    # 用戶目前的持倉
    positions = [
        {"symbol": "5871.TW", "name": "中租-KY", "avg_price": 103.0, "shares": 1000}
    ]
    
    portfolio_status = []
    
    for pos in positions:
        try:
            ticker = yf.Ticker(pos['symbol'])
            df = ticker.history(period='3mo', auto_adjust=False)
            if df.empty: 
                print(f"  ⚠️ {pos['symbol']} 無數據，跳過")
                continue
            
            current_p = round(df['Close'].iloc[-1], 2)
            
            # 指標計算
            ma20 = df['Close'].rolling(20).mean().iloc[-1]
            ma20_std = df['Close'].rolling(20).std().iloc[-1]
            bp = round((current_p - (ma20 - 2*ma20_std)) / (4*ma20_std + 0.001), 2)
            
            l9, h9 = df['Low'].rolling(9).min(), df['High'].rolling(9).max()
            rsv = (df['Close']-l9)/(h9-l9+0.001)*100
            K = rsv.ewm(com=2).mean(); D = K.ewm(com=2).mean(); J = round((3*K - 2*D).iloc[-1], 2)
            
            # 損益
            pnl_val = round((current_p - pos['avg_price']) * pos['shares'], 0)
            pnl_pct = round((current_p / pos['avg_price'] - 1) * 100, 2)
            
            # 出場邏輯建議
            action = "HOLD"
            advice = "目前處於超賣冰點，抱緊持股待彈。"
            if J > 80:
                action = "SELL"
                advice = "指標已過熱，建議分批獲利了結。"
            elif J > 50 and current_p > pos['avg_price']:
                action = "WATCH"
                advice = "股價已回升，接近壓力區，留意上攻力道。"

            portfolio_status.append({
                "symbol": pos['symbol'],
                "name": pos['name'],
                "avg_price": pos['avg_price'],
                "current_price": current_p,
                "pnl_value": pnl_val,
                "pnl_percent": pnl_pct,
                "j_val": J,
                "bp": bp,
                "action": action,
                "advice": advice,
                "targets": [108.0, 115.0],
                "stop_loss": 98.0
            })
        except Exception as e:
            print(f"  ❌ 抓取 {pos['symbol']} 失敗: {e}")
            continue

    result = {
        "last_updated": get_taipei_time(),
        "total_invested": sum(p['avg_price'] * p['shares'] for p in positions),
        "positions": portfolio_status
    }
    
    # 使用相對路徑，相容 GitHub Actions (Ubuntu) 與本地 (Windows)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, '..', 'public', 'data', 'portfolio_live.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"✅ 持倉資料已更新至: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    update_portfolio_data()
