"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, Clock, ShieldCheck } from "lucide-react";

export default function GlobalStrategyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 導向至首頁，並提示用戶股市雷達已整合
    const timer = setTimeout(() => {
      router.replace("/");
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#08080a] text-slate-200 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-8 rounded-3xl text-center space-y-6 shadow-2xl">
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
          <Target className="w-10 h-10 text-cyan-400 animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white tracking-tight">股市戰略總覽已升級整合</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            為提升系統一體性，此戰略儀表板已移至「系統首頁」的「股市雷達 ➔ 戰略總覽」分頁下。
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-950/40 py-2.5 px-4 rounded-xl border border-slate-900">
          <Clock className="w-4 h-4 text-cyan-500 animate-spin" />
          <span>正在自動為您導向至系統首頁...</span>
        </div>

        <button
          onClick={() => router.replace("/")}
          className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/10"
        >
          立即前往系統首頁
        </button>
      </div>
    </div>
  );
}
