# 2026-06-11 iOS Safari 客戶端崩潰診斷與修復紀錄 (iOS Safari Client-Side Exception Fix)

## 1. 問題描述 (Issue)

用戶反映，在 iOS 裝置的 Safari 瀏覽器上載入部署網址 `studio-2399006184-77f24.web.app` 時，會出現 Next.js 致命的白畫面與錯誤訊息：
`Application error: a client-side exception has occurred while loading studio-2399006184-77f24.web.app (see the browser console for more information).`

因為此錯誤是全域客戶端異常 (Client-Side Exception)，會導致整站 JavaScript 執行中斷而無法載入。

## 2. 根本原因 (Root Cause)

經過深入代碼分析與平台特性診斷，發現了以下 3 個潛在的 iOS Safari 致命相容性成因：

1. **Firestore 多分頁持久化快取 (IndexedDB / tabManager) 於 iOS 隱私模式崩潰 (主因)**：
   * 在 `src/firebase/index.ts` 中，使用 Firebase v10 新 API 啟用本地快取：`persistentLocalCache({ tabManager: persistentMultipleTabManager() })`。
   * iOS Safari 或者是內置 WebView 的「無痕隱私瀏覽模式」下，對於 IndexedDB 的讀寫、Web Locks API 以及 BroadcastChannel 有極為嚴格的沙盒限制（Web Locks/BroadcastChannel 在舊版 iOS 中也存在許多漏洞）。當 Firebase 試圖在多標籤管理器中進行跨頁面 Lock 或通訊時，會拋出無法被 Next.js / React 生命週期捕獲的 `SecurityError` 或 Unhandled Rejection，直接造成客戶端初始化崩潰。
2. **日期字串解析在 iOS JavaScript Core 返回 `NaN` 造成排序崩潰**：
   * iOS Safari 的 JS 引擎 (JSC) 對於非標準 ISO 8601 的日期字串解析（如帶有連字號 `-` 的日期，例如 `2026-03-04 12:00:00`）會返回 `Invalid Date`（而 Chrome/Firefox 可以寬鬆解析）。
   * 專案內 `balance-tracker.tsx` 等元件在排序交易時使用 `new Date(a.date).getTime()`。若是傳入帶連字號的字串，此運算會返回 `NaN`。當 `sort` 函數的返回值包含 `NaN`，會導致 JavaScript Core 引擎出錯，進而使 React 渲染圖表或專款明細列表時引發嚴重的 Runtime Exception。

## 3. 修復過程 (Fix Details)

我們實作了雙管齊下的「全域監聽」與「相容性防呆」方案：

### A. 實作全域錯誤捕獲面板 (Log Points on UI)
* **新增元件** [GlobalErrorReporter.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/components/GlobalErrorReporter.tsx)：在客戶端最早期透過 `window.addEventListener('error')` 與 `unhandledrejection` 攔截所有未捕獲錯誤。若在 iOS 上不幸再次崩潰，頁面頂部會跳出半透明紅色磨砂玻璃面板，列出 Stack Trace 與報錯資訊，使用戶無須連接電腦即可截圖回報。
* **修改** [layout.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/app/layout.tsx)：於 Root Layout 的最外層注入該診斷元件，確保在最早期開始監聽。

### B. 重構 Firebase 實體化邏輯 (防止 IndexedDB 崩潰)
* **修改** [index.ts](file:///d:/MyProjects/FinanceFlow/studio/src/firebase/index.ts)：
  * 引入 `isIndexedDBSupported()` 檢測 IndexedDB 是否可用。
  * 引入 `isIOS()` 檢測是否為 iOS 裝置。
  * **防呆措施**：對於 iOS 裝置，自動降級為單標籤持久化快取 `persistentLocalCache()`（不傳入 `tabManager`），避開 BroadcastChannel 與 Web Locks 的 WebKit Bug；若 IndexedDB 被禁用，則優雅降級為記憶體快取。

### C. 防呆日期排序邏輯 (防止 NaN 崩潰)
* **修改** [balance-tracker.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/components/finance-flow/balance-tracker.tsx) 與 [results-display.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/components/finance-flow/results-display.tsx)：
  * 撰寫 `parseDateToTime` 函數，在進行 `getTime()` 解析前，將日期字串中的連字號 `-` 統一替換為 iOS Safari 100% 支援的斜線 `/`（例如 `2026/03/04`）。
  * 進行 `isNaN` 檢查，如果解析失敗則回歸 `0`，保證排序回傳值必為 valid number。

## 4. 驗證方式 (Verification)

1. **編譯成功**：本地執行 `npm run build` 通過，未引入任何靜態生成或語法錯誤。
2. **部署驗證**：推送至 GitHub / Firebase 部署上雲端後，以 iOS 裝置載入，確認全站正常運作無 client-side 報錯。
