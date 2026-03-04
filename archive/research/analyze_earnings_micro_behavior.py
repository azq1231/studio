import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def detailed_event_analysis(symbol, event_date, window_days=15):
    ticker = yf.Ticker(symbol)
    start = (pd.to_datetime(event_date) - timedelta(days=window_days)).strftime('%Y-%m-%d')
    end = (pd.to_datetime(event_date) + timedelta(days=window_days)).strftime('%Y-%m-%d')
    
    df = ticker.history(start=start, end=end)
    df.index = df.index.tz_localize(None)
    
    print(f"\n--- Detailed Analysis Around {event_date} (TSMC 2330.TW) ---")
    
    # Calculate daily changes
    df['Pct_Change'] = df['Close'].pct_change() * 100
    df['Vol_Change'] = df['Volume'].pct_change() * 100
    
    # Identify the event row
    event_dt = pd.to_datetime(event_date)
    if event_dt not in df.index:
        event_dt = df.index[df.index.get_indexer([event_dt], method='nearest')[0]]
        
    print(df[['Close', 'Pct_Change', 'Volume', 'Vol_Change']].to_string())
    
    # Summary of behavior
    pre_event_avg_vol = df.loc[:event_dt].iloc[-5:-1]['Volume'].mean()
    post_event_avg_vol = df.loc[event_dt:].iloc[1:5]['Volume'].mean()
    
    print(f"\n[Observation]")
    print(f"1. Event Day Close: {df.loc[event_dt, 'Close']:.2f} ({df.loc[event_dt, 'Pct_Change']:.2f}%)")
    
    # Find local peak after/on event
    local_peak = df.loc[event_dt:].iloc[:5]['Close'].max()
    local_peak_date = df.loc[event_dt:].iloc[:5]['Close'].idxmax()
    print(f"2. Local Peak reached on {local_peak_date.date()}: {local_peak:.2f}")
    
    # Days from event to collapse (if price falls back below event price)
    fall_below = df.loc[local_peak_date:].loc[df['Close'] < df.loc[event_dt, 'Close']]
    if not fall_below.empty:
        first_fall_date = fall_below.index[0]
        print(f"3. Momentum Loss: Price fell back below event price on {first_fall_date.date()} ({(first_fall_date - event_dt).days} days after call)")
        print(f"4. Volume Shift: Pre-call Avg Vol={pre_event_avg_vol:,.0f} | Post-call Avg Vol={post_event_avg_vol:,.0f}")
        vol_ratio = post_event_avg_vol / pre_event_avg_vol
        print(f"   Volume Change Ratio: {vol_ratio:.2f}x (Ratio > 1 with falling price = Distribution/Selling)")

# Run analysis for the 2022 collapse start
detailed_event_analysis("2330.TW", "2022-01-13")

# Run analysis for comparison: 2021 Jan (where it didn't collapse immediately)
detailed_event_analysis("2330.TW", "2021-01-14")
