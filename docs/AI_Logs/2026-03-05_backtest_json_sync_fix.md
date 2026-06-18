# 2026-03-05 數據文件 Git 忽略與部署空洞修復 (Firestore as Data Bus)

## 1. 問題描述 (Issue)

在實作「2025 回測報告」頁面時，前端程式碼 (`/analysis/backtest`) 依賴 `fetch('/data/backtest_2025.json')`。然而，由於 `studio/public/data/*.json` 被列入 `.gitignore`，導致 `git push` 後該 JSON 檔案並未上傳至 GitHub，雲端部署版本因此抓不到資料（回傳 404/index.html），引發 `SyntaxError: Unexpected token '<'` 崩潰或顯示空白。

## 2. 根本原因 (Root Cause)

1. **Git 忽略策略**：為了避免大量生成的臨時數據污染代碼庫，`.json` 被排除在版本控制之外。
2. **部署機制侷限**：Firebase Hosting 僅部署 Git 有追蹤的檔案，或是透過特定工具上傳的檔案。
3. **靜態依賴風險**：直接使用 `fetch` 讀取靜態路徑，會受限於檔案是否成功部署，缺乏雲端的動態同步能力。

## 3. 修復過程 (Fix Details)

1. **定義「Firestore 資料總線」模式 (Firestore as Data Bus)**：
    * 修改 `scripts/cloud_sync.py`：新增同步路徑，將本地生成的 `backtest_2025.json` 自動推送到 Firestore 的 `marketRecords/backtest_2025` 文檔中。
    * 修改前端組組件 (`page.tsx`)：捨棄 `fetch` 靜態檔案，改用 `useDoc` 監聽 Firestore 的即時更新。
2. **自動化同步**：當本地或 GitHub Actions 重新執行回測腳本後，會自動調用 `cloud_sync.py` 將新數據推送到雲端資料庫，無需手動 `git add -f`。

## 4. 驗證方式 (Verification)

1. **本地同步測試**：執行 `python scripts/cloud_sync.py` 確認終端機顯示 `✅ 雲端同步成功: marketRecords/backtest_2025`。
2. **雲端連動驗證**：進入部署主站 `https://studio-2399006184-77f24.web.app/analysis/backtest`，確認即使在沒有靜態 JSON 檔案的情況下，頁面仍能正確渲染出 2025 年的回測圖表與交易明細。

---
📝 *記錄人: Antigravity*
