import yfinance as yf
import pandas as pd
import numpy as np

def find_strategy_waves(symbol, start, end):
    df = yf.Ticker(symbol).history(start=start, end=end)
    df.index = df.index.tz_localize(None)
    
    # Indicators
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['STD20'] = df['Close'].rolling(window=20).std()
    df['Lower'] = df['MA20'] - (df['STD20'] * 2)
    df['BP'] = (df['Close'] - df['Lower']) / (df['MA20'] + df['STD20'] * 2 - df['Lower'])
    df['VR'] = df['Volume'] / df['Volume'].rolling(window=10).median()
    l9 = df['Low'].rolling(window=9).min(); h9 = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - l9) / (h9 - l9) * 100
    df['J'] = 3 * rsv.ewm(com=2).mean() - 2 * rsv.ewm(com=2).mean().ewm(com=2).mean()
    
    # Potential Entries (Buy Signals)
    df['Buy_Signal'] = (df['BP'] < 0.2) & (df['J'] < 15) & (df['VR'] > 1.3)
    
    # Potential Exits (Sell Signals)
    # 1. Bias > 30% (High risk)
    # 2. Volume MA10 declining while price rising (Divergence)
    df['Vol_MA10'] = df['Volume'].rolling(window=10).mean()
    df['is_peak'] = (df['Close'] > df['Close'].shift(1)) & (df['Vol_MA10'] < df['Vol_MA10'].shift(1) * 0.95)
    
    signals = []
    in_position = False
    buy_date = None
    buy_price = 0
    
    for i in range(len(df)):
        current = df.iloc[i]
        date = df.index[i]
        
        if not in_position and current['Buy_Signal']:
            in_position = True
            buy_date = date
            buy_price = current['Close']
            
        elif in_position:
            # Check exit conditions: 
            # 1. Price is up but volume is dying (last 5 days)
            # 2. Or significant time has passed and indicators are hot (J > 85)
            # 3. Or price dropped below MA20
            
            # Simple exit logic for the retrospective:
            # Exit at local high after at least 15 days or price reversal
            future_slice = df.iloc[i:i+30]
            if future_slice.empty: break
            
            p_peak_idx = future_slice['Close'].idxmax()
            p_peak = df.loc[p_peak_idx, 'Close']
            
            # If current price is the peak of the next 30 days window and we have profit
            if date == p_peak_idx and current['Close'] > buy_price * 1.05:
                sell_price = current['Close']
                signals.append({
                    'Year': date.year,
                    'Buy_Date': buy_date.strftime('%Y-%m-%d'),
                    'Buy_Price': round(buy_price, 1),
                    'Sell_Date': date.strftime('%Y-%m-%d'),
                    'Sell_Price': round(sell_price, 1),
                    'Return': round(((sell_price/buy_price)-1)*100, 1),
                    'Reason': "量能枯竭/波段頂部"
                })
                in_position = False
                
    return pd.DataFrame(signals)

res = find_strategy_waves("2330.TW", "2021-01-01", "2025-01-01")
print(res.to_string())
