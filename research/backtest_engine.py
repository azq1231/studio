import pandas as pd
import numpy as np

class BacktestEngine:
    def __init__(self, initial_capital=100000.0, commission=0.001, tax=0.003):
        self.initial_capital = initial_capital
        self.commission = commission
        self.tax = tax

    def run(self, df: pd.DataFrame, entry: pd.Series, exit: pd.Series, 
            risk_per_trade=0.01, stop_mult=2.5, atr_col=None, max_pos_ratio=0.2):
        """
        執行回測模擬：支援動態倉位管理 (Volatility Targeting)
        risk_per_trade: 每筆交易承擔的風險比例 (0.01 = 1% 淨值)
        stop_mult: 止損用的 ATR 倍數
        atr_col: 用於計算倉位的 ATR 欄位名稱
        max_pos_ratio: 單一標的最大持倉佔淨值比例 (0.2 = 20% 資金上限)
        """
        data = df.copy()
        
        cash = self.initial_capital
        position = 0
        shares = 0
        
        equity_series = []
        trades = []
        
        for i in range(len(data)):
            price = data['Close'].iloc[i]
            date = data.index[i]
            current_equity = cash + (shares * price)
            
            # --- 核心訊號處理 ---
            # 如果目前沒持倉，且觸發 Entry 訊號 -> 買入
            if position == 0 and entry.iloc[i]:
                # 預設買入股數 (全倉)
                target_shares = cash // (price * (1 + self.commission))
                
                # 如果啟動了波動率位能倉位管理
                if atr_col and atr_col in data.columns:
                    atr_val = data[atr_col].iloc[i]
                    if not pd.isna(atr_val) and atr_val > 0:
                        # 專業公式：Position = (Equity * Risk) / (Stop Distance)
                        # Stop Distance = ATR * StopMult
                        risk_cap_shares = (current_equity * risk_per_trade) // (atr_val * stop_mult)
                        
                        # 同時遵守 Max Position Cap (單筆資金上限) 
                        max_allowed_shares = (current_equity * max_pos_ratio) // (price * (1 + self.commission))
                        
                        target_shares = min(risk_cap_shares, max_allowed_shares)
                
                # 最終執行買入 (確保不超過現金)
                shares = min(target_shares, cash // (price * (1 + self.commission)))
                
                if shares > 0:
                    cash -= shares * price * (1 + self.commission)
                    position = 1
                    trades.append({"date": date, "type": "BUY", "price": round(price, 2), "shares": int(shares)})
                else:
                    target_shares = 0 # 無法買入
            
            # 如果目前有持倉，且觸發 Exit 訊號 -> 賣出
            elif position == 1 and exit.iloc[i]:
                cash += shares * price * (1 - self.commission - self.tax)
                trades.append({"date": date, "type": "SELL", "price": round(price, 2), "shares": int(shares)})
                shares = 0
                position = 0
            
            # 每日結算淨值
            current_val = cash + (shares * price)
            equity_series.append(current_val)
            
        data['equity'] = equity_series
        return data, trades
