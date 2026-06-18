'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from 'firebase/firestore'

// Track if persistence has been initialized
let firestoreInstance: Firestore | null = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  const apps = getApps();
  if (apps.length > 0) {
    return getSdks(apps[0]);
  }

  let firebaseApp: FirebaseApp;

  try {
    // 優先使用明確定義的配置文件 (適用於標準 Hosting)
    if (firebaseConfig && firebaseConfig.apiKey) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      // 僅在無配置時嘗試自動初始化 (適用於 Firebase App Hosting)
      firebaseApp = initializeApp();
    }
  } catch (e) {
    // 最後的防線：嘗試自動初始化
    try {
      firebaseApp = initializeApp();
    } catch (innerE) {
      console.error("Firebase 初始化失敗，請檢查配置:", innerE);
      throw innerE;
    }
  }

  return getSdks(firebaseApp);
}

function isIndexedDBSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}

function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getSdks(firebaseApp: FirebaseApp) {
  if (!firestoreInstance) {
    let initialized = false;

    // 只在瀏覽器環境且 IndexedDB 可用時嘗試開啟本地持久化快取
    if (isIndexedDBSupported()) {
      try {
        // iOS Safari 的多標籤管理器 (persistentMultipleTabManager) 依賴 Web Locks API 與 BroadcastChannel，
        // 在舊版 iOS 或隱私無痕模式下極易拋出 SecurityError 崩潰。
        // 對於 iOS 裝置，我們安全降級為「單分頁快取」(不傳 tabManager)，其餘平台保留多分頁快取。
        const cacheConfig = isIOS()
          ? persistentLocalCache()
          : persistentLocalCache({ tabManager: persistentMultipleTabManager() });

        firestoreInstance = initializeFirestore(firebaseApp, {
          localCache: cacheConfig
        });
        initialized = true;
      } catch (e) {
        console.warn("[Firebase] 初始化持久化快取失敗，降級為記憶體快取模式:", e);
      }
    }

    if (!initialized) {
      try {
        firestoreInstance = getFirestore(firebaseApp);
      } catch (e) {
        console.error("[Firebase] 取得 Firestore 實例失敗:", e);
        throw e;
      }
    }
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: firestoreInstance!
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
