import pandas as pd
import matplotlib.pyplot as plt
import os
import sys

# 設置模組路徑
sys.path.append(os.path.dirname(__file__))

from data_loader import DataLoader
from feature_engine import FeatureEngine
from strategies.volatility_breakout import VolatilityBreakout
from backtest_engine import BacktestEngine
from metrics import Metrics

def compare_filter_impact(symbol="1503.TW"):
    print(f"🎬 正針對 {symbol} 進行『波動率壓縮過濾 (Volatility Filter)』對比測試...")
    
    loader = DataLoader()
    df = loader.get_stock_data(symbol, start_date="2023-01-01")
    df.set_index('date', inplace=True)
    
    # 預計算 14 日 ATR
    df['ATR_14'] = FeatureEngine(df).atr(14)
    
    # 1. 原始策略 (無過濾, Threshold=2.0 設得非常大)
    strat_raw = VolatilityBreakout(n_entry=20, n_exit=10, atr_mult=2.0, vol_threshold=2.0)
    entry_raw, exit_raw = strat_raw.generate_signals(df)
    res_raw, trades_raw = BacktestEngine(initial_capital=100000).run(df, entry_raw, exit_raw)
    perf_raw = Metrics(res_raw, trades_raw).summary()
    
    # 2. 有過濾策略 (使用 0.9x 平均作為基準)
    strat_filtered = VolatilityBreakout(n_entry=20, n_exit=10, atr_mult=2.0, vol_threshold=0.9)
    entry_f, exit_f = strat_filtered.generate_signals(df)
    res_f, trades_f = BacktestEngine(initial_capital=100000).run(df, entry_f, exit_f)
    perf_f = Metrics(res_f, trades_f).summary()
    
    print("\n📊 對比結果：")
    print(f"  策略類型     | 夏普比率 | 最大回撤 | 交易次數")
    print(f"  ------------------------------------------")
    print(f"  原始 (無過濾) | {perf_raw['Sharpe Ratio']:8} | {perf_raw['Max Drawdown %']:8}% | {len(trades_raw):8}")
    print(f"  強化 (有過濾) | {perf_f['Sharpe Ratio']:8} | {perf_f['Max Drawdown %']:8}% | {len(trades_f):8}")
    
    if len(trades_f) < len(trades_raw):
        print(f"\n✅ 過濾器生效！減少了 {len(trades_raw) - len(trades_f)} 次高波動假訊號進場。")
    else:
        print("\n⚠️ 效果不顯著，可能標的處於連續趨勢中。")

if __name__ == "__main__":
    compare_filter_impact("2330.TW") 
