import sys
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from datetime import datetime

# 導入 Alpha Factory 模組
sys.path.append(os.path.join(os.path.dirname(__file__), '../research'))
from alpha_factory import AlphaFactory

def sync_alpha_to_cloud():
    """
    執行 Alpha Factory 並將結果同步至 Firestore
    """
    print("🚀 啟動雲端同步: Alpha Factory -> Firestore")
    
    # 1. 執行 Alpha Factory 生成報告 (包含訊號、訂單與日誌元數據)
    factory = AlphaFactory()
    report = factory.generate_daily_report()
    
    if not report:
        print("❌ Alpha Factory 未生成報告 (可能是被 Market Macro Gate 擋下)，中止同步。")
        return

    # 2. 準備 Firestore 數據包
    # 將 Python 的 ISO 時間字串轉為 Firestore 伺服器時間戳記 (可選)
    # 這裡我們保留 Python 時間以便統一
    report["updatedAt"] = firestore.SERVER_TIMESTAMP 
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    report["date"] = today_str

    # 3. 寫入 Firestore
    try:
        # 尋求服務帳號金鑰
        sa_path = os.path.join(os.path.dirname(__file__), '../service-account.json')
        if not firebase_admin._apps:
            if os.path.exists(sa_path):
                cred = credentials.Certificate(sa_path)
                firebase_admin.initialize_app(cred)
            else:
                # 備援：若在 GitHub Action 且直接使用 ADC (Application Default Credentials)
                firebase_admin.initialize_app()
            
        db = firestore.client()
        
        # A. 存入 alphaSignals 歷程紀錄，以日期為 ID
        db.collection('alphaSignals').document(today_str).set(report)
        
        # B. 更新「最新」快照，供前端快速讀取
        db.collection('alphaSignals').document('latest').set(report)
        
        # C. 實作「交易日誌 (Trade Journal)」: 將 Orders 獨立存入追蹤
        # 讓未來可以分析這些訊號的勝率與期望值
        if report.get('orders'):
            # 建立 orders 庫，以日期為分界
            order_ref = db.collection('orders').document(today_str)
            order_ref.set({
                "date": today_str,
                "orders": report['orders'],
                "summary": report['summary']
            })
            
            # 建立 tradesLab (量化實驗室日誌)，每筆訊號獨立存檔以便未來 SQL 分析
            for ord in report['orders']:
                trade_id = f"{today_str}_{ord['symbol'].split('.')[0]}"
                db.collection('tradesLab').document(trade_id).set({
                    **ord,
                    "date": today_str,
                    "status": "OPEN", # 預設為已開啟追蹤
                    "pnl": 0.0,
                    "exit_date": None
                })
        
        print(f"✅ 同步成功！今日 Alpha 數據已上傳至 Firestore")
        print(f"📊 市場狀態: {report['market_state']}, 指令數: {len(report.get('orders', []))}")
        print(f"📝 已同步至 tradesLab 交易實驗日誌供未來分析。")
        
    except Exception as e:
        print(f"❌ Firestore 同步失敗: {e}")

if __name__ == "__main__":
    sync_alpha_to_cloud()
