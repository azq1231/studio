# 2026-06-11 Firebase 認證時序權限錯誤與全域錯誤防護網優化紀錄 (Firebase Auth State Permission Denied & Error Boundary Fix)

## 1. 問題描述 (Issue)

在未登入或點擊登出的瞬間，網頁控制台會拋出 `FirebaseError: Missing or insufficient permissions` 的權限錯誤。
先前臨時修復中將 `FirebaseErrorListener.tsx` 中的 `throw error` 拿掉以「停止流血」，但導致了兩個新隱憂：
1. **靜默忽略錯誤**：在正式環境中，如果是真正的權限設定錯誤（如已登入但規則不符），系統將完全無法察覺。
2. **缺少全域防護網**：若發生其他非預期的 client-side 嚴重例外，Next.js App Router 缺乏 `error.tsx` 客戶端錯誤邊界，會直接導致 iOS 或桌面端瀏覽器顯示白屏的 `Application error: a client-side exception has occurred`。
3. **訪客訪問股市雷達崩潰**：訪客以未登入狀態進入「股市雷達 -> Alpha 實驗室」時，會因為 `/alphaSignals/latest` 缺少 rules 定義而觸發權限錯誤。

---

## 2. 根本原因 (Root Cause)

1. **`alphaSignals` 缺少安全規則 (Security Rules)**：
   「股市雷達」是公開功能，未登入的訪客也可以訪問。然而，[firestore.rules](file:///d:/MyProjects/FinanceFlow/studio/firestore.rules) 內並無針對 `alphaSignals` 集合的規則，因此 Firestore 預設拒絕了所有對 `/alphaSignals/latest` 的訂閱，引發 `permission-denied`。
2. **認證狀態時序競態 (Auth State Race Condition)**：
   當使用者執行登出時，Firebase Client SDK 會立即登出並清除憑證。此時，活躍中的 Firestore `onSnapshot` 訂閱會因為憑證失效，在 React 完成 state 清理與 unsubscribe 之前，搶先收到伺服器的 `permission-denied` 錯誤。因為此時 `!auth.currentUser`，這是正常登出時的時序現象，應當被視為預期行為並靜默處理。
3. **缺乏 App-Router Error Boundary**：
   Next.js 需要在 Layout 層級下提供 `src/app/error.tsx` 來捕獲並優雅呈現 client-side 異常，否則未捕獲的 exception 會導致整站中斷渲染。

---

## 3. 修復過程 (Fix Details)

我們實作了「治本補齊規則」、「細分錯誤處理」與「錯誤防護網」之結構性修復：

### A. 補齊 Firestore 安全規則
* **修改** [firestore.rules](file:///d:/MyProjects/FinanceFlow/studio/firestore.rules)：
  在檔案中加入 `alphaSignals` 集合的讀寫規則。對齊 `marketRecords`，允許公開唯讀：
  ```javascript
  match /alphaSignals/{docId} {
    allow get, list: if true;
    allow write: if isSignedIn();
  }
  ```

### B. 重構 `FirebaseErrorListener.tsx` (細分錯誤類型)
* **修改** [FirebaseErrorListener.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/components/FirebaseErrorListener.tsx)：
  * 引入 `useUser` 監聽當前使用者狀態，引入 `useToast` 呈現友善提示。
  * 精確劃分錯誤類型：
    * **狀況 A（未登入/登出瞬間）**：若 `!user` 且錯誤為 `permission-denied`，視為時序正常現象，進行靜默處理 (`console.log`)，不拋出錯誤。
    * **狀況 B（非關鍵路徑）**：如 `marketRecords` 等，記錄警告 (`console.warn`)，UI 優雅降級使用本地 Fallback 資料。
    * **狀況 C（已登入但權限不足）**：當 `user` 存在但真的發生權限不足（例如非法讀取他人資料），利用 `toast` 提示「存取權限不足」，但不引發強制白屏。

### C. 建立全域錯誤邊界 `error.tsx`
* **新增** [error.tsx](file:///d:/MyProjects/FinanceFlow/studio/src/app/error.tsx)：
  * 實作 Next.js App Router 規定的 `error.tsx` client boundary。
  * 當有未捕獲的嚴重 Exception 時，呈現精心設計的深色質感 UI（HSL 配色、光暈特效與磨砂玻璃卡片），提供「嘗試重試」及「返回首頁」功能，確保應用的 Rich Aesthetics。

---

## 4. 驗證方式 (Verification)

1. **編譯驗證**：本地執行 `npm run build` 通過，無語法或打包錯誤。
2. **訪客模式測試**：清除 Cookie / 使用無痕模式，以未登入狀態進入「股市雷達」，「Alpha 實驗室」能正常渲染且控制台無任何 `permission-denied` 錯誤。
3. **登出/登入測試**：登入帳戶後進行操作，隨後點擊登出，控制台僅輸出預期的 `[FirebaseErrorListener] 尚未登入或正在登出，跳過資料載入...` 靜默日誌，UI 運作流暢無崩潰。
