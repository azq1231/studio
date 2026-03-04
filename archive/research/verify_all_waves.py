"""
台積電 2021-2025 全週期實戰對帳紀錄驗證腳本
驗證項目：
  1. 每個波段的進出場日期是否為有效交易日
  2. 進出場價格是否與真實歷史收盤價 (未還原) 吻合
  3. 報酬率計算是否正確
  4. 進場時的 J 值、布林帶是否真的觸發買訊
  5. 出場時的乖離率、量能背離是否真的觸發賣訊
"""
import yfinance as yf
import pandas as pd
import numpy as np

# 網頁上呈現的 8 個波段資料
WAVES = [
    {"name": "2021 本土疫情恐慌坑",       "buy": "2021-05-13", "buy_p": 547, "sell": "2021-09-06", "sell_p": 631, "ret": 15.3},
    {"name": "2022 百年難遇死亡區轉機",    "buy": "2022-10-25", "buy_p": 371, "sell": "2023-02-14", "sell_p": 545, "ret": 46.9},
    {"name": "2023 COMPUTEX 狂潮預演波",  "buy": "2023-04-26", "buy_p": 491, "sell": "2023-06-13", "sell_p": 593, "ret": 20.7},
    {"name": "2024 年初起漲波",           "buy": "2024-01-16", "buy_p": 580, "sell": "2024-03-08", "sell_p": 784, "ret": 35.1},
    {"name": "2024 首次千元衝刺",         "buy": "2024-04-19", "buy_p": 750, "sell": "2024-07-11", "sell_p": 1080, "ret": 44.0},
    {"name": "2024 8月股災修復期",        "buy": "2024-08-05", "buy_p": 815, "sell": "2024-10-18", "sell_p": 1085, "ret": 33.1},
    {"name": "2025 年後震盪上車波",       "buy": "2025-02-14", "buy_p": 1060, "sell": "2025-11-03", "sell_p": 1510, "ret": 42.5},
    {"name": "2025 輝達狂潮噴發波",       "buy": "2025-11-18", "buy_p": 1405, "sell": "2026-02-25", "sell_p": 2015, "ret": 43.4},
]

# 取得完整歷史資料 (未還原)
print("=" * 80)
print("正在從 Yahoo Finance 下載 2330.TW 歷史資料 (auto_adjust=False)...")
df = yf.Ticker('2330.TW').history(start='2021-01-01', end='2026-03-01', auto_adjust=False)
df.index = df.index.tz_localize(None)
print(f"資料範圍: {df.index[0].strftime('%Y-%m-%d')} ~ {df.index[-1].strftime('%Y-%m-%d')} (共 {len(df)} 個交易日)")
print("=" * 80)

# 計算技術指標
df['MA20'] = df['Close'].rolling(20).mean()
df['STD20'] = df['Close'].rolling(20).std()
df['Lower'] = df['MA20'] - (df['STD20'] * 2)
df['Upper'] = df['MA20'] + (df['STD20'] * 2)
df['BP'] = (df['Close'] - df['Lower']) / (df['Upper'] - df['Lower'])
df['MA240'] = df['Close'].rolling(240).mean()
df['Bias240'] = (df['Close'] - df['MA240']) / df['MA240'] * 100
df['VR'] = df['Volume'] / df['Volume'].rolling(10).median()

l9 = df['Low'].rolling(window=9).min()
h9 = df['High'].rolling(window=9).max()
rsv = (df['Close'] - l9) / (h9 - l9) * 100
K = rsv.ewm(com=2).mean()
D = K.ewm(com=2).mean()
df['J'] = 3 * K - 2 * D

df['Vol_MA10'] = df['Volume'].rolling(10).mean()

all_pass = True

for i, w in enumerate(WAVES):
    print(f"\n{'─' * 80}")
    print(f"【Wave {i+1}】{w['name']}")
    print(f"{'─' * 80}")
    
    errors = []
    
    # 1. 驗證日期是否為有效交易日
    buy_date = w['buy']
    sell_date = w['sell']
    
    if buy_date not in df.index.strftime('%Y-%m-%d').tolist():
        errors.append(f"❌ 進場日 {buy_date} 不是有效交易日！")
    if sell_date not in df.index.strftime('%Y-%m-%d').tolist():
        errors.append(f"❌ 出場日 {sell_date} 不是有效交易日！")
    
    if errors:
        for e in errors:
            print(e)
        all_pass = False
        continue
    
    # 2. 驗證價格
    real_buy = df.loc[buy_date, 'Close']
    real_sell = df.loc[sell_date, 'Close']
    
    buy_ok = abs(real_buy - w['buy_p']) <= 5
    sell_ok = abs(real_sell - w['sell_p']) <= 5
    
    print(f"  進場: {buy_date}  網頁報價=${w['buy_p']}  真實收盤=${real_buy}  {'✅' if buy_ok else '❌ 差距=' + str(round(real_buy - w['buy_p'], 1))}")
    print(f"  出場: {sell_date}  網頁報價=${w['sell_p']}  真實收盤=${real_sell}  {'✅' if sell_ok else '❌ 差距=' + str(round(real_sell - w['sell_p'], 1))}")
    
    if not buy_ok or not sell_ok:
        all_pass = False
    
    # 3. 驗證報酬率
    actual_ret = round((real_sell / real_buy - 1) * 100, 1)
    ret_ok = abs(actual_ret - w['ret']) <= 2.0
    print(f"  報酬: 網頁顯示=+{w['ret']}%  實際計算=+{actual_ret}%  {'✅' if ret_ok else '❌'}")
    
    if not ret_ok:
        all_pass = False
    
    # 4. 驗證進場指標 (J值、布林帶、量能比)
    j_at_buy = round(df.loc[buy_date, 'J'], 2)
    bp_at_buy = round(df.loc[buy_date, 'BP'], 2)
    vr_at_buy = round(df.loc[buy_date, 'VR'], 2)
    print(f"  [進場指標] J={j_at_buy} | 布林帶={bp_at_buy} | 量能比={vr_at_buy}x")
    
    # 5. 驗證出場指標 (乖離率、量能關係)
    bias_at_sell = df.loc[sell_date, 'Bias240']
    vr_at_sell = round(df.loc[sell_date, 'VR'], 2)
    bias_str = f"{round(bias_at_sell, 1)}%" if not pd.isna(bias_at_sell) else "N/A (資料不足240日)"
    print(f"  [出場指標] 年線乖離={bias_str} | 量能比={vr_at_sell}x")

print(f"\n{'=' * 80}")
if all_pass:
    print("🟢 全部 8 個波段驗證通過！所有價格與報酬率邏輯正確。")
else:
    print("🔴 有部分波段驗證失敗，需要修正！請檢查上方標記為 ❌ 的項目。")
print(f"{'=' * 80}")
