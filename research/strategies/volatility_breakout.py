import pandas as pd
import numpy as np
from strategy_engine import Strategy

class VolatilityBreakout(Strategy):
    def __init__(self, n_entry=55, n_exit=20, atr_mult=2.5, atr_period=14, vol_threshold=0.8, use_regime_gate=True):
        """
        台股專用 Breakout 結構 (v3.5): 
        由 20 日拉長為 55 日 (User 建議)，減少主力洗盤干擾。
        """
        super().__init__(name=f"VB_TW_{n_entry}_{n_exit}_{atr_mult}")
        self.n_entry = n_entry
        self.n_exit = n_exit
        self.atr_mult = atr_mult
        self.atr_period = atr_period
        self.vol_threshold = vol_threshold
        self.use_regime_gate = use_regime_gate

    def generate_signals(self, df: pd.DataFrame):
        atr_col = f'ATR_{self.atr_period}'
        if atr_col not in df.columns:
            from feature_engine import FeatureEngine
            df[atr_col] = FeatureEngine(df).atr(self.atr_period)

        # A. 基礎通道計算 (拉長至 55 日唐奇安)
        upper = df['High'].shift(1).rolling(self.n_entry).max()
        lower = df['Low'].shift(1).rolling(self.n_exit).min()

        # B. 進階過濾因子 (加入 VCP 壓縮概念)
        from feature_engine import FeatureEngine
        fe = FeatureEngine(df)
        vol_c_ratio = fe.vol_contraction_ratio(10, 100) # 核心：波動壓縮至長線的 80% 以下
        vol_e_ratio = fe.volume_expansion(20)           # 爆發：成交量需顯著放大
        adx = fe.adx(14)                                # 強度：ADX > 20 確保趨勢成型
        
        # C. 組合進場條件
        # 1. 突破 + 壓縮 (VCP 概念)
        entry_cond = (df['Close'] > upper) & (vol_c_ratio.shift(1) < self.vol_threshold)
        
        # 2. 假突破過濾 (量能與強度升級)
        # 台股特性：需要強大的量能推動
        fake_filter = (vol_e_ratio > 1.3) & (adx > 20)
        
        # --- Regime Gate (市場大趨勢) ---
        if self.use_regime_gate:
            if 'regime' not in df.columns:
                from regime_engine import RegimeEngine
                df = RegimeEngine(df).classify()
            
            # 只在多頭排列 (Bull) 或 高波動具噴發潛力 (High_Vol) 時進場
            regime_filter = (df['regime'] == 'Bull') | (df['regime'] == 'High_Vol')
            entry = entry_cond & regime_filter & fake_filter
        else:
            entry = entry_cond & fake_filter
        
        # 出場：破低點 或 ATR 止損
        atr_stop = df['Close'] < (df['Close'].shift(1) - self.atr_mult * df[atr_col])
        channel_exit = (df['Close'] < lower)
        
        exit = channel_exit | atr_stop
        
        return entry, exit
