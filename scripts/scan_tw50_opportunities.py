import yfinance as yf
import pandas as pd
import numpy as np
import json
import os

# 台灣 50 成份股代碼 (0050 指數主要權值股)
TW50_SYMBOLS = [
    '2330.TW', '2317.TW', '2454.TW', '2308.TW', '2303.TW', '2382.TW', '3711.TW', '2412.TW', 
    '2881.TW', '2882.TW', '1301.TW', '1303.TW', '2886.TW', '2002.TW', '2891.TW', '1216.TW', 
    '2357.TW', '3231.TW', '2884.TW', '2885.TW', '2327.TW', '2207.TW', '1101.TW', '2395.TW', 
    '2408.TW', '3034.TW', '2892.TW', '2880.TW', '5880.TW', '2883.TW', '2890.TW', '3045.TW', 
    '2912.TW', '4904.TW', '2603.TW', '2609.TW', '2615.TW', '2474.TW', '3008.TW', '3661.TW', 
    '6669.TW', '2379.TW', '1326.TW', '6505.TW', '1503.TW', '2345.TW', '2301.TW', '5871.TW', 
    '5876.TW', '9910.TW'
]

def scan_opportunity():
    results = []
    print(f"正在掃描台股五十成份股共 {len(TW50_SYMBOLS)} 檔...")
    
    for symbol in TW50_SYMBOLS:
        try:
            # 增加數據長度以計算 MA240 (年線)
            df = yf.Ticker(symbol).history(period='2y', interval='1d', auto_adjust=False)
            if df.empty or len(df) < 240: continue
            
            # 1. 最新價
            close = df['Close'].iloc[-1]
            
            # 2. Bias (乖離率) - 使用 MA240
            ma240 = df['Close'].rolling(window=240).mean().iloc[-1]
            bias = round((close - ma240) / ma240 * 100, 1)
            
            # 3. J Value
            l9 = df['Low'].rolling(window=9).min()
            h9 = df['High'].rolling(window=9).max()
            rsv = (df['Close'] - l9) / (h9 - l9 + 0.001) * 100
            K = rsv.ewm(com=2).mean()
            D = K.ewm(com=2).mean()
            J = (3 * K - 2 * D).iloc[-1]
            
            # 4. 布林帶位階 (BP)
            ma20 = df['Close'].rolling(20).mean().iloc[-1]
            std20 = df['Close'].rolling(20).std().iloc[-1]
            lower = ma20 - (std20 * 2)
            upper = ma20 + (std20 * 2)
            bp = (close - lower) / (upper - lower + 0.001)
            
            # 5. 狀態判定
            status = "HOLD"
            if J < 10 and bp < 0.1:
                status = "BUY"
            elif J > 90 or bp > 0.9:
                status = "SELL"
            
            results.append({
                "s": symbol,
                "p": round(close, 2),
                "b": bias,
                "j": round(J, 1),
                "bp": round(bp, 2),
                "st": status
            })
            print(f"  - {symbol}: {round(close, 1)} (J:{round(J, 1)}) -> {status}")
        except Exception as e:
            print(f"  ❌ {symbol} 錯誤: {e}")
            continue
            
    # 使用相對路徑，相容 GitHub Actions (Ubuntu) 與本地 (Windows)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, '..', 'public', 'data', 'tw50_full_scan.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ 掃描完成，已更新數據至 {os.path.abspath(output_path)}")
    return pd.DataFrame(results)

scan_df = scan_opportunity()
