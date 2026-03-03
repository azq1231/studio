import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

def analyze_tsmc():
    ticker = "2330.TW"
    print(f"正在抓取 {ticker} 的歷史數據...")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=400)
    
    df = yf.download(ticker, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
    
    # 扁平化多級索引 (yf 0.2.x 預設行為)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # 計算漲跌幅
    df['Daily_Return'] = df['Close'].pct_change() * 100
    
    # 取最近一年
    one_year_ago = datetime.now() - timedelta(days=365)
    df_recent = df[df.index >= one_year_ago.strftime('%Y-%m-%d')].copy()

    # 取漲幅前 10
    top_10 = df_recent.sort_values(by='Daily_Return', ascending=False).head(10)
    
    # 列印到終端機
    print("\n日期        | 收盤價  | 漲跌幅  | 成交量")
    print("-" * 50)
    for date, row in top_10.iterrows():
        print(f"{date.strftime('%Y-%m-%d')} | {float(row['Close']):.2f} | {float(row['Daily_Return']):+6.2f}% | {int(row['Volume']):,}")

    # 寫入 artifact 檔案
    with open("scripts/tsmc_top_days.log", "w", encoding="utf-8") as f:
        f.write("日期,收盤價,漲跌幅,成交量\n")
        for date, row in top_10.iterrows():
            f.write(f"{date.strftime('%Y-%m-%d')},{float(row['Close']):.2f},{float(row['Daily_Return']):+.2f}%,{int(row['Volume'])}\n")

if __name__ == "__main__":
    analyze_tsmc()
