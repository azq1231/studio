import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def analyze_period(symbol, peak_date_str, months_before=6):
    peak_date = pd.to_datetime(peak_date_str)
    start_date = peak_date - timedelta(days=months_before * 30 + 240)
    
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date.strftime('%Y-%m-%d'), end=(peak_date + timedelta(days=5)).strftime('%Y-%m-%d'))
    
    if df.empty:
        return None
        
    # Standardize index to be timezone-naive for comparison
    df.index = df.index.tz_localize(None)
    
    # Calculate MA240
    df['MA240'] = df['Close'].rolling(window=240).mean()
    df['Bias240'] = (df['Close'] - df['MA240']) / df['MA240'] * 100
    
    # Calculate RSI
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # Filter to the 6 months before peak
    analysis_start = peak_date - timedelta(days=months_before * 30)
    result_df = df.loc[analysis_start:peak_date].copy()
    
    if result_df.empty:
        return None

    stats = {
        "Peak Date": peak_date_str,
        "Peak Price": round(result_df['Close'].max(), 2),
        "Max Bias %": round(result_df['Bias240'].max(), 2),
        "Avg Bias %": round(result_df['Bias240'].mean(), 2),
        "Max RSI": round(result_df['RSI'].max(), 2),
        "Vol Trend": "Increasing" if result_df['Volume'].iloc[-10:].mean() > result_df['Volume'].iloc[:10].mean() else "Decreasing",
        "Days Over 20% Bias": len(result_df[result_df['Bias240'] > 20])
    }
    return stats, result_df

# Define target peaks
peaks = [
    "2021-01-21", # 679 高點 (Bias 極端期)
    "2022-01-17", # 688 高點 (崩盤前夕)
    "2015-03-20", # 庫存修正前
    "2024-07-11"  # 1080 第一次過熱修正
]

summary = []
print("Starting Detailed Crash Precursor Analysis...\n")

for p in peaks:
    try:
        stats, data = analyze_period("2330.TW", p)
        if stats:
            summary.append(stats)
            print(f"Analyzed {p}: Max Bias={stats['Max Bias %']}%, Max RSI={stats['Max RSI']}")
    except Exception as e:
        print(f"Error analyzing {p}: {e}")

# Save results
summary_df = pd.DataFrame(summary)
summary_df.to_csv("scripts/crash_precursor_summary.csv", index=False)
print("\nSummary saved to scripts/crash_precursor_summary.csv")
print("\n--- Technical Comparison ---")
print(summary_df.to_string())
