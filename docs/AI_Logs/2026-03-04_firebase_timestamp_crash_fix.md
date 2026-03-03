# Firebase Timestamp & JSON Fetch Error Fix Report

**Date**: 2026-03-04
**Module**: 股市雷達 (Stock Radar) - `finance-flow-client.tsx`

## 1. 症狀與故障表徵 (Symptom & Issues)

- **問題 A (React Crash):** 進入「股市雷達」任意分頁後，整個 React 應用程式會拋出致命的 `Error: Minified React error #31`，導致前端全白或出現 Application Error 錯誤視窗。
- **問題 B (Data Fetch Null/Crash):** 在讀取不到雲端更新的 `*.json` 資料時，瀏覽器 console 出現 `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`。

## 2. 根本原因診斷 (Root Cause Analysis)

### 🚨 原因 A: Firebase Timestamp Object rendering

當 Python `cloud_sync.py` 在推送 `last_updated: datetime.now()` 到 Firestore 時，該欄位在 Firestore 資料庫中會儲存為 Timestamp 物件，包含 `{seconds: ..., nanoseconds: ...}`。
在早期的前端代碼中，這個欄位被直接塞進 `<span>` 內渲染：

```tsx
// ❌ 觸發災難的寫法：
<span className="text-[10px] text-slate-400">更新時間: {portfolioData?.last_updated}</span>
```

React 遇到純 Object 直接放入 DOM，便會擲出 #31 渲染錯誤，因為它不知道如何將帶有鍵值的物件轉成文字。

### 🚨 原因 B: Firebase Hosting Fallback HTML

當前端對 Firebase Server (或 Next.js Dev Server) 以 Fetch API 請求一個不存在的 JSON（例如 `portfolio_live.json` 尚未由本地建立）時，伺服器按 SPA 規範拋回了預設的 404 處理頁面（即 404 HTML `<!DOCTYPE html>...`）。
由於前端使用了 `await res.json()` 強制解析，解析 HTML 時遇到 `{` 而非 `<` 就導致了語法錯誤與報錯。

## 3. 修復方案實作 (Fix Procedures)

### ✅ 修復 A: 統一實作 `safeTimeStr` (時間防呆轉型)

在 `finance-flow-client.tsx` 中建立一個多型別相容的安全解析函數：

```tsx
const safeTimeStr = (val: any): string => {
  if (!val) return '---';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') { // 對應 Firestore Timestamp
    try { return val.toDate().toLocaleString(); } catch { return '---'; }
  }
  if (val instanceof Date) return val.toLocaleString(); // 對應 Date
  if (typeof val?.seconds === 'number') { // 另一種可能被解出的 Timestamp
    try { return new Date(val.seconds * 1000).toLocaleString(); } catch { return '---'; }
  }
  return '---';
};
```

並且將 **所有** 取用時間的 DOM（包含 TSMC, Portfolio, TW50）全面改為以 `{safeTimeStr(data?.last_updated)}` 呼叫。

### ✅ 修復 B: 強化 `fetchSafe` 取代替代方案

在原本的資料請求中，加入了 Headers Content-Type 的嚴格檢查。如果 Header 不含 `application/json` 或 API 回傳 `res.ok === false`，程式將停止 `.json()` 解析，改為輸出本地事先定義好的 `TW50_FALLBACK` 常數資料，從此防止整個儀表板掛掉。

## 4. 閉環驗證成果 (Verification Results)

- **環境：** Deployed URL (`studio-2399006184-77f24.web.app/?v=fix4`)
- **操作：**
  - 主動點開「股市雷達」首頁 ➔ **無崩潰。**
  - 使用 Browser Subagent 切換「台積電監控」、「持倉實戰」、「機會掃描」➔ **所有組件正常運作，不再見到 `Error #31`。**
  - 檢視所有 `Updated:` 欄位 ➔ 已正常將 `Timestamp` 解析為 `2026/3/4 上午11:40:17` 字串格式。
- **結論：** 完全通過驗證，已上傳 GitHub `main` 分支並部署上雲端。
