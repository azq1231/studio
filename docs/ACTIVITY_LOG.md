# 開發活動紀錄 (Activity Log)

此文件用於集中記錄本專案的所有功能新增 (Features)、系統變更 (Changes) 以及錯誤修復 (Fixes)。所有變動均應依照規定記錄於此，以便未來維護與查詢。

---

## [2026-03-03] 解決 Git 合併衝突與編譯失敗 (Merge Conflict Resolution)

### 問題描述 (Symptom)

執行 `npm run build` 時因存在 Git 合併衝突標記 (`<<<<<<<`, `=======`, `>>>>>>>`) 導致語法錯誤而失敗。受影響檔案包括 `finance-flow-client.tsx`、`balance-tracker.tsx`、`results-display.tsx` 以及 `package.json`。

### 根因分析 (Root Cause)

之前的 Git 操作（Stash pop 或 Merge）產生了衝突，但未被及時手動清理，導致編譯器無法解析這些非標準的代碼標記。

### 修復方式 (Resolution)

1. 手動清理所有受影響檔案中的衝突標記，並根據邏輯保留正確的代碼分支。
2. 針對 `package.json`，保留了 `node scripts/build.js` 作為編譯進入點以規避 IDE 環境變數干擾。
3. 修復後執行 `npm run build` 已確認通過 (Exit code 0)。

### 受影響檔案 (Affected Files)

- `studio/src/components/finance-flow-client.tsx`
- `studio/src/components/finance-flow/balance-tracker.tsx`
- `studio/src/components/finance-flow/results-display.tsx`
- `studio/package.json`

---

## [2026-03-03] Firebase Hosting JSON 解析錯誤 (SyntaxError: Unexpected token '<')

### 問題描述 (Symptom)

在雲端環境中，客戶端在請求靜態檔案（如 `portfolio_live.json` 或 `tw50_full_scan.json`）時，無法被正確解析為 JSON，導致 Console 出現 `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`的錯誤。該 API 路徑甚至被 Cloud Server 退回了 HTML（`index.html`）。

### 根因分析 (Root Cause)

`firebase.json` 的 `hosting` 區塊中錯誤配置了 `"trailingSlash": true`。
這使 Firebase Hosting 在接收 `/data/portfolio_live.json` 請求時，自動導向結尾帶斜線的路徑 `/data/portfolio_live.json/`。由於該斜線路徑對應不到真實資料夾結構，自動觸發了 Catch-all 改寫機制（SPA 的 `**` -> `/index.html`）。

### 修復方式 (Resolution)

1. 在 `studio/firebase.json` 移除 `"trailingSlash": true` 的錯誤配置。
2. 針對靜態目錄 `/data/**` 增加專屬的 `headers` 區段，強制回應時帶上 `"Content-Type": "application/json"` 與 `"Cache-Control": "public, max-age=300"`，避免瀏覽器端產生編碼問題。

### 受影響檔案 (Affected Files)

- `studio/firebase.json`

---

## [2026-03-03] UI 排版重疊與股市雷達同步按鈕未顯示

### 問題描述 (Symptom)

導航分頁（TabsList）在小螢幕時因為長度過長擠在一起發生重疊，按鈕不可見或難以點擊；此外，用戶要求能在網頁上手動單擊按鈕即時呼叫雲端更新市場數據。

### 根因分析 (Root Cause)

原本的 `<TabsList>` 使用了絕對的 grid 且過於限縮的寬高設定，不適用小螢幕響應。另外缺乏一個與雲端通訊的媒介。

### 修復方式 (Resolution)

1. 將 `<TabsList>` class 中固定列數的 grid 佈局重構為 `flex flex-wrap h-auto w-full justify-start p-1 bg-muted rounded-xl gap-1 mb-4`，實現了自動換行響應式佈局。
2. 在 `finance-flow-client.tsx` 實作 `handleManualSync` 邏輯，點擊時會推送狀態更新至 Firestore 的 `marketSync` -> `trigger` 文件，再搭配後台 Daemon 完成指令同步。

### 受影響檔案 (Affected Files)

- `studio/src/components/finance-flow-client.tsx`

---

## [2026-03-03] Next.js Build 崩潰：TypeError: Unexpected response from worker: undefined

### 問題描述 (Symptom)

執行 `npm run build` 時，Next.js 在「Creating an optimized production build」階段立即崩潰，顯示：

```text
uncaughtException TypeError: Unexpected response from worker: undefined
    at ChildProcessWorker._onMessage (jest-worker/index.js:1:12438)
```

無論修改 `next.config.mjs`（關閉 SWC、禁用 workerThreads、限制 cpus、關閉 webpackBuildWorker、關閉 minimize）、升降 Next.js 版本（14.1.4 / 14.2.15 / 14.2.35）、重裝 node_modules，甚至退回歷史 commit，問題完全不受影響，持續出現。

### 根因分析 (Root Cause)

**環境變數 `WATCH_REPORT_DEPENDENCIES=1`** 是罪魁禍首。

此環境變數由 Antigravity (VS Code) IDE 自動設定，用於 Node.js 的 `--watch` 模式追蹤依賴變化。當此變數存在時，Node.js 20.19.0 會在**所有** `child_process.fork()` 建立的子進程中自動注入 `{watch:require:[...]}` 格式的 IPC 訊息。

Next.js 的 build 流程使用 `jest-worker` 的 `ChildProcessWorker` 來管理子進程。`jest-worker` 期望收到的 IPC 訊息是 `[type, payload, ...]` 陣列格式（其中 `type` 是 `PARENT_MESSAGE_OK`、`PARENT_MESSAGE_CLIENT_ERROR` 等常數）。但因為 `WATCH_REPORT_DEPENDENCIES` 的干擾，子進程發送了 `{watch:require:[...]}` 這個**物件**作為第一個訊息。在 `_onMessage` handler 中，`e[0]`（物件的第一個索引）為 `undefined`，觸發了 `default` case 中的 `throw new TypeError("Unexpected response from worker: " + e[0])`。

