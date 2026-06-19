import requests
import pandas as pd
import io

def fetch_twse_universe():
    """
    從 TWSE 抓取上市標的與產業別
    """
    url = "https://isin.twse.com.tw/isin/C_public.jsp?strMode=2"
    res = requests.get(url)
    res.encoding = 'big5'
    df = pd.read_html(io.StringIO(res.text))[0]
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    
    mapping = {}
    for idx, row in df.iterrows():
        name_val = str(row['有價證券代號及名稱'])
        industry = str(row['產業別'])
        if '　' in name_val:
            code = name_val.split('　')[0]
            if len(code) == 4:
                mapping[f"{code}.TW"] = industry
    return mapping

def fetch_tpex_universe():
    """
    從 TPEx 抓取上櫃標的與產業別
    """
    url = "https://isin.twse.com.tw/isin/C_public.jsp?strMode=4"
    res = requests.get(url)
    res.encoding = 'big5'
    df = pd.read_html(io.StringIO(res.text))[0]
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    
    mapping = {}
    for idx, row in df.iterrows():
        name_val = str(row['有價證券代號及名稱'])
        industry = str(row['產業別'])
        if '　' in name_val:
            code = name_val.split('　')[0]
            if len(code) == 4:
                mapping[f"{code}.TWO"] = industry
    return mapping

if __name__ == "__main__":
    twse_map = fetch_twse_universe()
    tpex_map = fetch_tpex_universe()
    all_map = {**twse_map, **tpex_map}
    
    print(f"✅ 發現共 {len(all_map)} 檔上市櫃標的並成功配對產業別。")
    
    with open('data/universe_with_industry.json', 'w', encoding='utf-8') as f:
        import json
        json.dump(all_map, f, ensure_ascii=False)
    
    # 同步更新舊的 full_universe.json 以保持向後兼容
    with open('data/full_universe.json', 'w') as f:
        json.dump(list(all_map.keys()), f)
    
    print("💾 已保存產業數據至 data/universe_with_industry.json")
