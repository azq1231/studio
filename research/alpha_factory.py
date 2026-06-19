import pandas as pd
import numpy as np
import os
import sys
from datetime import datetime

# 設置模組路徑
sys.path.append(os.path.dirname(__file__))

from data_loader import DataLoader
from feature_engine import FeatureEngine
from regime_engine import RegimeEngine
from matrix_engine import MatrixEngine
from portfolio_engine import PortfolioEngine

class AlphaFactory:
    """
    Alpha Factory: 專業量化訊號生成中心
    Universe (DB) -> Matrix Alpha Engine -> Portfolio -> Output
    """
    def __init__(self, initial_capital=1000000, market_proxy='^TWII'):
        self.capital = initial_capital
        self.market_proxy = market_proxy
        self.loader = DataLoader()
        self.portfolio = PortfolioEngine(max_positions=5)
        self.matrix_engine = MatrixEngine()

    def generate_daily_report(self, target_date=None):
        """
        掃描全市場 (V7.8 實戰強固版)
        """
        # 0. 市場全域過濾器 (Market Macro Gate - TAIEX MA200)
        print(f"🕵️ 正在檢測整體市場環境 ({self.market_proxy})...")
        m_df = self.loader.get_stock_data(self.market_proxy)
        if not m_df.empty:
            m_df.set_index('date', inplace=True)
            # 計算加權指數 MA200
            m_df['MA200'] = m_df['Close'].rolling(200).mean()
            current_close = m_df['Close'].iloc[-1]
            current_ma200 = m_df['MA200'].iloc[-1]
            
            # Regime 判定
            m_regime = RegimeEngine(m_df).classify()['regime'].iloc[-1]
            
            print(f"Index: {current_close:.2f} | MA200: {current_ma200:.2f}")
            
            # --- 核心實戰規則：Index < MA200 強制停下新倉 ---
            if current_close < current_ma200:
                print(f"⚠️ 全域風險警告：台股加權指數處於 MA200 之『空頭象限』。")
                print("🚫 已啟動 Market Macro Gate：停止所有新的 Alpha 掃描與進場指令。")
                return
            
            print(f"✅ 市場環境良好 ({m_regime})，大盤處於均線上方的強勢區間。")

        # 1. 使用 Matrix Engine 進行極速掃描 (V12 機構級)
        results_v12 = self.matrix_engine.scan_v12(top_n=20)
        
        all_candidates = []
        for r in results_v12:
            all_candidates.append({
                "symbol": r['symbol'],
                "score": r['score'],
                "atr": r['atr20'], # v12 中使用 atr20 欄位
                "price": r['price'],
                "regime": m_regime, 
                "industry": r['industry'],
                "journal_metadata": {
                    "rs_rank": r['rs_rank'],
                    "ind_rs": r['rs_rank'], # v12 中無獨立的 ind_rs，使用 rs_rank 映射
                    "vdu": r['vdu'],
                    "atr_comp": r['atr_comp'],
                    "cnh": r['cnh'],
                    "vol_expand": r['liq_shock'] # v12 中使用 liq_shock 作為成交量衝擊/擴張代理
                }
            })
        
        regime_counts = {"Matrix_VCP_Filtered": len(results_v12)}

        # --- D. Signal Ranking & Portfolio Selection ---
        print("\n" + "="*50)
        print(f"🏆 ALPHA FACTORY - DAILY RESEARCH SUMMARY")
        print(f"日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)
        
        print(f"🔍 [Market Pulse] 掃描 {len(self.loader.get_all_symbols())} 檔標的狀態：")
        for r, count in regime_counts.items():
            print(f"   {r:<10}: {count} 檔")
        print("-" * 50)

        # --- D. Signal Ranking & Sector Filtering ---
        ranked = self.portfolio.rank_signals(all_candidates)
        
        # 加入產業過濾，避免風險過度集中
        filtered_top = self.portfolio.filter_sectors(ranked)
        
        # 生成具體交易指令 (Execution Layer) 與 日誌元數據 (Journaling)
        orders = self.portfolio.generate_orders(filtered_top, self.capital)

        # 彙整報告數據
        report = {
            "updatedAt": datetime.now().isoformat(),
            "market_state": m_regime if 'm_regime' in locals() else 'Unknown',
            "regime_distribution": regime_counts,
            "summary": {
                "total_scanned": len(self.loader.get_all_symbols()),
                "candidates_count": len(all_candidates),
                "filtered_count": len(filtered_top)
            },
            "signals": [
                {
                    "symbol": s['symbol'],
                    "score": s['score'],
                    "price_est": s['price'],
                    "pos_ratio": next((o['pos_ratio'] for o in orders if o['symbol'] == s['symbol']), 0),
                    "shares": next((o['shares'] for o in orders if o['symbol'] == s['symbol']), 0),
                    "regime": s['regime']
                } for s in filtered_top
            ],
            "orders": orders # 包含完整的 Execution & Journaling 元數據
        }

        # --- E. Console Output ---
        print("\n" + "="*50)
        print(f"📊 ALPHA FACTORY - 掃描完畢 ({report['updatedAt']})")
        print("="*50)
        
        if not orders:
            print("🌑 今日無符合建議之執行指令 (Regime Gate 生效中)。")
        else:
            print(f"{'標的':<10} | {'指令Side':<10} | {'建議股數':<10} | {'掛單類型':<10} | {'止損位':<10}")
            print("-" * 65)
            for o in orders:
                print(f"{o['symbol']:<10} | {o['side']:<10} | {o['shares']:>10} | {o['entry_type']:<10} | {o['stop_price']:>10.1f}")
        
        print("\n💡 戰略提示：")
        print(f"1. 目前大盤狀態: {report['market_state']}")
        print("2. 執行建議：針對台股漲跌停特性，建議採用『Next Day Open』進場，以獲取更佳的流動性。")
        print("3. 指令內含 Journal 元數據，已準備好上傳至雲端交易實戰日誌。")
        print("="*50)
        
        return report

if __name__ == "__main__":
    factory = AlphaFactory()
    factory.generate_daily_report()
