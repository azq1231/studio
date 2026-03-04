import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def analyze_recent_divergences():
    symbol = "2330.TW"
    ticker = yf.Ticker(symbol)
    # Fetch half year data
    df = ticker.history(start="2025-08-01", end="2026-03-01")
    df.index = df.index.tz_localize(None)
    
    # Smooth data to identify trends
    df['Price_MA5'] = df['Close'].rolling(window=5).mean()
    df['Vol_MA10'] = df['Volume'].rolling(window=10).mean()
    
    # Identify price local peaks (swings)
    # A peak is defined as a point higher than its neighbors
    df['is_peak'] = (df['Price_MA5'] > df['Price_MA5'].shift(1)) & (df['Price_MA5'] > df['Price_MA5'].shift(-1))
    
    peaks = df[df['is_peak'] == True].copy()
    
    results = []
    print("--- 2025/08 - 2026/02 Divergence Wave Analysis ---")
    
    for date, row in peaks.iterrows():
        # Look back 20 days to find volume peak
        lookback = df.loc[date - timedelta(days=30):date]
        if lookback.empty: continue
        
        v_peak_date = lookback['Vol_MA10'].idxmax()
        v_peak_val = lookback['Vol_MA10'].max()
        
        current_vol_ma10 = df.loc[date, 'Vol_MA10']
        
        # If current volume is lower than the peak in this swing
        if current_vol_ma10 < v_peak_val * 0.95:
            # Check what happened NEXT (Next 15 days)
            after = df.loc[date : date + timedelta(days=20)]
            if len(after) < 5: continue
            
            drawdown = (after['Close'].min() - row['Close']) / row['Close'] * 100
            recovery_price = after['Close'].max()
            
            results.append({
                "Date": date.strftime('%Y-%m-%d'),
                "Price": round(row['Close'], 2),
                "Vol_At_Peak": f"{current_vol_ma10:,.0f}",
                "Vol_Peak_Ref": f"{v_peak_val:,.0f}",
                "Decay": f"{((current_vol_ma10/v_peak_val)-1)*100:.1f}%",
                "Max_20d_Drop": f"{drawdown:.2f}%",
                "Outcome": "Collapsed" if drawdown < -8 else ("Corrected" if drawdown < -4 else "Absorbed")
            })

    report = pd.DataFrame(results)
    print(report.to_string())
    return report

analyze_recent_divergences()
