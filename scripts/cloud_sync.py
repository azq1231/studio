import yfinance as yf
import pandas as pd
import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import time

# 初始化 Firebase (使用預設憑證)
try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
except Exception as e:
    print(f"Firebase 初始化失敗: {e}")
    sys.exit(1)

def sync_to_cloud(collection, doc_id, data):
    try:
        data['last_updated'] = datetime.now()
        db.collection(collection).document(doc_id).set(data)
        print(f"  ✅ 雲端同步成功: {collection}/{doc_id}")
    except Exception as e:
        print(f"  ❌ 雲端同步失敗: {e}")

def update_all_radar_to_cloud():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 開始執行雲端數據同步...")
    
    base_path = 'd:/MyProjects/FinanceFlow/studio/public/data/'
    
    try:
         # 1. 同步 TSMC Risk Monitor
         risk_file = base_path + 'tsmc_risk.json'
         with open(risk_file, 'r', encoding='utf-8') as f:
             risk_data = json.load(f)
         sync_to_cloud('marketRecords', 'tsmc', risk_data)
         
         # 2. 同步 TW50 Opportunities
         tw50_file = base_path + 'tw50_full_scan.json'
         with open(tw50_file, 'r', encoding='utf-8') as f:
             tw50_list = json.load(f)
         # Frontend expects { stocks: [...] }
         sync_to_cloud('marketRecords', 'tw50', {"stocks": tw50_list})

         # 3. 同步 Portfolio
         port_file = base_path + 'portfolio_live.json'
         with open(port_file, 'r', encoding='utf-8') as f:
             port_data = json.load(f)
         sync_to_cloud('marketRecords', 'portfolio', port_data)

    except Exception as e:
        print(f"數據推送至雲端時發生錯誤: {e}")

if __name__ == "__main__":
    update_all_radar_to_cloud()
