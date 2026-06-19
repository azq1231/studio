import pandas as pd
from data_loader import DataLoader
from feature_engine import FeatureEngine

loader = DataLoader()
df = loader.get_stock_data("1503.TW")
df.set_index('date', inplace=True)
vol_ratio = FeatureEngine(df).vol_contraction_ratio(10, 100)
print(f"士電 ATR Ratio 統計：")
print(vol_ratio.describe())
