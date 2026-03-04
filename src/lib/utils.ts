import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 安全時間格式化：防止 Firebase Timestamp 物件直接渲染導致 React 崩潰
 * 同時處理 ISO 字串並轉換為本地時間格式 (台北時間)
 */
export function formatSafeDate(val: any): string {
  if (!val) return '---';

  // 處理 ISO 8601 格式字串
  if (typeof val === 'string') {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      }
    } catch { return val; }
    return val;
  }

  // 處理 Firestore Timestamp 物件 (.toDate())
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-');
    } catch { return '---' }
  }

  // 處理包含 seconds 的物件 (API 回傳的 Firestore 資料)
  if (typeof val?.seconds === 'number') {
    try {
      return new Date(val.seconds * 1000).toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-');
    } catch { return '---' }
  }

  // 處理內建 Date 物件
  if (val instanceof Date) {
    return val.toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-');
  }

  return '---';
}
