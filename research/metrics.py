import pandas as pd
import numpy as np

class Metrics:
    def __init__(self, result_df: pd.DataFrame, trades: list = None):
        """
        result_df: 包含 'equity' 欄位的回測結果 DataFrame
        trades: 交易紀錄列表 [{"date":..., "type":..., "price":...}, ...]
        """
        self.equity = result_df['equity']
        self.returns = self.equity.pct_change().dropna()
        self.trades = trades if trades else []

    def sharpe(self, rf=0.01):
        """夏普比率 (Sharpe Ratio)"""
        if len(self.returns) < 2: return 0
        return (self.returns.mean() - rf/252) / (self.returns.std() + 1e-9) * np.sqrt(252)

    def sortino(self, rf=0.01):
        """索提諾比率 (Sortino Ratio) - 只考慮下行風險"""
        if len(self.returns) < 2: return 0
        downside_returns = self.returns[self.returns < 0]
        if len(downside_returns) < 2: return 0
        return (self.returns.mean() - rf/252) / (downside_returns.std() + 1e-9) * np.sqrt(252)

    def max_drawdown(self):
        """最大回撤 (MDD)"""
        rolling_max = self.equity.cummax()
        drawdown = (self.equity - rolling_max) / rolling_max
        return drawdown.min()

    def win_rate(self):
        """勝率 (基於已完成交易)"""
        trades_pnl = self._get_trades_pnl()
        if not trades_pnl: return 0
        wins = [p for p in trades_pnl if p > 0]
        return len(wins) / len(trades_pnl)

    def expectancy(self):
        """
        獲利期望值 (Expectancy)
        公式: (WinRate * AvgWin) + (LossRate * AvgLoss)
        代表每一塊錢冒險預期能換回多少回報。
        """
        trades_pnl = self._get_trades_pnl()
        if not trades_pnl: return 0
        
        win_rate = self.win_rate()
        wins = [p for p in trades_pnl if p > 0]
        losses = [p for p in trades_pnl if p <= 0]
        
        avg_win = np.mean(wins) if wins else 0
        avg_loss = np.mean(losses) if losses else 0
        
        return (win_rate * avg_win) + ((1 - win_rate) * avg_loss)

    def profit_factor(self):
        """獲利因子 (Profit Factor)"""
        trades_pnl = self._get_trades_pnl()
        if not trades_pnl: return 0
        gains = sum([p for p in trades_pnl if p > 0])
        losses = abs(sum([p for p in trades_pnl if p < 0]))
        return gains / (losses + 1e-9)

    def _get_trades_pnl(self):
        """輔助方法：取出每筆交易的損益"""
        if not self.trades or len(self.trades) < 2: return []
        pnl_list = []
        # 假設交易列表是 [BUY, SELL, BUY, SELL...]
        for i in range(1, len(self.trades), 2):
            buy = self.trades[i-1]
            sell = self.trades[i]
            # 以百分比計算損益較具參考價值
            pnl_pct = (sell['price'] - buy['price']) / buy['price']
            pnl_list.append(pnl_pct)
        return pnl_list

    def summary(self):
        """回傳績效總表"""
        total_return = (self.equity.iloc[-1] / self.equity.iloc[0]) - 1
        trades_pnl = self._get_trades_pnl()
        avg_pnl = np.mean(trades_pnl) if trades_pnl else 0
        
        return {
            "Total Return %": round(total_return * 100, 2),
            "Sharpe Ratio": round(self.sharpe(), 2),
            "Sortino Ratio": round(self.sortino(), 2),
            "Max Drawdown %": round(self.max_drawdown() * 100, 2),
            "Win Rate %": round(self.win_rate() * 100, 2),
            "Profit Factor": round(self.profit_factor(), 2),
            "Expectancy %": round(self.expectancy() * 100, 2),
            "Avg PnL %": round(avg_pnl * 100, 2),
            "Total Trades": len(trades_pnl)
        }
