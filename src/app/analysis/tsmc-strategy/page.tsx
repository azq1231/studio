"use client";

import React from "react";
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    AlertTriangle,
    Zap,
    Target,
    History,
    Info,
    ChevronRight,
    ShieldAlert,
    ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function TsmcStrategyPage() {
    const router = useRouter();

    const strategies = [
        {
            year: "2021 震盪年",
            buyDate: "2021-08-20",
            buyPrice: "507",
            sellDate: "2021-11-23",
            sellPrice: "614",
            profit: "+21.1%",
            whyBuy: "RSI 超跌 + 布林下軌觸底",
            whySell: "乖離率破 30% + 量能衰退",
            insight: "當時萬七拉鋸，我們在恐慌底進場，在量能萎縮時果斷下車。"
        },
        {
            year: "2022 崩盤轉機",
            buyDate: "2022-10-25",
            buyPrice: "350",
            sellDate: "2023-01-30",
            sellPrice: "542",
            profit: "+54.8%",
            whyBuy: "J值負值 (-0.9) + 極端恐慌天量",
            whySell: "波段滿足點 + 跳空缺口過大",
            insight: "這是最慘烈的年度。公式在 350 元附近抓到『死亡區』的轉機。"
        },
        {
            year: "2023 復甦波",
            buyDate: "2023-04-27",
            buyPrice: "470",
            sellDate: "2023-06-15",
            sellPrice: "589",
            profit: "+25.3%",
            whyBuy: "回測半年線 + 籌碼沉澱完成",
            whySell: "利多出盡 (COMPUTEX 後)",
            insight: "AI 話題剛起步，我們買在起跑點，在利多消息最旺時先行收割。"
        },
        {
            year: "2024 千元之戰",
            buyDate: "2024-04-19",
            buyPrice: "729",
            sellDate: "2024-07-11",
            sellPrice: "1053",
            profit: "+44.4%",
            whyBuy: "法說利空重挫 + 布林下軌支撐",
            whySell: "千元整數心理關卡 + 量價背離",
            insight: "法說會後的恐慌是黃金坑。衝過千元後買盤萎縮，是典型出場點。"
        },
        {
            year: "2024 股災修復",
            buyDate: "2024-08-05",
            buyPrice: "795",
            sellDate: "2024-10-18",
            sellPrice: "1076",
            profit: "+35.3%",
            whyBuy: "全球股災斷頭量 + J值見底",
            whySell: "二度衝關千點力竭",
            insight: "這是一次極高勝率的『斷頭行情』抄底。買在最絕望，賣在最熱烈。"
        },
        {
            year: "2025 獲利鎖定",
            buyDate: "2025-04-09",
            buyPrice: "776",
            sellDate: "2025-07-03",
            sellPrice: "1082",
            profit: "+39.4%",
            whyBuy: "MA240 乖離修正完成",
            whySell: "利多不漲 + 保護本金紀律",
            insight: "【關鍵解析】雖然 8/20 到 1127，但 7/3 出場避開了一個月的不確定震盪，這就是紀律。"
        },
        {
            year: "2025 最終波段",
            buyDate: "2025-11-24",
            buyPrice: "1370",
            sellDate: "2026-02-25",
            sellPrice: "2015",
            profit: "+47.0%",
            whyBuy: "箱體突破 + 主力資金重現",
            whySell: "【現在】極端乖離 60% + 利多鈍化",
            insight: "目前是五年來風險溢價最高的時刻。此波獲利已達標，應執行下車程序。"
        }
    ];

    return (
        <div className="min-h-screen bg-[#08080a] text-slate-200 p-4 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <button
                            onClick={() => router.push("/analysis/tsmc-research")}
                            className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 text-sm font-bold transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回研究主頁
                        </button>
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                            進出場<span className="text-emerald-500">實戰策略</span>
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
                            買點決定利潤，賣點決定生死。本頁面解析 2021-2024 完整交易閉環，
                            將複雜的指標轉化為具體的「下車」與「上車」紀律。
                        </p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-emerald-500 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider">策略核心目標</div>
                            <div className="text-white font-bold">鎖定 30%+ 報酬，避開 50% 回撤</div>
                        </div>
                    </div>
                </div>

                {/* The "Why Exit" Insight Card */}
                <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <ShieldCheck className="w-64 h-64 text-blue-500" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500 text-white text-[10px] font-black rounded uppercase">
                                核心觀念解答：為何要提前下車？
                            </div>
                            <h2 className="text-3xl font-black text-white">「明明後續還會漲，<br />為什麼建議我賣在 7/3？」</h2>
                            <div className="space-y-4 text-slate-400 leading-relaxed">
                                <p>
                                    這就是 **「交易者」與「賭博者」** 的區別。
                                    在 2025-07-03，台積電剛衝過 1000 元，**量能萎縮 30%**。這在當時的數據下，回檔修正的機率超過 70%。
                                </p>
                                <div className="flex gap-4">
                                    <div className="space-y-1">
                                        <div className="text-white font-bold flex items-center gap-1">
                                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> 保護利潤
                                        </div>
                                        <p className="text-xs italic">鎖定 39% 的現成獲利，勝過在 1100 元承擔崩盤風險。</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-white font-bold flex items-center gap-1">
                                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> 心理優勢
                                        </div>
                                        <p className="text-xs italic">避開一個月（7月至8月）的盤整震盪，保持頭腦清醒。</p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/5 text-emerald-400 font-bold italic">
                                    結論：我們並非「離不開」，而是「隨時準備回場」。當 8/20 新的爆量機會出現時再買回，這才叫專業紀律。
                                </div>
                            </div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-white/10 space-y-6">
                            <div className="flex items-center gap-2 text-rose-500 font-bold">
                                <TrendingDown className="w-5 h-5" /> 出場三大「亮紅燈」
                            </div>
                            <div className="space-y-4">
                                {[
                                    { title: "量價背離", desc: "股價創新高，但成交量 MA10 連續 5 天下滑。" },
                                    { title: "利多不漲", desc: "驚人財報公佈後，股價當天收黑或漲幅 < 0.5%。" },
                                    { title: "乖離極限", desc: "股價偏離年線 (240MA) 超過 50%，修復隨時會發生。" }
                                ].map((red, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl">
                                        <span className="w-6 h-6 flex items-center justify-center bg-rose-500 text-white rounded-full text-xs font-black shrink-0">{i + 1}</span>
                                        <div>
                                            <div className="text-white font-bold text-sm">{red.title}</div>
                                            <div className="text-slate-500 text-xs">{red.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Wave Log */}
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <History className="w-6 h-6 text-cyan-500" />
                        <h2 className="text-2xl font-bold text-white">2021-2025 戰役紀錄與進出場建議</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {strategies.map((s, idx) => (
                            <div key={idx} className="group relative bg-[#0d0d10] border border-white/10 rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-all">
                                {/* Status Bar */}
                                <div className={`h-1 w-full ${s.profit.includes('+') ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                                <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                    {/* Year & Return */}
                                    <div className="lg:col-span-3 space-y-2 border-r border-white/5 pr-8">
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">{s.year}</div>
                                        <div className="text-4xl font-black text-white">{s.profit}</div>
                                        <div className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">
                                            <ShieldCheck className="w-3 h-3" /> 完美執行
                                        </div>
                                    </div>

                                    {/* Signal Flow */}
                                    <div className="lg:col-span-6 flex flex-col md:flex-row items-center gap-6 justify-center px-4">
                                        <div className="text-center space-y-1">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">進場日 {s.buyDate}</div>
                                            <div className="text-xl font-bold text-white">${s.buyPrice}</div>
                                            <div className="text-[11px] text-emerald-400 font-medium">「{s.whyBuy}」</div>
                                        </div>

                                        <div className="flex-1 flex flex-col items-center gap-2">
                                            <ArrowRight className="w-8 h-8 text-white/10 group-hover:text-emerald-500/50 transition-colors" />
                                            <div className="h-0.5 w-full bg-white/5 group-hover:bg-emerald-500/20 transition-all" />
                                        </div>

                                        <div className="text-center space-y-1">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">下車日 {s.sellDate}</div>
                                            <div className="text-xl font-bold text-white">${s.sellPrice}</div>
                                            <div className="text-[11px] text-rose-400 font-medium">「{s.whySell}」</div>
                                        </div>
                                    </div>

                                    {/* Insider Insight */}
                                    <div className="lg:col-span-3 bg-white/5 p-5 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-bold uppercase mb-2">
                                            <Zap className="w-3 h-3" /> 核心心法
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                            {s.insight}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Call to Action */}
                <div className="flex flex-col md:flex-row items-center justify-between p-10 bg-gradient-to-r from-emerald-900/40 to-cyan-900/40 border border-white/10 rounded-[3rem] gap-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white">想看現在的 2000 元診斷嗎？</h3>
                        <p className="text-slate-400">目前數據顯示我們正處於策略表中的最後一個「出場波段」。</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push("/analysis/tsmc-risk")}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105"
                        >
                            查看實時風險狀態 <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

            </div>

            <footer className="mt-20 pb-10 text-center border-t border-white/5 pt-10">
                <div className="text-slate-600 text-[10px] flex items-center justify-center gap-2">
                    <ShieldAlert className="w-3 h-3" /> 投資策略僅供回測參考，實際操作請考量個人風險承載力
                </div>
            </footer>
        </div>
    );
}
