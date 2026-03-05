import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta

# 初始化 Firebase — 支援 GitHub Actions 環境變數與本地 service-account.json
try:
    if not firebase_admin._apps:
        # 1. 優先從環境變數讀取 (GitHub Actions Secrets)
        service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
        if service_account_json:
            try:
                key_dict = json.loads(service_account_json)
                cred = credentials.Certificate(key_dict)
                firebase_admin.initialize_app(cred)
                print("🚀 使用環境變數 FIREBASE_SERVICE_ACCOUNT 初始化成功")
            except Exception as json_err:
                print(f"❌ 解析環境變數 JSON 失敗: {json_err}")
                sys.exit(1)
        else:
            # 2. 嘗試本地 service-account.json
            current_dir = os.path.dirname(os.path.abspath(__file__))
            possible_paths = [
                os.path.join(current_dir, '..', 'service-account.json'),
                os.path.join(current_dir, 'service-account.json'),
                'service-account.json'
            ]
            found = False
            for path in possible_paths:
                if os.path.exists(path):
                    cred = credentials.Certificate(path)
                    firebase_admin.initialize_app(cred)
                    print(f"🚀 使用本地憑證 {os.path.abspath(path)} 初始化成功")
                    found = True
                    break
            if not found:
                print("❌ 未找到 Firebase 憑證。請設定 FIREBASE_SERVICE_ACCOUNT 環境變數或放置 service-account.json。")
                sys.exit(1)
    
    db = firestore.client()
except Exception as e:
    print(f"Firestore 初始化失敗: {e}")
    sys.exit(1)

def sync_to_cloud(collection, doc_id, data):
    """將資料推送到 Firestore"""
    try:
        # 強制使用台北時間 (UTC+8) 確保雲端和前端渲染一致
        tz_tpe = timezone(timedelta(hours=8))
        now_str = datetime.now(tz_tpe).strftime('%Y-%m-%d %H:%M:%S')
        data['last_updated'] = now_str
        if 'last_update' in data:
            data['last_update'] = now_str
        db.collection(collection).document(doc_id).set(data)
        print(f"  ✅ 雲端同步成功: {collection}/{doc_id}")
    except Exception as e:
        print(f"  ❌ 雲端同步失敗: {e}")

def update_all_radar_to_cloud():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 開始執行雲端數據同步...")
    
    # 使用相對路徑: scripts/ -> ../public/data/
    current_dir = os.path.dirname(os.path.abspath(__file__))
    base_path = os.path.join(current_dir, '..', 'public', 'data')
    
    print(f"  📂 資料讀取路徑: {os.path.abspath(base_path)}")

    synced = 0
    try:
         # 1. 同步 TSMC Risk Monitor
         risk_file = os.path.join(base_path, 'tsmc_risk.json')
         if os.path.exists(risk_file):
             with open(risk_file, 'r', encoding='utf-8') as f:
                 risk_data = json.load(f)
             sync_to_cloud('marketRecords', 'tsmc', risk_data)
             synced += 1
         else:
             print(f"  ⚠️ 跳過: {risk_file} 不存在")
         
         # 2. 同步 TW50 Opportunities
         tw50_file = os.path.join(base_path, 'tw50_full_scan.json')
         if os.path.exists(tw50_file):
             with open(tw50_file, 'r', encoding='utf-8') as f:
                 tw50_list = json.load(f)
             # 前端期望 { stocks: [...] } 格式
             sync_to_cloud('marketRecords', 'tw50', {"stocks": tw50_list})
             synced += 1
         else:
             print(f"  ⚠️ 跳過: {tw50_file} 不存在")

         # 3. 同步 Portfolio
         port_file = os.path.join(base_path, 'portfolio_live.json')
         if os.path.exists(port_file):
             with open(port_file, 'r', encoding='utf-8') as f:
                 port_data = json.load(f)
             sync_to_cloud('marketRecords', 'portfolio', port_data)
             synced += 1
         else:
             print(f"  ⚠️ 跳過: {port_file} 不存在")

    except Exception as e:
        print(f"❌ 數據推送至雲端時發生錯誤: {e}")
    
    print(f"\n🏁 雲端同步完成，共推送 {synced}/3 項資料。")

if __name__ == "__main__":
    update_all_radar_to_cloud()
