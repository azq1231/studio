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

def compare_risk_sizing(symbol="2330.TW"):
    print(f"Position Sizing Test: {symbol} starting...")
    
    loader = DataLoader()
    # 抓取長期數據以觀察完整週期
    df = loader.get_stock_data(symbol, start_date="2020-01-01")
    df.set_index('date', inplace=True)
    
    # 預計算 14 日 ATR
    df['ATR_14'] = FeatureEngine(df).atr(14)
    
    # 設置基準策略參數
    strat = VolatilityBreakout(n_entry=40, n_exit=20, atr_mult=2.5, vol_threshold=1.0, use_regime_gate=True)
    entry, exit = strat.generate_signals(df)
    
    # 1. Fixed Full Position
    engine_fixed = BacktestEngine(initial_capital=1000000)
    res_fixed, trades_fixed = engine_fixed.run(df, entry, exit, atr_col=None)
    perf_fixed = Metrics(res_fixed, trades_fixed).summary()
    
    # 2. Risk Sizing Model (Volatility Targeting)
    engine_risk = BacktestEngine(initial_capital=1000000)
    res_risk, trades_risk = engine_risk.run(
        df, entry, exit, 
        risk_per_trade=0.01, # Risk 1%
        stop_mult=2.5,       
        atr_col='ATR_14',    
        max_pos_ratio=0.2    # 20% Cap
    )
    perf_risk = Metrics(res_risk, trades_risk).summary()
    
    print("\nComparison Results:")
    print(f"{'Metric':<20} | {'Fixed Full':<20} | {'Risk Based':<20}")
    print("-" * 65)
    for key in ["Total Return %", "Max Drawdown %", "Sharpe Ratio", "Expectancy %", "Avg PnL %"]:
        print(f"{key:<20} | {perf_fixed[key]:>20} | {perf_risk[key]:>20}")
    
    print(f"\nTotal Trades: {len(trades_fixed)} (Fixed) vs {len(trades_risk)} (Risk)")
    
    # Plot Comparison
    plt.figure(figsize=(12, 7))
    plt.plot(res_fixed['equity'], label='Fixed Full Position', color='gray', alpha=0.6)
    plt.plot(res_risk['equity'], label='Volatility Targeting (1% Risk / 20% Cap)', color='blue', linewidth=2)
    plt.title(f"Position Sizing Comparison: {symbol}")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    save_path = os.path.join(os.path.dirname(__file__), "risk_sizing_comparison.png")
    plt.savefig(save_path)
    print(f"\nPlot saved to: {save_path}")

if __name__ == "__main__":
    compare_risk_sizing("2330.TW")
