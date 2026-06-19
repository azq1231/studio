import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime

def run_backtest_v3_premium(symbol, capital=100000):
    print(f"🚀 正在為 {symbol} 執行 V3 最終旗艦版回測 (2025 全年度)...")
    
    # 抓取數據 (含 緩衝)
    df = yf.Ticker(symbol).history(start='2024-11-01', end='2026-01-01', auto_adjust=False)
    df.index = df.index.tz_localize(None)
    
    # 指標計算
    l9 = df['Low'].rolling(window=9).min()
    h9 = df['High'].rolling(window=9).max()
    rsv = (df['Close'] - l9) / (h9 - l9 + 0.001) * 100
    K = rsv.ewm(com=2).mean()
    D = K.ewm(com=2).mean()
    df['J'] = 3 * K - 2 * D
    
    df['MA20'] = df['Close'].rolling(20).mean()
    df['std20'] = df['Close'].rolling(20).std()
    df['lower'] = df['MA20'] - (df['std20'] * 2)
    df['upper'] = df['MA20'] + (df['std20'] * 2)
    df['BP'] = (df['Close'] - df['lower']) / (df['upper'] - df['lower'] + 0.001)
    
    df_2025 = df.loc['2025-01-01':'2025-12-31'].copy()
    
    cash = capital
    position = 0
    trades = []
    daily_equity = []
    peak_price = 0
    
    for i in range(len(df_2025)):
        row = df_2025.iloc[i]
        date_str = df_2025.index[i].strftime('%Y-%m-%d')
        price = row['Close']
        j_val = row['J']
        bp_val = row['BP']
        ma20 = row['MA20']
        
        if position == 0:
            # 買入信號：KDJ 超跌 (J < 15)
            if j_val < 15:
                buy_cost = price * 1.001
                position = cash // buy_cost
                cash -= position * buy_cost
                peak_price = price
                trades.append({
                    "type": "BUY", "date": date_str, "price": round(price, 2), "shares": position,
                    "j": round(j_val, 2), "bp": round(bp_val, 2), "reason": "J值超跌點"
                })
        else:
            if price > peak_price:
                peak_price = price
            
            # --- V3 旗艦賣出邏輯：嚴防「被洗掉」 ---
            # 只有當利潤已經很不錯 (3% 以上) 時，才啟動移動停利，否則請保持耐心
            profit_pct = (price / trades[-1]['price']) - 1
            
            # 1. 大止損：虧損超過 10% 認賠 (保命)
            stop_loss = price < trades[-1]['price'] * 0.90
            
            # 2. 獲利後的移動停利：只有當利潤曾超過 10%，回撤 8% 才賣
            trailing_stop = (peak_price / trades[-1]['price'] > 1.10) and (price < peak_price * 0.92)
            
            # 3. 趨勢保護：只有當 J 值極熱 (J > 100) 且 開始回檔時才賣
            overheat_sell = (j_val > 100) and (price < peak_price * 0.97)

            if stop_loss or trailing_stop or overheat_sell:
                sell_revenue = position * price * 0.9975
                cash += sell_revenue
                pnl = sell_revenue - (trades[-1]['price'] * position * 1.001)
                
                reason = "止損" if stop_loss else ("移動停利" if trailing_stop else "過熱了結")
                
                trades.append({
                    "type": "SELL", "date": date_str, "price": round(price, 2), "shares": position,
                    "j": round(j_val, 2), "bp": round(bp_val, 2), "pnl": round(pnl, 2), "reason": reason
                })
                position = 0
                peak_price = 0
        
        daily_equity.append({"date": date_str, "val": round(cash + (position * price), 2)})

    final_val = cash + (position * df_2025['Close'].iloc[-1])
    return {
        "symbol": symbol, "name": {'1503.TW': '士電', '2317.TW': '鴻海'}.get(symbol, symbol),
        "capital_start": capital, "capital_end": round(final_val, 0),
        "total_pnl": round(final_val - capital, 2), "pnl_pct": round(((final_val/capital)-1)*100, 2),
        "trades": trades, "equity_curve": daily_equity
    }

if __name__ == "__main__":
    results = [run_backtest_v3_premium(s) for s in ['1503.TW', '2317.TW']]
    output_path = 'd:/MyProjects/FinanceFlow/studio/public/data/backtest_2025.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✅ V3 旗艦版完成，同步雲端...")
    os.system('python d:/MyProjects\FinanceFlow/scripts/cloud_sync.py')
