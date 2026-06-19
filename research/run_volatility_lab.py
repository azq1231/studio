import pandas as pd
import matplotlib.pyplot as plt
import os
import sys

# 設置模組路徑，確保可以引用 research/ 下的其他文件
sys.path.append(os.path.dirname(__file__))

from data_loader import DataLoader
from feature_engine import FeatureEngine
from strategies.volatility_breakout import VolatilityBreakout
from backtest_engine import BacktestEngine
from metrics import Metrics

def execute_backtest(symbol="2317.TW", start_date="2024-01-01"):
    print(f"📡 正在加載 {symbol} 的數據回測...")
    
    # 1. Data Loader
    loader = DataLoader() # 使用預設資料庫路徑
    df = loader.get_stock_data(symbol, start_date=start_date)
    df.set_index('date', inplace=True)
    
    # 2. Feature Engine (不預設策略，只生成因子)
    features = FeatureEngine(df)
    df['ATR'] = features.atr(14)  # 策略需要的波動率因子
    
    # 3. Strategy (Signal-based)
    # 使用 20 日唐奇安通道做進場，10 日做出場，搭配 2.0x ATR 止損
    strategy = VolatilityBreakout(n_entry=20, n_exit=10, atr_mult=2.0)
    entry, exit = strategy.generate_signals(df)
    
    # 4. Backtest Engine (統一回測，處理成本與部位)
    engine = BacktestEngine(initial_capital=100000)
    result_df, trades = engine.run(df, entry, exit)
    
    # 5. Metrics (專門績效計算機)
    perf = Metrics(result_df, trades)
    report = perf.summary()
    
    print("\n📈 --- 波動率突破策略 (Donchian + ATR) 績效總覽 ---")
    for key, val in report.items():
        print(f"  {key}: {val}")
    print(f"  Total Trades: {len(trades)}")
    
    # 6. 視覺化診斷 (這是研究層最重要的一環)
    plt.figure(figsize=(12, 6))
    plt.plot(result_df['Close'], label='Close Price', color='#2c3e50', alpha=0.5)
    plt.plot(result_df['equity'] / result_df['equity'].iloc[0] * result_df['Close'].iloc[0], 
             label='Equity Curve (Normalized)', color='#e74c3c', linewidth=2)
    
    # 標註交易點 (模擬研究層的看圖流程)
    for t in trades:
        color = 'green' if t['type'] == 'BUY' else 'red'
        marker = '^' if t['type'] == 'BUY' else 'v'
        plt.scatter(t['date'], t['price'], marker=marker, color=color, s=100, zorder=5)
        
    plt.title(f"Volatility Breakout Research: {symbol}")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # 儲存研究成果圖檔
    save_path = os.path.join(os.path.dirname(__file__), f"result_{symbol}_vb.png")
    plt.savefig(save_path)
    print(f"\n📂 研究圖檔已儲存: {save_path}")
    plt.close()

if __name__ == "__main__":
    # 對鴻海實施波動率突破研究
    execute_backtest("2317.TW")
    # 同時對士電進行實驗 (對比不同股性的標的表現)
    execute_backtest("1503.TW")
