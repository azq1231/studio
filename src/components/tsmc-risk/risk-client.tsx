"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Activity, History, Calendar, Target, Wallet, UserCheck, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { formatSafeDate } from "@/lib/utils";

interface RiskData {
    symbol: string;
    price: number;
    ma240: number;
    bias: number;
    rsi: number;
    bp: number;
    j_val: number;
    vr: number;
    risk_score: number;
    alerts: string[];
    last_update: string;
    comparison_2022: {
        peak_price: number;
        peak_bias: number;
        peak_rsi: number;
    };
    _source?: 'cloud' | 'local';
}

export default function TsmcRiskClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [data, setData] = useState<RiskData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // Firestore 引用
    const tsmcDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tsmc') : null, [firestore]);
    const { data: cloudData } = useDoc<any>(tsmcDocRef);

    useEffect(() => {
        if (cloudData) {
            setData({ ...cloudData, _source: 'cloud' } as RiskData & { _source: string });
            setLoading(false);
        } else {
            // 備援：讀取本地 JSON
            fetch("/data/tsmc_risk.json")
                .then((res) => res.json())
                .then((json) => {
                    setData({ ...json, _source: 'local' });
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Failed to load local data:", err);
                    setLoading(false);
                });
        }
    }, [cloudData]);

    const handleManualSync = async () => {
        if (!firestore || isSyncing) return;
        setIsSyncing(true);
        try {
            const syncRef = doc(firestore, 'marketSync', 'trigger');
            await setDoc(syncRef, {
                last_requested_at: serverTimestamp(),
                status: 'pending',
                type: 'TSMC'
            });
            toast({
                title: "🔄 同步指令已發送",
                description: "雲端任務已啟動，約需 30 秒更新，完成後請重新整理。",
            });
        } catch (error) {
            toast({
                title: "同步失敗",
                description: "無法發送同步指令。",
                variant: "destructive",
            });
        } finally {
            setTimeout(() => setIsSyncing(false), 5000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0f1115] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!data) return (
        <div className="p-20 text-white bg-[#0f1115] min-h-screen text-center flex flex-col items-center justify-center gap-4">
            <AlertTriangle className="w-12 h-12 text-rose-500" />
            <h2 className="text-2xl font-bold">無法讀取市場數據</h2>
            <p className="text-slate-400">雲端與本地備援均失效，請確認網路連接或稍後再試。</p>
            <Button onClick={() => window.location.reload()} variant="outline">重新整理</Button>
        </div>
    );

    const getRiskColor = (score: number) => {
        if (score < 30) return "text-emerald-400";
        if (score < 70) return "text-amber-400";
        return "text-rose-500";
    };

    const getRiskBg = (score: number) => {
        if (score < 30) return "bg-emerald-500/10 border-emerald-500/20";
        if (score < 70) return "bg-amber-500/10 border-amber-500/20";
        return "bg-rose-500/10 border-rose-500/20";
    };

    // 行動決策邏輯
    const isSell = data.risk_score > 70 || data.bias > 40;
    const isBuy = data.risk_score < 30;

    return (
        <div className="min-h-screen bg-[#0f1115] text-slate-200 p-4 md:p-8 font-sans antialiased">
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 text-xs font-black rounded uppercase tracking-wider ${data._source === 'cloud' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {data._source === 'cloud' ? '雲端即時連線' : '本地緩存模式'}
                            </span>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-white">台積電 (2330) 實戰風險雷達</h1>
                        </div>
                        <div className="flex flex-col gap-1 mt-3">
                            <p className="text-slate-500 flex items-center gap-2 font-mono text-sm">
                                <Activity className="w-4 h-4" /> 報價時間: {formatSafeDate(data.last_update)}
                            </p>
                            <p className="text-[10px] text-slate-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> 資料來源: {data._source === 'cloud' ? 'Firestore (Realtime)' : 'Local Static JSON (Fallover)'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 px-6 py-6 rounded-xl font-bold flex gap-2"
                        >
                            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {isSyncing ? '同步中...' : '手動刷新'}
                        </Button>

                        <div className="bg-slate-900 border border-slate-700 p-1 rounded-xl flex shadow-xl overflow-hidden">
                            <button
                                onClick={() => router.push('/analysis/tsmc-research')}
                                className="px-4 py-3 text-xs font-bold rounded-lg text-amber-400 hover:text-white hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
                            >
                                <Target className="w-3.5 h-3.5" /> 歷史對照
                            </button>
                            <button
                                onClick={() => router.push('/analysis/tw50-opportunities')}
                                className="px-4 py-3 text-xs font-bold rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                            >
                                <Wallet className="w-3.5 h-3.5" /> TW50 機會
                            </button>
                            <button
                                onClick={() => router.push('/analysis/portfolio')}
                                className="px-4 py-3 text-xs font-bold rounded-lg text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
                            >
                                <UserCheck className="w-3.5 h-3.5" /> 實戰指揮
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* 核心行動面板 */}
                    <div className={`p-8 rounded-2xl border ${getRiskBg(data.risk_score)} bg-slate-900 shadow-2xl`}>
                        <div className="flex flex-col md:flex-row items-center gap-10">

                            {/* 分數圓環 */}
                            <div className="relative w-40 h-40 shrink-0">
                                <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 100 100">
                                    <circle className="text-slate-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                                    <circle className={`${getRiskColor(data.risk_score)} stroke-current transition-all duration-1000 ease-in-out`} strokeWidth="8" strokeDasharray={`${data.risk_score * 2.51} 251`} strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" transform="rotate(-90 50 50)" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-sm font-bold text-slate-400 mb-[-5px]">風險分</span>
                                    <span className="text-4xl font-black text-white">{data.risk_score}</span>
                                </div>
                            </div>

                            {/* 大字報建議 */}
                            <div className="flex-1 space-y-5 w-full">
                                <div className={`p-6 rounded-xl border ${isSell ? 'bg-rose-950/40 border-rose-500/40' : isBuy ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-slate-800/50 border-slate-700'}`}>
                                    <div className={`text-sm font-bold uppercase tracking-widest mb-2 ${isSell ? 'text-rose-400' : isBuy ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        系統判定目前動向：
                                    </div>
                                    <div className={`text-2xl md:text-3xl font-black ${isSell ? 'text-rose-500' : isBuy ? 'text-emerald-500' : 'text-white'}`}>
                                        {isSell ? "🚨 強烈建議：獲利了結 (SELL)" : isBuy ? "✅ 強烈建議：進場佈局 (BUY)" : "👀 建議：空手觀望 (HOLD)"}
                                    </div>
                                    <p className="text-base text-slate-300 mt-3 leading-relaxed">
                                        {isSell ? "目前年線乖離率已達歷史極端高位，如同歷年來的頂部特徵。這通常是主力獲利了結的區域，散戶應跟隨大戶腳步先行下車，切勿追高盲入。"
                                            : isBuy ? "市場恐慌情緒已達極致，籌碼清洗乾淨。此時勝率極高，可依照歷史紀律分批進場撿便宜。"
                                                : "目前市場處於不上不下的無方向區間，既無恐慌低點也無極端高點。耐心等待是贏家最好的策略。"}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {data.alerts.map((alert, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-slate-950 border border-slate-700 text-slate-300 text-xs font-bold rounded flex items-center gap-1.5 shadow-md">
                                            <AlertTriangle className={`w-3.5 h-3.5 ${isSell ? 'text-rose-500' : 'text-amber-500'}`} /> {alert}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 三大客觀指標 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-slate-900 border-slate-700 shadow-lg">
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider">當前收盤價</CardHeader>
                            <CardContent><div className="text-4xl font-black text-white">${data.price}</div></CardContent>
                        </Card>
                        <Card className="bg-slate-900 border-slate-700 shadow-lg relative overflow-hidden">
                            {data.bias > 40 && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/20 blur-2xl rounded-full" />}
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider">年線乖離率</CardHeader>
                            <CardContent><div className={`text-4xl font-black ${data.bias > 40 ? 'text-rose-500 drop-shadow-sm' : 'text-white'}`}>{data.bias}%</div></CardContent>
                        </Card>
                        <Card className="bg-slate-900 border-slate-700 shadow-lg relative overflow-hidden">
                            {data.rsi > 70 && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/20 blur-2xl rounded-full" />}
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider">RSI (過熱指標)</CardHeader>
                            <CardContent><div className={`text-4xl font-black ${data.rsi > 70 ? 'text-amber-500' : 'text-white'}`}>{data.rsi}</div></CardContent>
                        </Card>
                    </div>

                    {/* 底部機會專用指標 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-800">
                        <Card className="bg-slate-900 border-slate-700 shadow-lg relative overflow-hidden">
                            {data.j_val < 10 && <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/20 blur-2xl rounded-full" />}
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider flex justify-between">
                                J 值 (極端冰點)
                                {data.j_val < 10 && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">機會</span>}
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${data.j_val < 10 ? 'text-emerald-400' : 'text-slate-300'}`}>{data.j_val}</div>
                                <div className="text-[10px] text-slate-500 mt-1">{"< 10 為最佳絕望買點"}</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900 border-slate-700 shadow-lg relative overflow-hidden">
                            {data.bp < 0 && <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/20 blur-2xl rounded-full" />}
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider flex justify-between">
                                布林通道位階
                                {data.bp < 0 && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">破底</span>}
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${data.bp < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{data.bp}</div>
                                <div className="text-[10px] text-slate-500 mt-1">{"< 0 已跌爆下軌"}</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900 border-slate-700 shadow-lg relative overflow-hidden">
                            {data.vr > 1.5 && <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/20 blur-2xl rounded-full" />}
                            <CardHeader className="pb-3 text-slate-400 text-sm font-bold uppercase tracking-wider flex justify-between">
                                恐慌倍數 (VR)
                                {data.vr > 1.5 && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded">爆量</span>}
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${data.vr > 1.5 ? 'text-emerald-400' : 'text-slate-300'}`}>{data.vr}x</div>
                                <div className="text-[10px] text-slate-500 mt-1">{"> 1.5x 散戶斷頭殺出"}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* 歷史比較警告 */}
                    <Card className="bg-slate-900 border-slate-700 shadow-xl">
                        <CardHeader><CardTitle className="text-lg flex items-center gap-2 font-bold"><History className="w-5 h-5 text-rose-500" /> 與 2022 崩盤巔峰比較</CardTitle></CardHeader>
                        <CardContent className="space-y-5">
                            <div className="flex justify-between border-b border-slate-800 pb-4">
                                <span className="text-slate-400 font-medium">2022 崩盤前最高乖離</span>
                                <span className="text-white font-mono font-bold">{data.comparison_2022.peak_bias}%</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-white font-bold">目前最新乖離</span>
                                <span className={`text-2xl font-black font-mono px-3 py-1 rounded bg-black/50 border border-slate-800 ${data.bias > data.comparison_2022.peak_bias ? 'text-rose-500' : 'text-emerald-400'}`}>
                                    {data.bias}%
                                </span>
                            </div>
                            {data.bias > data.comparison_2022.peak_bias && (
                                <div className="px-4 py-3 bg-rose-950/30 border border-rose-500/30 rounded-lg">
                                    <p className="text-xs text-rose-400 leading-relaxed font-medium">
                                        * 警告：當前乖離率已超越 2022 歷史崩盤前的最高點！代表市場價格已偏離均線太多，如無實質營收推升，隨時會爆發獲利了結賣壓。
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 操作指引 */}
                    <div className="p-6 rounded-xl bg-blue-900/20 border border-blue-500/30">
                        <h3 className="text-blue-400 font-bold flex items-center gap-2 mb-3"><Calendar className="w-4 h-4" /> 下一步該怎麼辦？</h3>
                        <p className="text-sm text-blue-100/70 leading-relaxed">
                            看到左側面板如果是叫您 <span className="text-rose-400 font-bold">SELL</span>，那就請果斷賣出。您可以隨時點選右上角的「對帳紀錄表」，檢視我們過去是不是靠著這個閃紅燈的紀律，成功躲掉了好幾次 20% 以上的台股大跌。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
