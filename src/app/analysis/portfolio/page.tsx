"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Target, TrendingUp, TrendingDown, Wallet, Clock, History, AlertTriangle, ShieldCheck, UserCheck } from "lucide-react";

interface Position {
    symbol: string;
    name: string;
    avg_price: number;
    current_price: number;
    pnl_value: number;
    pnl_percent: number;
    j_val: number;
    bp: number;
    action: string;
    advice: string;
    targets: number[];
    stop_loss: number;
}

interface PortfolioData {
    last_updated: string;
    total_invested: number;
    positions: Position[];
}

export default function PortfolioPage() {
    const [data, setData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/data/portfolio_live.json")
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load portfolio:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0c] text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    const totalPNL = data?.positions.reduce((acc, p) => acc + p.pnl_value, 0) || 0;
    const currentTotalValue = (data?.total_invested || 0) + totalPNL;

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-4 md:p-8 font-sans antialiased overflow-x-hidden">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <button
                            onClick={() => window.location.href = '/analysis/tsmc-risk'}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回風險監控儀表板
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-600/20 rounded-2xl border border-cyan-500/30">
                                <Wallet className="w-8 h-8 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">個人實戰管理中心</h1>
                                <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                                    <Clock className="w-4 h-4" /> 數據最後同步: {data?.last_updated}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Summary Overview */}
                    <div className="flex gap-4">
                        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-3xl min-w-[200px] relative overflow-hidden group">
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">總資產淨值</div>
                            <div className="text-3xl font-black text-white">${currentTotalValue.toLocaleString()}</div>
                            <div className={`text-xs mt-2 font-bold ${totalPNL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalPNL >= 0 ? '+' : ''}{totalPNL.toLocaleString()} ({((totalPNL / (data?.total_invested || 1)) * 100).toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Left: Active Positions List */}
                    <div className="lg:col-span-8 space-y-8">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <Target className="w-6 h-6 text-emerald-400" /> 當前監控標的 (計入實戰)
                        </h2>

                        {data?.positions.map((pos, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-cyan-500/50 transition-all duration-500 shadow-2xl">
                                {/* Glass Background Effect */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -z-10 group-hover:bg-cyan-500/10 transition-all"></div>

                                <div className="flex flex-col md:flex-row gap-10">
                                    {/* Stock Identity */}
                                    <div className="md:w-1/3 border-r border-slate-800/50 pr-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="px-2 py-1 bg-white text-black text-[10px] font-black rounded uppercase">持有中</span>
                                            <h3 className="text-2xl font-black text-white">{pos.name}</h3>
                                        </div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-500">買入成本</span>
                                            <span className="text-white font-black">${pos.avg_price}</span>
                                        </div>
                                        <div className="flex justify-between text-sm mb-6">
                                            <span className="text-slate-500">當前現價</span>
                                            <span className="text-white font-black">${pos.current_price}</span>
                                        </div>

                                        {/* Indicators Bar Area */}
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                    <span>J 值 (目前: {pos.j_val})</span>
                                                    <span className={pos.j_val < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                                        {pos.j_val < 0 ? '極度低迷' : '平穩回溫'}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, (pos.j_val + 20) * 0.8))}%` }}></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                    <span>布林位階 (BP: {pos.bp})</span>
                                                    <span>{pos.bp < 0 ? '超賣破底' : '安全區'}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, (pos.bp + 0.5) * 60))}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Guidance Container */}
                                    <div className="flex-1 space-y-6">
                                        <div className={`p-6 rounded-2xl border ${pos.j_val < 0 ? 'bg-rose-950/20 border-rose-500/30' : 'bg-emerald-950/20 border-emerald-500/30'} flex items-start gap-4 ring-4 ring-cyan-500/0 hover:ring-cyan-500/10 transition-all`}>
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                                <AlertTriangle className={`w-6 h-6 ${pos.j_val < 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">當前行動指令:</div>
                                                <div className="text-xl font-bold text-white mb-2">{pos.advice}</div>
                                                <p className="text-sm text-slate-400 leading-relaxed italic">
                                                    * 目前您的浮動損益為 <span className={pos.pnl_value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pos.pnl_value.toLocaleString()} </span>元。根據 J 值負值反彈規律，請至少抱持至 J 值翻正。
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 border-l-4 border-l-cyan-500">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">① 首波獲利點</div>
                                                <div className="text-3xl font-black text-cyan-400">${pos.targets[0]}</div>
                                                <div className="text-[10px] text-slate-600 mt-2">目標獲利: 約 +5%</div>
                                            </div>
                                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 border-l-4 border-l-emerald-500">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">② 最終結案點</div>
                                                <div className="text-3xl font-black text-emerald-400">${pos.targets[1]}</div>
                                                <div className="text-[10px] text-slate-600 mt-2">目標獲利: 約 +12%</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Side: Mindset & Records */}
                    <div className="lg:col-span-4 space-y-10">
                        {/* Status Guard */}
                        <div className="bg-gradient-to-br from-indigo-950/50 to-slate-950 border border-indigo-500/20 p-8 rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-8 h-8 text-indigo-400" />
                                <h3 className="text-xl font-bold text-white">交易心理防線</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                目前您的中租持倉處於 **「J 值冰點期」**。這是一個考驗耐心的階段。歷史數據證明，盲目在負 J 值時殺跌，是賠錢最快的方式。
                                記住：我們是在別人恐慌時買入，現在要做的就是等待別人開始追高。
                            </p>
                            <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex items-center gap-4">
                                <UserCheck className="w-5 h-5 text-indigo-400" />
                                <span className="text-xs text-slate-300">系統建議：繼續持有，不輕易交出籌碼。</span>
                            </div>
                        </div>

                        {/* Quick History Log */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <History className="w-5 h-5 text-slate-500" /> 買進紀律存檔 (Log)
                            </h3>
                            <div className="space-y-3">
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-xs">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-slate-500">2026-03-02</span>
                                        <span className="text-emerald-400 font-bold">成功買進 5871</span>
                                    </div>
                                    <div className="text-slate-300">以 $103.0 買入 1,000 股。J 值 -12.2，觸及 5 歷史冰點。</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Tip */}
                <div className="text-center pt-20 pb-10">
                    <p className="text-slate-600 text-xs tracking-widest uppercase">
                        保持紀律 • 極致冷靜 • 只賺非理性利潤
                    </p>
                </div>
            </div>
        </div>
    );
}
