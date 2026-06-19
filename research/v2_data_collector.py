import yfinance as yf
import pandas as pd
import requests
import os
import time
from pathlib import Path
from datetime import datetime

class TW_DataCollector_V2:
    """
    量化研究 V2 (L1) - 專業級 Data Lake 建構器 (避坑強化版)
    - 任務: 分批下載、標準化 Schema、防止被 YF 限速
    - 資料源: yfinance (Batch 模式)
    """
    def __init__(self, base_dir='data/market_history'):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.universe_file = Path("data/tw_universe.parquet")

    def get_full_universe(self):
        """獲取全市場股票名單 (含產業與代號)"""
        print("📡 正在同步 TWSE/TPEx 股票清單...")
        try:
            # 上市
            l_res = requests.get("https://openapi.twse.com.tw/v1/opendata/t187ap03_L").json()
            df_l = pd.DataFrame(l_res)[['證券代號', '證券名稱', '產業別']]
            df_l.columns = ['symbol', 'name', 'sector']
            df_l['ticker'] = df_l['symbol'] + ".TW"
            
            # 上櫃
            o_res = requests.get("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O").json()
            df_o = pd.DataFrame(o_res)[['證券代號', '證券名稱', '產業別']]
            df_o.columns = ['symbol', 'name', 'sector']
            df_o['ticker'] = df_o['symbol'] + ".TWO"
            
            universe = pd.concat([df_l[df_l['symbol'].str.len() == 4], 
                                  df_o[df_o['symbol'].str.len() == 4]], ignore_index=True)
            universe.to_parquet(self.universe_file)
            return universe
        except Exception as e:
            print(f"❌ 獲取名單失敗: {e}")
            return None

    def download_batch(self, tickers):
        """
        專業 Batch 下載模式: 防止限速並統一 Schema
        """
        print(f"📥 正在下載 Batch ({len(tickers)} 檔)...")
        try:
            # 使用 auto_adjust=True 處理除權息
            df = yf.download(tickers, period="2y", interval="1d", group_by="ticker", auto_adjust=True, progress=False, threads=True)
            
            for ticker in tickers:
                try:
                    # 處理 yfinance 多層索引
                    if ticker in df:
                        tdf = df[ticker].dropna()
                        if len(tdf) < 252: continue # 剔除上市不滿一年的新股
                        
                        # 重要: 強制統一 Schema (防止 Polars 讀取崩潰)
                        tdf = tdf.reset_index()
                        tdf.columns = ["date", "open", "high", "low", "close", "volume"]
                        
                        target_path = self.base_dir / f"{ticker}.parquet"
                        tdf.to_parquet(target_path, index=False)
                except Exception as e:
                    print(f"⚠️ {ticker} 處理失敗: {e}")
            return True
        except Exception as e:
            print(f"❌ Batch 下載失敗: {e}")
            return False

    def run_sync(self, batch_size=20):
        """啟動全自動同步流程"""
        universe = self.get_full_universe()
        if universe is None: return
        
        tickers = universe['ticker'].tolist()
        print(f"🚀 開始建立 Data Lake (共 {len(tickers)} 檔)，Batch Size: {batch_size}")
        
        for i in range(0, len(tickers), batch_size):
            batch = tickers[i:i+batch_size]
            success = self.download_batch(batch)
            if success:
                print(f"✅ 進度: {i+len(batch)} / {len(tickers)}")
            time.sleep(2) # 避坑指南: 嚴格遵守限速保護

if __name__ == "__main__":
    collector = TW_DataCollector_V2()
    # 首航測試前 60 檔 (3 個 Batch)
    collector.run_sync(batch_size=20)
