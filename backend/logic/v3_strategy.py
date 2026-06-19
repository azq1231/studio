import pandas as pd
import numpy as np

def run_v3_premium_strategy(df: pd.DataFrame, capital: float = 100000.0):
    """
    V3 旗艦版策略核心邏輯 (計算自數據庫讀取的 DataFrame)
    """
    # 確保資料按日期排序
    df = df.sort_values('date')
    
    # 指標計算 (基於資料庫取出的歷史 OHLC)
    l9 = df['low'].rolling(window=9).min()
    h9 = df['high'].rolling(window=9).max()
    rsv = (df['close'] - l9) / (h9 - l9 + 0.001) * 100
    K = rsv.ewm(com=2).mean()
    D = K.ewm(com=2).mean()
    df['J'] = 3 * K - 2 * D
    
    df['MA20'] = df['close'].rolling(20).mean()
    df['std20'] = df['close'].rolling(20).std()
    df['lower'] = df['MA20'] - (df['std20'] * 2)
    df['upper'] = df['MA20'] + (df['std20'] * 2)
    df['BP'] = (df['close'] - df['lower']) / (df['upper'] - df['lower'] + 0.001)
    
    cash = capital
    position = 0
    trades = []
    equity_curve = []
    peak_price = 0
    
    for _, row in df.iterrows():
        date_str = row['date'].strftime('%Y-%m-%d')
        price = row['close']
        j_val = row['J']
        
        if position == 0:
            if j_val < 15: # 買入訊號: J 值超跌
                buy_cost = price * 1.001
                position = cash // buy_cost
                cash -= position * buy_cost
                peak_price = price
                trades.append({
                    "type": "BUY", "date": date_str, "price": round(price, 2), "shares": position,
                    "j": round(j_val, 2), "reason": "J值超跌點"
                })
        else:
            if price > peak_price:
                peak_price = price
            
            # --- V3 旗艦賣出邏輯 ---
            stop_loss = price < trades[-1]['price'] * 0.90
            trailing_stop = (peak_price / trades[-1]['price'] > 1.10) and (price < peak_price * 0.92)
            overheat_sell = (j_val > 100) and (price < peak_price * 0.97)

            if stop_loss or trailing_stop or overheat_sell:
                sell_revenue = position * price * 0.9975
                cash += sell_revenue
                pnl = sell_revenue - (trades[-1]['price'] * position * 1.001)
                
                reason = "止損" if stop_loss else ("移動停利" if trailing_stop else "過熱了結")
                
                trades.append({
                    "type": "SELL", "date": date_str, "price": round(price, 2), "shares": position,
                    "j": round(j_val, 2), "pnl": round(pnl, 2), "reason": reason
                })
                position = 0
                peak_price = 0
        
        equity_curve.append({"date": date_str, "val": round(cash + (position * price), 2)})

    final_val = cash + (position * df['close'].iloc[-1])
    return {
        "capital_start": capital,
        "capital_end": round(final_val, 0),
        "total_pnl": round(final_val - capital, 2),
        "pnl_pct": round(((final_val/capital)-1)*100, 2),
        "trades": trades,
        "equity_curve": equity_curve
    }
