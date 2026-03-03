import yfinance as yf
import pandas as pd
import numpy as np

def backtest_signal_at_date(symbol, target_date_str):
    ticker = yf.Ticker(symbol)
    target_date = pd.to_datetime(target_date_str)
    # Fetch data up to BUT NOT INCLUDING future dates
    df = ticker.history(start="2024-01-01", end=(target_date + pd.Timedelta(days=1)).strftime('%Y-%m-%d'))
    df.index = df.index.tz_localize(None)
    
    # Technical Indicators (only using past data)
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA60'] = df['Close'].rolling(window=60).mean()
    df['Bias20'] = (df['Close'] - df['MA20']) / df['MA20'] * 100
    
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # Get the state ON calculations for the target date
    now = df.loc[target_date]
    
    print(f"\n--- 時光倒流至: {target_date_str} ---")
    print(f"當天收盤價: {now['Close']:.2f}")
    print(f"RSI(14): {now['RSI']:.2f} (指標意義: {'超跌!' if now['RSI'] < 30 else '穩定'})")
    print(f"月線乖離: {now['Bias20']:.2f}% (指標意義: {'負乖離過大!' if now['Bias20'] < -5 else '正常'})")
    
    # Check if there was a "Buy Signal" that day without knowing the future
    is_signal = (now['RSI'] < 35) or (now['Bias20'] < -7)
    print(f">>> 當時是否具備系統買進訊號? {'Yes' if is_signal else 'No'}")

# Test the three previous "Gold" dates
backtest_signal_at_date("2330.TW", "2025-04-09") # The Deep Bottom
backtest_signal_at_date("2025-08-20") # The Pullback
backtest_signal_at_date("2025-11-24") # The Base Breakout
