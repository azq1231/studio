"""
診斷腳本 v3：只用 ASCII 輸出，避免終端編碼問題
"""
import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    sa_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'service-account.json')
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection('marketRecords').document('tw50').get()

if not doc.exists:
    print("ERROR: tw50 not found")
    sys.exit(1)

data = doc.to_dict()
stocks = data.get('stocks', [])

filtered = [s for s in stocks if s.get('st') == 'BUY' or s.get('s') in ['2330.TW', '2603.TW']]

# 寫入到檔案 (UTF-8)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'diagnosis_result.json'), 'w', encoding='utf-8') as f:
    result = {
        "total": len(stocks),
        "filtered_count": len(filtered),
        "filtered_stocks": [],
        "missing_n_field": []
    }
    for stock in filtered:
        result["filtered_stocks"].append({
            "symbol": stock.get('s'),
            "n_field": stock.get('n', '__MISSING__'),
            "status": stock.get('st'),
            "j": stock.get('j'),
            "has_n": 'n' in stock
        })
    for stock in stocks:
        if 'n' not in stock:
            result["missing_n_field"].append(stock.get('s', '???'))
    
    json.dump(result, f, ensure_ascii=False, indent=2)

# ASCII-safe summary
print(f"Total stocks: {len(stocks)}")
print(f"Filtered (shown on UI): {len(filtered)}")
for s in filtered:
    sym = s.get('s', '?')
    has_n = 'n' in s
    n_val_len = len(s.get('n', '')) if has_n else 0
    print(f"  {sym}: has_n={has_n}, n_len={n_val_len}, st={s.get('st')}, j={s.get('j')}")

missing = [s.get('s') for s in stocks if 'n' not in s]
print(f"Missing 'n' field: {len(missing)} stocks")
if missing:
    for m in missing:
        print(f"  MISSING: {m}")
else:
    print("  All 50 stocks have 'n' field.")
print("Result saved to diagnosis_result.json")
