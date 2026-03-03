'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 非關鍵路徑清單：這些路徑的權限錯誤不應導致整個應用程式崩潰。
 * 改為靜默記錄警告，讓 UI 優雅降級（使用本地 fallback 資料）。
 */
const NON_CRITICAL_PATH_PREFIXES = [
  'marketRecords',
  'marketSync',
  'stockPositions',
];

function isNonCriticalPath(errorMessage: string): boolean {
  return NON_CRITICAL_PATH_PREFIXES.some(prefix => errorMessage.includes(prefix));
}

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * For critical user-data paths, it throws the error to be caught by Next.js error boundary.
 * For non-critical paths (market data, stock radar), it logs a warning and degrades gracefully.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // 非關鍵路徑：只記錄警告，不崩潰
      if (isNonCriticalPath(error.message)) {
        console.warn('[FirebaseErrorListener] 非關鍵路徑權限錯誤（已靜默處理）:', error.message);
        return;
      }
      // 關鍵路徑（用戶交易、設定）：觸發全局錯誤
      setError(error);
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }

  return null;
}
