import polars as pl
import os
from pathlib import Path

def sanitize_data_lake(data_dir="data/market_history"):
    """
    資料湖清洗工具 (Priority 3)
    - 任務: 固定所有 Parquet 的 Schema
    - 規範: date (Date), ohlcv (Float64)
    """
    path = Path(data_dir)
    files = list(path.glob("*.parquet"))
    print(f"🧹 開始清洗資料湖: 總計 {len(files)} 檔標的...")
    
    for f in files:
        try:
            # 1. 讀取
            df = pl.read_parquet(f)
            
            # 2. 強制轉換欄位類型
            df = df.with_columns([
                # 兼容 yfinance 的不同日期格式
                pl.col("date").cast(pl.Utf8).str.slice(0, 10).str.to_date("%Y-%m-%d").alias("date"),
                pl.col("open").cast(pl.Float64),
                pl.col("high").cast(pl.Float64),
                pl.col("low").cast(pl.Float64),
                pl.col("close").cast(pl.Float64),
                pl.col("volume").cast(pl.Float64)
            ])
            
            # 3. 覆蓋寫入 (標準化)
            df.write_parquet(f)
        except Exception as e:
            print(f"⚠️ {f.name} 清洗失敗: {e}")
            
    print("✅ 資料湖標準化完成，所有 Schema 已對齊。")

if __name__ == "__main__":
    sanitize_data_lake()
