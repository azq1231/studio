import pandas as pd
import numpy as np
import os
import sys
import matplotlib.pyplot as plt

# 設置模組路徑
sys.path.append(os.path.dirname(__file__))

from data_loader import DataLoader
from feature_engine import FeatureEngine
from strategies.volatility_breakout import VolatilityBreakout
from backtest_engine import BacktestEngine
from metrics import Metrics
from regime_engine import RegimeEngine

def run_stress_test(symbol="2330.TW"):
    print(f"🕵️ 正在啟動 {symbol} 的『2022 大空頭生存壓力測試』...")
    
    loader = DataLoader()
    # 抓取 2019 - 2022 的數據
    df = loader.get_stock_data(symbol, start_date="2019-01-01")
    df.set_index('date', inplace=True)
    
    # 1. 因子計算 & 市場型態標註 (Regime Engine)
    features = FeatureEngine(df)
    df['ATR_14'] = features.atr(14)
    
    regime_engine = RegimeEngine(df)
    df_with_regime = regime_engine.classify()
    
    # 2. 定義策略 (使用我們優化後的參數)
    # n_entry=40, n_exit=20, atr_mult=2.5, vol_threshold=1.0
    strategy = VolatilityBreakout(n_entry=40, n_exit=20, atr_mult=2.5, vol_threshold=1.0)
    entry, exit = strategy.generate_signals(df_with_regime)
    
    # 3. 執行回測
    engine = BacktestEngine(initial_capital=100000)
    result_df, trades = engine.run(df_with_regime, entry, exit)
    
    # --- 4. 拆分時間段：Walk-Forward 視角 ---
    # In-Sample: 2019-2021 (牛市與恢復期)
    is_mask = (result_df.index < '2022-01-01')
    # Out-of-Sample: 2022 (大空頭)
    oos_mask = (result_df.index >= '2022-01-01') & (result_df.index <= '2022-12-31')
    
    df_is = result_df[is_mask]
    df_oos = result_df[oos_mask]
    
    trades_is = [t for t in trades if pd.to_datetime(t['date']) < pd.to_datetime('2022-01-01')]
    trades_oos = [t for t in trades if pd.to_datetime(t['date']) >= pd.to_datetime('2022-01-01') and pd.to_datetime(t['date']) <= pd.to_datetime('2022-12-31')]

    # 5. 績效計算
    metrics_is = Metrics(df_is, trades_is).summary()
    metrics_oos = Metrics(df_oos, trades_oos).summary()
    
    # 6. Regime 表現分析
    regime_stats = regime_engine.analyze_performance(result_df, metrics_oos)
    
    print("\n📊 --- Walk-Forward 壓力測試報告 ---")
    print(f"{'指標':<15} | {'In-Sample (2019-21)':<20} | {'Out-of-Sample (2022)':<20}")
    print("-" * 65)
    for key in ["Total Return %", "Max Drawdown %", "Sharpe Ratio", "Profit Factor", "Expectancy %", "Win Rate %"]:
        print(f"{key:<15} | {metrics_is[key]:>20} | {metrics_oos[key]:>20}")
    
    print("\n🌍 --- 市場型態 (Regime) 績效分析 ---")
    print(regime_stats)
    
    # 7. 視覺化
    plt.figure(figsize=(14, 8))
    
    # 繪製淨值曲線
    plt.plot(result_df['equity'], label='Strategy Equity', color='blue', linewidth=2)
    plt.axvline(x=pd.to_datetime('2022-01-01'), color='red', linestyle='--', label='2022 Stress Test Start')
    
    # 背景塗色 (Regime)
    regime_colors = {"Bull": "green", "Bear": "red", "Sideways": "yellow", "High_Vol": "orange"}
    for regime, group in result_df.groupby('regime'):
        if regime in regime_colors:
            for idx in group.index:
                plt.axvspan(idx, idx + pd.Timedelta(days=1), color=regime_colors[regime], alpha=0.1)
                
    plt.title(f"Strategic Stress Test: {symbol} (2019-2022)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    save_path = os.path.join(os.path.dirname(__file__), f"stress_test_{symbol}_2022.png")
    plt.savefig(save_path)
    print(f"\n📂 壓力測試圖標已儲存: {save_path}")
    
if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_stress_test(sys.argv[1])
    else:
        run_stress_test("2330.TW")
