import yfinance as yf
import pandas as pd
import numpy as np
import json
import os

def run_backtest_pro(symbol, capital=100000):
    print(f"Running Pro (Trend) backtest for {symbol}...")
    df = yf.Ticker(symbol).history(start='2024-10-01', end='2026-01-01', auto_adjust=False)
    df.index = df.index.tz_localize(None)
    
    # KDJ Indicators
    l9 = df['Low'].rolling(window=9).min()
    h9 = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - l9) / (h9 - l9 + 0.001) * 100
    K = rsv.ewm(com=2).mean()
    D = K.ewm(com=2).mean()
    df['J'] = 3 * K - 2 * D
    
    # Bollinger
    df['ma20'] = df['Close'].rolling(20).mean()
    df['std20'] = df['Close'].rolling(20).std()
    df['lower'] = df['ma20'] - (df['std20'] * 2)
    df['BP'] = (df['Close'] - df['lower']) / (df['ma20'] + (df['std20']*2) - df['lower'] + 0.001)
    
    df_2025 = df.loc['2025-01-01':'2025-12-31'].copy()
    
    position = 0
    cash = capital
    trades = []
    daily_equity = []
    
    highest_p = 0 # for trailing stop
    
    for i in range(len(df_2025)):
        row = df_2025.iloc[i]
        date_str = df_2025.index[i].strftime('%Y-%m-%d')
        price = row['Close']
        j_val = row['J']
        bp_val = row['BP']
        
        if position == 0:
            # 買法不變：抓住超跌冰點
            if j_val < 15 and bp_val < 0.15:
                # BUY ALL
                position = cash // (price * 1.001)
                cash -= position * price * 1.001
                highest_p = price
                trades.append({"type": "BUY", "date": date_str, "price": round(price,2), "shares": position, "j": round(j_val,2)})
        else:
            # 修改賣法：利潤奔跑。不要因為「熱」就賣，而是改成「跌破最高點 8%」才賣。
            if price > highest_p:
                highest_p = price # 更新最高價
                
            stop_p = highest_p * 0.92 # 8% 移動停利
            
            # 只有在「過熱區」且「開始反轉(跌破移動停利)」才賣，而不是一熱就賣
            term_sell = (j_val > 90 or bp_val > 0.95) and (price < stop_p)
            # 或者是在強趨勢中，跌破 MA20 的嚴重訊號
            severe_sell = price < row['ma20'] * 0.98
            
            if term_sell or severe_sell or (j_val > 95 and price < highest_p * 0.95):
                # SELL ALL
                cash += position * price * 0.998
                trades.append({"type": "SELL", "date": date_str, "price": round(price,2), "shares": position, "j": round(j_val,2), "pnl": round(position * price * 0.998 - (trades[-1]['price'] * position * 1.001), 2)})
                position = 0
                highest_p = 0
                
        daily_equity.append({"date": date_str, "val": round(cash + (position * price), 2)})
        
    final_equity = cash + (position * df_2025['Close'].iloc[-1])
    return {
        "symbol": symbol,
        "name": "鴻海 (趨勢增強版)",
        "capital_start": capital,
        "capital_end": round(final_equity, 0),
        "total_pnl": round(final_equity - capital, 2),
        "pnl_pct": round(((final_equity/capital)-1)*100, 2),
        "trades": trades,
        "equity_curve": daily_equity
    }

if __name__ == "__main__":
    results = [
        run_backtest_pro('2317.TW'), # 對比組
    ]
    
    output_path = 'd:/MyProjects/FinanceFlow/studio/public/data/backtest_trend.json'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("Done")
