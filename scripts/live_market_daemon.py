import time
import subprocess
import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# 初始化路徑
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = BASE_DIR

# 初始化 Firebase (若未啟動)
def init_fb():
    if not firebase_admin._apps:
        # 在 studio/scripts 下，service-account.json 應該在 ../../ (即根目錄)
        # 或者在 ../ (即 studio 根目錄)
        possible_paths = [
            os.path.join(os.path.dirname(BASE_DIR), 'service-account.json'),
            os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), 'service-account.json'),
            'service-account.json'
        ]
        found = False
        for path in possible_paths:
            if os.path.exists(path):
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                found = True
                break
        if not found:
            raise FileNotFoundError("Could not find service-account.json")
    return firestore.client()

def run_sync_scripts():
    """執行全套更新與雲端同步步驟"""
    now = datetime.now().strftime('%H:%M:%S')
    print(f"[{now}] 🚀 正在啟動全自動市場同步...")
    
    # 全套腳本
    scripts = [
        "update_full_risk.py",
        "update_portfolio.py",
        "scan_tw50_opportunities.py",
        "cloud_sync.py" # 關鍵：必須執行雲端同步！
    ]
    
    for script_name in scripts:
        script_path = os.path.join(SCRIPTS_DIR, script_name)
        try:
            print(f"  -> {script_name}...", end=" ", flush=True)
            # 強制 UTF-8 以免 Windows 環境出錯
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            
            subprocess.run([sys.executable, script_path], check=True, capture_output=True, env=env)
            print("OK")
        except Exception as e:
            print(f"FAIL: {e}")

    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ 同步與推播雲端已完成。")

def on_snapshot(doc_snapshot, changes, read_time):
    """Firestore 監聽回調"""
    for doc in doc_snapshot:
        data = doc.to_dict()
        if data and data.get('status') == 'pending':
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 偵測到網頁手動觸發 (Status: pending)")
            
            # 更新狀態為處理中，防止重複觸發
            doc.reference.update({'status': 'processing', 'processed_at': firestore.SERVER_TIMESTAMP})
            
            run_sync_scripts()
            
            # 更新狀態為已完成
            doc.reference.update({'status': 'completed'})
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 🏁 手動任務執行完畢，恢復閒置狀態。")

if __name__ == "__main__":
    db = init_fb()
    print("="*60)
    print("🚀 金融數據實時偵聽進程已啟動 (Firestore Watcher Enabled)")
    print(f"📍 基準路徑: {BASE_DIR}")
    print("  - 定時輪詢: 每 5 分鐘")
    print("  - 實時監聽: Firestore marketSync/trigger")
    print("="*60)
    
    # 啟動實時監聽
    query_watch = db.collection('marketSync').document('trigger').on_snapshot(on_snapshot)
    
    last_poll = 0
    POLL_INTERVAL = 300 # 5分鐘定時更新
    
    try:
        while True:
            # 輔助定時更新 (每 5 分鐘強制刷一次，即便沒按下按鈕)
            now_ts = time.time()
            if now_ts - last_poll > POLL_INTERVAL:
                run_sync_scripts()
                last_poll = now_ts
                
            time.sleep(1) # 低負載等待
    except KeyboardInterrupt:
        print("\nStopping...")
        query_watch.unsubscribe()
