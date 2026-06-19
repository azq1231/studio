import pandas as pd
import numpy as np

class FeatureEngine:
    @staticmethod
    def add_kdj(df, n=9):
        l9 = df['Low'].rolling(window=n).min()
        h9 = df['High'].rolling(window=n).max()
        rsv = (df['Close'] - l9) / (h9 - l9 + 0.001) * 100
        K = rsv.ewm(com=2).mean()
        D = K.ewm(com=2).mean()
        df['K'], df['D'], df['J'] = K, D, 3 * K - 2 * D
        return df

    @staticmethod
    def add_atr(df, n=14):
        """波動率因子: ATR (Average True Range)"""
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['ATR'] = true_range.rolling(n).mean()
        return df

    @staticmethod
    def add_momentum(df, n=20):
        """動能因子: 變收率 (Rate of Change)"""
        df['Momentum'] = df['Close'].pct_change(n)
        return df

    @staticmethod
    def add_bollinger(df, n=20, dev=2):
        """趨勢與波動: 布林帶"""
        df['MA20'] = df['Close'].rolling(n).mean()
        df['STD20'] = df['Close'].rolling(n).std()
        df['BB_Upper'] = df['MA20'] + (df['STD20'] * dev)
        df['BB_Lower'] = df['MA20'] - (df['STD20'] * dev)
        return df
