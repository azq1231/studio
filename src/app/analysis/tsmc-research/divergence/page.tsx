"use client";

import React from "react";
import {
    ArrowLeft,
    TrendingDown,
    TrendingUp,
    BarChart,
    Calendar,
    AlertCircle,
    Activity,
    ChevronRight,
    ShieldAlert
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DivergenceAnalysisPage() {
    const router = useRouter();

    const data = [
        {
            period: "2015 庫存修正",
            pPeak: "2015-02-25",
            price: "113.67",
            vPeak: "2015-01-27",
            lead: 29,
            decay: "-30.06%",
            insight: "典型的量價背離。買盤在過年後提前見頂，股價在量能萎縮 30% 後才開始修正。",
            risk: "高"
        },
        {
            period: "2022 萬八崩盤",
            pPeak: "2022-01-17",
            price: "633.21",
            vPeak: "2022-01-14",
            lead: 3,
            decay: "-1.71%",
            insight: "這是『利多不漲』的極致。法說會爆天量後第 3 天即見頂，隨後是長達一年的大跌。",
            risk: "極高"
        },
        {
            period: "2024 千元修正",
            pPeak: "2024-07-11",
            price: "1053.87",
            vPeak: "2024-06-25",
            lead: 16,
            decay: "-36.02%",
            insight: "買盤在 1000 元關卡前 16 天就已經買完了。股價創高時，成交量僅剩峰值的六成。",
            risk: "高"
        },
        {
            period: "2026 現在 (AI)",
            pPeak: "2026-02-25",
            price: "2015.00",
            vPeak: "2026-01-16",
            lead: 40,
            decay: "-6.24%",
            insight: "目前處於『窒息區』。元月法說會後買盤已見頂。現在 2000 元完全靠慣性在撐，成交量遲遲無法補足。",
            risk: "極度危險"
        }
    ];

    return (
        <div className="min-h-screen bg-[#050507] text-slate-200 p-4 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-12">
                {/* Navigation & Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <button
                            onClick={() => router.push("/analysis/tsmc-research")}
                            className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 text-sm font-bold transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回研究主頁
                        </button>
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                            量價背離分析<span className="text-cyan-500">專題</span>
                        </h1>
                        <p className="text-slate-400 text-lg max-w-2xl">
                            當「股價在漲」但「成交量在跌」，這就是典型的量價背離。
                            歷史證明，每一次台積電的大跌前，都出現了買盤先行枯竭的預兆。
                        </p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-4">
                        <div className="p-2 bg-rose-500 rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="text-rose-400 text-xs font-bold uppercase tracking-wider">整體風險警告</div>
                            <div className="text-white font-bold">目前處於 40 天量價背離期</div>
                        </div>
                    </div>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {data.map((item, idx) => (
                        <div
                            key={idx}
                            className={`group p-8 rounded-3xl border ${item.period.includes('現在') ? 'bg-gradient-to-br from-cyan-950/40 to-black border-cyan-500/40 border-2' : 'bg-white/5 border-white/10'} backdrop-blur-md hover:bg-white/[0.08] transition-all`}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-white">{item.period}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${item.risk === '極度危險' ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/10 text-slate-400'}`}>
                                    風險: {item.risk}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> 價格見頂
                                    </div>
                                    <div className="text-xl font-bold text-white mb-1">{item.price}</div>
                                    <div className="text-slate-400 text-xs">{item.pPeak}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <div className="text-slate-500 text-xs mb-1 flex items-center gap-1">
                                        <BarChart className="w-3 h-3" /> 成交量見項
                                    </div>
                                    <div className="text-xl font-bold text-white mb-1">{item.decay}</div>
                                    <div className="text-slate-400 text-xs">{item.vPeak}</div>
                                </div>
                            </div>

                            {/* Visualization Timeline */}
                            <div className="relative h-24 bg-white/5 rounded-2xl mb-8 overflow-hidden flex items-center px-6">
                                {/* Lead Days Line */}
                                <div className="absolute inset-x-6 top-1/2 h-px bg-white/10" />
                                <div className="flex items-center justify-between w-full relative z-10">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-3 h-3 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
                                        <span className="text-[10px] text-slate-500 font-mono">成交量見頂</span>
                                    </div>

                                    <div className="flex-1 border-t-2 border-dashed border-cyan-500/30 mx-2 relative group-hover:border-cyan-400/50 transition-colors">
                                        <div className="absolute top-[-24px] left-1/2 translate-x-1/2 bg-cyan-500/20 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                            領先 {item.lead} 天
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-1 text-right">
                                        <div className="w-3 h-3 rounded-full bg-white ring-4 ring-white/10" />
                                        <span className="text-[10px] text-slate-500 font-mono">價格噴發見頂</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-sm text-slate-300 leading-relaxed italic">
                                    「{item.insight}」
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Conclusion / Diagnosis */}
                <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] space-y-8">
                    <div className="flex items-center gap-4">
                        <AlertCircle className="w-10 h-10 text-cyan-500" />
                        <div>
                            <h2 className="text-3xl font-black text-white">大跌真的都是「量價背離」嗎？</h2>
                            <p className="text-slate-400">數據給出了 100% 肯定的答案。</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <div className="text-cyan-500 font-bold text-lg">為什麼會背離？</div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                當股價漲到天價，能夠影響盤勢的法人和大戶已經「買完了」。此時的續漲完全是散戶的情緒慣性在推動。
                            </p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-cyan-500 font-bold text-lg">背離代表什麼？</div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                代表支撐力道虛化。因為成交量縮，這意味著「沒有新的買家願意接手」。一旦有人帶頭賣出，下方根本沒有買盤支撐。
                            </p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-cyan-500 font-bold text-lg">現在的危險度？</div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                目前背離天數已達 40 天，超過了 2015、2022、2024 的任何一次。這是歷史級的窒息區，請務必保持高度警覺。
                            </p>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <Activity className="w-5 h-5 text-cyan-500" />
                            <span className="text-slate-500 text-sm">最後更新數據: 2330.TW @ 2026-02-28</span>
                        </div>
                        <button
                            onClick={() => router.push("/analysis/tsmc-risk")}
                            className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(8,145,178,0.3)]"
                        >
                            立即返回即時風險監測 <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
