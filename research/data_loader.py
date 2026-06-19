import pandas as pd
from sqlalchemy import create_engine
import os

class DataLoader:
    def __init__(self, db_path=None):
        if db_path is None:
            # 自動定位到 backend 的數據庫
            db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/data/finance_flow.db'))
        self.engine = create_engine(f"sqlite:///{db_path}")

    def get_all_symbols(self):
        """獲取數據庫中所有不重複的股票標的"""
        query = "SELECT DISTINCT symbol FROM prices"
        df = pd.read_sql(query, self.engine)
        return df['symbol'].tolist()

    def get_stock_data(self, symbol: str, start_date: str = "2020-01-01"):
        """
        從數據庫獲取標準化的 OHLCV 資料
        """
        query = f"SELECT * FROM prices WHERE symbol = '{symbol}' AND date >= '{start_date}' ORDER BY date ASC"
        df = pd.read_sql(query, self.engine)
        df['date'] = pd.to_datetime(df['date'])
        # 標化列名，確保後續 Engine 通用
        df = df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'})
        return df
