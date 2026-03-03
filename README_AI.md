# 🤖 AI 開發與協作規範 (AI Collaboration Rules)

⚠️ **任何 AI 代理人在開始工作前，必須優先讀取並嚴格遵守本文件。**

## 1. 拒絕盲目嘗試與「靠運氣修復」

遇到任何程式碼錯誤、編譯失敗或崩潰：

- **嚴禁盲猜**：禁止隨便修改程式碼然後叫用戶「試試看」。
- **事前診斷**：修復前必須分析出具體失敗的根本原因 (Root Cause)，甚至需要加上 Log Points 攔截實際錯誤資訊。
- **閉環驗證**：修復方案實作後，**必須由 AI 自己透過瀏覽器/終端機/測試腳本驗證 (Verify) 能正常執行後，才能回報給用戶。**
- **永遠別問「試試看」**：嚴禁對用戶說「請重新整理試試看」或「請手動測試看看」。AI 要做完自己的端對端 (End-to-End) 測試。

## 2. 強制性問題與修復紀錄 (Detailed Issue Logging)

為避免重複發生相同問題（如 Firebase Timestamp 物件導致 React 渲染崩潰 ），所有解決的錯誤都必須被記錄下來。

- **紀錄位置**：`docs/AI_Logs/`
- **檔案命名**：以日期與簡略描述命名（例：`2026-03-04_firebase_timestamp_crash_fix.md`）
- **報告結構**：
  1. **問題描述 (Issue)**：具體發生了什麼故障（包含錯誤日誌與行號）。
  2. **根本原因 (Root Cause)**：為什麼會發生這個故障。
  3. **修復過程 (Fix Details)**：改動了什麼邏輯或檔案。
  4. **驗證方式 (Verification)**：你是如何確認這個問題已經被 100% 修復的。

## 3. 專案特化知識庫 (Project Avoidance list)

為避免重複踩坑，記錄以下關鍵禁忌：

- 🚫 **Firebase Timestamp 渲染崩潰**：在前端 React 取用 Firestore 傳來的 `last_updated` 欄位時，它可能會是一個 Timestamp 物件 (`{seconds, nanoseconds}`)。**嚴禁在 JSX 中直接渲染該變數**。必須統一使用防呆的時間轉換函式（例如專案中已實作的 `safeTimeStr()`）。
- 🚫 **靜態編譯時不存在的資料**：專案使用 Firebase Hosting，依賴靜態導出 (`next export`) 或 Fallback JSON。`fetch` 時必須實作完善的防呆，若回傳內容型態為 `text/html` (通常代表 404 被轉向 index.html)，絕對不能當作 JSON 處理，否則會引發 `SyntaxError: Unexpected token '<'` 崩潰。

---
> 📝 *最後更新: 2026-03-04*
