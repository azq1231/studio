"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Target, Wallet, Clock, History, AlertTriangle, ShieldCheck, UserCheck, Activity, Plus, Trash2 } from "lucide-react";
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Position {
    symbol: string;
    name: string;
    avg_price: number;
    shares?: number;
    current_price: number;
    pnl_value: number;
    pnl_percent: number;
    j_val?: number;
    bp?: number;
    action: string;
    advice: string;
    targets: number[];
    stop_loss: number;
}

interface PortfolioData {
    last_updated: any;
    total_invested: number;
    positions: Position[];
    _source?: 'cloud' | 'local';
}

// 防呆時間轉換函數，避免 Firebase Timestamp 物件導致 React 渲染崩潰
const safeTimeStr = (val: any) => {
    if (!val) return "無更新記錄";
    if (typeof val === 'string') return val;
    if (val.seconds) {
        // Firebase Timestamp 物件
        const date = new Date(val.seconds * 1000);
        return date.toLocaleString('zh-TW', { 
            timeZone: 'Asia/Taipei',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/\//g, '-');
    }
    if (typeof val.toDate === 'function') {
        return val.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    }
    return String(val);
};

export default function PortfolioPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [data, setData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // 新增持股 Modal 相關狀態
    const [isOpenAddDialog, setIsOpenAddDialog] = useState(false);
    const [newSymbol, setNewSymbol] = useState("");
    const [newName, setNewName] = useState("");
    const [newAvgPrice, setNewAvgPrice] = useState("");
    const [newShares, setNewShares] = useState("1000");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Firestore 引用
    const portDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'portfolio') : null, [firestore]);
    const { data: cloudData } = useDoc<any>(portDocRef);

    useEffect(() => {
        if (cloudData) {
            setData({ ...cloudData, _source: 'cloud' } as PortfolioData);
            setLoading(false);
        } else {
            // 備援：讀取本地 JSON
            fetch("/data/portfolio_live.json")
                .then(res => {
                    if (!res.ok) throw new Error("File not found");
                    return res.json();
                })
                .then(json => {
                    setData({ ...json, _source: 'local' });
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load portfolio:", err);
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
                type: 'PORTFOLIO'
            });
            toast({
                title: "🔄 同步指令已發送",
                description: "正在即時更新損益，約需 30 秒，請稍後刷新。",
            });
        } catch (error) {
            toast({
                title: "同步失敗",
                description: "無法發送指令。",
                variant: "destructive",
            });
        } finally {
            setTimeout(() => setIsSyncing(false), 5000);
        }
    };

    // 新增持股提交處理
    const handleAddPositionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSymbol || !newAvgPrice) {
            toast({
                title: "❌ 請填寫必填欄位",
                description: "股票代號與平均買入價格為必填項目。",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            let symbol = newSymbol.trim();
            // 自動補上台股後綴防呆
            if (/^\d+$/.test(symbol)) {
                symbol = `${symbol}.TW`;
            }

            const parsedAvgPrice = parseFloat(newAvgPrice);
            const parsedShares = parseInt(newShares) || 1000;

            const newPos: Position = {
                symbol: symbol,
                name: newName.trim() || symbol,
                avg_price: parsedAvgPrice,
                shares: parsedShares,
                current_price: parsedAvgPrice, // 預設同買入成本
                pnl_value: 0,
                pnl_percent: 0,
                j_val: 0,
                bp: 0.5,
                action: "HOLD",
                advice: "⏳ 新增成功，請點擊「同步即時損益」進行市場策略計算。",
                targets: [parsedAvgPrice * 1.05, parsedAvgPrice * 1.12].map(v => Math.round(v * 10) / 10),
                stop_loss: Math.round(parsedAvgPrice * 0.9 * 10) / 10
            };

            const currentPositions = data?.positions || [];
            if (currentPositions.some(p => p.symbol.toUpperCase() === symbol.toUpperCase())) {
                toast({
                    title: "⚠️ 標的已存在",
                    description: `您的持股中已包含 ${symbol}。`,
                    variant: "destructive",
                });
                setIsSubmitting(false);
                return;
            }

            const updatedPositions = [...currentPositions, newPos];
            const updatedTotalInvested = updatedPositions.reduce((acc, p) => acc + (p.avg_price * (p.shares || 1000)), 0);

            const updatedData: PortfolioData = {
                last_updated: data?.last_updated || new Date().toISOString().replace('T', ' ').substring(0, 19),
                total_invested: updatedTotalInvested,
                positions: updatedPositions
            };

            if (data?._source === 'cloud' && portDocRef) {
                await setDoc(portDocRef, updatedData);
                toast({
                    title: "✅ 雲端新增成功",
                    description: `已成功將 ${newPos.name} 加入投資組合，請點擊同步以抓取即時數據。`
                });
            } else {
                setData({ ...updatedData, _source: 'local' });
                toast({
                    title: "✅ 本地新增成功",
                    description: "資料已在本地更新，但目前無雲端連線，無法永久儲存。",
                });
            }

            // 重設欄位
            setNewSymbol("");
            setNewName("");
            setNewAvgPrice("");
            setNewShares("1000");
            setIsOpenAddDialog(false);
        } catch (error: any) {
            toast({
                title: "❌ 新增失敗",
                description: error.message || "更新配置時發生錯誤。",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // 刪除持股處理
    const handleDeletePosition = async (symbolToDelete: string, name: string) => {
        if (typeof window !== "undefined" && !window.confirm(`確定要刪除持股 ${name} (${symbolToDelete}) 嗎？`)) {
            return;
        }

        try {
            const currentPositions = data?.positions || [];
            const updatedPositions = currentPositions.filter(p => p.symbol !== symbolToDelete);
            const updatedTotalInvested = updatedPositions.reduce((acc, p) => acc + (p.avg_price * (p.shares || 1000)), 0);

            const updatedData: PortfolioData = {
                last_updated: data?.last_updated || new Date().toISOString().replace('T', ' ').substring(0, 19),
                total_invested: updatedTotalInvested,
                positions: updatedPositions
            };

            if (data?._source === 'cloud' && portDocRef) {
                await setDoc(portDocRef, updatedData);
                toast({
                    title: "🗑️ 雲端刪除成功",
                    description: `已刪除持股 ${name} (${symbolToDelete})。`
                });
            } else {
                setData({ ...updatedData, _source: 'local' });
                toast({
                    title: "🗑️ 本地刪除成功",
                    description: "已在本地移除持股，變更未寫入雲端。",
                });
            }
        } catch (error: any) {
            toast({
                title: "❌ 刪除失敗",
                description: error.message || "更新配置時發生錯誤。",
                variant: "destructive",
            });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0c] text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    if (!data) return (
        <div className="p-20 text-white bg-[#0a0a0c] min-h-screen text-center flex flex-col items-center justify-center gap-4">
            <AlertTriangle className="w-12 h-12 text-rose-500" />
            <h2 className="text-2xl font-bold">無法載入投資組合</h2>
            <p className="text-slate-400">目前雲端無回應且本地無快取資料。</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="border-slate-700">重試</Button>
        </div>
    );

    const totalPNL = data.positions.reduce((acc, p) => acc + p.pnl_value, 0);
    const currentTotalValue = (data.total_invested || 0) + totalPNL;

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
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-tighter ${data._source === 'cloud' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {data._source === 'cloud' ? '雲端同步' : '本地模式'}
                                    </span>
                                    <h1 className="text-4xl font-black text-white tracking-tight">個人實戰管理中心</h1>
                                </div>
                                <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                                    <Clock className="w-4 h-4" /> 數據更新時間: {safeTimeStr(data.last_updated)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* 新增持股按鈕 */}
                        <Button
                            onClick={() => setIsOpenAddDialog(true)}
                            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 px-6 py-6 rounded-3xl font-bold flex gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            新增持股
                        </Button>

                        <Button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 px-6 py-6 rounded-3xl font-bold flex gap-2"
                        >
                            <Activity className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? '同步中...' : '同步即時損益'}
                        </Button>

                        {/* Summary Overview */}
                        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-3xl min-w-[200px] relative overflow-hidden group">
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">總資產淨值</div>
                            <div className="text-3xl font-black text-white">${currentTotalValue.toLocaleString()}</div>
                            <div className={`text-xs mt-2 font-bold ${totalPNL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalPNL >= 0 ? '+' : ''}{totalPNL.toLocaleString()} ({((totalPNL / (data.total_invested || 1)) * 100).toFixed(2)}%)
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

                        {data.positions.length === 0 ? (
                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-16 text-center text-slate-500">
                                目前交易雷達中沒有持股。點擊上方「新增持股」按鈕開始監控。
                            </div>
                        ) : (
                            data.positions.map((pos, idx) => (
                                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden group hover:border-cyan-500/50 transition-all duration-500 shadow-2xl">
                                    {/* Glass Background Effect */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -z-10 group-hover:bg-cyan-500/10 transition-all"></div>

                                    <div className="flex flex-col md:flex-row gap-10">
                                        {/* Stock Identity */}
                                        <div className="md:w-1/3 border-r border-slate-800/50 pr-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2 py-1 bg-white text-black text-[10px] font-black rounded uppercase">持有中</span>
                                                    <h3 className="text-2xl font-black text-white">{pos.name}</h3>
                                                </div>
                                                <button
                                                    onClick={() => handleDeletePosition(pos.symbol, pos.name)}
                                                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-300"
                                                    title="刪除此持股"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-500">代號</span>
                                                <span className="text-white font-black">{pos.symbol}</span>
                                            </div>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-500">持有股數</span>
                                                <span className="text-white font-black">{(pos.shares || 1000).toLocaleString()} 股</span>
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
                                                        <span>J 值 (目前: {pos.j_val !== undefined ? pos.j_val : '待同步'})</span>
                                                        <span className={(pos.j_val || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                                            {(pos.j_val || 0) < 0 ? '極度低迷' : '平穩回溫'}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, ((pos.j_val || 0) + 20) * 0.8))}%` }}></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                        <span>布林位階 (BP: {pos.bp !== undefined ? pos.bp : '待同步'})</span>
                                                        <span>{(pos.bp || 0.5) < 0.15 ? '超賣破底' : '安全區'}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, ((pos.bp || 0.5) + 0.5) * 60))}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Guidance Container */}
                                        <div className="flex-1 space-y-6">
                                            <div className={`p-6 rounded-2xl border ${(pos.j_val || 0) < 0 ? 'bg-rose-950/20 border-rose-500/30' : 'bg-emerald-950/20 border-emerald-500/30'} flex items-start gap-4 ring-4 ring-cyan-500/0 hover:ring-cyan-500/10 transition-all`}>
                                                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                                    <AlertTriangle className={`w-6 h-6 ${(pos.j_val || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">當前行動指令:</div>
                                                    <div className="text-xl font-bold text-white mb-2">{pos.advice ? pos.advice.split('：')[0] : pos.action}</div>
                                                    <p className="text-sm text-slate-400 leading-relaxed italic">
                                                        * 目前您的浮動損益為 <span className={pos.pnl_value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pos.pnl_value.toLocaleString()} </span>元 ({pos.pnl_percent}%)。{pos.advice || '等待同步後提供操作策略建議。'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 border-l-4 border-l-cyan-500">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">① 首波獲利點</div>
                                                    <div className="text-3xl font-black text-cyan-400">${pos.targets && pos.targets[0] ? pos.targets[0] : '-'}</div>
                                                    <div className="text-[10px] text-slate-600 mt-2">目標獲利: 約 +5%</div>
                                                </div>
                                                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 border-l-4 border-l-emerald-500">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">② 最終結案點</div>
                                                    <div className="text-3xl font-black text-emerald-400">${pos.targets && pos.targets[1] ? pos.targets[1] : '-'}</div>
                                                    <div className="text-[10px] text-slate-600 mt-2">目標獲利: 約 +12%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
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
                                股市雷達藉由「KDJ冰點」與「布林帶下軌」雙重指標，專門捕捉市場恐慌時的黃金買點。
                                在持有期間，請保持耐力與紀律，嚴格遵循首波與最終獲利點進行減碼，切忌在低位因短期波動而恐慌賣出。
                            </p>
                            <div className="p-4 bg-black/40 rounded-xl border border-white/5 flex items-center gap-4">
                                <UserCheck className="w-5 h-5 text-indigo-400" />
                                <span className="text-xs text-slate-300">系統建議：保持倉位紀律，不隨意加碼或殺跌。</span>
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
                                    <div className="text-slate-300">以 $103.0 買入 1,000 股。J 值 -12.2，觸及歷史冰點。</div>
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

            {/* 新增持股對話框 */}
            <Dialog open={isOpenAddDialog} onOpenChange={setIsOpenAddDialog}>
                <DialogContent className="sm:max-w-[425px] bg-slate-900 border border-slate-800 text-white rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
                            <Target className="w-6 h-6 text-emerald-400" />
                            新增監控標的
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            請輸入您的持股明細。新增後點擊主頁面「同步即時損益」按鈕，系統將自動連線 Yahoo Finance 重新計算 KDJ、布林位階與交易指令。
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPositionSubmit} className="space-y-6 py-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="symbol" className="text-right text-slate-400 font-bold text-xs">
                                    代號 <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="symbol"
                                    placeholder="例如 2330.TW"
                                    value={newSymbol}
                                    onChange={(e) => setNewSymbol(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-600"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right text-slate-400 font-bold text-xs">
                                    名稱
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="例如 台積電"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-600"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="avgPrice" className="text-right text-slate-400 font-bold text-xs">
                                    買入成本 <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="avgPrice"
                                    type="number"
                                    step="0.01"
                                    placeholder="100.0"
                                    value={newAvgPrice}
                                    onChange={(e) => setNewAvgPrice(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-600"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="shares" className="text-right text-slate-400 font-bold text-xs">
                                    持有股數
                                </Label>
                                <Input
                                    id="shares"
                                    type="number"
                                    placeholder="1000"
                                    value={newShares}
                                    onChange={(e) => setNewShares(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-600"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsOpenAddDialog(false)}
                                className="text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                                disabled={isSubmitting}
                            >
                                取消
                            </Button>
                            <Button
                                type="submit"
                                className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold px-6 rounded-xl transition-all"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "正在儲存..." : "確認新增"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
