import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def get_divergence_dates(symbol, start_date, end_date, label):
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date, end=end_date)
    df.index = df.index.tz_localize(None)
    
    # Smooth volume to find true peak
    df['Vol_MA5'] = df['Volume'].rolling(window=5).mean()
    
    price_peak_date = df['Close'].idxmax()
    price_peak_val = df['Close'].max()
    
    # Volume peak usually happens BEFORE price peak in a divergence
    # We look for the max volume MA5 in the 30 days leading up to the price peak
    valid_vol_range = df.loc[:price_peak_date]
    vol_peak_date = valid_vol_range['Vol_MA5'].idxmax()
    vol_peak_val = valid_vol_range['Vol_MA5'].max()
    
    lead_days = (price_peak_date - vol_peak_date).days
    
    # Calculate volume decay at price peak
    vol_at_price_peak = df.loc[price_peak_date, 'Vol_MA5']
    vol_decay = (vol_at_price_peak - vol_peak_val) / vol_peak_val * 100
    
    return {
        "Period": label,
        "Price Peak Date": price_peak_date.strftime('%Y-%m-%d'),
        "Price Peak": round(price_peak_val, 2),
        "Vol Peak Date": vol_peak_date.strftime('%Y-%m-%d'),
        "Lead Days": lead_days,
        "Vol Decay %": round(vol_decay, 2)
    }

periods = [
    {"start": "2021-12-01", "end": "2022-02-15", "label": "2022 崩盤前夕"},
    {"start": "2024-06-01", "end": "2024-08-15", "label": "2024 修正前夕"},
    {"start": "2025-10-01", "end": "2026-02-28", "label": "2026 現在 (AI 狂熱)"}
]

results = []
for p in periods:
    results.append(get_divergence_dates("2330.TW", p['start'], p['end'], p['label']))

print(pd.DataFrame(results).to_string())
