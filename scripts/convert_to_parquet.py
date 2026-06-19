import pandas as pd
import polars as pl
from sqlalchemy import create_engine
import os

def convert_sqlite_to_matrix_parquet():
    """
    將 SQLite 中的 'Long' 格式數據轉換為 'Wide' 矩陣格式並存儲為 Parquet
    格式: Row=Date, Column=Symbol
    """
    db_path = os.path.abspath('backend/data/finance_flow.db')
    output_dir = 'data'
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"📡 讀取資料庫: {db_path}")
    engine = create_engine(f"sqlite:///{db_path}")
    
    # 讀取完整數據
    query = "SELECT date, symbol, close, high, low, open, volume FROM prices"
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date'])
    
    print(f"🔄 正在轉換矩陣格式... (共 {len(df)} 筆紀錄)")
    
    for col in ['close', 'high', 'low', 'open', 'volume']:
        pivoted = df.pivot(index='date', columns='symbol', values=col)
        # 轉換為 Polars 並保存
        pl_df = pl.from_pandas(pivoted.reset_index())
        output_path = os.path.join(output_dir, f"{col}_matrix.parquet")
        pl_df.write_parquet(output_path)
        print(f"✅ 已生成 {output_path} ({pl_df.width} 檔標的)")

if __name__ == "__main__":
    convert_sqlite_to_matrix_parquet()
