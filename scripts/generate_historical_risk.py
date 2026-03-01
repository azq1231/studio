import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime

def calculate_rsi(data, window=14):
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def generate_historical_data():
    ticker = "2330.TW"
    target_months = ["2025-10", "2025-11", "2025-12", "2026-01"]
    
    # 抓取足夠長數據
    df = yf.download(ticker, start="2024-01-01", end="2026-02-01", progress=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df['MA240'] = df['Close'].rolling(window=240).mean()
    df['RSI'] = calculate_rsi(df['Close'])

    output_dir = "public/data"
    os.makedirs(output_dir, exist_ok=True)

    for month_str in target_months:
        # 取得該月最後一個交易日
        month_data = df[df.index.strftime('%Y-%m') == month_str]
        if month_data.empty: continue
        
        last_day = month_data.iloc[-1]
        date_key = month_data.index[-1].strftime('%Y-%m-%d')
        
        price = float(last_day['Close'])
        ma240 = float(last_day['MA240'])
        bias = ((price - ma240) / ma240 * 100) if not pd.isna(ma240) else 0
        rsi = float(last_day['RSI'])
        
        # 簡單計算風險分
        risk_score = 0
        alerts = []
        if bias > 20: 
            risk_score += 40
            alerts.append(f"年線乖離率過高 ({bias:.1f}%)")
        if rsi > 70:
            risk_score += 30
            alerts.append(f"RSI 超買 ({rsi:.1f})")
        if price > 1000:
            risk_score += 10
            alerts.append("股價位於千元大關上方")

        result = {
            "symbol": ticker,
            "period": month_str,
            "price": round(price, 2),
            "ma240": round(ma240, 2),
            "bias": round(bias, 2),
            "rsi": round(rsi, 2),
            "risk_score": min(risk_score + 10, 100), # 加上基礎情緒分
            "alerts": alerts,
            "last_update": date_key,
            "comparison_2022": {
                "peak_price": 688,
                "peak_bias": 28.5,
                "peak_rsi": 82.0
            }
        }

        file_path = f"{output_dir}/tsmc_risk_{month_str}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=4, ensure_ascii=False)
        print(f"Generated: {file_path}")

if __name__ == "__main__":
    generate_historical_data()
