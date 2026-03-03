# 開發活動紀錄規範 (Development Activity Logging Guidelines)

## 核心準則

1. **所有**的功能新增 (Feature)、變更 (Change) 以及錯誤修復 (Fix)，均**必須**詳實記錄於 `docs/` 目錄下的日誌檔案中（如 `ISSUE_LOG.md` 包含修復，`CHANGELOG.md` 包含功能新增，或統一記錄於 `ACTIVITY_LOG.md`）。
2. AI 在完成任何開發任務（不論是修補 Bug 或是實作新功能）後，最後一個步驟必須是將該次成果寫入對應的日誌檔案。
3. 在進行程式碼提交 (Commit) 或部署 (Deploy) 前，必須確保活動紀錄已經更新，以利後續的維護與知識傳承。

## 記錄格式規範

每一筆記錄必須包含：

- **日期 (Date)**：開發完成的日期
- **類別 (Type)**：【錯誤修復】、【功能新增】或【系統變更】
- **內容描述 (Description)**：詳細說明新增的功能或修復的問題
- **技術細節/根因分析 (Technical Details/Root Cause)**：相關的技術細節或導致問題的原因
- **解決方案/實作方式 (Resolution/Implementation)**：具體的解決方案或開發實作方式
- **受影響檔案 (Affected Files)**：本次任務涉及的檔案路徑
