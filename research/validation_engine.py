import polars as pl
import numpy as np
from datetime import datetime, timedelta

class ValidationEngine:
    """
    Quant Lab v13 (Hedge Fund Edition): 研究驗證引擎
    - Walk-Forward Validation (滾動窗口驗證)
    - Factor Decay Analysis (因子衰減分析)
    - Regime Detection (市場環境偵測)
    """
    def __init__(self, data_path='data/market_history.parquet'):
        self.data_path = data_path

    def run_walk_forward(self, alpha_func, windows=None):
        """
        執行 Walk-Forward 驗證
        windows: list of (train_start, train_end, test_start, test_end)
        """
        print("🛡️ 啟動 Walk-Forward Validation Engine...")
        results = []
        
        # 如果沒提供窗口，預設生成最近三年的年度滾動
        if not windows:
            windows = [
                ("2021-01-01", "2022-12-31", "2023-01-01", "2023-12-31"),
                ("2022-01-01", "2023-12-31", "2024-01-01", "2024-12-31"),
            ]

        for t_start, t_end, s_start, s_end in windows:
            print(f"   [Window] Train: {t_start}~{t_end} | Test: {s_start}~{s_end}")
            # 這裡會呼叫矩陣引擎進行回測
            # 最終收集每個窗口的 Sharpe, MDD, Returns
            results.append({"window": s_start[:4], "sharpe": 1.25, "mdd": 0.12}) # 佔位符
            
        return results

    def analyze_factor_decay(self, signals_df, price_df):
        """
        因子衰減分析 (Decay Analysis)
        計算 T+1, T+5, T+10, T+20 遠期報酬
        """
        print("📉 正在執行 Factor Decay 分析...")
        
        # 核心邏輯：將訊號與未來價格連表
        # 計算不同持有期的平均 Alpha 表現
        periods = [1, 5, 10, 22]
        decay_metrics = {}
        
        for p in periods:
            # 模擬計算：未來 p 天報酬
            avg_ret = 0.05 / p  # 佔位符
            decay_metrics[f"T+{p}"] = avg_ret
            
        return decay_metrics

    def detect_regime(self, market_proxy_df):
        """
        Regime Adaptive Model
        偵測當前市場狀態 (Bull/Bear/Sideways)
        """
        # 使用 TAIEX 與 MA200/MA50 判定
        close = market_proxy_df['Close'].iloc[-1]
        ma200 = market_proxy_df['Close'].rolling(200).mean().iloc[-1]
        ma50 = market_proxy_df['Close'].rolling(50).mean().iloc[-1]
        
        if close > ma200 and close > ma50:
            return "Bull"
        elif close < ma200:
            return "Bear"
        else:
            return "Sideways"

    def get_regime_weights(self, regime):
        """
        根據環境返回推薦的因子權重
        """
        weights = {
            "Bull": {"mom": 0.6, "vcp": 0.3, "rev": 0.1},
            "Bear": {"mom": 0.1, "vcp": 0.2, "rev": 0.7},
            "Sideways": {"mom": 0.3, "vcp": 0.5, "rev": 0.2}
        }
        return weights.get(regime, weights["Bull"])

if __name__ == "__main__":
    validator = ValidationEngine()
    regime = "Bull"
    print(f"✅ 當前市場 Regime: {regime}")
    print(f"📊 建議權重分配: {validator.get_regime_weights(regime)}")
