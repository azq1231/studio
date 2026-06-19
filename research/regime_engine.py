import pandas as pd
import numpy as np

class RegimeEngine:
    """
    Regime Engine: 負責市場型態分類
    標記市場處於：Bull (多頭), Bear (空頭), Sideways (盤整), High Vol (高波動)
    """
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def classify(self):
        """
        升級版三維分類邏輯：
        1. Trend Filter: price > MA200
        2. Momentum Filter: MA50 > MA200
        3. Volatility Filter: ATR(20) / ATR(100)
        """
        data = self.df.copy()
        
        # 趨勢與動能因子
        data['ma50'] = data['Close'].rolling(50).mean()
        data['ma200'] = data['Close'].rolling(200).mean()
        
        # 波動度因子
        tr = pd.concat([
            data['High'] - data['Low'],
            (data['High'] - data['Close'].shift(1)).abs(),
            (data['Low'] - data['Close'].shift(1)).abs()
        ], axis=1).max(axis=1)
        
        data['atr_20'] = tr.rolling(20).mean()
        data['atr_100'] = tr.rolling(100).mean()
        data['atr_ratio'] = data['atr_20'] / (data['atr_100'] + 1e-9)
        
        # --- 專業級 Regime Labeling ---
        regimes = []
        for i in range(len(data)):
            price = data['Close'].iloc[i]
            ma50 = data['ma50'].iloc[i]
            ma200 = data['ma200'].iloc[i]
            v_ratio = data['atr_ratio'].iloc[i]
            
            if pd.isna(ma200) or pd.isna(v_ratio):
                regimes.append("Unknown")
                continue
            
            # 判斷邏輯優先級：
            # 1. 高波動噴發 (不論趨勢，風控優先)
            if v_ratio > 1.5:
                label = "High_Vol"
            # 2. 強力多頭 (雙均線多頭排列)
            elif price > ma200 and ma50 > ma200:
                label = "Bull"
            # 3. 強力空頭 (雙均線空頭排列)
            elif price < ma200 and ma50 < ma200:
                label = "Bear"
            # 4. 震盪/轉折
            else:
                label = "Sideways"
                
            regimes.append(label)
            
        data['regime'] = regimes
        return data

    @staticmethod
    def analyze_performance(result_df: pd.DataFrame, metrics_summary: dict):
        """
        統計策略在不同 Regime 下的表現
        """
        if 'regime' not in result_df.columns:
            return "No regime data"
            
        # 計算每日損益 (Equity 變動)
        result_df['daily_ret'] = result_df['equity'].pct_change()
        
        summary = result_df.groupby('regime')['daily_ret'].agg([
            ('Count', 'count'),
            ('Avg_Daily_Ret%', lambda x: round(x.mean() * 100, 4)),
            ('Sharpe', lambda x: round(x.mean() / (x.std() + 1e-9) * np.sqrt(252), 2))
        ])
        
        return summary