### 診斷過程

1. 硬體/記憶體排除：32GB RAM、16 核 CPU，資源充足
2. Node.js fork/IPC 測試：獨立腳本通過，排除系統層面問題
3. 環境變數排除：`NODE_DEBUG=child_process` 完整 dump 啟動環境，發現 `WATCH_REPORT_DEPENDENCIES=1`
4. processChild.js 直接 fork 測試：確認收到 `{watch:require:[...]}` 格式的非預期 IPC 訊息
5. 對比測試：移除 `WATCH_REPORT_DEPENDENCIES` 後 build 立即成功

### 修復方式 (Resolution)

1. 建立 `scripts/build.js` wrapper 腳本，在執行 `next build` 前使用 `delete process.env.WATCH_REPORT_DEPENDENCIES` 清除該環境變數
2. 修改 `package.json` 的 `build` script 為 `node scripts/build.js`
3. 恢復 `next.config.mjs` 為乾淨狀態，移除所有不必要的 workaround

### 受影響檔案 (Affected Files)

- `studio/scripts/build.js`（新增）
- `studio/package.json`
- `studio/next.config.mjs`

---

## [2026-03-03] 股市雷達手機端互動與登入崩潰修復 (Stock Radar Mobile & Auth Crash Fix)

### 問題描述 (Symptom)

1. **互動失效**：在 iPhone 上點擊「股市雷達」標籤後，警告區域會遮擋或攔截點擊事件，導致無法切換回其他標籤。
2. **延時崩潰**：用戶登入後進入股市雷達，畫面顯示約 1-2 秒後會消失，並出現 Next.js 的 「Application Error: a client-side exception has occurred」。
3. **UI 擁擠**：手機端導航與內容間距過大，導致核心數據被擠出首屏。

### 根因分析 (Root Cause)

1. **CSS 動畫衝突**：`slide-in-from-top` 進場動畫在 Mobile Safari 下會產生不可見的觸控攔截區域（Touch Interception），覆蓋了上方的標籤按鈕。
2. **權限缺失**：Firestore 安全規則漏掉了 `users/{uid}/settings` 與 `users/{uid}/stockPositions` 的讀取權限，導致登入後背景讀取失敗。
3. **錯誤傳播架構缺陷**：`FirebaseErrorListener` 原本會拋出 (throw) 所有 Firestore 權限錯誤。當非關鍵數據（如雷達顯示用的持倉）讀取失敗時，觸發全局崩潰而非優雅降解。

### 修復方式 (Resolution)

1. **UI 改進**：
    - 移除 `slide-in-from-top` 動畫，改用 `overflow-hidden` 裁切。
    - 將市場警告改為「可摺疊式 (Collapsible)」，預設收合以節省空間。
    - 垂直壓縮手機端間距（`mb-4` -> `mb-1.5`），優化螢幕利用率。
2. **Security Rules 補完**：
    - 開放 `marketRecords` 公開讀取權限。
    - 補齊 `users/{userId}/settings` 與 `users/{userId}/stockPositions` 的個人讀寫權限。
3. **韌性增強**：
    - 改寫 `FirebaseErrorListener`，將市場、持倉等非核心路徑的權限錯誤改為 `console.warn` 靜默處理，不中斷 React 渲染。
    - 為 `setDoc` 自動同步邏輯加上 `try-catch` 區塊。

### 受影響檔案 (Affected Files)

- `studio/src/components/finance-flow-client.tsx`
- `studio/src/components/FirebaseErrorListener.tsx`
- `FinanceFlow-114/firestore.rules`

---

## [2026-03-04] 台灣50 機會掃描雲端實時化 (TW50 Real-time Scan System)

### 問題描述 (Symptom)

原本的「機會掃描」功能僅讀取靜態 `tw50_full_scan.json`，導致用戶即便點擊「立即同步市場數據」，掃描結果也不會同步更新，無法依據即時新聞決定進出場。此外，由於 `docs/` 文件夾位於 Git 倉庫外，導致開發日誌未能正確提交。

### 根因分析 (Root Cause)

1. **數據串接缺失**：`finance-flow-client.tsx` 未實現對 `marketRecords/tw50` 的實時訂閱。
2. **分析文本靜態化**：判斷分析文字為前端寫死，不支援雲端推送。
3. **目錄結構不一致**：Git 倉庫根目錄位於 `studio/`，導致外部 `docs/` 被排除在版本控制之外。

### 修復方式 (Resolution)

1. **實裝雲端訂閱**：在 `FinanceFlowClient` 中引入 `tw50DocRef` 並通過 `useDoc` 進行實時監測，資料流現在支援 `Cloud -> Local Fallback`。
2. **遷移自動化**：增加自動同步邏輯，若雲端無數據則自動將本地初始掃描結果推播上雲（包含更新時間戳 `updatedAt`）。
3. **動態分析支持**：優化渲染引擎，若數據物件中包含 `analysis` 欄位，則優先顯示精準分析，否則套用預設邏輯。
4. **倉庫整合**：將專案根目錄下的 `.agent/` 與 `docs/` 移動至 `studio/` 子目錄內，解決了「還沒提交」的 Git 不同步問題。

### 受影響檔案 (Affected Files)

- `studio/src/components/finance-flow-client.tsx`
- `studio/docs/ACTIVITY_LOG.md` (已移動入庫)
- `studio/docs/待開發功能.md` (已移動入庫)
