import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def analyze_volume_dynamics():
    # Fetch historical data covering the AI rally period
    symbol = "2330.TW"
    ticker = yf.Ticker(symbol)
    df = ticker.history(start="2024-06-01", end="2026-02-28")
    df.index = df.index.tz_localize(None)
    
    # 1. 10-day and 60-day average volume to clear noise
    df['Vol_MA10'] = df['Volume'].rolling(window=10).mean()
    df['Vol_MA60'] = df['Volume'].rolling(window=60).mean()
    
    # 2. Identify major volume "waves" (Max Vol days in each quarter)
    df['Quarter'] = df.index.to_period('Q')
    quarterly_peaks = df.groupby('Quarter')['Volume'].max().reset_index()
    
    # 3. Correlation between Price and Volume in moving windows
    df['Price_Vol_Corr'] = df['Close'].rolling(window=20).corr(df['Volume'])
    
    print("--- Quarterly Volume Peaks Analysis ---")
    for _, row in quarterly_peaks.iterrows():
        peak_date = df[df['Volume'] == row['Volume']].index[0]
        peak_price = df.loc[peak_date, 'Close']
        print(f"Quarter: {row['Quarter']} | Peak Vol Date: {peak_date.date()} | Price at Vol Peak: {peak_price:.2f}")

    print("\n--- Current Status (2026-02) ---")
    last_10d_avg_vol = df['Vol_MA10'].iloc[-1]
    last_60d_avg_vol = df['Vol_MA60'].iloc[-1]
    max_hist_vol_ma60 = df['Vol_MA60'].max()
    max_hist_vol_ma60_date = df['Vol_MA60'].idxmax().date()
    
    print(f"Current 10d Avg Vol: {last_10d_avg_vol:,.0f}")
    print(f"Current 60d Avg Vol: {last_60d_avg_vol:,.0f}")
    print(f"Historical 60d Avg Vol Peak: {max_hist_vol_ma60:,.0f} (at {max_hist_vol_ma60_date})")
    
    # Check for divergence: Is Current Price > Price at Vol Peak AND Current Vol < Peak Vol?
    # Get price at the 60d Vol peak date
    price_at_vol_peak = df.loc[pd.Timestamp(max_hist_vol_ma60_date), 'Close']
    current_price = df['Close'].iloc[-1]
    
    print(f"\n--- Divergence Check ---")
    print(f"Price at Vol Peak ({max_hist_vol_ma60_date}): {price_at_vol_peak:.2f}")
    print(f"Current Price: {current_price:.2f}")
    
    if current_price > price_at_vol_peak and last_60d_avg_vol < max_hist_vol_ma60 * 0.8:
        print("ALERT: PRECISE VOLUME DIVERGENCE DETECTED.")
        print(f"Price is {((current_price/price_at_vol_peak)-1)*100:.2f}% higher, but Volume is {((last_60d_avg_vol/max_hist_vol_ma60)-1)*100:.2f}% lower.")

analyze_volume_dynamics()
