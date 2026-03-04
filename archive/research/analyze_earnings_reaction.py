import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def analyze_earnings_reaction(symbol, call_dates):
    ticker = yf.Ticker(symbol)
    start_date = min(pd.to_datetime(call_dates)) - timedelta(days=10)
    end_date = max(pd.to_datetime(call_dates)) + timedelta(days=30)
    
    df = ticker.history(start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
    df.index = df.index.tz_localize(None)
    
    results = []
    for d_str in call_dates:
        d = pd.Timestamp(d_str)
        if d not in df.index:
            try:
                d = df.index[df.index.get_indexer([d], method='nearest')[0]]
            except:
                continue
        
        price_at_call = df.loc[d, 'Close']
        # 10 days after and 20 days after
        try:
            price_10d = df.loc[d : d + timedelta(days=10)].iloc[-1]['Close']
            price_20d = df.loc[d : d + timedelta(days=20)].iloc[-1]['Close']
            
            change_10d = (price_10d - price_at_call) / price_at_call * 100
            change_20d = (price_20d - price_at_call) / price_at_call * 100
            
            results.append({
                "Call Date": d_str,
                "Price at Call": round(price_at_call, 2),
                "10d Return %": round(change_10d, 2),
                "20d Return %": round(change_20d, 2),
                "Impact": "Crash/Drop" if change_20d < -5 else ("Rally" if change_20d > 5 else "Sideways")
            })
        except:
            continue
            
    return pd.DataFrame(results)

# Key historical earnings calls near suspected peaks
calls = [
    "2015-04-16", "2015-07-16",
    "2021-01-14", "2021-07-15",
    "2022-01-13", "2022-04-14",
    "2024-04-18", "2024-07-18", "2024-10-17",
    "2025-01-16", "2025-04-17", "2025-07-17", "2025-10-16"
]

report = analyze_earnings_reaction("2330.TW", calls)
print("--- TSMC Post-Earnings Performance Analysis ---")
print(report.to_string())

# Calculate hit rate of "Crash/Drop"
drop_count = len(report[report['Impact'] == "Crash/Drop"])
total = len(report)
print(f"\nSummary: {drop_count}/{total} calls followed by >5% drop within 20 days.")
