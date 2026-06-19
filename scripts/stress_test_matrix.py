import polars as pl
import os
import time
import numpy as np

# 導入我們最新寫好的引擎
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../research'))
from matrix_engine import MatrixEngine

def stress_test_full_market():
    """
    壓力測試：模擬 2000 檔股票的全市場掃描效能
    """
    print("🚀 [Stress Test] 啟動全市場 2000 檔壓力測試...")
    
    # 載入現有資料 (80 檔)
    data_dir = 'data'
    c = pl.read_parquet(os.path.join(data_dir, 'close_matrix.parquet'))
    h = pl.read_parquet(os.path.join(data_dir, 'high_matrix.parquet'))
    l = pl.read_parquet(os.path.join(data_dir, 'low_matrix.parquet'))
    v = pl.read_parquet(os.path.join(data_dir, 'volume_matrix.parquet'))
    
    # 模擬擴張：將 80 檔拷貝 25 次，加上微量隨機擾動，湊成 2000 檔
    def expand_data(df, target_n=2000):
        cols = [c for c in df.columns if c != 'date']
        date_col = df.select('date')
        
        expanded_cols = []
        for i in range(target_n // len(cols) + 1):
            for col in cols:
                if len(expanded_cols) >= target_n: break
                # 加上一點點隨機變化 (0.1%) 模擬不同股票
                new_col = df[col] * (1 + (np.random.rand(len(df)) - 0.5) * 0.001)
                expanded_cols.append(new_col.alias(f"STK_{len(expanded_cols):04d}"))
        
        return pl.concat([date_col, pl.DataFrame(expanded_cols)], how="horizontal")

    print("📊 正在生成模擬全市場數據 (2000 stocks x 1700 days)...")
    c_m = expand_data(c)
    h_m = expand_data(h)
    l_m = expand_data(l)
    v_m = expand_data(v)
    
    # 暫存到 tmp 供引擎讀取
    tmp_dir = 'data/tmp_stress'
    os.makedirs(tmp_dir, exist_ok=True)
    c_m.write_parquet(f"{tmp_dir}/close_matrix.parquet")
    h_m.write_parquet(f"{tmp_dir}/high_matrix.parquet")
    l_m.write_parquet(f"{tmp_dir}/low_matrix.parquet")
    v_m.write_parquet(f"{tmp_dir}/volume_matrix.parquet")
    
    print(f"✅ 模擬數據已就緒 (矩陣大小: {c_m.shape})")
    print("⏲️ 開始執行 V6 機構級全市場掃描...")
    
    # 啟動引擎
    engine = MatrixEngine(data_dir=tmp_dir)
    
    # 測試多次取平均
    iters = 3
    durations = []
    for i in range(iters):
        start = time.time()
        results = engine.scan_v6(top_n=10)
        end = time.time()
        durations.append(end - start)
        print(f"   Iteration {i+1}: {end-start:.3f}s")
        
    avg_duration = sum(durations) / iters
    print("\n" + "="*50)
    print(f"🏁 壓力測試報告")
    print(f"標的數量: {c_m.width - 1} 檔")
    print(f"歷史天數: {c_m.height} 天")
    print(f"平均掃描耗時: {avg_duration:.3f} 秒")
    print(f"性能評價: {'🚀 超神速' if avg_duration < 0.5 else '🐢 需優化'}")
    print("="*50)

if __name__ == "__main__":
    try:
        stress_test_full_market()
    except Exception as e:
        print(f"❌ 壓力測試失敗: {e}")
