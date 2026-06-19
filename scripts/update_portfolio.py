import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta

def get_taipei_time():
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')

def get_positions():
    """
    動態獲取持股配置：
    1. 優先嘗試從 Firestore 的 marketRecords/portfolio 讀取。
    2. 若失敗，嘗試讀取本地 portfolio_live.json。
    3. 若以上皆失敗，使用預設的中租-KY 作為 Fallback。
    """
    default_positions = [
        {"symbol": "5871.TW", "name": "中租-KY", "avg_price": 103.0, "shares": 1000}
    ]
    
    db = None
    # 1. 嘗試初始化 Firebase 並讀取 Firestore
    try:
        if not firebase_admin._apps:
            # 優先從環境變數讀取 (GitHub Actions)
            sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
            if sa_json:
                key_dict = json.loads(sa_json)
                cred = credentials.Certificate(key_dict)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
            else:
                # 嘗試讀取本地 service-account.json
                current_dir = os.path.dirname(os.path.abspath(__file__))
                sa_path = os.path.join(current_dir, '..', 'service-account.json')
                if os.path.exists(sa_path):
                    cred = credentials.Certificate(sa_path)
                    firebase_admin.initialize_app(cred)
                    db = firestore.client()
        else:
            db = firestore.client()
    except Exception as e:
        print(f"⚠️ Firebase 初始化失敗: {e}")

    if db:
        try:
            doc_ref = db.collection('marketRecords').document('portfolio')
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                positions = data.get('positions', [])
                if positions:
                    print(f"📥 成功從 Firestore 讀取到 {len(positions)} 筆持股配置。")
                    return [
                        {
                            "symbol": p["symbol"],
                            "name": p.get("name", p["symbol"]),
                            "avg_price": float(p["avg_price"]),
                            "shares": int(p.get("shares", 1000))
                        }
                        for p in positions
                    ]
        except Exception as e:
            print(f"⚠️ 從 Firestore 讀取持股失敗: {e}")

    # 2. 嘗試從本地 JSON 讀取
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        local_path = os.path.join(current_dir, '..', 'studio', 'public', 'data', 'portfolio_live.json')
        if os.path.exists(local_path):
            with open(local_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                positions = data.get('positions', [])
                if positions:
                    print(f"📥 成功從本地 JSON 讀取到 {len(positions)} 筆持股配置。")
                    return [
                        {
                            "symbol": p["symbol"],
                            "name": p.get("name", p["symbol"]),
                            "avg_price": float(p["avg_price"]),
                            "shares": int(p.get("shares", 1000))
                        }
                        for p in positions
                    ]
    except Exception as e:
        print(f"⚠️ 從本地 JSON 讀取持股失敗: {e}")

    # 3. Fallback 到硬編碼
    print("📥 使用硬編碼預設持股配置。")
    return default_positions

def update_portfolio_data():
    positions = get_positions()
    portfolio_status = []
    
    for pos in positions:
        symbol = pos['symbol']
        name = pos['name']
        avg_price = pos['avg_price']
        shares = pos['shares']
        
        print(f"🔄 正在計算 {name} ({symbol}) 的量化策略指標...")
        
        try:
            ticker = yf.Ticker(symbol)
            # 抓取 3 個月歷史數據以計算 KDJ 和布林通道
            df = ticker.history(period='3mo', auto_adjust=True)
            if df.empty:
                print(f"  ⚠️ 無法獲取 {symbol} 的歷史價格數據")
                continue
            
            close_series = df['Close']
            current_p = round(close_series.iloc[-1], 2)
            pnl_val = round((current_p - avg_price) * shares, 0)
            pnl_pct = round((current_p / avg_price - 1) * 100, 2)
            
            # --- 計算 KDJ 策略中的 J 值 ---
            j_val = 0.0
            if len(df) >= 9:
                l9 = df['Low'].rolling(window=9).min()
                h9 = df['High'].rolling(window=9).max()
                denom = h9 - l9 + 0.001
                rsv = (close_series - l9) / denom * 100
                K = rsv.ewm(com=2).mean()
                D = K.ewm(com=2).mean()
                J = 3 * K - 2 * D
                j_val = round(float(J.iloc[-1]), 1)
            
            # --- 計算布林位階 (BP) ---
            bp_val = 0.5
            if len(df) >= 20:
                ma20 = close_series.rolling(20).mean().iloc[-1]
                std20 = close_series.rolling(20).std().iloc[-1]
                lower = ma20 - (std20 * 2)
                upper = ma20 + (std20 * 2)
                denom = upper - lower + 0.001
                bp = (current_p - lower) / denom
                bp_val = round(float(bp), 2)
            
            # --- 策略點位計算與動態指令生成 ---
            # 獲利目標點為成本的 +5% 與 +12%
            targets = [
                round(avg_price * 1.05, 1),
                round(avg_price * 1.12, 1)
            ]
            # 停損點為成本的 -10%
            stop_loss = round(avg_price * 0.9, 1)
            
            action = "HOLD"
            advice = "⏳ 價格目前在區間震盪，建議繼續持有並觀察 J 值動向。"
            
            if current_p <= stop_loss:
                action = "STOP_LOSS"
                advice = f"🚨 已跌破停損價 {stop_loss}，觸及硬性停損線，請嚴格執行紀律出場。"
            elif current_p >= targets[1]:
                action = "TAKE_PROFIT_ALL"
                advice = f"🎉 已抵達最終結案點 {targets[1]} (目標 +12%)，建議全數獲利了結。"
            elif current_p >= targets[0]:
                action = "TAKE_PROFIT_PART"
                advice = f"📈 已抵達首波獲利點 {targets[0]} (目標 +5%)，建議可分批減碼落袋為安。"
            elif j_val < 0 and bp_val < 0.15:
                action = "BUY_MORE"
                advice = f"🔥 J值({j_val})與布林位階({bp_val})均觸及冰點超賣區，建議在防線之上逢低加碼。"
            elif j_val > 80 or bp_val > 0.85:
                action = "SELL_WARN"
                advice = f"⚠️ J值({j_val})與布林位階({bp_val})進入超買區，短期追高風險增加，建議暫停加碼。"
            
            portfolio_status.append({
                "symbol": symbol,
                "name": name,
                "avg_price": avg_price,
                "shares": shares,
                "current_price": current_p,
                "pnl_value": pnl_val,
                "pnl_percent": pnl_pct,
                "j_val": j_val,
                "bp": bp_val,
                "action": action,
                "advice": advice,
                "targets": targets,
                "stop_loss": stop_loss,
                "risk_note": "單一持倉占比過高，請注意分散風險。" if shares * avg_price > 150000 else "倉位控制在安全範圍內。"
            })
        except Exception as e:
            print(f"❌ 抓取或計算 {symbol} 失敗: {e}")
            continue

    result = {
        "last_updated": get_taipei_time(),
        "total_invested": sum(p['avg_price'] * p['shares'] for p in portfolio_status),
        "positions": portfolio_status
    }
    
    # 輸出至前端靜態 JSON
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, '..', 'studio', 'public', 'data', 'portfolio_live.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"✅ 持倉審計更新完成，共更新 {len(portfolio_status)} 檔標的。")

if __name__ == "__main__":
    update_portfolio_data()
