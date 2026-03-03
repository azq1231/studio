import yfinance as yf
import pandas as pd
import numpy as np

def technical_forensics(symbol, dates):
    ticker = yf.Ticker(symbol)
    df = ticker.history(start="2024-01-01", end="2026-03-01")
    df.index = df.index.tz_localize(None)
    
    # Calculate more indicators
    # 1. Bollinger Bands
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD20'] = df['Close'].rolling(window=20).std()
    df['Upper'] = df['MA20'] + (df['STD20'] * 2)
    df['Lower'] = df['MA20'] - (df['STD20'] * 2)
    
    # 2. MACD
    exp1 = df['Close'].ewm(span=12, adjust=False).mean()
    exp2 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = exp1 - exp2
    df['Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['Hist'] = df['MACD'] - df['Signal']
    
    # 3. Volume Trend (10-day median to find dry-up)
    df['Vol_Median'] = df['Volume'].rolling(window=10).median()
    df['Vol_Ratio'] = df['Volume'] / df['Vol_Median']
    
    # 4. KDJ (roughly)
    low_list = df['Low'].rolling(window=9).min()
    high_list = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - low_list) / (high_list - low_list) * 100
    df['K'] = rsv.ewm(com=2).mean()
    df['D'] = df['K'].ewm(com=2).mean()
    df['J'] = 3 * df['K'] - 2 * df['D']

    print(f"{'Date':<12} | {'Close':<8} | {'BB %B':<8} | {'MACD Hist':<10} | {'Vol %':<8} | {'J Value':<8}")
    print("-" * 65)
    
    for d_str in dates:
        d = pd.Timestamp(d_str)
        if d not in df.index:
            d = df.index[df.index.get_indexer([d], method='nearest')[0]]
        
        row = df.loc[d]
        b_percent_b = (row['Close'] - row['Lower']) / (row['Upper'] - row['Lower'])
        
        print(f"{d_str:<12} | {row['Close']:<8.2f} | {b_percent_b:<8.2f} | {row['Hist']:<10.2f} | {row['Vol_Ratio']:<8.2f} | {row['J']:<8.2f}")

# The dates of interest
dates_to_check = ["2025-04-09", "2025-08-20", "2025-11-24"]
technical_forensics("2330.TW", dates_to_check)
