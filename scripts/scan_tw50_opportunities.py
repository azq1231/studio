import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime

# 定義 50 檔對照表，確保後端直接輸出中文
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

def scan_opportunity():
    results = []
    print("正在掃描台股五十成份股共 50 檔...")
    
    for symbol, name in TW50_MAPPING.items():
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period='3mo', auto_adjust=False)
            if df.empty: continue
            
            prices = df['Close']
            current_p = round(prices.iloc[-1], 2)
            
            # MA20/Std
            ma20 = prices.rolling(20).mean().iloc[-1]
            ma20_std = prices.rolling(20).std().iloc[-1]
            bp = round((current_p - (ma20 - 2*ma20_std)) / (4*ma20_std + 0.001), 2)
            
            # KDJ (J)
            l9, h9 = df['Low'].rolling(9).min(), df['High'].rolling(9).max()
            rsv = (prices - l9) / (h9 - l9 + 0.001) * 100
            K = rsv.ewm(com=2).mean()
            D = K.ewm(com=2).mean()
            J = round((3*K - 2*D).iloc[-1], 2)
            
            status = "HOLD"
            if J < 20: status = "BUY"
            elif J > 80: status = "SELL"
            
            results.append({
                "s": symbol,
                "n": name, # 直接注入中文名稱，解決手機快取問題
                "p": current_p,
                "j": J,
                "bp": bp,
                "st": status,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            print(f"  - {symbol} ({name}): {current_p} (J:{J}) -> {status}")
            
        except Exception as e:
            print(f"  Error {symbol}: {e}")
            
    # 使用相對路徑，相容 GitHub Actions (Ubuntu) 與本地 (Windows)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, '..', 'public', 'data', 'tw50_full_scan.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n掃描完成，已更新數據至 {os.path.abspath(output_path)}")
    return results

if __name__ == "__main__":
    scan_opportunity()
