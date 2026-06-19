import pandas as pd
import seaborn as sns
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

def generate_research_artifacts(csv_path="cross_asset_sweep.csv"):
    path = os.path.join(os.path.dirname(__file__), csv_path)
    if not os.path.exists(path):
        print(f"❌ 找不到數據文件: {path}")
        return

    df = pd.read_csv(path)
    
    # --- 1. Heatmap: 尋找參數甜蜜點 (Aggregated) ---
    # 我們將所有標的的 Sharpe 取平均，看哪組參數最 Robust
    pivot_df = df.groupby(['donchian', 'atr_mult'])['sharpe'].mean().unstack()
    
    plt.figure(figsize=(10, 8))
    sns.heatmap(pivot_df, annot=True, cmap='RdYlGn', fmt=".2f")
    plt.title("Aggregated Parameter Heatmap (Average Sharpe across Assets)")
    plt.xlabel("ATR Multiplier")
    plt.ylabel("Donchian Window (Days)")
    
    heatmap_path = os.path.join(os.path.dirname(__file__), "research_heatmap.png")
    plt.savefig(heatmap_path)
    print(f"✅ Heatmap 已生成: {heatmap_path}")
    plt.close()

    # --- 2. Robustness Ranking ---
    robust_rank = df.groupby(['donchian', 'atr_mult', 'atr_p'])['sharpe'].mean().reset_index()
    robust_rank = robust_rank.sort_values(by='sharpe', ascending=False)
    top_5 = robust_rank.head(5)
    
    print("\n🏆 --- Top 5 Robust Parameter Sets ---")
    print(top_5.to_string(index=False))

    # --- 3. Equity Overlay: 前 5 名畫在同一張圖 ---
    # 選取台積電 (2330.TW) 作為測試基準
    loader = DataLoader()
    test_df = loader.get_stock_data("2330.TW", start_date="2023-01-01")
    test_df.set_index('date', inplace=True)
    
    # 預計算因子
    features = FeatureEngine(test_df)
    for p in [10, 14, 20]:
        test_df[f'ATR_{p}'] = features.atr(p)

    plt.figure(figsize=(12, 7))
    plt.plot(test_df['Close'], label='2330.TW Close', color='black', alpha=0.3, linewidth=1)
    
    colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6']
    
    for i, (_, row) in enumerate(top_5.iterrows()):
        d_win = int(row['donchian'])
        atr_m = row['atr_mult']
        atr_p = int(row['atr_p'])
        
        strat = VolatilityBreakout(n_entry=d_win, n_exit=d_win//2, atr_mult=atr_m, atr_period=atr_p)
        entry, exit = strat.generate_signals(test_df)
        
        engine = BacktestEngine(initial_capital=100000)
        res_df, _ = engine.run(test_df, entry, exit)
        
        # 歸一化淨值以便對比
        equity_normalized = res_df['equity'] / res_df['equity'].iloc[0] * test_df['Close'].iloc[0]
        plt.plot(equity_normalized, label=f"Param: D={d_win}, M={atr_m}, P={atr_p}", color=colors[i], linewidth=2)

    plt.title("Equity Overlay (Top 5 Robust Parameters on 2330.TW)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    overlay_path = os.path.join(os.path.dirname(__file__), "equity_overlay.png")
    plt.savefig(overlay_path)
    print(f"✅ Equity Overlay 已生成: {overlay_path}")
    plt.close()

if __name__ == "__main__":
    generate_research_artifacts()
