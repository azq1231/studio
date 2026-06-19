import pandas as pd
from strategy_engine import Strategy

class MomentumStrategy(Strategy):
    def __init__(self, n=20):
        super().__init__(name=f"Momentum_{n}")
        self.n = n

    def generate_signals(self, df: pd.DataFrame):
        """
        訊號導向界面：只輸出 Entry 和 Exit 條件
        """
        # 假設 DataFrame 已經過 FeatureEngine 定義了 'momentum_20' 因子
        # Entry: 動能翻正且 > 5%
        entry = (df[f'momentum_{self.n}'] > 0.05)
        
        # Exit: 動能轉負
        exit = (df[f'momentum_{self.n}'] < 0)
        
        return entry, exit
