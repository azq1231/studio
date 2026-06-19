import pandas as pd
import numpy as np
import os
import sys
from itertools import product

# 設置模組路徑
sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from data_loader import DataLoader
from feature_engine import FeatureEngine
from strategies.volatility_breakout import VolatilityBreakout
from backtest_engine import BacktestEngine
from metrics import Metrics
from backend.database import SessionLocal, Strategy as strategy_db # 避免與策略類混淆

def run_parameter_matrix(symbols=["2317.TW", "1503.TW", "2330.TW"], start_date="2023-01-01"):
    """
    執行多標的參數掃描 (Cross-asset Parameter Sweep)
    """
    all_results = []
    db = SessionLocal()
    
    # 3. 定義您建議的專業參數矩陣 (5 x 4 x 3 = 60 組)
    donchian_windows = [10, 20, 40, 60, 80]
    atr_multipliers = [1.5, 2, 2.5, 3]
    atr_periods = [10, 14, 20]
    
    param_combinations = list(product(donchian_windows, atr_multipliers, atr_periods))
    print(f"🚀 開始專業級交叉掃描，總共 {len(symbols)} 支標的，矩陣規模 {len(param_combinations)} 組參數...")

    for symbol in symbols:
        print(f"📡 掃描標的: {symbol}...")
        loader = DataLoader()
        df = loader.get_stock_data(symbol, start_date=start_date)
        df.set_index('date', inplace=True)
        
        # 預計算所有需要的 ATR 因子
        features = FeatureEngine(df)
        for p in atr_periods:
            df[f'ATR_{p}'] = features.atr(p)

        for d_win, atr_mult, atr_p in param_combinations:
            # 策略邏輯：離場窗口固定為進場窗口的一半 (海龜法則經典比例)
            n_entry = d_win
            n_exit = d_win // 2
            
            str_obj = VolatilityBreakout(n_entry=n_entry, n_exit=n_exit, atr_mult=atr_mult, atr_period=atr_p)
            entry, exit = str_obj.generate_signals(df)
            
            engine = BacktestEngine(initial_capital=100000)
            res_df, trades = engine.run(df, entry, exit)
            
            perf = Metrics(res_df, trades)
            report = perf.summary()
            
            res_item = {
                "symbol": symbol,
                "donchian": n_entry, "atr_mult": atr_mult, "atr_p": atr_p,
                "sharpe": report["Sharpe Ratio"],
                "mdd": report["Max Drawdown %"],
                "pnl": report["Total Return %"]
            }
            all_results.append(res_item)

            # 持久化至策略庫
            strat_entry = strategy_db(
                name=f"Sweep_V1", symbol=symbol,
                parameters={"n_entry": n_entry, "n_exit": n_exit, "atr_mult": atr_mult},
                performance={"pnl": report["Total Return %"], "trades": len(trades)},
                sharpe=report["Sharpe Ratio"], drawdown=report["Max Drawdown %"]
            )
            db.add(strat_entry)
        
        db.commit()

    db.close()
    
    # 7. 交叉對比分析 (Cross-asset Analysis)
    results_df = pd.DataFrame(all_results)
    
    # 計算每組參數在所有標的上的「平均夏普比率」，這就是 Robustness (魯棒性) 的核心指標
    robustness_rank = results_df.groupby(["donchian", "atr_mult", "atr_p"])["sharpe"].mean().reset_index()
    robustness_rank = robustness_rank.sort_values(by="sharpe", ascending=False)

    print("\n🏆 --- 跨標的魯棒性排名 (Robustness Test) ---")
    print("這些參數組合在多個標的上平均表現最穩定：")
    print(robustness_rank.head(15).to_string(index=False))
    
    output_path = os.path.join(os.path.dirname(__file__), "cross_asset_sweep.csv")
    results_df.to_csv(output_path, index=False)
    print(f"\n📂 完整交叉掃描數據已儲存: {output_path}")

if __name__ == "__main__":
    # 使用典型的「大盤股 vs 中盤股」組合進行交叉測試
    # 如果要研究魯棒性，標的愈多愈好
    run_parameter_matrix(["2317.TW", "1503.TW", "2330.TW", "5871.TW"])
