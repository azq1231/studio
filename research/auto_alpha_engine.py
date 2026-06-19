import polars as pl
import numpy as np
from datetime import timedelta

class AutoAlphaEngine:
    """
    Quant Lab v14 (Auto-Alpha Discovery): 自動因子探索引擎
    - 自動生成 Candidate Factors
    - 計算 Information Coefficient (IC)
    - 因子強度篩選與演化
    """
    def __init__(self, data_path='data/market_history.parquet'):
        self.data_path = data_path

    def generate_primitive_features(self, df):
        """
        建立基礎特徵庫 (Primitive Library)
        """
        return df.with_columns([
            # Price
            (pl.col('close') / pl.col('close').shift(1).over('symbol') - 1).alias('ret_1d'),
            (pl.col('close') / pl.col('close').shift(5).over('symbol') - 1).alias('ret_5d'),
            (pl.col('high') / pl.col('low') - 1).alias('range'),
            
            # Volume 
            (pl.col('volume') / pl.col('volume').rolling_mean(20).over('symbol')).alias('vol_ratio'),
            
            # Institutional (Net relative to volume)
            ((pl.col('inst_trust') + pl.col('inst_foreign')) / pl.col('volume').clip(1)).alias('inst_flow_ratio'),
            
            # Future Return (Target for IC)
            (pl.col('close').shift(-5).over('symbol') / pl.col('close') - 1).alias('future_ret_5')
        ])

    def evolve_factors(self, df):
        """
        自動生成複合因子 (Factor Generator)
        - Algebraic: ret_1d * inst_flow
        - Time: rolling_std(ret_1d)
        """
        print("🧬 啟動因子遺傳演化 (Genetic Generation)...")
        # 範例：生成幾種非線性組合
        return df.with_columns([
            # Alpha_1: 動能與籌碼共振
            (pl.col('ret_5d') * pl.col('inst_flow_ratio')).alias('alpha_gen_1'),
            # Alpha_2: 低波動高籌碼比例
            (pl.col('inst_flow_ratio') / (pl.col('ret_1d').rolling_std(20).over('symbol') + 0.001)).alias('alpha_gen_2'),
            # Alpha_3: 營收加速度代理 (這裡假設我們有相關欄位)
            (pl.col('inst_trust').rolling_mean(5).over('symbol') / 
             pl.col('inst_trust').rolling_mean(60).over('symbol').clip(1)).alias('alpha_gen_3')
        ])

    def evaluate_ic(self, df):
        """
        因子強度評估 (IC Evaluator)
        IC = corr(factor, future_return)
        """
        factors = [c for c in df.columns if 'alpha_gen' in c]
        ic_results = {}
        
        print("🔍 正在計算各因子之 Information Coefficient (IC)...")
        for f in factors:
            # 計算橫截面相關係數
            ic = df.select(pl.corr(f, "future_ret_5")).collect().item()
            ic_results[f] = ic
            
        return ic_results

if __name__ == "__main__":
    # 這裡僅演示架構，實戰需讀取歷史數據
    engine = AutoAlphaEngine()
    print("🚀 [V14] Auto-Alpha Discovery Engine: Ready")
    print("   - Genetic Generator: Loaded")
    print("   - IC Evaluator: Loaded")
