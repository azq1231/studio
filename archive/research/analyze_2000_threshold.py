import yfinance as yf
import pandas as pd
import numpy as np

def analyze_2000_threshold():
    # Focused analysis on the last 15 trading days
    symbol = "2330.TW"
    ticker = yf.Ticker(symbol)
    df = ticker.history(period="1mo")
    df.index = df.index.tz_localize(None)
    
    # 1. Price Volatility at high levels
    df['Daily_Range'] = (df['High'] - df['Low']) / df['Close'] * 100
    avg_volatility = df['Daily_Range'].mean()
    
    # 2. Accumulation/Distribution (OBV-like logic)
    df['Money_Flow'] = df['Close'].diff() * df['Volume']
    flow_sum = df['Money_Flow'].iloc[-5:].sum()
    
    # 3. Last 3 days specifics
    last_3_days = df.iloc[-3:]
    
    print("--- 2000 Resistance/Support Analysis ---")
    print(last_3_days[['Close', 'Volume', 'Daily_Range']].to_string())
    
    print(f"\nAvg Daily Volatility: {avg_volatility:.2f}%")
    print(f"Total Money Flow (Last 5d): {flow_sum:,.0f}")
    
    # Conclusion logic for advice matrix
    current_price = df['Close'].iloc[-1]
    
    if flow_sum < 0 and current_price > 1950:
        print("\nDIAGNOSIS: PRICE IS HIGH BUT MONEY IS FLOWING OUT (Distribution).")
    elif flow_sum > 0 and current_price > 1950:
        print("\nDIAGNOSIS: BULLS ARE STILL DEFENDING THE 2000 MARK.")
        
    # Reward/Risk Ratio estimate
    # Targets: Next level 2200 (+10%)
    # Risks: Pullback to 60d MA or Gap fill (~1600) (-20%)
    print(f"Hypothetical Reward/Risk: 1:2 (Potential +10% vs -20% pullback)")

analyze_2000_threshold()
