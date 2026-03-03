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

export function getSdks(firebaseApp: FirebaseApp) {
  // Initialize Firestore with persistent cache (new API for Firebase v10+)
  if (!firestoreInstance) {
    try {
      firestoreInstance = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch (e) {
      // Firestore might already be initialized (e.g., during hot reload)
      firestoreInstance = getFirestore(firebaseApp);
    }
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: firestoreInstance
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
