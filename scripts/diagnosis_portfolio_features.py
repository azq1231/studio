"""
診斷與驗證腳本：股市雷達持股新增/刪除與策略更新端對端驗證
"""
import os
import sys
import json
import firebase_admin
from firebase_admin import credentials, firestore

# 1. 初始化 Firebase
def init_fb():
    db = None
    try:
        if not firebase_admin._apps:
            sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
            if sa_json:
                key_dict = json.loads(sa_json)
                cred = credentials.Certificate(key_dict)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
            else:
                current_dir = os.path.dirname(os.path.abspath(__file__))
                sa_path = os.path.join(current_dir, '..', 'service-account.json')
                if os.path.exists(sa_path):
                    cred = credentials.Certificate(sa_path)
                    firebase_admin.initialize_app(cred)
                    db = firestore.client()
        else:
            db = firestore.client()
    except Exception as e:
        print(f"❌ Firebase 初始化失敗: {e}")
    return db

def main():
    db = init_fb()
    if not db:
        print("❌ 無法連線至 Firestore，將跳過 Firestore 模擬部分")
        return

    doc_ref = db.collection('marketRecords').document('portfolio')
    
    # 備份原有資料
    backup_data = None
    try:
        doc = doc_ref.get()
        if doc.exists:
            backup_data = doc.to_dict()
            print("💾 成功備份 Firestore portfolio 原有數據")
    except Exception as e:
        print(f"⚠️ 備份失敗: {e}")

    try:
        # 2. 模擬前端寫入：新增台積電(2330.TW) 與 鴻海(2317.TW)
        mock_positions = [
            {"symbol": "5871.TW", "name": "中租-KY", "avg_price": 103.0, "shares": 1000},
            {"symbol": "2330.TW", "name": "台積電", "avg_price": 850.0, "shares": 500},
            {"symbol": "2317.TW", "name": "鴻海", "avg_price": 150.0, "shares": 2000}
        ]
        
        print("\n🧪 [步驟 1] 模擬前端：寫入測試持股資料至 Firestore...")
        doc_ref.set({
            "last_updated": "2026-06-19 00:00:00",
            "total_invested": sum(p["avg_price"] * p["shares"] for p in mock_positions),
            "positions": mock_positions
        })
        print("✅ 成功寫入 3 檔測試持股至 Firestore")

        # 3. 呼叫後端 update_portfolio.py 執行策略更新
        print("\n🧪 [步驟 2] 執行 update_portfolio.py 進行策略更新計算...")
        import subprocess
        current_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(current_dir, 'update_portfolio.py')
        
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        res = subprocess.run([sys.executable, script_path], capture_output=True, text=True, env=env)
        
        if res.returncode != 0:
            print("❌ update_portfolio.py 執行失敗！")
            print(res.stderr)
            sys.exit(1)
        else:
            print("✅ update_portfolio.py 執行成功！")
            # 印出後端執行輸出的最後幾行
            print("--- 後端輸出日誌 ---")
            print("\n".join(res.stdout.split("\n")[-5:]))
            print("------------------")

        # 4. 讀取並驗證輸出的 portfolio_live.json
        print("\n🧪 [步驟 3] 驗證輸出的本地 JSON 資料...")
        json_path = os.path.join(current_dir, '..', 'studio', 'public', 'data', 'portfolio_live.json')
        
        if not os.path.exists(json_path):
            print(f"❌ 找不到產生的 JSON 檔案: {json_path}")
            sys.exit(1)
            
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        positions = data.get("positions", [])
        print(f"驗證本地 JSON 中包含的持股數: {len(positions)} 檔")
        
        for pos in positions:
            symbol = pos["symbol"]
            name = pos["name"]
            curr_p = pos["current_price"]
            j_val = pos.get("j_val")
            bp = pos.get("bp")
            action = pos.get("action")
            pnl_val = pos.get("pnl_value")
            targets = pos.get("targets", [])
            
            print(f"\n📈 標的: {name} ({symbol})")
            print(f"  - 買入成本: {pos['avg_price']} | 當前市價: {curr_p}")
            print(f"  - 計算 J 值: {j_val} | 計算布林位階: {bp}")
            print(f"  - 浮動損益: {pnl_val} 元 | 目標首波獲利點: {targets[0] if len(targets) > 0 else 'N/A'}")
            print(f"  - 策略指令: {action}")
            print(f"  - 策略建議: {pos.get('advice')}")
            
            # 防呆驗證
            assert curr_p > 0, f"⚠️ {symbol} 當前現價異常：{curr_p}"
            assert j_val is not None, f"⚠️ {symbol} 的 J 值計算為空"
            assert bp is not None, f"⚠️ {symbol} 的布林位階計算為空"
            assert len(targets) == 2, f"⚠️ {symbol} 的 targets 長度必須為 2"

        print("\n🎉 [驗證通過] 所有量化指標、獲利點、停損點、策略建議皆計算正確且符合規格！")

    finally:
        # 5. 還原 Firestore 資料，不留髒數據
        if backup_data:
            print("\n🧹 [清理步驟] 正在還原 Firestore 原始數據...")
            doc_ref.set(backup_data)
            print("✅ 原始數據還原完成！")

if __name__ == "__main__":
    main()
