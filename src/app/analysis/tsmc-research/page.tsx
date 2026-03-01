"use client";

import React from "react";
import { ArrowLeft, Target, ArrowRight, TrendingUp } from "lucide-react";

export default function TsmcResearchPage() {
    const wavesAll = [
        {
            year: "2021 年：疫情盤整期",
            waves: [
                {
                    name: "本土疫情恐慌坑",
                    buy: { date: "2021-05-13", price: "$547", reasons: ["台灣本土疫情爆發，台股史上最大跌幅", "單日爆出 16 萬張天量（非理性恐慌）", "布林通道嚴重破底 (BP < 0)"] },
                    sell: { date: "2021-09-06", price: "$631", reasons: ["台積電宣佈全面調漲晶圓代工價格 (利多發酵)", "股價急漲後動能轉弱，成交量跟不上", "受制於 600 元以上層層的套牢賣壓"] },
                    profit: "+15.3%"
                }
            ]
        },
        {
            year: "2022 年：外資大提款與絕望滿點",
            waves: [
                {
                    name: "百年難遇的『死亡區轉機』",
                    buy: { date: "2022-10-25", price: "$371", reasons: ["外資無腦提款，股價殺破 400 大關 (總體經濟面極度悲觀)", "技術面 J 值驚見負值 (-0.9)", "爆出恐怖的 13 萬張融資斷頭量"] },
                    sell: { date: "2023-02-14", price: "$545", reasons: ["巴菲特旗下波克夏宣佈重砍台積電 ADR (籌碼面巨震)", "波段強彈近 50%，年線乖離大幅收斂", "短線獲利了結賣壓沉重"] },
                    profit: "+46.9%"
                }
            ]
        },
        {
            year: "2023 年：AI 破曉前的洗盤",
            waves: [
                {
                    name: "COMPUTEX 狂潮預演波",
                    buy: { date: "2023-04-26", price: "$491", reasons: ["股價回撤至半年線找尋支撐", "法說會下修全年營收展望 (但利空測試不跌)", "籌碼沉澱，量能萎縮至 2 萬張以下 (窒息量)"] },
                    sell: { date: "2023-06-13", price: "$593", reasons: ["輝達黃仁勳來台引爆 AI 概念股全面噴出", "台積電攻抵 600 元前波套牢區", "極度樂觀情緒下，爆出急漲天量，觸發出貨警報"] },
                    profit: "+20.7%"
                }
            ]
        },
        {
            year: "2024 年：衝破天際與兩度回調 (全年度)",
            waves: [
                {
                    name: "年初起漲波",
                    buy: { date: "2024-01-16", price: "$580", reasons: ["法說會前夕市場擔憂殺盤 (事件驅動)", "非典型技術觸發，屬於情緒性洗盤落底"] },
                    sell: { date: "2024-03-08", price: "$784", reasons: ["台股站上兩萬點，台積電跳空急拉", "單日爆出 11 萬張天量（典型的短線力竭）"] },
                    profit: "+35.1%"
                },
                {
                    name: "首次千元衝刺",
                    buy: { date: "2024-04-19", price: "$750", reasons: ["法說會利多不漲反跌，造成恐慌性爆量 (3.5倍均量)", "跌破布林帶下軌 (-0.02)"] },
                    sell: { date: "2024-07-11", price: "$1080", reasons: ["首次突破千元大關，散戶狂熱", "年線乖離率高達驚人的 61% (歷史極端)", "股價創新高，但成交量較前月驟降 36% (量價背離)"] },
                    profit: "+44.0%"
                },
                {
                    name: "8月股災修復期",
                    buy: { date: "2024-08-05", price: "$815", reasons: ["日圓升值引發全球股災，台股出現史上最大跌點", "單日爆量 17 萬張 (斷頭恐慌量)", "J 值來到 0.67，觸及年線黃金支撐"] },
                    sell: { date: "2024-10-18", price: "$1085", reasons: ["法說會爆出驚天利多，但股價開高走低", "挑戰前高 1080 失敗，買盤動能明顯衰退"] },
                    profit: "+33.1%"
                }
            ]
        },
        {
            year: "2025-2026 年：AI 大爆發與極度乖離",
            waves: [
                {
                    name: "年後震盪上車波",
                    buy: { date: "2025-02-14", price: "$1060", reasons: ["農曆年後股價震盪洗盤，回調找尋均線支撐", "J 值降溫，量能萎縮至波段低點 (散戶退場)"] },
                    sell: { date: "2025-11-03", price: "$1510", reasons: ["財報釋出驚人利多，但股價動能停滯 (100% 利多不漲訊號)", "高檔連續出現爆量收黑 (大戶獲利了結)"] },
                    profit: "+42.5%"
                },
                {
                    name: "輝達狂潮噴發波 (目前出逃點)",
                    buy: { date: "2025-11-18", price: "$1405", reasons: ["經歷半個月修正，J 值再度落入超賣區 (清洗浮額完畢)", "低位出現量縮止跌的防守訊號"] },
                    sell: { date: "2026-02-25", price: "$2015", reasons: ["連續噴發突破 2000 元大關，年線乖離飆破 59% (歷史極端值)", "輝達財報後股價不漲，整體買盤動能較前月萎縮 31% (量價背離)"] },
                    profit: "+43.4%"
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans antialiased">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Clean Header */}
                <header className="space-y-4 border-b border-slate-800 pb-8">
                    <button
                        onClick={() => window.location.href = '/analysis/tsmc-risk'}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> 返回實時風險監控
                    </button>
                    <h1 className="text-4xl font-extrabold text-white">2021-2025 全週期實戰對帳紀錄表</h1>
                    <p className="text-slate-400 text-lg">
                        這是一份剔除所有感性文字的極致理性紀錄表。我們提取過去五年間最關鍵的八個波段，所有價格均為當時<strong className="text-yellow-400">「未經還原」的真實報價</strong>。
                        從中您可以清清楚楚看到：當某些客觀信號亮起（背離、爆量、極端乖離）時，紀律就是唯一的護身符。
                    </p>
                </header>

                {/* Years Loop */}
                <div className="space-y-12">
                    {wavesAll.map((yearGroup, yIdx) => (
                        <div key={yIdx} className="space-y-6">
                            <h2 className="text-3xl font-black text-cyan-400 border-l-4 border-cyan-500 pl-4">{yearGroup.year}</h2>

                            {/* Waves List inside the Year */}
                            <div className="space-y-6">
                                {yearGroup.waves.map((wave, index) => (
                                    <div key={index} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                                        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                <Target className="w-5 h-5 text-blue-400" /> {wave.name}
                                            </h3>
                                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 font-bold text-sm">
                                                波段結算: {wave.profit} <TrendingUp className="w-4 h-4" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">

                                            {/* Buy Section */}
                                            <div className="md:col-span-6 p-6 space-y-4 bg-slate-900/50">
                                                <div className="flex justify-between items-start">
                                                    <div className="inline-block px-3 py-1 bg-green-900/30 text-green-400 text-xs font-bold rounded border border-green-800/50">進場點 (BUY)</div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-slate-400 font-medium">日期 / 價格</div>
                                                        <div className="text-2xl font-black text-green-400">{wave.buy.date} <span className="text-white">({wave.buy.price})</span></div>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-slate-800">
                                                    <div className="text-sm text-slate-400 font-medium mb-2">客觀作多訊號：</div>
                                                    <ul className="space-y-2">
                                                        {wave.buy.reasons.map((reason, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                                <span className="text-green-500 mt-0.5 font-bold">✓</span> {reason}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Sell Section */}
                                            <div className="md:col-span-6 p-6 space-y-4 bg-slate-900/50">
                                                <div className="flex justify-between items-start">
                                                    <div className="inline-block px-3 py-1 bg-red-900/30 text-red-400 text-xs font-bold rounded border border-red-800/50">了結點 (SELL)</div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-slate-400 font-medium">日期 / 價格</div>
                                                        <div className="text-2xl font-black text-red-400">{wave.sell.date} <span className="text-white">({wave.sell.price})</span></div>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-slate-800">
                                                    <div className="text-sm text-slate-400 font-medium mb-2">危險預警訊號 (出逃)：</div>
                                                    <ul className="space-y-2">
                                                        {wave.sell.reasons.map((reason, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                                <span className="text-red-500 mt-0.5 font-bold">✗</span> {reason}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Final Conclusion Box */}
                <div className="mt-16 bg-blue-950 border border-blue-800 rounded-xl p-8 space-y-4">
                    <h3 className="text-2xl font-bold text-white mb-2">【戰略總結】目前的兩千點，符合哪一種特徵？</h3>
                    <div className="flex items-start gap-3">
                        <ArrowRight className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                        <p className="text-blue-100 leading-relaxed text-lg">
                            回顧這四年間的所有「了結點 (Sell)」都有共同DNA：<strong className="text-yellow-300 text-xl">「極端乖離」、「爆量長紅」或「利多不漲 / 量縮推升」</strong>。<br /><br />
                            而現在的台積電（1995元），年線乖離高達 59%，且在輝達財報後呈現嚴重鈍化。它完全符合 2021 與 2024 年高點時的「出逃預警訊號」。紀律告訴我們：<strong className="text-red-400">現在是等待下一個恐慌坑（Buy 點）的時候，而非追高時機。</strong>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
