"use client";

import React from "react";
import { ArrowLeft, Target, TrendingUp, DollarSign, Wallet } from "lucide-react";

export default function Tw50OpportunitiesPage() {
    const opps = [
        {
            symbol: "2474 可成",
            description: "金屬機殼龍頭，近期轉型跨入醫材與半導體設備，帳上現金充足，具備強大防禦力。",
            currentPrice: "$191.5",
            budgetAdvice: "10 萬元預算可購入約 522 股（零股交易）。建議分兩批進場，第一批 250 股，若 J 值進一步探底 (-5以下) 再補剩餘部分。",
            waves: [
                {
                    name: "價值低估修正波",
                    buy: { date: "2024-09-04", price: "$225.5", reasons: ["J 值來到極低位 (4.2)", "布林帶位階 0.15", "量能異常萎縮至窒息量"] },
                    sell: { date: "2024-09-06", price: "$240.5", reasons: ["短線乖離迅速修復", "觸及上軌壓力位"] },
                    profit: "+6.7%"
                },
                {
                    name: "資優生回測波",
                    buy: { date: "2025-04-07", price: "$198.0", reasons: ["年線支撐位附近放量止跌", "J 值呈黃金交叉形態"] },
                    sell: { date: "2025-04-17", price: "$213.5", reasons: ["短線獲利了結賣壓湧現"] },
                    profit: "+7.8%"
                }
            ]
        },
        {
            symbol: "5871 中租-KY",
            description: "租賃業霸主，近期受中國信用市場擔憂影響股價超跌，但基本面依然穩健，殖利率具吸引力。",
            currentPrice: "$104.0",
            budgetAdvice: "10 萬元預算可購入 1 張 (1000 股) 或分批購入。目前價格已殺至近年低點，適合長期佈局起始點。",
            waves: [
                {
                    name: "恐慌超跌波",
                    buy: { date: "2022-06-22", price: "$190.5", reasons: ["全球升息恐慌導致金融股大跌", "J 值負值閃現", "布林下軌支撐強度測試中"] },
                    sell: { date: "2022-06-29", price: "$204.1", reasons: ["情緒性反彈達 7%，觸及壓力區"] },
                    profit: "+7.2%"
                },
                {
                    name: "基本面修復波",
                    buy: { date: "2023-12-13", price: "$168.4", reasons: ["利空出盡，底部爆量換手成功"] },
                    sell: { date: "2023-12-15", price: "$179.9", reasons: ["極速彈升，短線過熱警告"] },
                    profit: "+6.8%"
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans antialiased">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Header */}
                <header className="space-y-4 border-b border-slate-800 pb-8">
                    <button
                        onClick={() => window.location.href = '/analysis/tsmc-risk'}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> 返回風險雷達
                    </button>
                    <div className="flex items-center gap-4">
                        <Wallet className="w-10 h-10 text-emerald-400" />
                        <div>
                            <h1 className="text-4xl font-extrabold text-white">台灣五十：底部機會掃描</h1>
                            <p className="text-slate-400 mt-1">針對 10 萬元預算的實戰配置與歷史紀律回顧</p>
                        </div>
                    </div>
                </header>

                {/* 我的實戰倉位監控 (中租 5871) */}
                <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-8 space-y-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-cyan-500/10 text-cyan-400 text-xs font-black uppercase tracking-tighter rounded-bl-xl border-l border-b border-cyan-500/30">
                        目前持倉監控中
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-white text-black text-sm rounded">我的持倉</span> 中租-KY (5871)
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">已購於 $103.0 | 數量：1,000 股 (1張)</p>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">目前 J 值 (日)</div>
                                <div className="text-2xl font-black text-rose-500">-12.2</div>
                                <div className="text-[8px] text-rose-400/70">「極度絕望區，切勿恐慌殺跌」</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">目前損益</div>
                                <div className="text-2xl font-black text-slate-400">-$500</div>
                                <div className="text-[10px] text-slate-500">(-0.48%)</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-6">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-colors">
                            <div className="text-xs text-slate-500 font-bold mb-2">① 短線彈升目標</div>
                            <div className="text-xl font-black text-cyan-400">$108.0</div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">觸及布林上軌壓力位。若 J 值彈回 80 附近可在此先行獲利了結 30% 落袋為安。</p>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-colors">
                            <div className="text-xs text-slate-500 font-bold mb-2">② 中期獲利了結點</div>
                            <div className="text-xl font-black text-emerald-400">$115.0</div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">前段盤整區重賣壓。若股價在此站穩，且營收利多發酵，建議全數出清，結算波段獲利約 11%。</p>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 border-rose-900/50 bg-rose-950/20">
                            <div className="text-xs text-rose-400/70 font-bold mb-2">✗ 防禦止損位 (結案價格)</div>
                            <div className="text-xl font-black text-rose-500">$98.0</div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">跌破 100 元整數大關且 J 值無低位鈍化跡象。若不幸跌破此處，代表市場出現非系統性崩盤，應果斷停損等待下個大坑。</p>
                        </div>
                    </div>
                </div>

                {/* Budget Advice Overall */}
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                    <div className="p-4 bg-emerald-500/20 rounded-full">
                        <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-emerald-400 mb-1">您的 10 萬元預算：專家配置建議</h3>
                        <p className="text-emerald-100/70 text-sm leading-relaxed">
                            目前的市場整體偏貴（如台積電），不建議強行追高。您的 10 萬元預算在 **2474 可成** 與 **5871 中租** 身上都有極佳的發揮空間。
                            建議將資金拆分為 **40% (可成)** 與 **60% (中租)**，利用「零股」與「分批」紀律，在 J 值極低位時建倉。
                        </p>
                    </div>
                </div>

                {/* Stock Loop */}
                <div className="space-y-16">
                    {opps.map((stock, sIdx) => (
                        <div key={sIdx} className="space-y-6">
                            <div className="flex items-end justify-between border-l-4 border-emerald-500 pl-4">
                                <div>
                                    <h2 className="text-3xl font-black text-white">{stock.symbol}</h2>
                                    <p className="text-slate-400 text-sm mt-1">{stock.description}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">目前股價</div>
                                    <div className="text-3xl font-black text-emerald-400">{stock.currentPrice}</div>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 mb-4 italic text-sm text-yellow-200/80">
                                💡 **預算配比：** {stock.budgetAdvice}
                            </div>

                            {/* Waves List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {stock.waves.map((wave, index) => (
                                    <div key={index} className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                                        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                                            <span className="text-sm font-bold text-slate-300 flex items-center gap-1">
                                                <Target className="w-4 h-4 text-blue-400" /> {wave.name}
                                            </span>
                                            <span className="text-xs font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                                {wave.profit} <TrendingUp className="w-3 h-3 inline" />
                                            </span>
                                        </div>

                                        <div className="p-4 flex-1 space-y-4">
                                            <div className="grid grid-cols-2 divide-x divide-slate-800">
                                                <div className="pr-3">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">進場 (BUY)</div>
                                                    <div className="text-sm font-bold text-green-400">{wave.buy.date}</div>
                                                    <div className="text-lg font-black text-white">{wave.buy.price}</div>
                                                </div>
                                                <div className="pl-3">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">了結 (SELL)</div>
                                                    <div className="text-sm font-bold text-rose-400">{wave.sell.date}</div>
                                                    <div className="text-lg font-black text-white">{wave.sell.price}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-3 border-t border-slate-800">
                                                <div className="text-[10px] text-slate-500 font-bold mb-1">進場客觀理由：</div>
                                                {wave.buy.reasons.map((r, i) => (
                                                    <div key={i} className="text-xs text-slate-400 flex items-start gap-1">
                                                        <span className="text-emerald-500">•</span> {r}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Final Safety Note */}
                <div className="mt-16 bg-slate-900 border border-slate-700 p-8 rounded-xl text-center space-y-4 shadow-xl">
                    <h3 className="text-xl font-bold text-white">「紀律比預測更重要」</h3>
                    <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                        10 萬元預算雖然不多，但如果能像台積電那樣，只在「J 值冰點」且「爆量恐慌」時出手，您的勝率將遠高於追逐 AI 熱點的散戶。目前的 2474 與 5871 是全台灣五十中唯二具備此 DNA 的標的。
                    </p>
                </div>

            </div>
        </div>
    );
}
