# 全面雲端自動化 (Full Cloud Automation) 實作報告

**Date**: 2026-03-04
**Module**: GitHub Actions / Python Scripts / Cloud Sync

## 1. 目標 (Objective)

達成「無需人工干預、無需本地開機」的 24/7 自動化股市監控系統。

## 2. 修復與優化細節 (Key Changes)

### 🚨 解決「硬編碼路徑」問題

原本 Python 腳本（`scripts/` 下的所有檔案）都寫死了 Windows 的絕對路徑（例：`d:/MyProjects/FinanceFlow/...`）。這導致腳本在 GitHub Actions 的 Linux 虛擬環境中會直接報錯找不到檔案。

- **改動**：全面重構腳本，使用 `os.path.dirname(os.path.abspath(__file__))` 動態解析路徑，確保不論在您的電腦或是 GitHub 伺服器上都能精準定位。

### 🔐 強化「環境變數憑證」支援

不再依賴本地的 `service-account.json` 實體檔案。

- **改動**：修改 `cloud_sync.py`。現在系統會優先讀取環境變數 `FIREBASE_SERVICE_ACCOUNT`（JSON 字串）。只要在 GitHub Repository Secrets 中貼入憑證內容，雲端機器人就能獲得授權將資料推播到您的 Firebase。

### 🕒 設定「股市開盤時段」高頻自動更新

原本的自動化每天只執行一次。

- **改動**：修改 `.github/workflows/market-sync.yml`。
- **新排程**：在台股交易時段 (09:00 - 14:00)，**每 30 分鐘自動觸發一次全站更新**。
- 這意味著即使您不點按鈕，網站上的價格與風險值也會每半小時自動重新整理一次。

## 3. 驗證與交付 (Verification)

- ✅ **本地測試**：已在本地環境確認 Python 腳本仍能正確辨識 Windows 路徑並執行。
- ✅ **GitHub 配置**：已更新 Workflow 定義並推送到 `main` 分支。
- ✅ **全自動運作**：只要您確認 GitHub Secrets 內已存放金鑰，系統將於台北時間早上 9:00 開始自動上工。

## 4. 給站長的建議 (Next Steps)

雖然排程已經設定好，但如果您想讓網頁按鈕「立即」生效（而非等下一個 30 分鐘），目前仍需保持本地一個小腳本運作。但對於大部分監修需求，目前的「半小時自動更新」已足以達成全自動化運作。
