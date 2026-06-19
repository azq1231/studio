import polars as pl
import requests
import os
from datetime import datetime, timedelta
from pathlib import Path

class TW_MomentumEngine_V2:
    """
    量化研究 V2 - 實戰動能引擎
    - 目標: 建立真實的 RS Ranking 與 VDU 偵測
    - 原則: 拒絕幻覺數據，只用真實 API 輸出
    """
    def __init__(self, cache_dir='data'):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.master_path = self.cache_dir / "market_history.parquet"

    def fetch_real_prices(self):
        """
        從 TWSE 抓取全市場真實收盤價 (今日)
        """
        url = "https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json"
        print(f"📡 正在從交易所獲取真實數據...")
        try:
            res = requests.get(url, timeout=15)
            data = res.json()
            # 欄位: [證券代號, 證券名稱, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
            df = pl.DataFrame(data['data'], schema={
                "column_0": pl.String, "column_1": pl.String, "column_2": pl.String,
                "column_3": pl.String, "column_4": pl.String, "column_5": pl.String,
                "column_6": pl.String, "column_7": pl.String, "column_8": pl.String,
                "column_9": pl.String
            })
            
            # 清洗數據
            df = df.select([
                pl.col("column_0").alias("symbol"),
                pl.col("column_7").str.replace_all(",", "").cast(pl.Float64, strict=False).alias("close"),
                pl.col("column_2").str.replace_all(",", "").cast(pl.Float64, strict=False).alias("volume")
            ]).drop_nulls()
            
            return df
        except Exception as e:
            print(f"❌ 數據抓取失敗: {e}")
            return None

    def calculate_rs_rank(self, df_history, lookback=126):
        """
        真正的橫截面 RS 排名 (Percentile Rank)
        """
        print(f"📊 正在計算全市場 1800 檔標的的 RS 排名 (Window: {lookback}d)...")
        # 這裡需要 df_history 包含過去半年的價格
        # RS = (Current_Close / Past_Close - 1)
        pass

if __name__ == "__main__":
    engine = TW_MomentumEngine_V2()
    # 第一步: 驗證環境與資料源
    df = engine.fetch_real_prices()
    if df is not None:
        print(f"✅ 成功獲取 {len(df)} 檔標的真實行情。")
        print(df.head())
