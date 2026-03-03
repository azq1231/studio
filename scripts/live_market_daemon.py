import time
import subprocess
import sys
from datetime import datetime

def run_updates():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 正在啟動全自動市場同步...")
    
    # 執行所有相關的更新腳本
    scripts = [
        "d:/MyProjects/FinanceFlow/scripts/update_full_risk.py",
        "d:/MyProjects/FinanceFlow/scripts/update_portfolio.py",
        "d:/MyProjects/FinanceFlow/scripts/scan_tw50_opportunities.py"
    ]
    
    for script in scripts:
        try:
            print(f"  -> 更新中: {script.split('/')[-1]}...")
            subprocess.run([sys.executable, script], check=True, capture_output=True)
        except Exception as e:
            print(f"  ❌ 更新失敗 {script.split('/')[-1]}: {e}")

    # 同步到 JSON 給網頁讀取 (這部分已經包含在上述腳本內)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ 同步成功。目前為休眠狀態，5 分鐘後將進行下一次抓取。")

if __name__ == "__main__":
    print("="*60)
    print("🚀 金融數據全自動守護進程已啟動 (Live Market Daemon)")
    print("="*60)
    
    while True:
        # 僅在交易時段或您需要時更新 (這裡設定為全天候每 5 分鐘一次)
        run_updates()
        time.sleep(300) # 暫停 300 秒 (5 分鐘)
