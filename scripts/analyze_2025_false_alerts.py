import yfinance as yf
import pandas as pd
import numpy as np

def analyze_2025_resilience():
    # Analyze 2024-2026 to see why 2025 held up
    symbol = "2330.TW"
    ticker = yf.Ticker(symbol)
    df = ticker.history(start="2024-01-01", end="2026-02-28")
    df.index = df.index.tz_localize(None)
    
    # Calculate MA240 and Bias
    df['MA240'] = df['Close'].rolling(window=240).mean()
    df['Bias'] = (df['Close'] - df['MA240']) / df['MA240'] * 100
    
    # Peak points in 2025 where Bias was high but it didn't collapse
    peaks_2025 = [
        "2025-02-11", # Post-Lunar New Year rally
        "2025-06-19", # Summer AI surge
        "2025-10-17"  # Post-Q3 Earnings
    ]
    
    results = []
    print("--- 2025 'High Bias' Resilience Analysis ---")
    for p_str in peaks_2025:
        p = pd.Timestamp(p_str)
        if p not in df.index:
            p = df.index[df.index.get_indexer([p], method='nearest')[0]]
            
        # Check what happened in the 2 months AFTER this "High Bias" alert
        after_range = df.loc[p : p + pd.Timedelta(days=60)]
        max_drawdown = (after_range['Close'].min() - df.loc[p, 'Close']) / df.loc[p, 'Close'] * 100
        
        results.append({
            "Date": p.date(),
            "Bias": round(df.loc[p, 'Bias'], 2),
            "Price": round(df.loc[p, 'Close'], 2),
            "Max Drawdown (2mo)": round(max_drawdown, 2),
            "Result": "Correction" if max_drawdown < -10 else "Sideways/Rally"
        })
        
    print(pd.DataFrame(results).to_string())

analyze_2025_resilience()
