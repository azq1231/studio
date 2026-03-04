import yfinance as yf
import pandas as pd
import numpy as np

def analyze_entry_points():
    symbol = "2330.TW"
    ticker = yf.Ticker(symbol)
    df = ticker.history(period="2y")
    df.index = df.index.tz_localize(None)
    
    current_price = df['Close'].iloc[-1]
    
    # 1. Moving Averages (Traditional Support)
    ma_levels = {
        "MA20 (月線 - 短線支撐)": df['Close'].rolling(window=20).mean().iloc[-1],
        "MA60 (季線 - 中期生命線)": df['Close'].rolling(window=60).mean().iloc[-1],
        "MA120 (半年線 - 趨勢線)": df['Close'].rolling(window=120).mean().iloc[-1],
        "MA240 (年線 - 長期底線)": df['Close'].rolling(window=240).mean().iloc[-1],
    }
    
    # 2. Volume Profile (Where the crowd bought)
    # We look at the last 1 year of trading volume distributed by price
    bins = 20
    hist, bin_edges = np.histogram(df['Close'].iloc[-250:], bins=bins, weights=df['Volume'].iloc[-250:])
    poc_index = np.argmax(hist)
    poc_price = (bin_edges[poc_index] + bin_edges[poc_index+1]) / 2
    
    # 3. Gap Analysis (Identifying unfilled gaps)
    # Looking for significant gaps (>2%) in the last 6 months
    df['Prev_Close'] = df['Close'].shift(1)
    df['Gap'] = (df['Open'] - df['Prev_Close']) / df['Prev_Close'] * 100
    major_gaps = df[(df['Gap'] > 2) & (df.index > (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d'))]
    
    print(f"Current Price: {current_price:.2f}\n")
    print("--- 均線支撐參考 ---")
    for name, val in ma_levels.items():
        print(f"{name}: {val:.2f} (距離目前: {((val/current_price)-1)*100:.1f}%)")
        
    print("\n--- 籌碼密集區 (Volume Profile) ---")
    print(f"最大籌碼堆積價位 (POC): {poc_price:.2f}")
    
    print("\n--- 缺口防線 ---")
    if not major_gaps.empty:
        for date, row in major_gaps.tail(3).iterrows():
            print(f"日期: {date.date()} | 跳空價位: {row['Prev_Close']:.2f}")

    # 4. Logical Entry Strategy
    print("\n--- 策略建議 (Entry Strategy) ---")
    print(f"1. 積極進場 (短線): {ma_levels['MA20 (月線 - 短線支撐)']:.2f} 附近。")
    print(f"2. 穩健進場 (中線): {ma_levels['MA60 (季線 - 中期生命線)']:.2f} 至 {poc_price:.2f} 區間。")
    print(f"3. 安全進場 (長期): {ma_levels['MA120 (半年線 - 趨勢線)']:.2f} 附近，此處為乖離率回歸正常的黃金區。")

from datetime import datetime, timedelta
analyze_entry_points()
