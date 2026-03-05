"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Target, TrendingUp, TrendingDown, Wallet, Clock, Activity, BarChart, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Trade {
    type: string;
    date: string;
    price: number;
    shares: number;
    j: number;
    bp: number;
    pnl?: number;
}

interface BacktestResult {
    symbol: string;
    name: string;
    capital_start: number;
    capital_end: number;
    total_pnl: number;
    pnl_pct: number;
    trades: Trade[];
    equity_curve: { date: string; val: number }[];
}

export default function BacktestPage() {
    const [results, setResults] = useState<BacktestResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/data/backtest_2025.json")
            .then(res => res.json())
            .then(json => {
                setResults(json);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load backtest data:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0c] text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8 font-sans antialiased">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回主儀表板
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600/20 rounded-2xl border border-indigo-500/30">
                                <BarChart className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">2025 年度實戰模擬回測</h1>
                                <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                                    <Clock className="w-4 h-4" /> 策略基準：KDJ J值冰點 + 布林帶位階
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {results.map((res, idx) => (
                        <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -z-10 group-hover:bg-indigo-500/10 transition-all"></div>

                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="px-2 py-1 bg-white/10 text-white text-[10px] font-black rounded uppercase mb-2 inline-block">2025 模擬表現</span>
                                    <h2 className="text-3xl font-black text-white">{res.name} ({res.symbol.split('.')[0]})</h2>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">最終損益比</div>
                                    <div className={`text-4xl font-black ${res.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {res.total_pnl >= 0 ? '+' : ''}{res.pnl_pct}%
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                    <div className="text-[10px] font-bold text-slate-500 mb-1">期初資本</div>
                                    <div className="text-xl font-black text-white">${res.capital_start.toLocaleString()}</div>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                    <div className="text-[10px] font-bold text-slate-500 mb-1">期末資產估值</div>
                                    <div className="text-xl font-black text-white">${res.capital_end.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <History className="w-4 h-4" /> 2025 交易紀錄 ({res.trades.length} 筆)
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {res.trades.map((trade, tIdx) => (
                                        <div key={tIdx} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${trade.type === 'BUY' ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-rose-950/10 border-rose-500/20'}`}>
                                            <div className="flex gap-4 items-center">
                                                <span className={`px-2 py-0.5 rounded font-black text-[10px] ${trade.type === 'BUY' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                    {trade.type}
                                                </span>
                                                <div>
                                                    <div className="font-bold text-white">{trade.date}</div>
                                                    <div className="text-slate-500">價格: ${trade.price} | 股數: {trade.shares}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {trade.type === 'SELL' && (
                                                    <div className={`font-black ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {trade.pnl && trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toLocaleString()}
                                                    </div>
                                                )}
                                                <div className="text-[9px] text-slate-600">J: {trade.j} | BP: {trade.bp}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {res.trades.length === 0 && (
                                        <div className="text-center py-10 text-slate-600 text-xs italic">2025 年度未觸發任何訊號</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-3xl p-8 text-center space-y-6">
                    <h3 className="text-xl font-black text-white">策略診斷分析</h3>
                    <p className="text-slate-400 text-sm max-w-3xl mx-auto leading-relaxed">
                        與低波動標的（如中租）相比，**士電** 與 **鴻海** 在 2025 年展現了極強的價格張力。當 J 值低於 15 且布林帶位階於 0.15 以下時，
                        高動能股傾向於發生「超跌強彈」，這使得在短時間內能獲得 5~12% 的波段收益。
                        <br /><br />
                        <span className="text-indigo-400 font-bold">⚠️ 提醒：</span> 動能股的震盪也更劇烈，2025 年的回測顯示，在高點未及時出場可能回吐全部獲利。系統的「賣出訊號」對這類股尤其重要。
                    </p>
                </div>
            </div>
        </div>
    );
}
