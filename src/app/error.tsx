'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 可以在這裡將錯誤回報給日誌監控服務
    console.error('[GlobalErrorBoundary] 捕捉到未處理的客戶端崩潰:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 font-sans antialiased text-slate-100">
      {/* 裝飾性背景霓虹光暈 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative max-w-lg w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 md:p-10 shadow-2xl text-center space-y-8">
        {/* 頂部發光警告 Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-inner shadow-rose-500/5">
          <AlertTriangle className="w-10 h-10 text-rose-500 animate-pulse" />
        </div>

        {/* 標題與描述 */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            應用程式發生預期外錯誤
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            系統在運行時發生了非預期的客戶端異常。我們已經記錄此問題，您可以嘗試重試或返回首頁。
          </p>
        </div>

        {/* 錯誤細節 (折疊區) */}
        {error && (
          <div className="text-left space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">
              錯誤診斷代碼 (Diagnostic Info)
            </span>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 max-h-40 overflow-y-auto shadow-inner">
              <pre className="text-xs font-mono leading-relaxed text-rose-400 break-all whitespace-pre-wrap">
                {error.name || 'Error'}: {error.message || '未知錯誤'}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </div>
          </div>
        )}

        {/* 動作按鈕 */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Button
            onClick={() => reset()}
            className="rounded-2xl py-6 font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/20 transition-all active:scale-95 flex items-center justify-center gap-2 border-0"
          >
            <RotateCcw className="w-4 h-4" />
            嘗試重試
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="rounded-2xl py-6 font-bold border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            返回首頁
          </Button>
        </div>
      </div>
    </div>
  );
}
