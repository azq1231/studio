import polars as pl
import os
from pathlib import Path

class TW_RS_Engine_V2:
    """
    量化研究 V2 (L2) - RS Ranking 引擎 (Polars 極速版)
    - 任務: 全市場橫截面動能排名
    - 邏輯: Weighted Momentum (3m/6m) + Percentile Rank
    """
    def __init__(self, data_dir='data/market_history'):
        self.data_dir = Path(data_dir)

    def scan_all_history(self):
        """利用 Polars 讀取並建立價格矩陣"""
        files = list(self.data_dir.glob("*.parquet"))
        print(f"🧩 正在加載 {len(files)} 檔標的之歷史序列...")
        
        # 建立 Long-Table 改為 Wide-Table 的極速管線
        dfs = []
        for f in files:
            symbol = f.stem
            # 只讀取 date 與 close
            df = pl.read_parquet(f).select([
                pl.col("date"),
                pl.col("close").alias(symbol)
            ])
            dfs.append(df)
            
        # 橫截面合併
        print("⚡ 正在執行矩陣合併與排名的向量化運算...")
        full_df = dfs[0]
        for df in dfs[1:]:
            full_df = full_df.join(df, on="date", how="outer")
            
        return full_df.sort("date")

    def calculate_rs_matrix(self, df):
        """計算橫截面 RS 權重排名"""
        # 選取除 date 以外的所有 columns (tickers)
        tickers = [c for c in df.columns if c != "date"]
        
        # 1. 計算報酬率 (3個月=63日, 6個月=126日)
        # RS_Score = 0.4 * R63 + 0.6 * R126
        # 使用 Polars 向量化表達式
        latest_idx = -1
        m3_idx = -63
        m6_idx = -126
        
        scores = {}
        for t in tickers:
            prices = df[t].drop_nulls()
            if len(prices) < 126: continue
            
            p_now = prices[latest_idx]
            p_3m = prices[m3_idx]
            p_6m = prices[m6_idx]
            
            # 權重動能公式
            score = 0.4 * (p_now/p_3m - 1) + 0.6 * (p_now/p_6m - 1)
            scores[t] = score
            
        # 2. 轉為 Series 並執行 Percentile Rank
        rs_series = pl.DataFrame([
            pl.Series("ticker", list(scores.keys())),
            pl.Series("raw_score", list(scores.values()))
        ])
        
        # 計算百分比排名 (0-100)
        rs_series = rs_series.with_columns(
            (pl.col("raw_score").rank() / pl.count() * 100).alias("rs_rank")
        ).sort("rs_rank", descending=True)
        
        return rs_series

if __name__ == "__main__":
    engine = TW_RS_Engine_V2()
    # 假設 Data Lake 已有一些數據
    df_matrix = engine.scan_all_history()
    rs_results = engine.calculate_rs_matrix(df_matrix)
    
    print("\n🏆 [台股動能王者排行榜 - V2]")
    print(rs_results.head(20))
