import yfinance as yf
import pandas as pd
import numpy as np

def get_unified_history(symbol):
    df = yf.Ticker(symbol).history(start='2021-01-01', end='2026-03-01')
    df.index = df.index.tz_localize(None)
    
    # 1. Indicators
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA240'] = df['Close'].rolling(window=240).mean()
    df['Bias240'] = (df['Close'] - df['MA240']) / df['MA240'] * 100
    df['Vol_MA10'] = df['Volume'].rolling(window=10).mean()
    
    # KDJ (J)
    low_9 = df['Low'].rolling(window=9).min(); high_9 = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - low_9) / (high_9 - low_9) * 100
    df['J'] = 3 * rsv.ewm(com=2).mean() - 2 * rsv.ewm(com=2).mean().ewm(com=2).mean()

    # 2. Extract Yearly Case Studies
    cases = {}
    years = [2021, 2022, 2023, 2024]
    
    for year in years:
        y_df = df[df.index.year == year]
        
        # Peak (Risk Point)
        peak_idx = y_df['Close'].idxmax()
        peak_row = df.loc[peak_idx]
        
        # Find the divergence date before peak (Max Vol MA10)
        pre_peak = df[(df.index >= peak_idx - pd.Timedelta(days=60)) & (df.index <= peak_idx)]
        max_vol_date = pre_peak['Vol_MA10'].idxmax()
        
        # Bottom (Entry Point) - using our formulas
        # Actually find the lowest price in that year
        bottom_idx = y_df['Close'].idxmin()
        bottom_row = df.loc[bottom_idx]
        
        cases[year] = {
            'Peak': {
                'Date': peak_idx.strftime('%Y-%m-%d'),
                'Price': round(peak_row['Close'], 1),
                'Bias240': round(peak_row['Bias240'], 1),
                'Divergence_Date': max_vol_date.strftime('%Y-%m-%d'),
                'Divergence_Days': (peak_idx - max_vol_date).days
            },
            'Bottom': {
                'Date': bottom_idx.strftime('%Y-%m-%d'),
                'Price': round(bottom_row['Close'], 1),
                'J_Value': round(bottom_row['J'], 1),
                'Volume_Ratio': round(bottom_row['Volume'] / df['Volume'].rolling(window=10).median().loc[bottom_idx], 2)
            }
        }
    return cases

unified_data = get_unified_history('2330.TW')
import json
print(json.dumps(unified_data, indent=2))
