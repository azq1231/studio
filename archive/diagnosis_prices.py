import yfinance as yf
from datetime import datetime

symbols = ['2330.TW', '2317.TW', '5871.TW']
print(f"Checking prices at {datetime.now()}")

for s in symbols:
    try:
        t = yf.Ticker(s)
        hist = t.history(period='1d')
        if not hist.empty:
            print(f"{s}: {hist['Close'].iloc[-1]}")
        else:
            print(f"{s}: No data")
    except Exception as e:
        print(f"{s}: Error {e}")
