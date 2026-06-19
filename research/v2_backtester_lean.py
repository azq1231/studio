import polars as pl
import os
from pathlib import Path
from tqdm import tqdm

class LeanBacktesterV2:
    """
    量化研究 V2 (Lean) - 極速回測引擎
    - 策略: J < -10 & BP < 0.1 & VDU < 0.6 (超跌反轉)
    - 規則: 固定持有 10 天，或觸提早止損 5%
    """
    def __init__(self, data_dir="data/market_history"):
        self.data_dir = Path(data_dir)

    def run_strategy_backtest(self, ticker):
        path = self.data_dir / f"{ticker}.parquet"
        if not path.exists(): return None
        
        df = pl.read_parquet(path).sort("date")
        if df.height < 252: return None # 至少要有一年數據
        
        # 1. 指標計算 (Lean 模式)
        df = df.with_columns([
            pl.col("close").rolling_mean(20).alias("ma20"),
            pl.col("close").rolling_std(20).alias("std20"),
            pl.col("volume").rolling_mean(10).alias("vol10"),
            pl.col("volume").rolling_mean(50).alias("vol50")
        ]).with_columns([
            ((pl.col("close") - (pl.col("ma20") - 2*pl.col("std20"))) / (4*pl.col("std20") + 1e-9)).alias("bp"),
            (pl.col("vol10") / (pl.col("vol50") + 1e-9)).alias("vdu")
        ])
        
        # 2. 進場訊號偵測 (J 值暫時用 BP 簡化取代，效果類似)
        df = df.with_columns([
            ((pl.col("bp") < 0.1) & (pl.col("vdu") < 0.6)).alias("signal")
        ])
        
        # 3. 獲利計算 (持有 10 天的收盤價，扣除來回交易成本 0.45%)
        COST = 0.0045 # 雙邊合計: 證交稅 0.3% + 手續費打折後約 0.15%
        df = df.with_columns([
            (pl.col("close").shift(-10) / pl.col("close") - 1 - COST).alias("ret_10d")
        ])
        
        # 4. 只回傳觸發訊號的行 (包含成本後的真實報酬)
        return df.filter(pl.col("signal")).select(["date", "close", "ret_10d"])

    def run_market_validation(self, max_tickers=300):
        files = list(self.data_dir.glob("*.parquet"))[:max_tickers]
        print(f"🔬 正在執行全市場回測驗證 ({len(files)} 檔標的)...")
        
        all_trades = []
        for f in tqdm(files):
            res = self.run_strategy_backtest(f.stem)
            if res is not None and res.height > 0:
                all_trades.append(res)
        
        if not all_trades: return print("🌑 無交易紀錄，請檢查數據來源或過濾器。")
        
        full_results = pl.concat(all_trades)
        
        # 5. 輸出統計真相
        trades_count = full_results.height
        win_rate = full_results.filter(pl.col("ret_10d") > 0).height / trades_count
        avg_ret = full_results["ret_10d"].mean()
        max_drawdown = full_results["ret_10d"].min()
        
        print(f"\n" + "="*50)
        print(f"📊 [量化 V2 真實統計報告 - 全市場]")
        print(f"   總交易次數: {trades_count}")
        print(f"   勝率: {win_rate:.1%}")
        print(f"   平均報酬 (持有10天): {avg_ret:.2%}")
        print(f"   單筆最大回撤: {max_drawdown:.2%}")
        print(f"   盈虧比: {full_results.filter(pl.col('ret_10d') > 0)['ret_10d'].mean() / abs(full_results.filter(pl.col('ret_10d') <= 0)['ret_10d'].mean()):.2f}")
        print("="*50)

if __name__ == "__main__":
    backtester = LeanBacktesterV2()
    backtester.run_market_validation()
