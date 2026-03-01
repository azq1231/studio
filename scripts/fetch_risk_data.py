import yfinance as yf
import pandas as pd
import json
from datetime import datetime, timedelta

def calculate_rsi(data, window=14):
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def fetch_tsmc_risk():
    ticker = "2330.TW"
    print(f"正在抓取 {ticker} 數據...")
    
    # 抓取較長一段時間以計算 240MA
    end_date = datetime.now()
    start_date = end_date - timedelta(days=500)
    
    df = yf.download(ticker, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
    
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # 1. 基礎價格與 240MA
    df['MA240'] = df['Close'].rolling(window=240).mean()
    current_price = float(df['Close'].iloc[-1])
    ma240 = float(df['MA240'].iloc[-1]) if not pd.isna(df['MA240'].iloc[-1]) else 0
    bias = ((current_price - ma240) / ma240 * 100) if ma240 != 0 else 0

    # 2. RSI
    df['RSI'] = calculate_rsi(df['Close'])
    current_rsi = float(df['RSI'].iloc[-1])

    # 3. 模擬法人動向 (yf 無法直接拿台股法人買賣超，這裡透過成交量異動模擬)
    # 在實際應用中應對接 TWSE API
    vol_change = float(df['Volume'].pct_change().iloc[-1] * 100)
    
    # 風險評分邏輯 (初步)
    risk_score = 0
    alerts = []
    
    if bias > 20: 
        risk_score += 40
        alerts.append("年線乖離率過高 (>20%)")
    if current_rsi > 70:
        risk_score += 30
        alerts.append("RSI 指標進入超買區 (>70)")
    if current_price > df['Close'].max() * 0.98:
        risk_score += 10
        alerts.append("股價處於歷史極高位")

    result = {
        "symbol": ticker,
        "price": round(current_price, 2),
        "ma240": round(ma240, 2),
        "bias": round(bias, 2),
        "rsi": round(current_rsi, 2),
        "vol_change": round(vol_change, 2),
        "risk_score": min(risk_score, 100),
        "alerts": alerts,
        "last_update": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "comparison_2022": {
            "peak_price": 688,
            "peak_bias": 28.5,
            "peak_rsi": 82.0
        }
    }

    output_path = "public/data/tsmc_risk.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
    
    print(f"風險數據已更新: {output_path}")

if __name__ == "__main__":
    fetch_tsmc_risk()
