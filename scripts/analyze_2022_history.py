import yfinance as yf
import pandas as pd
from datetime import datetime
from tabulate import tabulate

def analyze_2022_crash():
    ticker = "2330.TW"
    print(f"正在抓取 {ticker} 2021-2022 年的數據...")
    
    start_date = "2021-01-01"
    end_date = "2022-12-31"
    
    df = yf.download(ticker, start=start_date, end=end_date, progress=False)
    
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # 找出這段時間的高點 (688元) 與低點 (371元)
    ath_2022 = df['Close'].max()
    ath_date = df['Close'].idxmax()
    
    low_2022 = df['Close'].min()
    low_date = df['Close'].idxmin()

    print(f"\n--- 2021-2022 台積電關鍵轉折點 ---")
    print(f"2022 高點日期: {ath_date.strftime('%Y-%m-%d')} | 價格: {ath_2022:.2f}")
    print(f"2022 低點日期: {low_date.strftime('%Y-%m-%d')} | 價格: {low_2022:.2f}")
    print(f"最大跌幅: {((low_2022 - ath_2022) / ath_2022 * 100):.2f}%")

    # 擷取關鍵月份的平均價格與波動
    df['YearMonth'] = df.index.to_period('M')
    monthly = df.groupby('YearMonth')['Close'].agg(['mean', 'max', 'min']).reset_index()
    
    # 產出一段時間的價格概覽 (2021 全年到 2022 崩盤)
    print("\n--- 2021-2022 每月概覽 (還原大樂觀到大修正) ---")
    output = []
    for _, row in monthly.iterrows():
        output.append([
            str(row['YearMonth']),
            f"{row['mean']:.2f}",
            f"{row['max']:.2f}",
            f"{row['min']:.2f}"
        ])
    
    headers = ["年份月份", "月平均價", "最高價", "最低價"]
    print(tabulate(output, headers=headers, tablefmt="grid"))

if __name__ == "__main__":
    analyze_2022_crash()
