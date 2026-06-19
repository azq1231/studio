import requests
import polars as pl
from datetime import datetime
import os
import json
from pathlib import Path

class FastIngestV8:
    """
    Quant Lab v8: 職業級資料層
    - 2 個 Request 抓取全市場 (1900+ 檔)
    - 拋棄 yfinance，使用交易所原始資料
    - 存儲為極速 Long Table Parquet
    """
    def __init__(self, data_dir='data'):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.history_path = os.path.join(data_dir, 'market_history.parquet')

    def fetch_twse(self, date_str):
        """抓取上市全市場行情"""
        print(f"📡 正在抓取 TWSE (上市) 全市場行情: {date_str}")
        url = f"https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date={date_str}&type=ALL"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if data['stat'] != 'OK':
                print(f"⚠️ TWSE 無數據 (可能是假日)")
                return None
            
            # 台股行情通常在 data9 或 data8，尋找包含股票代號的表格
            table_idx = 0
            for i in range(12):
                key = f'data{i}'
                if key in data and len(data[key]) > 500:
                    table_idx = i
                    break
            
            if table_idx == 0: return None
            
            # 定義格式化函數
            def clean_num(v):
                if isinstance(v, str):
                    v = v.replace(',', '').replace('--', '0')
                try: return float(v)
                except: return 0.0

            raw_data = data[f'data{table_idx}']
            df = pl.DataFrame([
                {
                    "date": datetime.strptime(date_str, "%Y%m%d"),
                    "symbol": f"{row[0]}.TW",
                    "open": clean_num(row[5]),
                    "high": clean_num(row[6]),
                    "low": clean_num(row[7]),
                    "close": clean_num(row[8]),
                    "volume": clean_num(row[2]),
                    "turnover": clean_num(row[4])
                } for row in raw_data if len(row[0]) == 4 # 只取 4 碼普通股
            ])
            return df
        except Exception as e:
            print(f"❌ TWSE 抓取出錯: {e}")
            return None

    def fetch_tpex(self, date_str):
        """抓取 TPEx (上櫃) 全市場行情"""
        # TPEx 格式: 112/03/06
        y = int(date_str[:4]) - 1911
        m = date_str[4:6]
        d = date_str[6:8]
        tpex_date = f"{y}/{m}/{d}"
        
        print(f"📡 正在抓取 TPEx (上櫃) 全市場行情: {tpex_date}")
        url = f"https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date={tpex_date}&response=json"
        
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if not data.get('tables') or len(data['tables'][0]['data']) == 0:
                print(f"⚠️ TPEx 無數據")
                return None

            raw_data = data['tables'][0]['data']
            
            def clean_num(v):
                if isinstance(v, str):
                    v = v.replace(',', '').replace('--', '0')
                try: return float(v)
                except: return 0.0

            df = pl.DataFrame([
                {
                    "date": datetime.strptime(date_str, "%Y%m%d"),
                    "symbol": f"{row[0]}.TWO",
                    "open": clean_num(row[4]),
                    "high": clean_num(row[5]),
                    "low": clean_num(row[6]),
                    "close": clean_num(row[2]),
                    "volume": clean_num(row[7]),
                    "turnover": clean_num(row[8])
                } for row in raw_data if len(row[0]) == 4
            ])
            return df
        except Exception as e:
            print(f"❌ TPEx 抓取出錯: {e}")
            return None

    def migrate_old_data(self):
        """將舊的 Wide Matrix 轉換為 Long Table"""
        print("🔄 正在遷移舊有的 Wide Matrix 數據...")
        try:
            c = pl.read_parquet(os.path.join(self.data_dir, 'close_matrix.parquet'))
            h = pl.read_parquet(os.path.join(self.data_dir, 'high_matrix.parquet'))
            l = pl.read_parquet(os.path.join(self.data_dir, 'low_matrix.parquet'))
            o = pl.read_parquet(os.path.join(self.data_dir, 'open_matrix.parquet'))
            v = pl.read_parquet(os.path.join(self.data_dir, 'volume_matrix.parquet'))
            
            def melt_it(df, name):
                return df.unpivot(index='date', variable_name='symbol', value_name=name)
            
            long_df = melt_it(c, 'close') \
                .join(melt_it(h, 'high'), on=['date', 'symbol']) \
                .join(melt_it(l, 'low'), on=['date', 'symbol']) \
                .join(melt_it(o, 'open'), on=['date', 'symbol']) \
                .join(melt_it(v, 'volume'), on=['date', 'symbol'])
            
            # 加入空欄位以對齊 schema
            long_df = long_df.with_columns(pl.lit(0.0).alias('turnover'))
            
            # 存儲
            long_df.write_parquet(self.history_path)
            print(f"✅ 遷移完成: {self.history_path} ({len(long_df)} 筆紀錄)")
            return True
        except Exception as e:
            print(f"⚠️ 遷移失敗 (可能檔案不存在): {e}")
            return False

    def fetch_twse_inst(self, date_str):
        """抓取上市三大法人買賣超"""
        print(f"📡 正在抓取 TWSE 三大法人數據: {date_str}")
        url = f"https://www.twse.com.tw/fund/T86?response=json&date={date_str}&selectType=ALLBUT0999"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if data['stat'] != 'OK': return None
            # [代號, 名稱, 外資買, 外資賣, 外資淨, 投信買, 投信賣, 投信淨...]
            raw_data = data['data']
            return pl.DataFrame([
                {
                    "symbol": f"{row[0].strip()}.TW",
                    "inst_foreign": float(row[4].replace(',', '')),
                    "inst_trust": float(row[7].replace(',', ''))
                } for row in raw_data if len(row[0].strip()) == 4
            ])
        except: return None

    def fetch_tpex_inst(self, date_str):
        """抓取上櫃三大法人買賣超"""
        y = int(date_str[:4]) - 1911
        m = date_str[4:6]
        d = date_str[6:8]
        t_date = f"{y}/{m}/{d}"
        print(f"📡 正在抓取 TPEx 三大法人數據: {t_date}")
        url = f"https://www.tpex.org.tw/www/zh-tw/insti/t86?date={t_date}&type=ALL&response=json"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if not data.get('tables'): return None
            # [代號, 名稱, 外資買, 外資賣, 外資淨, 投信買, 投信賣, 投信淨...]
            raw_data = data['tables'][0]['data']
            return pl.DataFrame([
                {
                    "symbol": f"{row[0].strip()}.TWO",
                    "inst_foreign": float(row[10].replace(',', '')), # 櫃買格式不同
                    "inst_trust": float(row[13].replace(',', ''))
                } for row in raw_data if len(row[0].strip()) == 4
            ])
        except: return None

    def fetch_twse_margin(self, date_str):
        """抓取上市融資餘額"""
        print(f"📡 正在抓取 TWSE 融資數據: {date_str}")
        url = f"https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date={date_str}&selectType=ALL"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if data['stat'] != 'OK': return None
            # [代號, 名稱, 前日餘額, 買進, 賣出, 現償, 今日餘額, 限額...]
            raw_data = data['data']
            return pl.DataFrame([
                {
                    "symbol": f"{row[0].strip()}.TW",
                    "margin_balance": float(row[6].replace(',', ''))
                } for row in raw_data if len(row[0].strip()) == 4
            ])
        except: return None

    def fetch_tpex_margin(self, date_str):
        """抓取上櫃融資餘額"""
        y = int(date_str[:4]) - 1911
        m = date_str[4:6]
        d = date_str[6:8]
        t_date = f"{y}/{m}/{d}"
        print(f"📡 正在抓取 TPEx 融資數據: {t_date}")
        url = f"https://www.tpex.org.tw/www/zh-tw/margin/dailyQuotes?date={t_date}&response=json"
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
            if not data.get('tables'): return None
            # [代號, 名稱, 融資前日餘額, 融資買, 融資賣, 融資現償, 融資今日餘額...]
            raw_data = data['tables'][0]['data']
            return pl.DataFrame([
                {
                    "symbol": f"{row[0].strip()}.TWO",
                    "margin_balance": float(row[6].replace(',', ''))
                } for row in raw_data if len(row[0].strip()) == 4
            ])
        except: return None

    def daily_update(self):
        """執行每日全市場更新 (行情 + 籌碼 + 融資)"""
        today = datetime.now().strftime("%Y%m%d")
        
        # 1. 抓取所有數據
        df_price_list = [f for f in [self.fetch_twse(today), self.fetch_tpex(today)] if f is not None]
        if not df_price_list:
            print("🌑 今日無市場行情資料 (周末或假日)。")
            return
        df_price = pl.concat(df_price_list)
        
        # 法人
        df_inst_list = [f for f in [self.fetch_twse_inst(today), self.fetch_tpex_inst(today)] if f is not None]
        df_inst = pl.concat(df_inst_list) if df_inst_list else None
        
        # 融資
        df_margin_list = [f for f in [self.fetch_twse_margin(today), self.fetch_tpex_margin(today)] if f is not None]
        df_margin = pl.concat(df_margin_list) if df_margin_list else None
        
        # 2. 合併
        new_df = df_price
        if df_inst is not None:
            new_df = new_df.join(df_inst, on="symbol", how="left")
        else:
            new_df = new_df.with_columns([pl.lit(0.0).alias('inst_foreign'), pl.lit(0.0).alias('inst_trust')])
            
        if df_margin is not None:
            new_df = new_df.join(df_margin, on="symbol", how="left")
        else:
            new_df = new_df.with_columns([pl.lit(1.0).alias('margin_balance')]) 

        new_df = new_df.fill_null(0).fill_nan(0)
        
        # 3. 寫入 (Append & Deduplicate)
        if os.path.exists(self.history_path):
            old_df = pl.read_parquet(self.history_path)
            # 確保 Schema 兼容
            for col, default in [('inst_foreign', 0.0), ('inst_trust', 0.0), ('margin_balance', 1.0)]:
                if col not in old_df.columns:
                    old_df = old_df.with_columns(pl.lit(default).alias(col))
            
            new_df = new_df.with_columns(pl.col('date').cast(old_df['date'].dtype))
            final_df = pl.concat([old_df.filter(pl.col('date') != new_df['date'][0]), new_df])
            final_df.write_parquet(self.history_path)
            print(f"🚀 [V11] 全數據更新完成! 總筆數: {len(final_df)}")
        else:
            new_df.write_parquet(self.history_path)
            print(f"🆕 已建立全新的 V11 市場資料檔。")

if __name__ == "__main__":
    ingestor = FastIngestV8()
    # 如果沒歷史紀錄，先遷移
    if not os.path.exists(ingestor.history_path):
        ingestor.migrate_old_data()
    
    # 執行今日更新
    ingestor.daily_update()
