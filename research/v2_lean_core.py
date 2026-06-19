"""
research/v2_lean_core.py
200 行 Lean Engine 核心引擎 (V2 基石)
核心功能：
- Data Ingest (Parquet / Polars)
- RS Ranking (全市場百分位)
- Volume / VDU 偵測
- Breakout Filter
- Trade Management (Entry / Exit / TimeStop / Volume Confirmation)
"""

import polars as pl
import yfinance as yf
import os
from pathlib import Path
from datetime import datetime, timedelta

# ┌─────────────┐
# │ Data Ingest │
# └─────────────┘
class DataIngest:
    def __init__(self, data_path="data/market_history/"):
        self.data_path = Path(data_path)
        self.data_path.mkdir(parents=True, exist_ok=True)

    def fetch_history(self, ticker, period="2y"):
        """抓取歷史數據並存為標準 Parquet"""
        print(f"📥 正在更新 {ticker} 歷史數據...")
        try:
            # yfinance 抓取
            df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
            if df.empty: return False
            
            # 標準化 Schema: 清洗 yfinance 潛在的多層索引
            df.columns = [str(c[0]).lower() if isinstance(c, tuple) else str(c).lower() for c in df.columns]
            df = df.reset_index()
            df.columns = [str(c).lower() for c in df.columns]
            
            # 強制保留核心欄位
            df = df[["date", "open", "high", "low", "close", "volume"]]
            
            # 使用 Polars 轉換並存入 Data Lake
            pl_df = pl.from_pandas(df)
            pl_df.write_parquet(self.data_path / f"{ticker}.parquet")
            return True
        except Exception as e:
            print(f"❌ {ticker} 下載失敗: {e}")
            return False

    def load_data(self, ticker):
        path = self.data_path / f"{ticker}.parquet"
        if not path.exists(): return None
        return pl.read_parquet(path)


# ┌─────────────┐
# │ RS Ranking  │
# └─────────────┘
class RSRank:
    def __init__(self, lookback=126):
        self.lookback = lookback

    def compute(self, df_dict):
        """ 計算 0-100 的相對強度排名 """
        returns = {}
        for t, df in df_dict.items():
            if df is None or df.height < self.lookback: continue
            # 計算 6 個月報酬率 (126日)
            ret = (df["close"][-1] / df["close"][-self.lookback]) - 1
            returns[t] = ret
            
        if not returns: return {}
        
        # 排序並產出百分位 (Percentile Rank)
        sorted_items = sorted(returns.items(), key=lambda x: x[1])
        total = len(sorted_items)
        return {t: (i + 1) / total * 100 for i, (t, _) in enumerate(sorted_items)}


# ┌─────────────────────┐
# │ Volume / VDU Module │
# └─────────────────────┘
class VDUCheck:
    def __init__(self, short_window=10, long_window=50):
        self.short, self.long = short_window, long_window

    def is_dry(self, df):
        """ 偵測成交量是否乾枯 (窒息量) """
        if df.height < self.long: return False
        v_short = df["volume"][-self.short:].mean()
        v_long = df["volume"][-self.long:].mean()
        return (v_short / (v_long + 1e-9)) < 0.6


# ┌───────────────┐
# │ Breakout Filter│
# └───────────────┘
class BreakoutFilter:
    def __init__(self, atr_window=14):
        self.atr_window = atr_window

    def is_breakout(self, df):
        if df.height < self.atr_window: return False
        
        # 計算真實波幅 (TR)
        tr = pl.max_horizontal([
            (df["high"] - df["low"]),
            (df["high"] - df["close"].shift(1)).abs(),
            (df["low"] - df["close"].shift(1)).abs()
        ]).fill_null(0)
        
        atr = tr[-self.atr_window:].mean()
        current_range = df["high"][-1] - df["low"][-1]
        
        # 簡單判定: 當日震幅大於 ATR，且收盤接近最高
        cnh = (df["close"][-1] - df["low"][-1]) / (df["high"][-1] - df["low"][-1] + 1e-9)
        return current_range > atr and cnh > 0.7


# ┌─────────────────────┐
# │ Trade Management    │
# └─────────────────────┘
class TradeManagement:
    def __init__(self, stop_loss=0.975, target1=1.05, target2=1.08, time_stop_days=5):
        self.stop_loss = stop_loss
        self.target1 = target1
        self.target2 = target2
        self.time_stop_days = time_stop_days

    def evaluate(self, df, entry_price, entry_date_str):
        """ 核心: 決定 SELL / HOLD / TARGET """
        price_now = df["close"][-1]
        entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d")
        days_held = (datetime.now() - entry_date).days
        
        # 1. 硬性結構停損
        if price_now <= entry_price * self.stop_loss:
            return "SELL_STOP", "跌破 97.5% 結構停損點，立即出場。"
            
        # 2. 時間停損 (Time-Stop)
        if days_held >= self.time_stop_days and price_now < entry_price:
            return "SELL_TIMESTOP", f"持有 {days_held} 天未回成本，資金效率低落，撤離。"
            
        # 3. 目標區間
        if price_now >= entry_price * self.target2:
            return "HOLD_STRONG", f"突破 108% 轉強點，轉為波段操作。"
        elif price_now >= entry_price * self.target1:
            return "WATCH", "站上 105% 觀察點，等待量能確認。"
            
        return "HOLD", "繼續持有，觀察反彈動能。"

# ┌─────────────────────┐
# │ Risk Manager        │
# └─────────────────────┘
class RiskManager:
    """ 風控硬約束: 確保決策不違反基本安全規則 """
    def __init__(self, max_weight_per_stock=0.10):
        self.max_weight = max_weight_per_stock

    def enforce_limits(self, symbol, current_weight):
        """ 檢查權重是否超標 """
        if current_weight > self.max_weight:
            return False, f"🚨 風控攔截: {symbol} 權重 {current_weight:.1%} 超過上限 {self.max_weight:.1%}"
        return True, "符合權重規範"


if __name__ == "__main__":
    # 首航測試: 中租-KY (5871.TW)
    ingest = DataIngest()
    risk = RiskManager(max_weight_per_stock=0.10) # 寫死 10% 上限
    ticker = "5871.TW"
    
    # 模擬當前資金狀況 (假設總資金 100萬, 該部位 30萬)
    total_capital = 1000000
    position_value = 300000
    current_weight = position_value / total_capital

    # 1. 更新數據
    if ingest.fetch_history(ticker):
        df = ingest.load_data(ticker)
        
        # 2. 執行風控預審
        is_safe, msg = risk.enforce_limits(ticker, current_weight)
        if not is_safe:
            print(f"\n🛡️ [Risk Alert] {msg}")
            # 觸發強制減碼邏輯...
        
        # 3. 執行交易管理評估
        mgmt = TradeManagement()
        decision, comment = mgmt.evaluate(df, 103.0, "2026-03-01")
        
        print(f"\n📊 [V2 Lean Engine] 決策報告: {ticker}")
        print(f"   目前權重: {current_weight:.1%}")
        print(f"   最終決策: {decision}")
        print(f"   理由: {comment}")
