import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def get_micro_analysis(symbol, peak_date_str):
    peak_date = pd.to_datetime(peak_date_str)
    # Look at 20 days before and 5 days after
    start_date = peak_date - timedelta(days=60)
    end_date = peak_date + timedelta(days=10)
    
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
    df.index = df.index.tz_localize(None)
    
    # Needs MA for context
    full_df = ticker.history(start=(start_date - timedelta(days=300)).strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
    full_df.index = full_df.index.tz_localize(None)
    full_df['MA240'] = full_df['Close'].rolling(window=240).mean()
    full_df['Bias'] = (full_df['Close'] - full_df['MA240']) / full_df['MA240'] * 100
    
    # RSI
    delta = full_df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    full_df['RSI'] = 100 - (100 / (1 + rs))
    
    # Filter back to the local peak window
    window = full_df.loc[start_date:end_date].copy()
    
    peak_row = window.loc[peak_date]
    
    # Key Patterns to check:
    # 1. Volume Peak vs Price Peak
    max_vol_date = window['Volume'].idxmax()
    vol_lead_days = (peak_date - max_vol_date).days
    
    # 2. RSI Divergence: Is RSI lower at the price peak than it was recently?
    recent_max_rsi = window['RSI'].max()
    rsi_at_peak = peak_row['RSI']
    rsi_divergence = recent_max_rsi > rsi_at_peak + 2
    
    # 3. Acceleration: Slope of Bias in last 5 days
    bias_slope = (window.loc[peak_date]['Bias'] - window.shift(5).loc[peak_date]['Bias']) / 5
    
    return {
        "Peak": peak_date_str,
        "Price": round(peak_row['Close'], 2),
        "Bias": round(peak_row['Bias'], 2),
        "RSI": round(peak_row['RSI'], 2),
        "Vol Peak Lead (Days)": vol_lead_days,
        "RSI Divergence": rsi_divergence,
        "Bias Accel (5d)": round(bias_slope, 2),
        "Last 3 Days Vol Change %": round(window['Volume'].iloc[-5:-1].pct_change().mean() * 100, 2)
    }

peaks = ["2021-01-21", "2022-01-17", "2024-07-11"]
results = []
for p in peaks:
    results.append(get_micro_analysis("2330.TW", p))

# Also need current 2026 status to compare
current_df = yf.Ticker("2330.TW").history(period="1y")
current_df.index = current_df.index.tz_localize(None)
# Mock current 2026 data based on user info (Price ~1995)
# Actually let's just use the real recent data it can fetch
last_date = current_df.index[-1]
# Calculate MA240 for current
full_current = yf.Ticker("2330.TW").history(period="2y")
full_current['MA240'] = full_current['Close'].rolling(window=240).mean()
full_current['Bias'] = (full_current['Close'] - full_current['MA240']) / full_current['MA240'] * 100
# RSI
delta = full_current['Close'].diff()
gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
rs = gain / loss
full_current['RSI'] = 100 - (100 / (1 + rs))

curr = {
    "Peak": "2026-02 (Current)",
    "Price": round(full_current['Close'].iloc[-1], 2),
    "Bias": round(full_current['Bias'].iloc[-1], 2),
    "RSI": round(full_current['RSI'].iloc[-1], 2),
    "Vol Peak Lead (Days)": "TBD",
    "RSI Divergence": full_current['RSI'].iloc[-5:-1].max() > full_current['RSI'].iloc[-1] + 1,
    "Bias Accel (5d)": round((full_current['Bias'].iloc[-1] - full_current['Bias'].iloc[-6]) / 5, 2),
    "Last 3 Days Vol Change %": round(full_current['Volume'].iloc[-4:-1].pct_change().mean() * 100, 2)
}
results.append(curr)

print(pd.DataFrame(results).to_string())
