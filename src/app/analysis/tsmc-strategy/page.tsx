"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Target, Wallet, Clock, History, AlertTriangle, ShieldCheck, UserCheck, Activity, Plus, Trash2, TrendingUp, TrendingDown, HelpCircle, CheckCircle } from "lucide-react";
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

interface Tw50Stock {
    s: string;  // symbol
    n: string;  // name
    p: number;  // price
    b: number;  // bias
    j: number;  // j_val
    bp: number; // bp
    st: string; // status
    vol?: number;
    amp?: number;
}

const nameMap: Record<string, string> = {
    '2330.TW': '台積電', '2317.TW': '鴻海', '2454.TW': '聯發科', '2308.TW': '台達電',
    '2303.TW': '聯電', '2382.TW': '廣達', '3711.TW': '日月光投控', '2412.TW': '中華電',
    '2881.TW': '富邦金', '2882.TW': '國泰金', '1301.TW': '台塑', '1303.TW': '南亞',
    '2886.TW': '兆豐金', '2002.TW': '中鋼', '2891.TW': '中信金', '1216.TW': '統一',
    '2357.TW': '華碩', '3231.TW': '緯創', '2884.TW': '玉山金', '2885.TW': '元大金',
    '2327.TW': '國巨', '2207.TW': '和泰車', '1101.TW': '台泥', '2395.TW': '研華',
    '2408.TW': '南亞科', '3034.TW': '聯詠', '2892.TW': '第一金', '2880.TW': '華南金',
    '5880.TW': '合庫金', '2883.TW': '凱基金', '2890.TW': '永豐金', '3045.TW': '台灣大',
    '2912.TW': '統一超', '4904.TW': '遠傳', '2603.TW': '長榮', '2609.TW': '陽明',
    '2615.TW': '萬海', '2474.TW': '可成', '3008.TW': '大立光', '3661.TW': '世芯-KY',
    '6669.TW': '緯穎', '2379.TW': '瑞昱', '1326.TW': '台化', '6505.TW': '台塑化',
    '1503.TW': '士電', '2345.TW': '智邦', '2301.TW': '光寶科', '5871.TW': '中租-KY',
    '5876.TW': '上海商銀', '9910.TW': '豐泰'
};

// 台灣 50 機會篩選的備援資料
const TW50_FALLBACK = [
    { "s": "5871.TW", "n": "中租-KY", "p": 103.0, "b": -8.7, "j": -7.0, "bp": 0.09, "st": "BUY" },
    { "s": "2474.TW", "n": "可成", "p": 190.0, "b": -6.4, "j": 10.1, "bp": 0.1, "st": "BUY" },
    { "s": "1101.TW", "n": "台泥", "p": 32.5, "b": -5.2, "j": 12.0, "bp": 0.12, "st": "BUY" }
];

