import pandas as pd
import numpy as np

class PortfolioEngine:
    """
    Portfolio Engine: 負責多標的配置、訊號排序與風險分散
    """
    def __init__(self, max_positions=5, max_per_sector=2):
        self.max_positions = max_positions
        self.max_per_sector = max_per_sector

    def filter_sectors(self, candidates):
        """
        板塊過濾：限制單一產業持倉不超過 N 檔
        使用來自 MatrixEngine 的動態產業數據
        """
        final_selection = []
        sector_counts = {}
        
        for cand in candidates:
            if len(final_selection) >= self.max_positions:
                break
                
            # 直接使用 MatrixEngine 提供的產業別，若無則標記為 '其他'
            industry = cand.get('industry', '其他')
            
            # 檢查該板塊是否已達上限
            count = sector_counts.get(industry, 0)
            if count < self.max_per_sector:
                final_selection.append(cand)
                sector_counts[industry] = count + 1
            else:
                # 排除過度集中的標的，即使分數更高
                print(f"📡 Portfolio Rule: 跳過 {cand['symbol']} (所屬 {industry} 產業已達持倉上限 {self.max_per_sector} 檔)")
                continue
                
        return final_selection

    def rank_signals(self, signals):
        """
        訊號排序：基於 V6 Alpha Score (綜合 RS, Industry, Quality)
        """
        return sorted(signals, key=lambda x: x.get('score', 0), reverse=True)

    def allocate(self, selections, total_equity, risk_per_trade=0.01, stop_mult=2.5):
        """
        計算最終具體股數與倉位佔比 (Risk-Based Weighting)
        """
        final_trades = []
        for s in selections:
            atr = s.get('atr', 0)
            price = s.get('price', 0)
            
            if atr > 0:
                # 核心公式: Position = (Equity * Risk) / (ATR * StopMult)
                risk_amount = total_equity * risk_per_trade
                shares = risk_amount // (atr * stop_mult)
                
                # 計算倉位佔比 (%)
                pos_value = shares * price
                pos_ratio = (pos_value / total_equity) * 100
                
                # 專業 Cap：單一持位上限 20%
                if pos_ratio > 25: # 分散化：放寬到 25% 
                    shares = (total_equity * 0.25) // price
                    pos_ratio = 25.0

                final_trades.append({
                    "symbol": s['symbol'],
                    "action": "BUY",
                    "shares": int(shares),
                    "price_est": price,
                    "pos_ratio": round(pos_ratio, 2),
                    "score": round(s['score'], 3),
                    "atr": atr,
                    "industry": s.get('industry', 'Unknown'),
                    "journal": s.get('journal_metadata', {}) # 透傳 V6 元數據
                })
        
        return final_trades

    def generate_orders(self, selected_candidates, initial_capital):
        """
        執行層 (Execution Engine): 轉化訊號為具體的交易指令
        V7: 整合完整 Alpha 結構元數據
        """
        trades = self.allocate(selected_candidates, initial_capital)
        orders = []
        
        for t in trades:
            orders.append({
                "symbol": t['symbol'],
                "side": "BUY",
                "shares": t['shares'],
                "pos_ratio": t['pos_ratio'],
                "industry": t['industry'],
                "entry_type": "next_open",      # 台股策略：隔日開盤進場
                "stop_price": round(t['price_est'] - (t['atr'] * 2.5), 1), 
                "journal_metadata": {
                    "score": t['score'],
                    "industry": t['industry'],
                    **t['journal'], # 包含 RS_Rank, VDU, ATR_Comp, CNH, Vol_Expand
                    "timestamp": pd.Timestamp.now().isoformat()
                }
            })
            
        return orders
