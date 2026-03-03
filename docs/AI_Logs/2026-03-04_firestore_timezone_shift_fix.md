# Firestore 時區偏移 (Future Time) 修復紀錄

**Date**: 2026-03-04
**Module**: 雲端同步腳本 `cloud_sync.py` / Firebase SDK

## 1. 症狀 (Symptom)

在「機會掃描」與「持倉實戰」的分頁上，更新時間顯示為「未來的時間」。例如，現在是本地時間凌晨 03:40，系統卻標示更新時間為 `2026/3/4 上午11:40:17`，整整比現在快了 8 個小時。

## 2. 根本原因 (Root Cause)

Python 腳本在寫入 Timestamp 進入 Firestore 時，使用的是普通的本地時間 `datetime.now()`。

```python
# 這是沒有時區資訊 (Naive) 的時間物件
data['last_updated'] = datetime.now() 
```

當 `firebase_admin` (Python SDK) 收到這個「無時區標示」的 Naive Datetime 時，它**預設以 UTC 時區儲存**。
所以當本地端在 `03:40 (GMT+8)` 送出訊號時，Firestore 直接將 `03:40` 當成了 UTC 時間儲存。(此時實際的純 UTC 時間應該是前一天的 19:40)。
隨後，React 前端瀏覽器讀取到這個 Timestamp (`03:40 UTC`) 後，又根據使用者的台灣時區自動加上了 8 小時 (`+08:00`)，結果導致畫面顯示為 `11:40`，造成了「時間穿越」8個小時的 Bug。

## 3. 修復方案 (Solution)

在 Python 同步腳本中，強制將傳入 Firestore 的時間物件加上明確的 `timezone.utc`：

```python
from datetime import datetime, timezone

# 這樣就能建立帶有明確 UTC 時區意識的物件
data['last_updated'] = datetime.now(timezone.utc)
```

修改後，Firestore 就能確實接收到正確的國際標準時間，而前端瀏覽器在加上 8 小時的本地時區換算後，就會完美對齊使用者的現在時間。

## 4. 驗證 (Verification)

- 已重新執行 Python `cloud_sync.py` 將帶有明確 UTC 時區的 Timestamp 覆寫進 Firestore。
- 本 AI 已透過自動瀏覽器 `Browser Subagent` 點擊測試，確認 UI 渲染回正確的當前時間，停止發生未來時間偏移的問題。
