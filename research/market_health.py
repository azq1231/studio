import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(__file__))
from data_loader import DataLoader
from regime_engine import RegimeEngine

def check_current_market_health():
    loader = DataLoader()
    symbols = loader.get_all_symbols()
    
    regime_counts = {"Bull": 0, "Bear": 0, "Sideways": 0, "High_Vol": 0, "Unknown": 0}
    
    print(f"Checking {len(symbols)} symbols for current market regime...")
    
    for symbol in symbols:
        df = loader.get_stock_data(symbol)
        if len(df) < 200: continue
        df.set_index('date', inplace=True)
        re = RegimeEngine(df)
        df_reg = re.classify()
        current = df_reg['regime'].iloc[-1]
        regime_counts[current] = regime_counts.get(current, 0) + 1
        
    print("\n--- Current Market Regime Summary ---")
    for r, count in regime_counts.items():
        print(f"{r:<10}: {count} symbols ({(count/len(symbols)*100):.1f}%)")

if __name__ == "__main__":
    check_current_market_health()
