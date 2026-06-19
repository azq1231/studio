import yfinance as yf
import pandas as pd
from database import SessionLocal, Price, init_db
from datetime import datetime, timedelta
import os

def ingest_stock_data(symbols, years=7):
    """
    抓取指定標的的歷史資料並存入數據庫 (擴大至 7 年以支援回測)
    """
    db = SessionLocal()
    # 確保包含 2018-2022 的完整數據
    start_date = (datetime.now() - timedelta(days=365 * years)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    total_added = 0
    for symbol in symbols:
        print(f"📡 正在抓取 {symbol} 的數據...")
        try:
            # 抓取 OHLCV 資料
            df = yf.Ticker(symbol).history(start=start_date, end=end_date, auto_adjust=False)
            df.index = df.index.tz_localize(None)
            
            for date, row in df.iterrows():
                # 檢查是否已存在 (避免重複)
                existing = db.query(Price).filter_by(symbol=symbol, date=date).first()
                if not existing:
                    price_entry = Price(
                        symbol=symbol,
                        date=date,
                        open=float(row['Open']),
                        high=float(row['High']),
                        low=float(row['Low']),
                        close=float(row['Close']),
                        volume=int(row['Volume'])
                    )
                    db.add(price_entry)
                    total_added += 1
            
            db.commit()
            print(f"  ✅ {symbol} 數據入庫完成")
        except Exception as e:
            print(f"  ❌ {symbol} 抓取或入庫出錯: {e}")
            db.rollback()
    
    db.close()
    print(f"\n🏁 數據入庫成功！共新增 {total_added} 筆紀錄。")

if __name__ == "__main__":
    # 先初始化庫
    init_db()
    
    # 擴增標的：全台灣 300 支核心標的 (Universe Expansion)
    # 包含 0050, 0051 成份股與成交量前茅
    tw50 = ['2330.TW', '2317.TW', '2454.TW', '2308.TW', '2881.TW', '2882.TW', '2303.TW', '2002.TW', '1301.TW', '2412.TW'] # 示例
    tw_mid = ['2382.TW', '2357.TW', '3231.TW', '3017.TW', '2376.TW', '2603.TW', '2609.TW', '2615.TW', '1503.TW', '1513.TW'] # 示例
    
    # 標的擴張 (Universe Expansion): 0050 + 0051 + High Volume Targets
    tw50 = ['2330.TW', '2317.TW', '2454.TW', '2308.TW', '2881.TW', '2882.TW', '2303.TW', '2002.TW', '1301.TW', '2412.TW', '2886.TW', '2891.TW', '1216.TW', '2357.TW', '2382.TW', '2408.TW', '2474.TW', '2880.TW', '2884.TW', '2885.TW', '2892.TW', '5880.TW', '2912.TW', '9904.TW', '3037.TW', '3711.TW', '2449.TW', '2379.TW', '3034.TW', '2337.TW', '4938.TW', '2301.TW', '2360.TW', '3044.TW', '2618.TW', '2610.TW', '2615.TW', '2204.TW', '2206.TW', '2105.TW', '1303.TW', '1326.TW', '1402.TW']
    tw_mid = ['3231.TW', '3017.TW', '2376.TW', '6669.TW', '2353.TW', '2324.TW', '2356.TW', '2409.TW', '3481.TW', '1503.TW', '1513.TW', '1519.TW', '1514.TW', '1605.TW', '1609.TW', '1710.TW', '1712.TW', '2801.TW', '2834.TW', '5876.TW', '4739.TW', '1717.TW', '1722.TW', '6505.TW']
    
    # 將兩組結合並去重
    target_symbols = list(set(['0050.TW'] + tw50 + tw_mid))
    print(f"📡 準備抓取全市場 {len(target_symbols)} 檔標的數據...")
    ingest_stock_data(target_symbols)
