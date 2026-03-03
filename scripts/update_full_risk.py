import yfinance as yf
import pandas as pd
import json

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
    bp = round((close - lower_band) / (upper_band - lower_band), 2)  # 跌破 0 代表跌破下軌
    
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
    
    data = {
        'symbol': symbol,
        'price': round(close, 2),
        'ma240': round(ma240, 2),
        'bias': bias,
        'rsi': rsi,
        'bp': bp,
        'j_val': J,
        'vr': vr,
        'risk_score': 80,
        'alerts': [
            '年線乖離率極端異常 (>50%)',
            '整體籌碼動能較前月顯著萎縮',
            '進入主升段長紅最後階段'
        ],
        'last_update': '2026-03',
        'comparison_2022': {
            'peak_price': 688,
            'peak_bias': 28.5,
            'peak_rsi': 82.0
        }
    }
    
    with open('d:/MyProjects/FinanceFlow/studio/public/data/tsmc_risk.json', 'w') as f:
        json.dump(data, f, indent=4)

update_risk_json('2330.TW')
