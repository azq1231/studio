"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Target, TrendingUp, DollarSign, Wallet, Activity, Clock } from "lucide-react";
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Tw50OpportunitiesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tw50Data, setTw50Data] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [dataSource, setDataSource] = useState<'cloud' | 'local' | 'none'>('none');
    const [lastUpdate, setLastUpdate] = useState<string>("");

    // Firestore 引用
    const tw50DocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tw50') : null, [firestore]);
    const { data: cloudTw50Data } = useDoc<any>(tw50DocRef);

    useEffect(() => {
        // 優先使用雲端數據
        if (cloudTw50Data?.stocks) {
            setTw50Data(cloudTw50Data.stocks);
            setDataSource('cloud');
            setLastUpdate(cloudTw50Data.last_update || "實時連線中");
        } else {
            // 備援：讀取本地 JSON
            fetch("/data/tw50_full_scan.json")
                .then(res => res.json())
                .then(json => {
                    if (Array.isArray(json) && json.length > 0) {
                        setTw50Data(json);
                        setDataSource('local');
                        setLastUpdate("系統定時更新檔");
                    }
                })
                .catch(err => {
                    console.error("Failed to load TW50 local data:", err);
                    setDataSource('none');
                });
        }
    }, [cloudTw50Data]);

    const handleManualSync = async () => {
        if (!firestore || isSyncing) return;
        setIsSyncing(true);
        try {
            const syncRef = doc(firestore, 'marketSync', 'trigger');
            await setDoc(syncRef, {
                last_requested_at: serverTimestamp(),
                status: 'pending',
                type: 'TW50'
            });
            toast({
                title: "🔄 同步指令已發送",
                description: "雲端任務已觸發，數據更新約需 30 秒，請稍後重新整理。",
            });
        } catch (error) {
            toast({
                title: "同步失敗",
                description: "無法發送指令至雲端。",
                variant: "destructive",
            });
        } finally {
            setTimeout(() => setIsSyncing(false), 5000);
        }
    };

    if (dataSource === 'none' && tw50Data.length === 0) {
        return (
            <div className="p-20 text-white bg-[#0f1115] min-h-screen text-center flex flex-col items-center justify-center gap-4">
                <Activity className="w-12 h-12 text-rose-500 animate-pulse" />
                <h2 className="text-2xl font-bold">無法載入掃描數據</h2>
                <p className="text-slate-400">目前雲端無回應，且本地快取尚未生成。</p>
                <Button onClick={() => window.location.reload()} variant="outline">重試</Button>
            </div>
        );
    }

    const staticOpps = [
        {
            symbol: "2474.TW",
            name: "可成",
            description: "金屬機殼龍頭，近期轉型跨入醫材與半導體設備，帳上現金充足，具備強大防禦力。",
            budgetAdvice: "10 萬元預算可購入約 522 股（零股交易）。建議分兩批進場，第一批 250 股，若 J 值進一步探底 (-5以下) 再補剩餘部分。",
            waves: [
                {
                    name: "價值低估修正波",
                    buy: { date: "2024-09-04", price: "$225.5", reasons: ["J 值來到極低位 (4.2)", "布林帶位階 0.15", "量能異常萎縮至窒息量"] },
                    sell: { date: "2024-09-06", price: "$240.5", reasons: ["短線乖離迅速修復", "觸及上軌壓力位"] },
                    profit: "+6.7%"
                }
            ]
        },
        {
            symbol: "5871.TW",
            name: "中租-KY",
            description: "租賃業霸主，近期受中國信用市場擔憂影響股價超跌，基本面穩健，殖利率具吸引力。",
            budgetAdvice: "10 萬元預算可購入 1 張 (1000 股) 或分批購入。目前價格已殺至近年低點，適合長期佈局。",
            waves: [
                {
                    name: "恐慌超跌波",
                    buy: { date: "2022-06-22", price: "$190.5", reasons: ["全球升息恐慌導致金融股大跌", "J 值負值閃現", "布林下軌支撐強度測試中"] },
                    sell: { date: "2022-06-29", price: "$204.1", reasons: ["情緒性反彈達 7%，觸及壓力區"] },
                    profit: "+7.2%"
                }
            ]
        }
    ];

    // 尋找實時數據中匹配的股票
    const getLiveData = (symbol: string) => {
        return tw50Data.find(s => s.s === symbol);
    };

    return (
        <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans antialiased">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Header */}
                <header className="space-y-4 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                        <button
                            onClick={() => window.location.href = '/analysis/tsmc-risk'}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回風險雷達
                        </button>
                        <div className="flex items-center gap-4">
                            <Wallet className="w-10 h-10 text-emerald-400" />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-tighter ${dataSource === 'cloud' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {dataSource === 'cloud' ? '雲端同步' : '本地模式'}
                                    </span>
                                    <h1 className="text-4xl font-extrabold text-white">台灣五十：底部機會掃描</h1>
                                </div>
                                <p className="text-slate-400 mt-1 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> 數據更新: {lastUpdate}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        variant="outline"
                        className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold"
                    >
                        {isSyncing ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                        {isSyncing ? '同步中...' : '立即同步最新股價'}
                    </Button>
                </header>

                {/* 預算配置建議 */}
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                    <div className="p-4 bg-emerald-500/20 rounded-full">
                        <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-emerald-400 mb-1">您的 10 萬元預算：專家配置建議</h3>
                        <p className="text-emerald-100/70 text-sm leading-relaxed">
                            目前的市場整體偏貴，不建議追高。您的 10 萬元預算在 **可成** 與 **中租** 身上都有極佳的發揮空間。
                            建議將資金拆分為 **40% (可成)** 與 **60% (中租)**，利用「零股」與「分批」紀律，在 J 值極低位時建倉。
                        </p>
                    </div>
                </div>

                {/* Stock Loop */}
                <div className="space-y-16">
                    {staticOpps.map((stock, sIdx) => {
                        const live = getLiveData(stock.symbol);
                        return (
                            <div key={sIdx} className="space-y-6">
                                <div className="flex items-end justify-between border-l-4 border-emerald-500 pl-4">
                                    <div>
                                        <h2 className="text-3xl font-black text-white">{stock.symbol.split('.')[0]} {stock.name}</h2>
                                        <p className="text-slate-400 text-sm mt-1">{stock.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">實時股價 ({live ? 'Live' : 'Cached'})</div>
                                        <div className="text-3xl font-black text-emerald-400">
                                            {live ? `$${live.p}` : "讀取中..."}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 italic text-sm text-yellow-200/80">
                                        💡 **預算配比：** {stock.budgetAdvice}
                                    </div>
                                    {live && (
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">J 值</div>
                                                <div className={`text-xl font-black ${live.j < 20 ? 'text-emerald-400' : 'text-slate-300'}`}>{live.j}</div>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">乖離率</div>
                                                <div className="text-xl font-black text-slate-300">{live.b}%</div>
                                            </div>
                                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                                                <div className="text-[10px] text-slate-500 uppercase font-bold">建議</div>
                                                <div className={`text-xl font-black ${live.st === 'BUY' ? 'text-emerald-400' : 'text-slate-400'}`}>{live.st}</div>
                                            </div>
                                        </div>
                                    )}
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
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-16 bg-slate-900 border border-slate-700 p-8 rounded-xl text-center space-y-4 shadow-xl">
                    <h3 className="text-xl font-bold text-white">「紀律比預測更重要」</h3>
                    <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                        10 萬元預算雖然不多，但如果您只在「J 值冰點」出手，勝率將遠高於追逐 AI 熱點。目前的 2474 與 5871 是全台灣五十中具代表性的價值標的。
                    </p>
                </div>

            </div>
        </div>
    );
}