// Firebase Timestamp 安全轉換
const safeTimeStr = (val: any) => {
    if (!val) return "無更新記錄";
    if (typeof val === 'string') return val;
    if (val.seconds) {
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

export default function GlobalStrategyPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // 資料讀取狀態
    const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
    const [recommendedStocks, setRecommendedStocks] = useState<Tw50Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // 新增持股 Modal
    const [isOpenAddDialog, setIsOpenAddDialog] = useState(false);
    const [selectedRecStock, setSelectedRecStock] = useState<Tw50Stock | null>(null);
    const [newAvgPrice, setNewAvgPrice] = useState("");
    const [newShares, setNewShares] = useState("1000");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Firestore 引用
    const portDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'portfolio') : null, [firestore]);
    const { data: cloudPortData } = useDoc<any>(portDocRef);

    const tw50DocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tw50') : null, [firestore]);
    const { data: cloudTw50Data } = useDoc<any>(tw50DocRef);

    // 1. 同步實戰持股資料
    useEffect(() => {
        if (cloudPortData) {
            setPortfolioData({ ...cloudPortData, _source: 'cloud' } as PortfolioData);
        } else {
            // 本地 fallback
            fetch("/data/portfolio_live.json")
                .then(res => res.ok ? res.json() : null)
                .then(json => {
                    if (json) setPortfolioData({ ...json, _source: 'local' });
                })
                .catch(err => console.error("Failed to fetch local portfolio:", err));
        }
    }, [cloudPortData]);

    // 2. 同步推薦機會股票資料
    useEffect(() => {
        let stocksList: any[] = [];
        if (cloudTw50Data) {
            stocksList = cloudTw50Data.stocks || (Array.isArray(cloudTw50Data) ? cloudTw50Data : []);
        }
        
        if (stocksList.length === 0) {
            // 讀取本地掃描數據
            fetch("/data/tw50_full_scan.json")
                .then(res => res.ok ? res.json() : null)
                .then(json => {
                    if (json && Array.isArray(json)) {
                        processRecommendedStocks(json);
                    } else {
                        processRecommendedStocks(TW50_FALLBACK);
                    }
                })
                .catch(() => {
                    processRecommendedStocks(TW50_FALLBACK);
                });
        } else {
            processRecommendedStocks(stocksList);
        }
    }, [cloudTw50Data]);

    // 3. 處理機會篩選：只列出狀態為 BUY (量化冰點) 的股票
    const processRecommendedStocks = (stocks: any[]) => {
        const buyStocks = stocks
            .filter((s: any) => s.st === 'BUY')
            .map((s: any) => ({
                s: s.s,
                n: s.n || nameMap[s.s] || s.s.split('.')[0],
                p: s.p,
                b: s.b || 0,
                j: s.j || 0,
                bp: s.bp || 0,
                st: s.st,
                vol: s.vol,
                amp: s.amp
            }));
        setRecommendedStocks(buyStocks);
        setLoading(false);
    };

    // 4. 手動觸發市場同步
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
                title: "🔄 市場分析同步已觸發",
                description: "系統正在即時抓取股價並運算 KDJ 策略，預計 30 秒後完成。",
            });
        } catch (error) {
            toast({
                title: "同步發送失敗",
                description: "無法寫入同步觸發指令。",
                variant: "destructive",
            });
        } finally {
            setTimeout(() => setIsSyncing(false), 5000);
        }
    };

    // 5. 點擊推薦股票的「加入監控」
    const handleOpenAddDialog = (stock: Tw50Stock) => {
        setSelectedRecStock(stock);
        setNewAvgPrice(String(stock.p)); // 預設成本價為現價
        setNewShares("1000");
        setIsOpenAddDialog(true);
    };

    // 6. 提交加入持股
    const handleAddPositionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecStock || !newAvgPrice) return;
        
        setIsSubmitting(true);
        try {
            const parsedAvgPrice = parseFloat(newAvgPrice);
            const parsedShares = parseInt(newShares) || 1000;

            const newPos: Position = {
                symbol: selectedRecStock.s,
                name: selectedRecStock.n,
                avg_price: parsedAvgPrice,
                shares: parsedShares,
                current_price: selectedRecStock.p,
                pnl_value: Math.round((selectedRecStock.p - parsedAvgPrice) * parsedShares),
                pnl_percent: Math.round((selectedRecStock.p / parsedAvgPrice - 1) * 10000) / 100,
                j_val: selectedRecStock.j,
                bp: selectedRecStock.bp,
                action: "HOLD",
                advice: "⏳ 已從推薦股票加入，點擊「同步即時損益」獲取最新量化訊號建議。",
                targets: [parsedAvgPrice * 1.05, parsedAvgPrice * 1.12].map(v => Math.round(v * 10) / 10),
                stop_loss: Math.round(parsedAvgPrice * 0.9 * 10) / 10
            };

            const currentPositions = portfolioData?.positions || [];
            
            // 防重入
            if (currentPositions.some(p => p.symbol.toUpperCase() === selectedRecStock.s.toUpperCase())) {
                toast({
                    title: "⚠️ 標的已存在",
                    description: `您的持股中已包含 ${selectedRecStock.n}。`,
                    variant: "destructive",
                });
                setIsSubmitting(false);
                return;
            }

            const updatedPositions = [...currentPositions, newPos];
            const updatedTotalInvested = updatedPositions.reduce((acc, p) => acc + (p.avg_price * (p.shares || 1000)), 0);

            const updatedData: PortfolioData = {
                last_updated: portfolioData?.last_updated || new Date().toISOString().replace('T', ' ').substring(0, 19),
                total_invested: updatedTotalInvested,
                positions: updatedPositions
            };

            if (portfolioData?._source === 'cloud' && portDocRef) {
                await setDoc(portDocRef, updatedData);
                toast({
                    title: "✅ 成功加入實戰持股",
                    description: `已成功將 ${newPos.name} (${newPos.symbol}) 加入監控。`
                });
            } else {
                setPortfolioData({ ...updatedData, _source: 'local' });
                toast({
                    title: "✅ 本地新增成功",
                    description: "目前處於本地模式，變更已在畫面上生效，但未寫入雲端。",
                });
            }

            setIsOpenAddDialog(false);
            setSelectedRecStock(null);
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

    // 7. 刪除持股
    const handleDeletePosition = async (symbolToDelete: string, name: string) => {
        if (typeof window !== "undefined" && !window.confirm(`確定要刪除持股 ${name} (${symbolToDelete}) 嗎？`)) {
            return;
        }

        try {
            const currentPositions = portfolioData?.positions || [];
            const updatedPositions = currentPositions.filter(p => p.symbol !== symbolToDelete);
            const updatedTotalInvested = updatedPositions.reduce((acc, p) => acc + (p.avg_price * (p.shares || 1000)), 0);

            const updatedData: PortfolioData = {
                last_updated: portfolioData?.last_updated || new Date().toISOString().replace('T', ' ').substring(0, 19),
                total_invested: updatedTotalInvested,
                positions: updatedPositions
            };

            if (portfolioData?._source === 'cloud' && portDocRef) {
                await setDoc(portDocRef, updatedData);
                toast({
                    title: "🗑️ 刪除成功",
                    description: `已成功將 ${name} 從持股中移除。`
                });
            } else {
                setPortfolioData({ ...updatedData, _source: 'local' });
                toast({
                    title: "🗑️ 本地刪除成功",
                    description: "變更已在本地生效，未寫入雲端。",
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#08080a] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    const sourceLabel = portfolioData?._source === 'cloud' ? '雲端同步' : '本地模式';
    const totalPNL = portfolioData?.positions.reduce((acc, p) => acc + p.pnl_value, 0) || 0;
    const currentTotalValue = (portfolioData?.total_invested || 0) + totalPNL;

    return (
        <div className="min-h-screen bg-[#08080a] text-slate-200 p-4 md:p-8 font-sans antialiased">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* Header Section */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-900">
                    <div className="space-y-2">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-2 transition-colors font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回系統首頁
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                                <Target className="w-8 h-8 text-cyan-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-cyan-500/20 text-cyan-400">
                                        {sourceLabel}
                                    </span>
                                    <h1 className="text-3xl font-black text-white tracking-tight">股市戰略總覽儀表板</h1>
                                </div>
                                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" /> 數據庫同步時間: {safeTimeStr(portfolioData?.last_updated)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <Button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/30 px-5 py-5 rounded-2xl font-bold flex gap-2"
                        >
                            <Activity className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? '同步中...' : '同步即時損益'}
                        </Button>

                        {/* Summary Overview */}
                        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl min-w-[180px]">
                            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">總資產淨值</div>
                            <div className="text-2xl font-black text-white">${currentTotalValue.toLocaleString()}</div>
                            <div className={`text-xs mt-1 font-bold ${totalPNL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalPNL >= 0 ? '+' : ''}{totalPNL.toLocaleString()} ({((totalPNL / (portfolioData?.total_invested || 1)) * 100).toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Section: Active Positions Monitor (7 Columns) */}
                    <section className="lg:col-span-7 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-emerald-400" />
                                當前實戰持股狀態 ({portfolioData?.positions.length || 0})
                            </h2>
                        </div>

                        {!portfolioData || portfolioData.positions.length === 0 ? (
                            <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-16 text-center">
                                <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                                <div className="text-slate-400 font-bold mb-2">無監控中的持股</div>
                                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                                    目前無實戰持股。您可以從右側「量化超賣推薦」標的中選擇，並點擊加號一鍵加入監控。
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {portfolioData.positions.map((pos, idx) => {
                                    const hasJVal = pos.j_val !== undefined;
                                    const hasBp = pos.bp !== undefined;
                                    const isLoss = pos.pnl_value < 0;

                                    return (
                                        <div key={idx} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 hover:border-cyan-500/30 transition-all duration-300 relative group overflow-hidden">
                                            {/* Corner Delete Button */}
                                            <button
                                                onClick={() => handleDeletePosition(pos.symbol, pos.name)}
                                                className="absolute top-4 right-4 p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                title="移除此持股"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                                {/* Column 1: Info & Price (5 cols) */}
                                                <div className="md:col-span-5 space-y-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-bold uppercase">
                                                                持有中
                                                            </span>
                                                            <h3 className="text-lg font-black text-white">{pos.name}</h3>
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-mono">{pos.symbol} • {(pos.shares || 1000).toLocaleString()} 股</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                                                        <div>
                                                            <div className="text-[10px] text-slate-500">平均成本</div>
                                                            <div className="text-sm font-black text-white">${pos.avg_price}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500">當前現價</div>
                                                            <div className="text-sm font-black text-white">${pos.current_price}</div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-500">預計浮動損益</span>
                                                        <span className={`text-sm font-black ${isLoss ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {isLoss ? '' : '+'}{pos.pnl_value.toLocaleString()} ({pos.pnl_percent}%)
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Column 2: Indicators & Signals (7 cols) */}
                                                <div className="md:col-span-7 space-y-4 flex flex-col justify-between">
                                                    {/* Indicators */}
                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                                <span>J 值 (目前: {hasJVal ? pos.j_val : '待同步'})</span>
                                                                <span className={(pos.j_val || 0) < 0 ? 'text-rose-400' : 'text-cyan-400'}>
                                                                    {(pos.j_val || 0) < 0 ? '超賣冰點' : '平穩區'}
                                                                </span>
                                                            </div>
                                                            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-cyan-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, ((pos.j_val || 0) + 20) * 0.8))}%` }}></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                                <span>布林位階 (BP: {hasBp ? pos.bp : '待同步'})</span>
                                                                <span className={(pos.bp || 0.5) < 0.15 ? 'text-rose-400' : 'text-emerald-400'}>
                                                                    {(pos.bp || 0.5) < 0.15 ? '下軌超賣' : '安全區'}
                                                                </span>
                                                            </div>
                                                            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, ((pos.bp || 0.5) + 0.5) * 60))}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* AI Action signal card */}
                                                    <div className={`p-4 rounded-xl border text-xs leading-relaxed ${(pos.j_val || 0) < 0 ? 'bg-rose-950/10 border-rose-500/20 text-rose-300' : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300'}`}>
                                                        <div className="font-bold flex items-center gap-1.5 mb-1 text-white">
                                                            <ShieldCheck className="w-4 h-4 text-cyan-400" />
                                                            決策指令: {pos.advice ? pos.advice.split('：')[0] : pos.action}
                                                        </div>
                                                        {pos.advice || '⏳ 等待同步數據計算。'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Right Section: Undervalued Recommended Picks (5 Columns) */}
                    <section className="lg:col-span-5 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-cyan-400" />
                                量化超賣推薦股票 ({recommendedStocks.length})
                            </h2>
                            <span title="自動篩選自台灣50成份股中，J值小於15且布林位階小於0.15的冰點超賣股票">
                                <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                            </span>
                        </div>

                        {recommendedStocks.length === 0 ? (
                            <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-16 text-center text-slate-500">
                                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
                                目前台灣 50 標的中無符合超賣冰點之推薦股票（市場處於相對高位）。
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recommendedStocks.map((stock, idx) => (
                                    <div key={idx} className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl hover:border-emerald-500/30 transition-all duration-300 flex justify-between items-center gap-4">
                                        <div className="space-y-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white text-base">{stock.n}</h3>
                                                    <span className="text-[10px] text-slate-500 font-mono">{stock.s}</span>
                                                </div>
                                                <span className="text-xs text-slate-400">當前現價: <strong className="text-white font-black">${stock.p}</strong></span>
                                            </div>

                                            <div className="flex gap-4 text-[10px]">
                                                <span className="text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">
                                                    J值: {stock.j}
                                                </span>
                                                <span className="text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                                                    布林位階: {stock.bp}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Add Button */}
                                        <Button
                                            onClick={() => handleOpenAddDialog(stock)}
                                            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 p-3 rounded-xl flex items-center justify-center shrink-0"
                                            title="將此推薦股加入實戰監控"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Mindset Card */}
                        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 border border-indigo-500/15 p-6 rounded-2xl space-y-4">
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                量化選股核心思維
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                我們的主力策略在於 **「尋找別人恐慌時的黃金坑」**。
                                當一檔優質大盤成分股的 J 值觸及負值（或低於 15）且布林位階低於 0.15 時，代表其短線處於非理性極度超賣。歷史回測顯示，在此處逢低買入具有極高的反彈勝率。
                            </p>
                        </div>
                    </section>
                </div>
            </div>

            {/* 一鍵加入實戰對話框 */}
            <Dialog open={isOpenAddDialog} onOpenChange={setIsOpenAddDialog}>
                <DialogContent className="sm:max-w-[400px] bg-slate-900 border border-slate-800 text-white rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                            <Plus className="w-5 h-5 text-emerald-400" />
                            加入持股監控
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            正在將 <strong className="text-white">{selectedRecStock?.n} ({selectedRecStock?.s})</strong> 加入您的持股清單，請設定您的買入明細。
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPositionSubmit} className="space-y-5 py-3">
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="dialog_price" className="text-right text-slate-400 font-bold text-xs">
                                    買入成本 <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="dialog_price"
                                    type="number"
                                    step="0.01"
                                    placeholder="買入單價"
                                    value={newAvgPrice}
                                    onChange={(e) => setNewAvgPrice(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 text-white placeholder-slate-600"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="dialog_shares" className="text-right text-slate-400 font-bold text-xs">
                                    持有股數
                                </Label>
                                <Input
                                    id="dialog_shares"
                                    type="number"
                                    placeholder="1000"
                                    value={newShares}
                                    onChange={(e) => setNewShares(e.target.value)}
                                    className="col-span-3 bg-slate-950 border-slate-800 rounded-xl focus:border-cyan-500 text-white placeholder-slate-600"
                                />
                            </div>
                        </div>
                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setIsOpenAddDialog(false);
                                    setSelectedRecStock(null);
                                }}
                                className="text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                                disabled={isSubmitting}
                            >
                                取消
                            </Button>
                            <Button
                                type="submit"
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-6 rounded-xl transition-all"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "正在儲存..." : "確認加入監控"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
