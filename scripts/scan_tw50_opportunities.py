import yfinance as yf
import pandas as pd
import numpy as np
import json
import os

# 台灣 50 成份股代號與名稱映射
TW50_MAPPING = {
    '2330.TW': '台積電', '2317.TW': '鴻海', '2454.TW': '聯發科', '2308.TW': '台達電', 
    '2303.TW': '聯電', '2382.TW': '廣達', '3711.TW': '日月光投控', '2412.TW': '中華電', 
    '2881.TW': '富邦金', '2882.TW': '國泰金', '1301.TW': '台塑', '1303.TW': '南亞', 
    '2886.TW': '兆豐金', '2002.TW': '中鋼', '2891.TW': '中信金', '1216.TW': '統一', 
    '2357.TW': '華碩', '3231.TW': '緯創', '2884.TW': '玉山金', '2885.TW': '元大金', 
    '2327.TW': '國巨', '2207.TW': '和泰車', '1101.TW': '台泥', '2395.TW': '研華', 
    '2408.TW': '南亞科', '3034.TW': '聯詠', '2892.TW': '第一金', '2880.TW': '華南金', 
    '5880.TW': '合庫金', '2883.TW': '凱基金', '2890.TW': '永豐金', '3045.TW': '台灣大', 
    '2912.TW': '統一超', '4904.TW': '遠傳', '2603.TW': '長榮', '2609.TW': '陽明', 
    '2615.TW': '萬海', '2474.TW': '可成', '3008.TW': '大立光', '3661.TW': '世芯-KY', 
    '6669.TW': '緯穎', '2379.TW': '瑞昱', '1326.TW': '台化', '6505.TW': '台塑化', 
    '1503.TW': '士電', '2345.TW': '智邦', '2301.TW': '光寶科', '5871.TW': '中租-KY', 
    '5876.TW': '上海商銀', '9910.TW': '豐泰'
}

TW50_SYMBOLS = list(TW50_MAPPING.keys())

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
                "n": TW50_MAPPING.get(symbol, symbol),
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
        json.dump(results, f, indent=2, ensure_ascii=True)
    
    print(f"\n✅ 掃描完成，已更新數據至 {os.path.abspath(output_path)}")
    return pd.DataFrame(results)

scan_df = scan_opportunity()
