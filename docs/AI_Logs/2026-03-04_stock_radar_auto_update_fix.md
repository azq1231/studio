# 🩺 Bug Fix: 股市雷達雲端自動更新失敗

**日期**: 2026-03-04
**模組**: 股市雷達 (Stock Radar) — GitHub Actions 自動同步

---

## 問題描述 (Issue)

雲端部署的股市雷達無法自動更新。前端透過 Firestore `onSnapshot` 訂閱 `marketRecords/tsmc`、`marketRecords/portfolio`、`marketRecords/tw50` 三個文件，但資料始終停留在舊值。

---

## 根本原因 (Root Cause)

**3 個致命的後端配置錯誤同時存在**，導致 GitHub Actions 的自動同步完全失效：

### 原因 A：所有 Python 腳本寫死 Windows 絕對路徑

`update_full_risk.py`、`update_portfolio.py`、`scan_tw50_opportunities.py`、`cloud_sync.py` 四個腳本的輸出/讀取路徑全部寫死為 Windows 格式：

```python
# ❌ 錯誤：GitHub Actions 運行在 Ubuntu Linux，此路徑不存在
with open('d:/MyProjects/FinanceFlow/studio/public/data/tsmc_risk.json', 'w') as f:
```

**結果**：GitHub Actions 上所有腳本靜默失敗（FileNotFoundError），JSON 檔案無法產生。

### 原因 B：`cloud_sync.py` Firebase 初始化邏輯缺失

```python
# ❌ 錯誤：無憑證初始化，在 GitHub Actions 上會直接失敗
firebase_admin.initialize_app()  # 沒有讀取 FIREBASE_SERVICE_ACCOUNT 環境變數
```

即使 JSON 檔案順利產生，Firestore 寫入也會因為找不到憑證而失敗。

### 原因 C：兩個工作流程重複且互相矛盾

- `market-sync.yml`：涵蓋完整但全部壞掉
- `market-monitor.yml`：只更新 TSMC 一項，且引用的 `fetch_risk_data.py` 是獨立版本，沒有包含 Portfolio 和 TW50

---

## 修復過程 (Fix Details)

### 1. 統一路徑解析為相對路徑

所有四個腳本改為：

```python
# ✅ 正確：使用相對路徑，同時適用 Windows 和 Linux
current_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(current_dir, '..', 'public', 'data', 'tsmc_risk.json')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
```

### 2. 修復 `cloud_sync.py` Firebase 初始化

```python
# ✅ 正確：優先讀取環境變數
service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
if service_account_json:
    key_dict = json.loads(service_account_json)
    cred = credentials.Certificate(key_dict)
    firebase_admin.initialize_app(cred)
```

### 3. 合併工作流程

- 刪除冗餘的 `market-monitor.yml`
- `market-sync.yml` 統一涵蓋：TSMC 風險 + Portfolio 持倉 + TW50 掃描 + Firestore 雲端同步

### 4. 額外修復：`update_full_risk.py` 裡的動態風險分數

`studio/scripts/update_full_risk.py` 舊版本寫死了 `risk_score: 80` 和固定的 alerts 字串，已還原為動態計算版本。

---

## 修改檔案清單

| 檔案 | 操作 |
|---|---|
| `studio/scripts/update_full_risk.py` | 修改：路徑 + 還原動態風險分數 |
| `studio/scripts/update_portfolio.py` | 修改：路徑 |
| `studio/scripts/scan_tw50_opportunities.py` | 修改：路徑 |
| `studio/scripts/cloud_sync.py` | 重寫：路徑 + Firebase 初始化邏輯 |
| `studio/.github/workflows/market-sync.yml` | 重寫：合併完整流程 |
| `studio/.github/workflows/market-monitor.yml` | 刪除（已合併進 market-sync.yml） |

---

## 驗證方式 (Verification)

1. 使用 `diagnosis_path_check.py` 腳本驗證所有 7 項檢查全部通過：
   - ✅ 路徑計算正確指向 `public/data/`
   - ✅ 四個腳本無任何 Windows 硬編碼路徑
   - ✅ `cloud_sync.py` 正確讀取 `FIREBASE_SERVICE_ACCOUNT` 環境變數
   - ✅ 唯一的 workflow `market-sync.yml` 配置正常

2. 部署後需在 GitHub Actions 手動觸發 `Market Data Sync (Stock Radar)` 工作流程進行端對端驗證。
