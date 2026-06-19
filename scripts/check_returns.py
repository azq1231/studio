import yfinance as yf
import pandas as pd

symbols = ['1503.TW', '2317.TW', '5871.TW']
for s in symbols:
    try:
        df = yf.Ticker(s).history(start='2025-01-01', end='2025-12-31', auto_adjust=False)
        if not df.empty:
            start_p = df['Close'].iloc[0]
            end_p = df['Close'].iloc[-1]
            print(f"{s} 2025 年原始漲幅 (Buy & Hold): {round((end_p - start_p) / start_p * 100, 2)}%")
    except:
        print(f"Failed for {s}")
