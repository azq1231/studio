import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime

def update_risk_json(symbol):
    df = yf.Ticker(symbol).history(period='2y', auto_adjust=False)
    df.index = df.index.tz_localize(None)
    
    # 1. 抓取最新收盤
    close = df['Close'].iloc[-1]
    
    # 2. 均線與乖離率 (賣出指標)
    ma240 = df['Close'].rolling(240).mean().iloc[-1]
    bias = round((close - ma240) / ma240 * 100, 2)
    
    # 3. RSI (熱度指標)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi = round((100 - (100 / (1 + rs))).iloc[-1], 2)
    
    # 4. 布林通道位置 (買進指標)
    ma20 = df['Close'].rolling(20).mean().iloc[-1]
    std20 = df['Close'].rolling(20).std().iloc[-1]
    lower_band = ma20 - (std20 * 2)
    upper_band = ma20 + (std20 * 2)
    bp = round((close - lower_band) / (upper_band - lower_band), 2)
    
    # 5. J Value (超賣指標)
    l9 = df['Low'].rolling(window=9).min()
    h9 = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - l9) / (h9 - l9) * 100
    K = rsv.ewm(com=2).mean()
    D = K.ewm(com=2).mean()
    J = round((3 * K - 2 * D).iloc[-1], 2)
    
    # 6. 量能倍數 (恐慌量指標)
    vol_median = df['Volume'].rolling(10).median().iloc[-1]
    vol = df['Volume'].iloc[-1]
    vr = round(vol / vol_median, 2)
    
    # 動態風險分數
    score = 0
    if bias > 50: score += 30
    elif bias > 30: score += 20
    elif bias > 15: score += 10
    if rsi > 70: score += 20
    elif rsi > 50: score += 10
    if J > 80: score += 15
    elif J > 50: score += 5
    if bp > 0.8: score += 15
    elif bp > 0.5: score += 5
    risk_score = min(100, max(0, score))

    # 動態警告
    alerts = []
    if bias > 50:
        alerts.append(f'年線乖離率極端異常 ({bias}%，超過50%警戒線)')
    elif bias > 30:
        alerts.append(f'年線乖離率偏高 ({bias}%)')
    if rsi > 70:
        alerts.append(f'RSI 進入超買區 ({rsi})')
    if J > 80:
        alerts.append(f'KDJ J值過熱 ({J})')
    if vr > 2:
        alerts.append(f'成交量放大異常 (VR: {vr}x)')
    if not alerts:
        alerts.append('目前技術面無重大異常')

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')

    data = {
        'symbol': symbol,
        'price': round(close, 2),
        'ma240': round(ma240, 2),
        'bias': bias,
        'rsi': rsi,
        'bp': bp,
        'j_val': J,
        'vr': vr,
        'risk_score': risk_score,
        'alerts': alerts,
        'last_update': now_str,
        'comparison_2022': {
            'peak_price': 688,
            'peak_bias': 28.5,
            'peak_rsi': 82.0
        }
    }
    
    # 使用相對路徑，相容 GitHub Actions (Ubuntu) 與本地 (Windows)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, '..', 'public', 'data', 'tsmc_risk.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"✅ TSMC 風險資料已更新至: {os.path.abspath(output_path)}")

update_risk_json('2330.TW')
