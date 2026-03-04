import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def export_tsmc_prices():
    ticker = "2330.TW"
    print(f"正在抓取 {ticker} 過去一年的每日價格數據...")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    
    df = yf.download(ticker, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
    
    # 處理 yf 0.2.x 索引
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # 依照日期排序 (由舊到新)
    df = df.sort_index()

    # 計算漲跌價與漲跌幅
    df['Price_Change'] = df['Close'].diff()
    df['Pct_Change'] = df['Close'].pct_change() * 100

    # 準備輸出格式
    # 我們選擇月第一天、週一或大變動天來呈現，或者直接產出完整 CSV
    output_path = "scripts/tsmc_full_year_prices.csv"
    df.to_csv(output_path)
    print(f"完整數據已儲存至: {output_path}")

    # 為了方便用戶閱讀，我們印出每個月的代表性價格 (例如每月 1 號或第一個交易日)
    df['YearMonth'] = df.index.to_period('M')
    monthly_representative = df.groupby('YearMonth').head(1)

    print("\n--- 台積電 (2330.TW) 過去一年股價走勢概覽 (按日期排列) ---")
    print(f"{'日期':<12} | {'收盤價':<8} | {'單日漲跌':<8} | {'漲跌幅':<8}")
    print("-" * 50)
    
    for date, row in monthly_representative.iterrows():
        change = f"{float(row['Price_Change']):+6.2f}" if not pd.isna(row['Price_Change']) else "N/A"
        pct = f"{float(row['Pct_Change']):+6.2f}%" if not pd.isna(row['Pct_Change']) else "N/A"
        print(f"{date.strftime('%Y-%m-%d')} | {float(row['Close']):8.2f} | {change:<8} | {pct:<8}")

    # 最後顯現最新的 5 天
    print("\n--- 最近 5 個交易日 ---")
    for date, row in df.tail(5).iterrows():
        print(f"{date.strftime('%Y-%m-%d')} | {float(row['Close']):8.2f} | {float(row['Price_Change']):+6.2f} | {float(row['Pct_Change']):+6.2f}%")

if __name__ == "__main__":
    export_tsmc_prices()
