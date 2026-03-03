# fetchSafe 讀取 HTML Fallback 導致 SyntaxError 修復紀錄

**Date**: 2026-03-04
**Module**: `finance-flow-client.tsx` / `fetchSafe`

## 1. 症狀 (Symptom)

在瀏覽器開發者工具的 Console 中，出現這類紅字解析錯誤，儘管網頁功能看起來正常（或是掉回去使用本地陣列），但紅字大量洗版：
`Portfolio fetch failed: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
`TW50 fetch failed: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

## 2. 根本原因 (Root Cause)

在 `firebase.json` 的配置中：

```json
    "headers": [
      {
        "source": "/data/**",
        "headers": [
          { "key": "Content-Type", "value": "application/json" }
        ]
      }
    ]
```

當 `fetch("/data/portfolio_live.json")` 發送時，若該檔案不在 Firebase Hosting 伺服器上，Firebase 的 SPA 重寫規則會攔截 404，改成吐出 `index.html` 的內容。
**致命的是**，既然 URL 匹配了 `/data/**`，Firebase 會直接把 `Content-Type: application/json` 這個 Header 強塞進這個（本體其實是 HTML 的）回應中。
所以原先的 `fetchSafe` 防線 `if (!contentType.includes("application/json"))` 被 Firebase 騙過了，直接放行去執行 `await res.json()`，然後 JSON 解析器遇到 HTML 開頭的第一個字元 `<` (即 `<!DOCTYPE`)，便理所當然地拋出了 `SyntaxError` 崩潰，加上 `console.warn` 被印在 Console。

## 3. 修復辦法 (Fix Procedures)

重構 `fetchSafe`，改為手動使用 `res.text()` 並攔截：

```tsx
const text = await res.text();
// 攔截 Firebase 偽裝成 JSON 的 HTML
if (text.trim().startsWith('<')) {
  if (label === 'TW50') setter(TW50_FALLBACK);
  return; // 靜默返回，不噴出嚇人的錯誤
}
const json = JSON.parse(text);
```

這同時防止了解析崩潰，把 `console.warn` 拿掉，確保了「主控台無紅字政策」的落實。

## 4. 驗證 (Verification)

- 已部署至 Production。
- 使用 AI Browser Subagent 切出 Console Logs，確認紅字報錯已消失，程式會「安靜且優雅地」降級切換資料。
