import polars as pl
import os
import json
from datetime import timedelta

class MatrixEngine:
    """
    Quant Lab v12 (Microstructure Flagship): 基金級微結構引擎
    - 整合 Liquidity Shock (流動性衝擊)
    - 整合 Float Rotation (籌碼換手率)
    - 整合 Dealer Hedging Pressure (權證避險壓力)
    - 整合 V11 Ownership & Trinity Factors
    """
    def __init__(self, data_dir='data'):
        self.data_dir = data_dir
        self.source_path = os.path.join(data_dir, 'market_history.parquet')
        self.industries = self._load_industries()

    def _load_industries(self):
        path = os.path.join(self.data_dir, 'universe_with_industry.json')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def scan_v12(self, top_n=10):
        print("🚀 [V12] 啟動基金級 Microstructure 矩陣掃描...")
        
        q = pl.scan_parquet(self.source_path)
        last_date = q.select(pl.col('date').max()).collect().item()
        
        # 假設中小型股平均股本與流通股 (實戰需對接發行股數資料庫)
        # 台股 10億資本額 = 1億股 = 100,000,000 股
        DEFAULT_FLOAT = 100_000_000 

        # 2. V12 核心因子計算 (Microstructure Layer)
        processed = q.filter(pl.col('date') >= last_date - timedelta(days=400)).with_columns([
            # A. Liquidity Shock (成交量窒息衝擊)
            (pl.col('volume').rolling_mean(5).over('symbol') / 
             pl.col('volume').rolling_mean(60).over('symbol').clip(1)).alias('liq_shock'),
            
            # B. Float Rotation Rate (流通股換手率) - 20日成交量佔流通股比
            (pl.col('volume').rolling_sum(20).over('symbol') / DEFAULT_FLOAT).alias('float_rotation'),
            
            # C. Ownership Change (投信鎖碼)
            (pl.col('inst_trust').rolling_sum(20).over('symbol') / DEFAULT_FLOAT).alias('ownership_change'),
            
            # D. Dealer Hedging Pressure (模擬：權證交易佔比，實戰需對接 T86 權證欄位)
            # 目前我們先用 (當日成交金額 / 總成交金額) 的某種代理變數，
            # 實戰中應為 (Warrant_Buy_Net / Stock_Turnover)
            pl.lit(0.02).alias('hedging_pressure'), # 佔位符

            # E. 傳統與動能維度
            (pl.col('close') / pl.col('close').rolling_max(252).over('symbol')).alias('near_high'),
            (pl.col('close') / pl.col('close').shift(63).over('symbol') - 1).alias('ret63'),
            pl.col('close').rolling_mean(50).over('symbol').alias('ma50')
            
        ]).with_columns([
            # Low Vol Momentum
            ((pl.col('close') / pl.col('close').shift(120).over('symbol') - 1) /
             (pl.col('close').pct_change().rolling_std(120).over('symbol').clip(0.001))).alias('low_vol_mom'),
            
            # VCP ATR Compression
            pl.max_horizontal([
                (pl.col('high') - pl.col('low')),
                (pl.col('high') - pl.col('close').shift(1).over('symbol')).abs(),
                (pl.col('low') - pl.col('close').shift(1).over('symbol')).abs()
            ]).alias('tr')
        ]).with_columns([
            pl.col('tr').rolling_mean(20).over('symbol').alias('atr20'),
            pl.col('tr').rolling_mean(100).over('symbol').alias('atr100'),
            (pl.col('volume').rolling_mean(10).over('symbol') / 
             pl.col('volume').rolling_mean(60).over('symbol')).alias('vdu'),
            (pl.col('close') * pl.col('volume')).alias('turnover_daily')
        ]).with_columns([
            (pl.col('atr20') / pl.col('atr100').clip(0.01)).alias('atr_comp'),
            ((pl.col('close') - pl.col('low')) / (pl.col('high') - pl.col('low')).clip(0.01)).alias('cnh'),
            (pl.col('close') * DEFAULT_FLOAT).alias('market_cap')
        ])

        # 3. 擷取截面
        final_scan = processed.filter(pl.col('date') == last_date).collect()
        
        # 4. 排名與評分
        final_scan = final_scan.with_columns([
            (pl.col('ret63').rank(method='average') / pl.len()).alias('rs_rank'),
            pl.col('symbol').map_elements(lambda s: self.industries.get(s, "未知"), return_dtype=pl.String).alias('industry')
        ])

        # 5. V12 專業評分公式 (基金級組合)
        candidates = final_scan.filter(
            (pl.col('rs_rank') > 0.85) &
            (pl.col('close') > pl.col('ma50')) &     # 價格在 MA50 之上
            (pl.col('liq_shock') < 0.6) &           # 流動性收縮 (窒息量)
            (pl.col('turnover_daily') > 100_000_000) &
            (pl.col('market_cap') < 1500_000_000_00)
        ).with_columns(
            (
                pl.col('rs_rank') * 0.25 + 
                (1 - pl.col('atr_comp')).clip(0, 1) * 0.20 + 
                (1 - pl.col('vdu')).clip(0, 1) * 0.15 + 
                pl.col('ownership_change').clip(0, 0.1) * 1.5 + 
                (1 - pl.col('liq_shock')).clip(0, 1) * 0.10 + 
                pl.col('float_rotation').clip(0, 2) * 0.05 + 
                pl.col('hedging_pressure') * 2.5
            ).alias('score'),
            
            pl.struct([
                pl.col('rs_rank'),
                pl.col('ownership_change'),
                pl.col('liq_shock'),
                pl.col('float_rotation'),
                pl.col('atr_comp'),
                pl.col('cnh')
            ]).alias('journal_metadata')
        ).sort('score', descending=True).head(top_n)

        return candidates.rename({'close': 'price'}).to_dicts()

if __name__ == "__main__":
    import time
    start = time.time()
    engine = MatrixEngine()
    results = engine.scan_v12()
    duration = time.time() - start
    
    print("\n" + "="*75)
    print(f"📊 [MICROSTRUCTURE] QUANT LAB V12 - FUND ENGINE ({duration:.3f}s)")
    print("="*75)
    if not results:
        print("🌑 今日無符合『微結構扭曲』之領頭羊標的。")
    else:
        for r in results:
            print(f"🎯 {r['symbol']:<8} | {r['industry']:<12} | Score: {r['score']:.3f} | Shock: {r['liq_shock']:.2f}")
            print(f"   Rotation: {r['float_rotation']:.1%} | OwnΔ: {r['ownership_change']:.2%}")
            print(f"   RS: {r['rs_rank']:.1%} | VCP: {r['atr_comp']:>5.3f} | CNH: {r['cnh']:>4.2f}")
    print("="*75)
