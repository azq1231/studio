from abc import ABC, abstractmethod
import pandas as pd

class Strategy(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """
        輸入帶有因子的 DataFrame，返回信號序列 (1: 買入, -1: 賣出, 0: 持有/觀望)
        """
        pass
