import pandas as pd
import numpy as np

class FeatureEngine:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()

    def atr(self, n=14):
        """波動率因子: ATR (Average True Range)"""
        high_low = self.df['High'] - self.df['Low']
        high_close = np.abs(self.df['High'] - self.df['Close'].shift())
        low_close = np.abs(self.df['Low'] - self.df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        return true_range.rolling(n).mean()

    def volatility(self, n=20):
        """波動率因子: 收益率標準差"""
        return self.df['Close'].pct_change().rolling(n).std() * np.sqrt(252)

    def momentum(self, n=20):
        """動能因子: 價格變動率 (ROC)"""
        return self.df['Close'].pct_change(n)

    def rs(self, benchmark_df, n=20):
        """相對強度 (Relative Strength) 對比大盤"""
        stock_ret = self.df['Close'].pct_change(n)
        bench_ret = benchmark_df['Close'].pct_change(n)
        return stock_ret - bench_ret

    def percentile_rank(self, column, n=252):
        """百分位數排位 (常用於過濾極端值)"""
        return self.df[column].rolling(n).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1])

    def donchian_width(self, n=20):
        """唐奇安通道寬度 - 用於衡量波動壓縮 (Squeeze)"""
        upper, lower = self.donchian(n)
        return (upper - lower) / (self.df['Close'].rolling(n).mean() + 1e-9)

    def vol_contraction_ratio(self, short_n=10, long_n=100):
        """波動率壓縮比率 (ATR Ratio)"""
        short_atr = self.atr(short_n)
        long_atr = self.atr(long_n)
        return short_atr / (long_atr + 1e-9)

    def breakout_strength(self, n=20, atr_p=14):
        """突破強度得分: (當前價 - n日高點) / ATR"""
        upper, _ = self.donchian(n)
        atr = self.atr(atr_p)
        return (self.df['Close'] - upper) / (atr + 1e-9)

    def adx(self, n=14):
        """平均趨勢動向指數 (ADX) - 用於過濾無趨勢或趨勢過弱的區間"""
        df = self.df.copy()
        df['up'] = df['High'] - df['High'].shift(1)
        df['down'] = df['Low'].shift(1) - df['Low']
        
        df['+dm'] = np.where((df['up'] > df['down']) & (df['up'] > 0), df['up'], 0)
        df['-dm'] = np.where((df['down'] > df['up']) & (df['down'] > 0), df['down'], 0)
        
        tr = pd.concat([
            df['High'] - df['Low'],
            (df['High'] - df['Close'].shift(1)).abs(),
            (df['Low'] - df['Close'].shift(1)).abs()
        ], axis=1).max(axis=1)
        
        atr = tr.rolling(n).mean()
        plus_di = 100 * (pd.Series(df['+dm']).rolling(n).mean() / (atr + 1e-9))
        minus_di = 100 * (pd.Series(df['-dm']).rolling(n).mean() / (atr + 1e-9))
        dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9))
        return dx.rolling(n).mean()

    def volume_expansion(self, n=20):
        """成交量擴張比率: 當前成交量 / n日平均成交量"""
        return self.df['Volume'] / (self.df['Volume'].rolling(n).mean() + 1e-9)
