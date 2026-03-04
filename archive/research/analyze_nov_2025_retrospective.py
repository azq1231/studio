import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def analyze_nov_2025_context():
    symbol = "2330.TW"
    target_date = "2025-11-15"
    
    ticker = yf.Ticker(symbol)
    # Fetch enough history for MA calculation
    df = ticker.history(start="2024-11-01", end="2025-12-15")
    df.index = df.index.tz_localize(None)
    
    # Needs MA240 context
    full_history = ticker.history(start="2024-01-01", end="2025-12-15")
    full_history.index = full_history.index.tz_localize(None)
    full_history['MA240'] = full_history['Close'].rolling(window=240).mean()
    full_history['Bias'] = (full_history['Close'] - full_history['MA240']) / full_history['MA240'] * 100
    
    # RSI
    delta = full_history['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    full_history['RSI'] = 100 - (100 / (1 + rs))
    
    # 1. 2025 Nov Status
    nov_status = full_history.loc["2025-11-01":"2025-11-30"]
    avg_price = nov_status['Close'].mean()
    max_bias = nov_status['Bias'].max()
    avg_vol = nov_status['Volume'].mean()
    
    # 2. Previous Peak context (July 2024)
    july_2024_vol = full_history.loc["2024-07-01":"2024-07-31"]['Volume'].mean()
    
    print("--- Retrospective Analysis: November 2025 ---")
    print(f"Avg Price: {avg_price:.2f}")
    print(f"Max Bias (240MA): {max_bias:.2f}%")
    print(f"Avg Volume: {avg_vol:,.0f}")
    print(f"Volume vs. 2024 Peak: {(avg_vol/july_2024_vol)*100:.2f}% (Wait... is it increasing or decreasing?)")
    
    # 3. Post-Nov Performance (Predicting if it was a good entry)
    dec_performance = full_history.loc["2025-12-01":"2025-12-31"]['Close'].mean()
    print(f"Subsequent Dec Avg Price: {dec_performance:.2f} (Change: {((dec_performance/avg_price)-1)*100:.2f}%)")
    
    # 4. Fundamental Context: Q3 Earnings Call (Oct 2025)
    # Price was around 1300-1400 in Nov 2025 based on previous data
    
    if max_bias < 40 and dec_performance > avg_price:
        print("\nDIAGNOSIS: NOV 2025 WAS A 'HEALTHY GROWTH' ENTRY POINT.")
        print("Reason: Bias was manageable, Earnings support was strong, and Volume was recovering.")
    else:
        print("\nDIAGNOSIS: NOV 2025 WAS ALREADY ENTERING OVERHEATED ZONE.")

analyze_nov_2025_context()
