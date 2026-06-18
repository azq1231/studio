'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy, X, Terminal } from 'lucide-react';

interface ErrorDetail {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type: 'JS_ERROR' | 'UNHANDLED_REJECTION';
}

export function GlobalErrorReporter() {
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. 監聽全域同步/非同步 JS 錯誤
    const handleJsError = (event: ErrorEvent) => {
      // 避免重複處理 React 已知捕捉的錯誤 (如果有 ErrorBoundary 的話)
      // 但我們依然想捕獲致命的 client-side exception
      setError({
        message: event.message || '未知 JavaScript 錯誤',
        source: event.filename || '未知來源',
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || '無 Stack Trace 資訊',
        type: 'JS_ERROR',
      });
    };

    // 2. 監聽 Unhandled Promise Rejections (常見於 Firebase 非同步操作)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let message = '未處理的 Promise 拒絕';
      let stack = '無 Stack Trace 資訊';

      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack || stack;
      } else if (typeof reason === 'string') {
        message = reason;
      } else if (reason) {
        try {
          message = JSON.stringify(reason);
        } catch {
          message = String(reason);
        }
      }

      // Ignore common Firebase permission errors during auth transitions
      if (message.includes('Missing or insufficient permissions') || message.includes('permission_denied')) {
        console.warn('[GlobalErrorReporter] Ignored expected Firebase permission error:', message);
        return;
      }

      setError({
        message,
        stack,
        type: 'UNHANDLED_REJECTION',
      });
    };

    window.addEventListener('error', handleJsError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleJsError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleCopy = async () => {
    if (!error) return;
    const textToCopy = `[${error.type}]
Message: ${error.message}
Source: ${error.source || 'N/A'} (Line: ${error.lineno || 'N/A'}, Col: ${error.colno || 'N/A'})
Stack: ${error.stack || 'N/A'}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('無法複製錯誤訊息:', err);
    }
  };

  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] p-4 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-950/95 text-rose-100 shadow-2xl backdrop-blur-md">
        {/* 頂部標題列 */}
        <div className="flex items-center justify-between border-b border-rose-500/20 bg-rose-900/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
            <span className="font-bold text-sm tracking-wider uppercase">
              診斷面板：偵測到客戶端異常 (${error.type})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition-all active:scale-95 border border-rose-500/20"
            >
              <Copy className="h-3 w-3" />
              {copied ? '已複製！' : '複製錯誤資訊'}
            </button>
            <button
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/20 transition-all"
              aria-label="關閉診斷面板"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 錯誤主體 */}
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Terminal className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <h4 className="text-sm font-bold text-white break-words">{error.message}</h4>
              {error.source && (
                <p className="text-xs text-rose-300/80 font-mono break-all">
                  來源: {error.source}:{error.lineno}:{error.colno}
                </p>
              )}
            </div>
          </div>

          {/* Stack Trace 區塊 */}
          {error.stack && (
            <div className="rounded-lg bg-black/40 border border-black/20 p-3 max-h-60 overflow-y-auto">
              <pre className="text-[10px] font-mono leading-relaxed text-rose-300/90 whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
