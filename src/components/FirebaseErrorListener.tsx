'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

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
 * For critical user-data paths, it shows a destructive toast to notify the user.
 * For unauthenticated transitions or non-critical paths, it silences or warns without crashing.
 */
export function FirebaseErrorListener() {
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // 1. 尚未登入或正在登出的權限錯誤 -> 預期行為，靜默即可
      if (!user) {
        console.log('[FirebaseErrorListener] 尚未登入或正在登出，跳過資料載入:', error.message);
        return;
      }

      // 2. 非關鍵路徑：只記錄警告，不崩潰
      if (isNonCriticalPath(error.message)) {
        console.warn('[FirebaseErrorListener] 非關鍵路徑權限錯誤（已靜默處理）:', error.message);
        return;
      }

      // 3. 已登入但仍發生權限錯誤 -> 真正的權限不足問題
      console.error('[FirebaseErrorListener] 已登入但權限不足，請檢查 Security Rules:', error.message);
      
      toast({
        variant: "destructive",
        title: "存取權限不足",
        description: "您目前的帳戶無權存取該筆資料，請重新登入或聯絡系統管理員。",
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [user, toast]);

  return null;
}
