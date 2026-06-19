import yfinance as yf
import polars as pl
import pandas as pd
import os
import time
from pathlib import Path
from datetime import datetime

class LeanQuantV2:
    """
    Quant Lab V2 (Lean) - 300 行台股量化引擎
    - 任務: 資料 -> 排名 -> 濾網 -> 信號
    """
    def __init__(self, data_dir='data/market_history'):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.universe_file = Path("data/tw_universe.parquet")

    def run_full_pipeline(self):
        # 1. 第一步: 下載/更新熱門股歷史 (Top 300 先測)
        tickers = ["2330.TW", "2317.TW", "5871.TW", "2454.TW", "2382.TW", "3661.TW", "3037.TW"] # 演示用名單
        self.download_market_data(tickers)
        
        # 2. 第二步: 計算 RS Ranking & VDU
        print("⚡ 正在執行矩陣計算 (RS Rank & VDU)...")
        results = self.calculate_rs_and_vdu(tickers)
        
        # 3. 第三步: 輸出 Top 信號
        print("\n🏆 [台股 V2 強勢股掃描結果]")
        print(results.filter(pl.col("rs_rank") > 70).sort("rs_rank", descending=True))
        
        return results

    def download_market_data(self, tickers, batch_size=20):
        print(f"📥 正在更新 {len(tickers)} 檔標的歷史數據...")
        for i in range(0, len(tickers), batch_size):
            batch = tickers[i:i+batch_size]
            df = yf.download(batch, period="2y", auto_adjust=True, progress=False, threads=True)
            for ticker in batch:
                try:
                    tdf = df[ticker].dropna().reset_index()
                    tdf.columns = ["date", "open", "high", "low", "close", "volume"]
                    tdf.to_parquet(self.data_dir / f"{ticker}.parquet")
                except: continue
            time.sleep(1)

    def calculate_rs_and_vdu(self, tickers):
        summary = []
        for t in tickers:
            path = self.data_dir / f"{t}.parquet"
            if not path.exists(): continue
            df = pl.read_parquet(path)
            if len(df) < 126: continue
            
            # RS: Weighted Momentum (0.4*3m + 0.6*6m)
            p_now, p_3m, p_6m = df["close"][-1], df["close"][-63], df["close"][-126]
            rs_score = 0.4 * (p_now/p_3m - 1) + 0.6 * (p_now/p_6m - 1)
            
            # VDU: Vol_10 / Vol_50
            vdu = df["volume"][-10:].mean() / df["volume"][-50:].mean()
            
            summary.append({"ticker": t, "price": p_now, "rs_raw": rs_score, "vdu": vdu})
            
        # 百分比排名
        res = pl.DataFrame(summary)
        return res.with_columns(
            (pl.col("rs_raw").rank() / pl.count() * 100).alias("rs_rank")
        )

if __name__ == "__main__":
    engine = LeanQuantV2()
    engine.run_full_pipeline()
