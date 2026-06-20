'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, writeBatch, doc, getDocs, query, setDoc, serverTimestamp, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast"
import { processBankStatement } from '@/lib/processor';
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import { StatementImporter } from '@/components/statement-importer';
import { SettingsManager, DEFAULT_SETTINGS, type AppSettings } from '@/components/finance-flow/settings-manager';
import { ResultsDisplay } from '@/components/finance-flow/results-display';
import { FixedItemsSummary } from '@/components/finance-flow/fixed-items-summary';
import { BalanceTracker } from '@/components/finance-flow/balance-tracker';
import { MaintenanceManager, type MaintenanceRecord } from '@/components/finance-flow/maintenance-manager';
import { Wrench } from 'lucide-react';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text, Settings, ClipboardCopy, FileText, BarChart2, Zap, ShoppingCart, Wallet, TrendingUp, Target, Activity, History, Calendar, AlertTriangle, UserCheck, TrendingDown, Clock, ShieldCheck, ArrowLeft, ArrowDown, ArrowRight, Plus, Trash2, HelpCircle, CheckCircle } from 'lucide-react';
import { parse } from 'date-fns';
import { formatCurrency, formatSafeDate } from "@/lib/utils";
import { getCreditDisplayDate } from '@/lib/parser';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type CombinedData } from '@/types/index';

// =======================================================================
// HELPER: sha1 (UNIVERSAL)
// =======================================================================
/**
 * Creates a SHA-1 hash for generating consistent IDs.
 * This function is safe to use in both Node.js (server-side) and browser environments.
 */
async function sha1(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment
    const buffer = new TextEncoder().encode(str);
    const hash = await window.crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment - This part is not used in this client component, but makes the function universal.
    // The actual Node.js crypto module should be imported in server-side files.
    throw new Error('sha1 function running in a non-browser environment without Node.js crypto module.');
  }
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // 壓縮為 jpeg，品質 0.7
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};


// =======================================================================
// MAIN COMPONENT: FinanceFlowClient
// =======================================================================
export function FinanceFlowClient() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);

  // --- 安全時間格式化：防止 Firebase Timestamp 物件直接渲染導致 React 崩潰 ---
  const safeTimeStr = formatSafeDate;

  // --- 股市雷達狀態 ---
  const [radarView, setRadarView] = useState<'overview' | 'tsmc' | 'portfolio' | 'tw50' | 'research' | 'alpha'>('overview');
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
    '5876.TW': '上海商銀', '9910.TW': '豐泰', '3017.TW': '奇鋐', '2376.TW': '技嘉',
    '2353.TW': '宏碁', '2356.TW': '英業達', '1513.TW': '中興電', '1519.TW': '華城',
    '1605.TW': '華新', '2618.TW': '長榮航', '2610.TW': '華航'
  };
  const [isWarningExpanded, setIsWarningExpanded] = useState(false);
  const [tsmcDataLocal, setTsmcDataLocal] = useState<any>(null);
  const [portfolioDataLocal, setPortfolioDataLocal] = useState<any>(null);

  // 內聯備援資料，防止靜態 JSON 404
  const TW50_FALLBACK = [
    { "s": "2330.TW", "p": 1990.0, "b": 57.7, "j": 96.6, "bp": 0.91, "st": "SELL" },
    { "s": "2317.TW", "p": 239.0, "b": 23.1, "j": 82.9, "bp": 0.89, "st": "HOLD" },
    { "s": "2454.TW", "p": 1920.0, "b": 37.5, "j": 88.0, "bp": 0.84, "st": "SELL" },
    { "s": "2308.TW", "p": 1435.0, "b": 101.3, "j": 101.3, "bp": 0.97, "st": "SELL" },
    { "s": "2303.TW", "p": 65.0, "b": 37.7, "j": 63.5, "bp": 0.48, "st": "HOLD" },
    { "s": "2603.TW", "p": 206.5, "b": 3.0, "j": 98.5, "bp": 1.34, "st": "SELL" },
    { "s": "2609.TW", "p": 59.5, "b": -4.8, "j": 97.4, "bp": 1.17, "st": "SELL" },
    { "s": "2615.TW", "p": 79.6, "b": -6.2, "j": 73.3, "bp": 1.26, "st": "HOLD" },
    { "s": "5871.TW", "p": 103.0, "b": -8.7, "j": -7.0, "bp": 0.09, "st": "BUY" },
    { "s": "2474.TW", "p": 190.0, "b": -6.4, "j": 10.1, "bp": 0.1, "st": "BUY" },
    { "s": "2002.TW", "p": 20.2, "b": 1.8, "j": 19.9, "bp": 0.44, "st": "HOLD" },
    { "s": "2881.TW", "p": 93.2, "b": 7.4, "j": 31.5, "bp": 0.52, "st": "HOLD" }
  ];
  const [tw50DataLocal, setTw50DataLocal] = useState<any[] | null>(null);

  // Firestore 實時引用 (Cloud Sync)
  // marketRecords 是公開讀取的，所以只需要 firestore 實例即可
  const tsmcDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tsmc') : null, [firestore]);
  const { data: cloudTsmcData, isLoading: isLoadingTsmc } = useDoc<any>(tsmcDocRef);

  const portfolioDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'portfolio') : null, [firestore]);
  const { data: cloudPortfolioData, isLoading: isLoadingPortfolio } = useDoc<any>(portfolioDocRef);

  const tw50DocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tw50') : null, [firestore]);
  const { data: cloudTw50Data, isLoading: isLoadingTw50 } = useDoc<any>(tw50DocRef);

  const alphaDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'alphaSignals', 'latest') : null, [firestore]);
  const { data: alphaData, isLoading: isLoadingAlpha } = useDoc<any>(alphaDocRef);

  // 優先順序：雲端數據 > 本地 JSON 數據
  const tsmcData = cloudTsmcData || tsmcDataLocal;
  const portfolioData = cloudPortfolioData || portfolioDataLocal;
  const tw50Data = (cloudTw50Data?.stocks || (Array.isArray(cloudTw50Data) ? cloudTw50Data : null)) || tw50DataLocal;

  // --- 自動生成市場買賣總結 (用於頂部 Banner) ---
  const marketSummary = useMemo(() => {
    if (!tw50Data || !Array.isArray(tw50Data)) return null;
    const buys = tw50Data.filter((s: any) => s.st === 'BUY');
    const sells = tw50Data.filter((s: any) => s.st === 'SELL');

    // 計算波動率排名 (由高到低)
    const hotPick = [...tw50Data]
      .sort((a, b) => (b.vol || 0) - (a.vol || 0))
      .slice(0, 3)
      .map(s => ({
        name: nameMap[s.s] || s.s.split('.')[0],
        vol: s.vol || 0
      }));

    return {
      buyCount: buys.length,
      sellCount: sells.length,
      topBuys: buys.slice(0, 5).map((s: any) => ({
        name: nameMap[s.s] || s.s.split('.')[0],
        price: s.p,
        symbol: s.s,
        vol: s.vol || 0
      })),
      topSells: sells.slice(0, 5).map((s: any) => ({
        name: nameMap[s.s] || s.s.split('.')[0],
        price: s.p,
        symbol: s.s
      })),
      hotPicks: hotPick
    };
  }, [tw50Data]);

  // --- 量化超賣推薦股 ---
  const recommendedStocks = useMemo(() => {
    if (!tw50Data || !Array.isArray(tw50Data)) return [];
    return tw50Data
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
  }, [tw50Data]);

  // --- 實戰持股總覽數據計算 ---
  const portfolioSummary = useMemo(() => {
    if (!portfolioData || !portfolioData.positions || !Array.isArray(portfolioData.positions)) {
      return { totalPNL: 0, currentTotalValue: 0, totalInvested: 0, pnlPercent: 0 };
    }
    const totalInvested = portfolioData.total_invested || 0;
    const totalPNL = portfolioData.positions.reduce((acc: number, p: any) => acc + (p.pnl_value || 0), 0);
    const currentTotalValue = totalInvested + totalPNL;
    const pnlPercent = totalInvested > 0 ? (totalPNL / totalInvested) * 100 : 0;
    return { totalPNL, currentTotalValue, totalInvested, pnlPercent };
  }, [portfolioData]);

    // --- 台北時間格式化 Helper ---
  const getTaipeiTimeStr = () => {
    const date = new Date();
    const offset = 8 * 60 * 60 * 1000;
    const localDate = new Date(date.getTime() + offset);
    return localDate.toISOString().replace('T', ' ').substring(0, 19);
  };

  // --- 一鍵加入與刪除持股 States ---
  const [isOpenAddDialog, setIsOpenAddDialog] = useState(false);
  const [selectedRecStock, setSelectedRecStock] = useState<any>(null);
  const [newAvgPrice, setNewAvgPrice] = useState("");
  const [newShares, setNewShares] = useState("1000");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 調整持股 States ---
  const [isOpenEditDialog, setIsOpenEditDialog] = useState(false);
  const [selectedEditStock, setSelectedEditStock] = useState<any>(null);
  const [editAvgPrice, setEditAvgPrice] = useState("");
  const [editShares, setEditShares] = useState("");

  // --- TW50 機會篩選狀態 ---
  const [tw50Filter, setTw50Filter] = useState<'opportunity' | 'all'>('opportunity');

  // --- 手動新增持股明細狀態 ---
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualName, setManualName] = useState("");

  // --- 加減碼交易狀態 ---
  const [isOpenTxDialog, setIsOpenTxDialog] = useState(false);
  const [txType, setTxType] = useState<'buy' | 'sell'>('buy');
  const [txStock, setTxStock] = useState<any>(null);
  const [txPrice, setTxPrice] = useState("");
  const [txShares, setTxShares] = useState("");

  const handleOpenTxDialog = (stock: any, type: 'buy' | 'sell') => {
    setTxStock(stock);
    setTxType(type);
    setTxPrice(String(stock.current_price || stock.avg_price || ''));
    setTxShares("1000");
    setIsOpenTxDialog(true);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txStock || !txPrice || !txShares) return;
    
    setIsSubmitting(true);
    try {
      const parsedPrice = parseFloat(txPrice);
      const parsedShares = parseInt(txShares) || 0;
      if (parsedShares <= 0) throw new Error("交易股數必須大於 0");

      const currentPositions = portfolioData?.positions || [];
      const currentPos = currentPositions.find((p: any) => p.symbol.toUpperCase() === txStock.symbol.toUpperCase());
      if (!currentPos) throw new Error("找不到該持股資料");

      const origPrice = currentPos.avg_price || 0;
      const origShares = currentPos.shares || 1000;

      let updatedPositions = [];
      let toastDesc = "";

      if (txType === 'buy') {
        // 加碼：計算加權平均價
        const totalCost = origPrice * origShares + parsedPrice * parsedShares;
        const totalShares = origShares + parsedShares;
        const newAvg = Math.round((totalCost / totalShares) * 100) / 100;

        updatedPositions = currentPositions.map((p: any) => {
          if (p.symbol.toUpperCase() === txStock.symbol.toUpperCase()) {
            return {
              ...p,
              avg_price: newAvg,
              shares: totalShares,
              pnl_value: Math.round(((p.current_price || newAvg) - newAvg) * totalShares),
              pnl_percent: Math.round(((p.current_price || newAvg) / newAvg - 1) * 10000) / 100,
              targets: [newAvg * 1.05, newAvg * 1.12].map(v => Math.round(v * 10) / 10),
              stop_loss: Math.round(newAvg * 0.9 * 10) / 10
            };
          }
          return p;
        });
        toastDesc = `已成功加碼買入 ${txStock.name} 共 ${parsedShares} 股，新均價為 $${newAvg}。`;
      } else {
        // 減碼：扣除股數
        if (parsedShares > origShares) {
          throw new Error(`減碼股數 (${parsedShares} 股) 不能大於持有股數 (${origShares} 股)`);
        }
        
        const remainingShares = origShares - parsedShares;

        if (remainingShares === 0) {
          // 全部賣出，移除監控
          updatedPositions = currentPositions.filter((p: any) => p.symbol.toUpperCase() !== txStock.symbol.toUpperCase());
          toastDesc = `已成功全數賣出並移除 ${txStock.name} 的監控。`;
        } else {
          updatedPositions = currentPositions.map((p: any) => {
            if (p.symbol.toUpperCase() === txStock.symbol.toUpperCase()) {
              return {
                ...p,
                shares: remainingShares,
                pnl_value: Math.round(((p.current_price || p.avg_price) - p.avg_price) * remainingShares),
                pnl_percent: Math.round(((p.current_price || p.avg_price) / p.avg_price - 1) * 10000) / 100
              };
            }
            return p;
          });
          toastDesc = `已成功減碼賣出 ${txStock.name} 共 ${parsedShares} 股，剩餘 ${remainingShares} 股。`;
        }
      }

      const updatedTotalInvested = updatedPositions.reduce((acc: number, p: any) => acc + (p.avg_price * (p.shares || 1000)), 0);

      const updatedData = {
        last_updated: getTaipeiTimeStr(),
        total_invested: updatedTotalInvested,
        positions: updatedPositions
      };

      if (cloudPortfolioData && portfolioDocRef) {
        await setDoc(portfolioDocRef, updatedData);
        toast({ title: txType === 'buy' ? "📈 加碼成功" : "📉 減碼成功", description: toastDesc });
      } else {
        setPortfolioDataLocal(updatedData);
        toast({ title: "✅ 本地更新成功", description: "交易調整已在本地生效（未同步至雲端）。" });
      }

      setIsOpenTxDialog(false);
      setTxStock(null);
    } catch (error: any) {
      toast({
        title: "❌ 交易失敗",
        description: error.message || "處理交易時發生錯誤。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 調整持股對話框開啟 ---
  const handleOpenEditDialog = (stock: any) => {
    setSelectedEditStock(stock);
    setEditAvgPrice(String(stock.avg_price || ''));
    setEditShares(String(stock.shares || 1000));
    setIsOpenEditDialog(true);
  };

  // --- 提交持股調整 ---
  const handleEditPositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditStock || !editAvgPrice) return;
    
    setIsSubmitting(true);
    try {
      const parsedAvgPrice = parseFloat(editAvgPrice);
      const parsedShares = parseInt(editShares) || 1000;

      const currentPositions = portfolioData?.positions || [];
      const updatedPositions = currentPositions.map((p: any) => {
        if (p.symbol.toUpperCase() === selectedEditStock.symbol.toUpperCase()) {
          return {
            ...p,
            avg_price: parsedAvgPrice,
            shares: parsedShares,
            pnl_value: Math.round(((p.current_price || 0) - parsedAvgPrice) * parsedShares),
            pnl_percent: Math.round(((p.current_price || parsedAvgPrice) / parsedAvgPrice - 1) * 10000) / 100,
            targets: [parsedAvgPrice * 1.05, parsedAvgPrice * 1.12].map(v => Math.round(v * 10) / 10),
            stop_loss: Math.round(parsedAvgPrice * 0.9 * 10) / 10
          };
        }
        return p;
      });

      const updatedTotalInvested = updatedPositions.reduce((acc: number, p: any) => acc + (p.avg_price * (p.shares || 1000)), 0);

      const updatedData = {
        last_updated: getTaipeiTimeStr(),
        total_invested: updatedTotalInvested,
        positions: updatedPositions
      };

      if (cloudPortfolioData && portfolioDocRef) {
        await setDoc(portfolioDocRef, updatedData);
        toast({
          title: "✅ 持股調整成功",
          description: `已成功更新 ${selectedEditStock.name} 的持有成本及股數。`
        });
      } else {
        setPortfolioDataLocal(updatedData);
        toast({
          title: "✅ 本地更新成功",
          description: "持股調整已在本地生效，未同步至雲端。",
        });
      }

      setIsOpenEditDialog(false);
      setSelectedEditStock(null);
    } catch (error: any) {
      toast({
        title: "❌ 調整失敗",
        description: error.message || "更新配置時發生錯誤。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 新增持股至實戰監控 ---
  const handleOpenAddDialog = (stock: any) => {
    setSelectedRecStock(stock);
    setNewAvgPrice(String(stock.p || stock.price || ''));
    setNewShares("1000");
    setIsOpenAddDialog(true);
  };

  const handleAddPositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecStock || !newAvgPrice) return;
    
    setIsSubmitting(true);
    try {
      const parsedAvgPrice = parseFloat(newAvgPrice);
      const parsedShares = parseInt(newShares) || 1000;

      let symbol = selectedRecStock.s || selectedRecStock.symbol || "";
      let name = selectedRecStock.n || selectedRecStock.name || "";
      let current_price = selectedRecStock.p || selectedRecStock.price || 0;

      if (selectedRecStock.isManual) {
        symbol = manualSymbol.trim().toUpperCase();
        if (!symbol) throw new Error("股票代號不能為空");
        // 自動補足台股後綴
        if (/^\d+$/.test(symbol)) {
          symbol = symbol + ".TW";
        }
        name = manualName.trim() || nameMap[symbol] || symbol.split('.')[0];
        current_price = parsedAvgPrice; // 手動加入時，先將現價設為均價，等背景 daemon 抓取最新價
      }

      const newPos = {
        symbol: symbol,
        name: name,
        avg_price: parsedAvgPrice,
        shares: parsedShares,
        current_price: current_price,
        pnl_value: Math.round((current_price - parsedAvgPrice) * parsedShares),
        pnl_percent: Math.round(((current_price / parsedAvgPrice) - 1) * 10000) / 100,
        j_val: selectedRecStock.j || selectedRecStock.j_val || 50,
        bp: selectedRecStock.bp || 0.5,
        action: "HOLD",
        advice: "⏳ 已加入監控，點擊「同步即時損益」獲取最新量化訊號建議。",
        targets: [parsedAvgPrice * 1.05, parsedAvgPrice * 1.12].map(v => Math.round(v * 10) / 10),
        stop_loss: Math.round(parsedAvgPrice * 0.9 * 10) / 10
      };

      const currentPositions = portfolioData?.positions || [];
      
      if (currentPositions.some((p: any) => p.symbol.toUpperCase() === newPos.symbol.toUpperCase())) {
        toast({
          title: "⚠️ 標的已存在",
          description: `您的持股中已包含 ${newPos.name}。`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const updatedPositions = [...currentPositions, newPos];
      const updatedTotalInvested = updatedPositions.reduce((acc, p) => acc + (p.avg_price * (p.shares || 1000)), 0);

      const updatedData = {
        last_updated: getTaipeiTimeStr(),
        total_invested: updatedTotalInvested,
        positions: updatedPositions
      };

      if (cloudPortfolioData && portfolioDocRef) {
        await setDoc(portfolioDocRef, updatedData);
        toast({
          title: "✅ 成功加入實戰持股",
          description: `已成功將 ${newPos.name} (${newPos.symbol}) 加入監控。`
        });
      } else {
        setPortfolioDataLocal(updatedData);
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

  // --- 刪除實戰持股 ---
  const handleDeletePosition = async (symbolToDelete: string, name: string) => {
    if (typeof window !== "undefined" && !window.confirm(`確定要刪除持股 ${name} (${symbolToDelete}) 嗎？`)) {
      return;
    }

    try {
      const currentPositions = portfolioData?.positions || [];
      const updatedPositions = currentPositions.filter((p: any) => p.symbol !== symbolToDelete);
      const updatedTotalInvested = updatedPositions.reduce((acc: number, p: any) => acc + (p.avg_price * (p.shares || 1000)), 0);

      const updatedData = {
        last_updated: getTaipeiTimeStr(),
        total_invested: updatedTotalInvested,
        positions: updatedPositions
      };

      if (cloudPortfolioData && portfolioDocRef) {
        await setDoc(portfolioDocRef, updatedData);
        toast({
          title: "🗑️ 刪除成功",
          description: `已成功將 ${name} 從持股中移除。`
        });
      } else {
        setPortfolioDataLocal(updatedData);
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

  // 1. 獲取本地 fallback 資料
  useEffect(() => {
    const fetchSafe = async (url: string, setter: (val: any) => void, label: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return; // Silent fallback
        const text = await res.text();
        // If Firebase returns index.html due to 404 rewrite, ignore it quietly
        if (text.trim().startsWith('<')) {
          if (label === 'TW50') setter(TW50_FALLBACK);
          return;
        }
        const json = JSON.parse(text);
        setter(json);
      } catch (err) {
        // Suppress console error to keep user console clean.
        // Silently fallback if anything fails (like network error)
        if (label === 'TW50') setter(TW50_FALLBACK);
      }
    };

    fetchSafe("/data/tsmc_risk.json", setTsmcDataLocal, "TSMC");
    fetchSafe("/data/portfolio_live.json", setPortfolioDataLocal, "Portfolio");
    fetchSafe("/data/tw50_full_scan.json", setTw50DataLocal, "TW50");
  }, []);

  // (Deprecated) Auto-sync migration removed to prevent permission errors
    // --- 手動同步邏輯 (支援 GitHub API 與 Firestore Fallback 雙管齊下) ---
  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      console.log("Triggering manual sync...");
      const pat = process.env.NEXT_PUBLIC_GITHUB_PAT;
      let syncTriggeredViaGithub = false;

      if (pat) {
        try {
          const response = await fetch("https://api.github.com/repos/azq1231/studio/actions/workflows/market-sync.yml/dispatches", {
            method: "POST",
            headers: {
              "Accept": "application/vnd.github.v3+json",
              "Authorization": `token ${pat}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ref: "main" })
          });

          if (response.ok) {
            syncTriggeredViaGithub = true;
            toast({
              title: "🚀 雲端自動化已喚醒",
              description: "GitHub 伺服器正在進行計算更新，請耐候 1~2 分鐘後重新整理頁面。",
            });
          } else {
            const errText = await response.text();
            console.warn("GitHub API dispatch failed:", errText);
          }
        } catch (githubErr) {
          console.warn("GitHub dispatch network or CORS error:", githubErr);
        }
      }

      // 如果 GitHub 觸發不可用或失敗，自動 fallback 至 Firestore 寫入訊號以利 Daemon 回應
      if (!syncTriggeredViaGithub) {
        if (!firestore) throw new Error("尚未載入 Firestore 實例，請稍後重試。");
        const syncRef = doc(firestore, 'marketSync', 'trigger');
        await setDoc(syncRef, {
          last_requested_at: serverTimestamp(),
          status: 'pending',
          requested_by: user?.uid || 'anonymous'
        });
        toast({
          title: "🔄 同步訊號已發送",
          description: "已將同步指令寫入雲端數據庫，等待 Daemon 處理中...",
        });
      }
    } catch (error: any) {
      console.error("Sync trigger error:", error);
      toast({
        title: "同步發送失敗",
        description: error.message || "無法發送同步指令。",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsSyncing(false), 5000);
    }
  };

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

  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const [cashData, setCashData] = useState<CashData[]>([]);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("importer");

  // --- Data Fetching ---
  const creditTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'creditCardTransactions') : null, [user, firestore]);
  const { data: savedCreditTransactions, isLoading: isLoadingCredit } = useCollection<CreditData>(creditTransactionsQuery);

  const depositTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'depositAccountTransactions') : null, [user, firestore]);
  const { data: savedDepositTransactions, isLoading: isLoadingDeposit } = useCollection<DepositData>(depositTransactionsQuery);

  const cashTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'cashTransactions') : null, [user, firestore]);
  const { data: savedCashTransactions, isLoading: isLoadingCash } = useCollection<CashData>(cashTransactionsQuery);

  const maintenanceRecordsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'maintenanceRecords') : null, [user, firestore]);
  const { data: savedMaintenanceRecords, isLoading: isLoadingMaintenance } = useCollection<MaintenanceRecord>(maintenanceRecordsQuery);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

  const settingsDocRef = useMemoFirebase(() => user && firestore ? doc(firestore, 'users', user.uid, 'settings', 'user-settings') : null, [user, firestore]);
  const { data: savedSettings, isLoading: isLoadingSettings } = useDoc<AppSettings>(settingsDocRef);


  useEffect(() => { if (savedCreditTransactions) setCreditData(savedCreditTransactions); }, [savedCreditTransactions]);
  useEffect(() => { if (savedDepositTransactions) setDepositData(savedDepositTransactions); }, [savedDepositTransactions]);
  useEffect(() => { if (savedCashTransactions) setCashData(savedCashTransactions); }, [savedCashTransactions]);
  useEffect(() => { if (savedMaintenanceRecords) setMaintenanceRecords(savedMaintenanceRecords); }, [savedMaintenanceRecords]);

  useEffect(() => {
    if (user && savedSettings) {
      const mergedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        availableCategories: savedSettings.availableCategories?.length ? savedSettings.availableCategories : DEFAULT_SETTINGS.availableCategories,
        replacementRules: savedSettings.replacementRules?.length ? savedSettings.replacementRules : DEFAULT_SETTINGS.replacementRules,
        categoryRules: savedSettings.categoryRules?.length ? savedSettings.categoryRules : DEFAULT_SETTINGS.categoryRules,
        quickFilters: savedSettings.quickFilters?.length ? savedSettings.quickFilters : DEFAULT_SETTINGS.quickFilters,
        cashTransactionDescriptions: savedSettings.cashTransactionDescriptions?.length ? savedSettings.cashTransactionDescriptions : DEFAULT_SETTINGS.cashTransactionDescriptions,
        descriptionGroupingRules: savedSettings.descriptionGroupingRules?.length ? savedSettings.descriptionGroupingRules : DEFAULT_SETTINGS.descriptionGroupingRules,
      };
      setSettings(mergedSettings);
    } else if (user && !savedSettings && !isLoadingSettings) {
      if (!settingsDocRef) return;
      getDoc(settingsDocRef).then(docSnap => {
        if (!docSnap.exists()) {
          handleSaveSettings(DEFAULT_SETTINGS, true);
        }
      });
    } else if (!user) {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [user, savedSettings, isLoadingSettings]);


  const handleSaveSettings = useCallback(async (newSettings: AppSettings, isInitial: boolean = false) => {
    if (!user || !firestore || !settingsDocRef) {
      if (!isInitial) toast({ variant: "destructive", title: "儲存失敗", description: "請先登入才能儲存設定。" });
      return;
    }

    // Sanitize data before saving to prevent Firestore errors with `undefined`.
    const sanitizedSettings = JSON.parse(JSON.stringify(newSettings, (key, value) => value === undefined ? null : value));

    try {
      await setDoc(settingsDocRef, sanitizedSettings, { merge: true });
      setSettings(sanitizedSettings); // Optimistically update local state with sanitized data
    } catch (e: any) {
      console.error("Failed to save settings:", e);
      if (!isInitial) toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將設定儲存到資料庫。" });
    }
  }, [user, firestore, settingsDocRef, toast]);

  const handleAutoAddCategoryRule = useCallback(async (keyword: string, category: string) => {
    if (!keyword || !category || category === '未分類') return;

    setSettings(prev => {
      const existingRuleIndex = prev.categoryRules.findIndex(r => r.keyword === keyword);
      let newRules = [...prev.categoryRules];

      if (existingRuleIndex > -1) {
        if (newRules[existingRuleIndex].category === category) return prev;
        newRules[existingRuleIndex] = { ...newRules[existingRuleIndex], category };
      } else {
        newRules = [{ keyword, category }, ...newRules];
      }

      const newSettings = { ...prev, categoryRules: newRules };
      handleSaveSettings(newSettings);
      return newSettings;
    });

    toast({
      title: "規則已更新",
      description: `已自動將「${keyword}」加入「${category}」規則中。`,
    });
  }, [handleSaveSettings, toast]);


  const handleProcessAndSave = useCallback(async ({ text, excelData }: { text?: string; excelData?: any[][] }) => {
    setIsLoading(true);
    setHasProcessed(false);

    // 將 Firestore 資料轉換成純物件（移除 createdAt 等 Firestore 特定欄位）
    const cleanData = <T extends { id: string }>(data: T[]): T[] => {
      return data.map(item => {
        const { createdAt, updatedAt, ...rest } = item as any;
        return rest as T;
      });
    };

    const result = await processBankStatement(text || '', settings.replacementRules, settings.categoryRules, cleanData(creditData), cleanData(depositData), cleanData(cashData), !!excelData, excelData);

    if (result.success) {
      const creditTotal = result.creditData.reduce((sum, item) => sum + item.amount, 0);
      const depositTotal = result.depositData.reduce((sum, item) => sum + item.amount, 0);
      const cashTotal = result.cashData.reduce((sum, item) => sum + item.amount, 0);
      const summaryLines: string[] = [];
      if (result.creditData.length > 0) {
        summaryLines.push(`信用卡 ${result.creditData.length} 筆，總金額 ${creditTotal.toLocaleString()}`);
      }
      if (result.depositData.length > 0) {
        summaryLines.push(`活存帳戶 ${result.depositData.length} 筆，總金額 ${depositTotal.toLocaleString()}`);
      }
      if (result.cashData.length > 0) {
        summaryLines.push(`Excel 現金 ${result.cashData.length} 筆，總金額 ${cashTotal.toLocaleString()}`);
      }

      // 顯示跳過的重複資料數量
      const totalSkipped = result.skippedDuplicates.credit + result.skippedDuplicates.deposit + result.skippedDuplicates.cash;
      if (totalSkipped > 0) {
        const skippedDetails: string[] = [];
        if (result.skippedDuplicates.credit > 0) skippedDetails.push(`信用卡 ${result.skippedDuplicates.credit} 筆`);
        if (result.skippedDuplicates.deposit > 0) skippedDetails.push(`活存 ${result.skippedDuplicates.deposit} 筆`);
        if (result.skippedDuplicates.cash > 0) skippedDetails.push(`現金 ${result.skippedDuplicates.cash} 筆`);
        summaryLines.push(`已跳過重複資料：${skippedDetails.join('、')}`);
      }

      if (summaryLines.length > 0) {
        toast({
          title: "報表解析摘要",
          description: (
            <ul className="list-disc pl-5">
              {summaryLines.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          ),
          duration: 10000,
        });
      }

      if (result.detectedCategories.length > 0) {
        const currentCats = settings.availableCategories;
        const newCats = result.detectedCategories.filter(c => !currentCats.includes(c));
        if (newCats.length > 0) {
          const updatedSettings = { ...settings, availableCategories: [...currentCats, ...newCats] };
          setSettings(updatedSettings);
          await handleSaveSettings(updatedSettings);
          toast({ title: '自動新增類型', description: `已新增：${newCats.join(', ')}` });
        }
      }

      if (user && firestore) {
        const batch = writeBatch(firestore);
        let transactionsSaved = 0;
        const processData = (data: (CreditData | DepositData | CashData)[], collectionName: string) => {
          if (data.length > 0) {
            const coll = collection(firestore, 'users', user.uid, collectionName);
            data.forEach(transaction => {
              const docRef = doc(coll, transaction.id);
              batch.set(docRef, transaction, { merge: true });
            });
            transactionsSaved += data.length;
          }
        };
        processData(result.creditData, 'creditCardTransactions');
        processData(result.depositData, 'depositAccountTransactions');
        processData(result.cashData, 'cashTransactions');

        if (transactionsSaved > 0) {
          try {
            await batch.commit();
            // 立即更新本地 state，這樣連續貼上時能立即檢測到重複
            if (result.creditData.length > 0) {
              setCreditData(prev => {
                const existingIds = new Set(prev.map(d => d.id));
                const newItems = result.creditData.filter(d => !existingIds.has(d.id));
                return [...prev, ...newItems];
              });
            }
            if (result.depositData.length > 0) {
              setDepositData(prev => {
                const existingIds = new Set(prev.map(d => d.id));
                const newItems = result.depositData.filter(d => !existingIds.has(d.id));
                return [...prev, ...newItems];
              });
            }
            if (result.cashData.length > 0) {
              setCashData(prev => {
                const existingIds = new Set(prev.map(d => d.id));
                const newItems = result.cashData.filter(d => !existingIds.has(d.id));
                return [...prev, ...newItems];
              });
            }
          } catch (e: any) {
            toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將資料儲存到資料庫。" });
          }
        }
      }
      if (result.creditData.length === 0 && result.depositData.length === 0 && result.cashData.length === 0) {
        if (totalSkipped > 0) {
          toast({ variant: "default", title: "提醒", description: `所有資料都是重複的，已自動跳過 ${totalSkipped} 筆重複資料。` });
        } else {
          toast({ variant: "default", title: "提醒", description: "未解析到任何有效資料，請檢查您的報表格式或規則是否正確。" });
        }
      }
    } else {
      toast({ variant: "destructive", title: "處理失敗", description: result.error || '發生未知錯誤，請稍後再試。' });
    }

    setIsLoading(false);
    setHasProcessed(true);
    setActiveTab("results");
  }, [user, firestore, toast, settings, creditData, depositData, cashData, handleSaveSettings]);

  const handleAddCashTransaction = useCallback(async (newTransactionData: Omit<CashData, 'id'>) => {
    if (!user || !firestore) { toast({ variant: 'destructive', title: '錯誤', description: '請先登入' }); return; }
    const idString = `${newTransactionData.date}-${newTransactionData.description}-${newTransactionData.amount}-${Date.now()}`;
    const id = await sha1(idString);
    const newTransaction: CashData = { ...newTransactionData, id };
    try {
      const cashCollectionRef = collection(firestore, 'users', user.uid, 'cashTransactions');
      await setDoc(doc(cashCollectionRef, newTransaction.id), { ...newTransaction, createdAt: serverTimestamp() });
      toast({ title: '成功', description: '現金交易已新增' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將資料儲存到資料庫。" });
    }
  }, [user, firestore, toast]);

  const handleAddMaintenanceRecord = useCallback(async (newRecordData: Omit<MaintenanceRecord, 'id'>) => {
    if (!user || !firestore) { toast({ variant: 'destructive', title: '錯誤', description: '請先登入' }); return; }
    const idString = `${newRecordData.date}-${newRecordData.location}-${newRecordData.item}-${newRecordData.amount}-${Date.now()}`;
    const id = await sha1(idString);
    const newRecord: MaintenanceRecord = { ...newRecordData, id };
    try {
      const maintenanceCollectionRef = collection(firestore, 'users', user.uid, 'maintenanceRecords');
      // 移除值為 undefined 的欄位，防止 Firestore 寫入崩潰
      const cleanRecord = Object.fromEntries(
        Object.entries({ ...newRecord, createdAt: serverTimestamp() }).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(maintenanceCollectionRef, newRecord.id), cleanRecord);
      toast({ title: '成功', description: '維修紀錄已新增' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將資料儲存到資料庫。" });
    }
  }, [user, firestore, toast]);

  const handleDeleteMaintenanceRecord = useCallback(async (id: string) => {
    if (!user || !firestore) return;
    const recordToDelete = maintenanceRecords.find(r => r.id === id);
    setMaintenanceRecords(prev => prev.filter(item => item.id !== id));
    try {
      if (recordToDelete && recordToDelete.photos) {
        const storage = getStorage();
        for (const photoUrl of recordToDelete.photos) {
          if (photoUrl.startsWith('https://firebasestorage.googleapis.com')) {
            try {
              const fileRef = storageRef(storage, photoUrl);
              await deleteObject(fileRef);
            } catch (err) {
              console.error("Failed to delete storage file:", err);
            }
          }
        }
      }
      await deleteDoc(doc(firestore, 'users', user.uid, 'maintenanceRecords', id));
      toast({ title: '成功', description: '維修紀錄已刪除' });
    } catch (error) {
      toast({ variant: "destructive", title: "刪除失敗", description: `無法從資料庫中刪除此筆紀錄。` });
    }
  }, [user, firestore, toast, maintenanceRecords]);

  const handleUpdateMaintenanceRecord = useCallback(async (id: string, updatedRecordData: Partial<Omit<MaintenanceRecord, 'id'>>) => {
    if (!user || !firestore) return;
    setMaintenanceRecords(prev => prev.map(item => item.id === id ? { ...item, ...updatedRecordData } : item));
    try {
      const cleanData = Object.fromEntries(
        Object.entries(updatedRecordData).filter(([_, v]) => v !== undefined)
      );
      await updateDoc(doc(firestore, 'users', user.uid, 'maintenanceRecords', id), cleanData);
      toast({ title: '成功', description: '維修紀錄已更新' });
    } catch (error) {
      toast({ variant: "destructive", title: "更新失敗", description: `無法更新此筆紀錄。` });
    }
  }, [user, firestore, toast]);

  const handleDeleteAllData = useCallback(async () => {
    if (!user || !firestore) { toast({ variant: 'destructive', title: '錯誤', description: '請先登入' }); return; }
    setIsLoading(true);
    try {
      const batch = writeBatch(firestore);
      for (const collectionName of ['creditCardTransactions', 'depositAccountTransactions', 'cashTransactions']) {
        const snapshot = await getDocs(query(collection(firestore, 'users', user.uid, collectionName)));
        snapshot.forEach(doc => batch.delete(doc.ref));
      }
      await batch.commit();
      setCreditData([]); setDepositData([]); setCashData([]);
      toast({ title: '成功', description: '您的所有交易資料已被刪除。' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '刪除失敗', description: e.message || '刪除所有資料時發生錯誤。' });
    } finally {
      setIsLoading(false);
    }
  }, [user, firestore, toast]);

  const handleUpdateTransaction = useCallback(async (id: string, field: keyof any, value: string | number, type: 'credit' | 'deposit' | 'cash') => {
    if (!user || !firestore) return;
    const collectionNameMap = { credit: 'creditCardTransactions', deposit: 'depositAccountTransactions', cash: 'cashTransactions' };
    const setterMap = { credit: setCreditData, deposit: setDepositData, cash: setCashData };

    (setterMap[type] as React.Dispatch<React.SetStateAction<any[]>>)(prev => {
      const transaction = prev.find(item => item.id === id);
      if (field === 'category' && typeof value === 'string' && value !== '未分類' && transaction && transaction.category === '未分類') {
        handleAutoAddCategoryRule(transaction.description, value);
      }
      return prev.map(item => item.id === id ? { ...item, [field]: value } : item);
    });

    try {
      await updateDoc(doc(firestore, 'users', user.uid, collectionNameMap[type], id), { [field]: value });
    } catch (error) {
      toast({ variant: "destructive", title: "更新失敗", description: `無法將變更儲存到資料庫。` });
    }
  }, [user, firestore, toast, handleAutoAddCategoryRule]);

  const handleDeleteTransaction = useCallback(async (id: string, type: 'credit' | 'deposit' | 'cash') => {
    if (!user || !firestore) return;
    const collectionNameMap = { credit: 'creditCardTransactions', deposit: 'depositAccountTransactions', cash: 'cashTransactions' };
    const setterMap = { credit: setCreditData, deposit: setDepositData, cash: setCashData };
    (setterMap[type] as React.Dispatch<React.SetStateAction<any[]>>)(prev => prev.filter(item => item.id !== id));
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, collectionNameMap[type], id));
    } catch (error) {
      toast({ variant: "destructive", title: "刪除失敗", description: `無法從資料庫中刪除此筆交易。` });
    }
  }, [user, firestore, toast]);

  const isLoadingData = isLoadingCredit || isLoadingDeposit || isLoadingCash || isLoadingMaintenance || (user && isLoadingSettings);

  const combinedData: CombinedData[] = useMemo(() => {
    const parseDateSafe = (dateString: string): Date => {
      const now = new Date();
      if (!dateString) return now;

      try {
        const d = parse(dateString, 'yyyy/MM/dd', now);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return d;
      } catch (e) { }

      try {
        const d = parse(dateString, 'MM/dd', now);
        if (!isNaN(d.getTime())) return d;
      } catch (e) { }

      return now;
    };

    const combined: CombinedData[] = [];

    const mapData = (data: any[], source: CombinedData['source'], dateKey: string) => {
      data.forEach(d => {
        const displayDate = dateKey === 'transactionDate' ? getCreditDisplayDate(d[dateKey]) : d[dateKey];
        const dateObj = parseDateSafe(displayDate);
        combined.push({ ...d, date: displayDate, dateObj, source });
      });
    };

    mapData(creditData, '信用卡', 'transactionDate');
    mapData(depositData, '活存帳戶', 'date');
    mapData(cashData, '現金', 'date');

    return combined;
  }, [creditData, depositData, cashData]);

  const hasData = useMemo(() => combinedData.length > 0, [combinedData]);
  const hasFixedItems = useMemo(() => combinedData.some(d => d.category === '固定'), [combinedData]);

  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (!isLoadingData && hasData && isFirstLoadRef.current) {
      setActiveTab((currentTab) =>
        currentTab === "importer" ? "results" : currentTab
      );
      isFirstLoadRef.current = false;
    }
  }, [isLoadingData, hasData]);


  const showResults = hasProcessed || (!isUserLoading && hasData && !isLoadingData);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-3 md:flex md:w-auto h-auto w-full p-0.5 bg-muted rounded-xl gap-0.5 mb-1.5 relative z-50 border border-slate-200">
        <TabsTrigger value="importer" className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm">
          <ClipboardCopy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">貼上報表</span>
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm">
          <Settings className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">規則設定</span>
        </TabsTrigger>
        <TabsTrigger value="results" className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">處理結果</span>
        </TabsTrigger>
        <TabsTrigger value="analysis" disabled={!combinedData.some(d => d.category === '固定' || d.category === '收入')} className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm">
          <BarChart2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">詳細分析</span>
        </TabsTrigger>
        <TabsTrigger value="balances" disabled={!hasData} className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm">
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">專款餘額</span>
        </TabsTrigger>
        <TabsTrigger value="stock-radar" className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm text-cyan-600 font-bold data-[state=active]:text-cyan-700 data-[state=active]:bg-cyan-50">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">股市雷達</span>
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs md:text-sm text-slate-700 font-bold data-[state=active]:text-primary">
          <Wrench className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">維修紀錄</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="importer" className="mt-4">
        <StatementImporter isProcessing={isLoading} onProcess={handleProcessAndSave} user={user} />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        {isLoadingData && user ? (
          <div className="space-y-4 pt-4">
            <Card><CardHeader><Skeleton className="h-8 w-48 rounded-md" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-48 w-full rounded-md" /></CardContent></Card>
          </div>
        ) : (
          <SettingsManager
            onDeleteAllData={handleDeleteAllData}
            onSaveSettings={handleSaveSettings}
            isProcessing={isLoading}
            user={user}
            settings={settings}
            setSettings={setSettings}
          />
        )}
      </TabsContent>
      <TabsContent value="results" className="mt-4">
        {(isLoading || showResults) ? (
          <ResultsDisplay
            creditData={creditData}
            depositData={depositData}
            cashData={cashData}
            settings={settings}
            onAddCashTransaction={handleAddCashTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            hasProcessed={hasProcessed}
            user={user}
            maintenanceRecords={maintenanceRecords}
            onAddMaintenanceRecord={handleAddMaintenanceRecord}
          />
        ) : (isLoadingData && !hasData) ? (
          <div className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-48 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4"><Skeleton className="h-10 w-24 rounded-md" /><Skeleton className="h-10 w-24 rounded-md" /></div>
                <div><Skeleton className="h-48 w-full rounded-md" /></div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Text className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">沒有可顯示的資料</h3>
                <p className="mt-2 text-sm text-muted-foreground">請先到「貼上報表」分頁處理您的銀行資料。</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="analysis" className="mt-4">
        {isLoadingData ? (
          <div className="space-y-4 pt-4">
            <Card><CardHeader><Skeleton className="h-8 w-48 rounded-md" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-48 w-full rounded-md" /></CardContent></Card>
          </div>
        ) : showResults && (combinedData.some(d => d.category === '固定' || d.category === '收入')) ? (
          <FixedItemsSummary combinedData={combinedData} settings={settings} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Text className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">沒有可顯示的分析資料</h3>
                <p className="mt-2 text-sm text-muted-foreground">請先處理您的銀行資料，並確保有「固定」或「收入」分類的項目。</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="balances" className="mt-4">
        {isLoadingData ? (
          <div className="space-y-4 pt-4">
            <Card><CardHeader><Skeleton className="h-8 w-48 rounded-md" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-48 w-full rounded-md" /></CardContent></Card>
          </div>
        ) : (showResults && hasData) ? (
          <BalanceTracker transactions={combinedData} balanceAccounts={settings.balanceAccounts || []} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">沒有可顯示的餘額資料</h3>
                <p className="mt-2 text-sm text-muted-foreground">請先處理您的銀行資料，或在「規則設定」中設定餘額帳戶。</p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="maintenance" className="mt-4">
        {isLoadingData && user ? (
          <div className="space-y-4 pt-4">
            <Card><CardHeader><Skeleton className="h-8 w-48 rounded-md" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-48 w-full rounded-md" /></CardContent></Card>
          </div>
        ) : (
          <MaintenanceManager
            records={maintenanceRecords}
            onAddRecord={handleAddMaintenanceRecord}
            onDeleteRecord={handleDeleteMaintenanceRecord}
            onUpdateRecord={handleUpdateMaintenanceRecord}
            user={user}
            isProcessing={isLoading}
          />
        )}
      </TabsContent>
      <TabsContent value="stock-radar" className="mt-1 pt-0 outline-none overflow-hidden">
        {/* 子導航選單 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1 bg-slate-100/50 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setRadarView('overview')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              戰略總覽
            </button>
            <button
              onClick={() => setRadarView('tsmc')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'tsmc' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              台積電監控
            </button>
            <button
              onClick={() => setRadarView('portfolio')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'portfolio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              持倉實戰
            </button>
            <button
              onClick={() => setRadarView('tw50')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'tw50' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              機會掃描
            </button>
            <button
              onClick={() => setRadarView('alpha')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'alpha' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Alpha 實驗室
            </button>
            <button
              onClick={() => setRadarView('research')}
              className={`px-3 py-1.5 text-[10px] md:text-xs font-black rounded-xl transition-all ${radarView === 'research' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              歷史研究
            </button>
          </div>

          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="rounded-xl border-cyan-200 bg-cyan-50/30 text-cyan-700 hover:bg-cyan-100 font-bold transition-all shadow-sm"
          >
            {isSyncing ? <Clock className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-2 h-3.5 w-3.5" />}
            {isSyncing ? '同步中...' : '立即同步市場數據'}
          </Button>
        </div>
        {/* --- 市場快訊：動態訊號雷達 (取代陳舊警告) --- */}
        <div className="bg-indigo-50 border border-indigo-200/50 rounded-2xl overflow-hidden shadow-sm mb-8 transition-all hover:shadow-md">
          <button
            onClick={() => setIsWarningExpanded(!isWarningExpanded)}
            className="w-full flex items-center justify-between p-4 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-600 rounded-full animate-pulse">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h4 className="font-black text-indigo-900 text-sm">市場快訊：台股 50 即時買賣訊號掃描</h4>
                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">
                  目前訊號：{marketSummary?.buyCount || 0} 家推薦佈局 | {marketSummary?.sellCount || 0} 家超漲警戒
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">點擊查看建議</span>
              <ArrowDown className={`h-4 w-4 text-indigo-400 transition-transform duration-300 ${isWarningExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isWarningExpanded && (
            <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-indigo-100">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-black text-emerald-600 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1 h-1 bg-emerald-500 rounded-full"></div> 推薦進場標的 (大數據冰點)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {marketSummary?.topBuys && marketSummary.topBuys.length > 0 ? (
                        marketSummary.topBuys.map((item, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg border border-emerald-200 transition-all hover:bg-emerald-200 flex items-center gap-2">
                              {item.name} <span className="text-emerald-600 opacity-70 font-mono">${item.price}</span>
                              {item.vol > 35 && <span className="p-0.5 bg-rose-500 rounded-sm text-[8px] text-white leading-none">HIGH VOL</span>}
                            </span>
                            <span className="text-[8px] text-slate-400 pl-1 flex justify-between">
                              <span>{item.price > 100 ? '需零股/單張10w+' : '可買整股/10w有找'}</span>
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 font-bold italic">目前無強烈買進訊號</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-black text-rose-600 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                      <div className="w-1 h-1 bg-rose-500 rounded-full"></div> 建議減碼標的 (指標過熱)
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
                      {marketSummary?.topSells && marketSummary.topSells.length > 0 ? (
                        marketSummary.topSells.map((item, i) => (
                          <span key={i} className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg border border-rose-200 transition-all hover:bg-rose-200 flex items-center gap-2">
                            {item.name} <span className="text-rose-600 opacity-70 font-mono">${item.price}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 font-bold italic">目前無強烈賣出訊號</span>
                      )}
                    </div>
                  </div>

                  {/* 波動率排名區塊 */}
                  <div className="p-3 bg-white/40 rounded-xl border border-indigo-100/50">
                    <div className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-widest">
                      🏃‍♂️ 高動能標的 (今日活躍)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {marketSummary?.hotPicks?.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                          <span>{p.name}</span>
                          <span className="px-1 py-0.5 bg-slate-200 rounded text-[8px]">{p.vol}% 變動</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 10 萬預算戰略提示 */}
              <div className="mt-4 p-3 bg-white/60 border border-indigo-100 rounded-xl">
                <div className="text-[10px] font-black text-indigo-900 mb-1 flex items-center gap-1">
                  💡 持倉深度診斷：為什麼中租不動？
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  **中租-KY** 屬於「低波動防禦股」，特性是跟漲不跟跌，在盤整期會顯得非常安靜。目前的 10 萬預算若要追求「心跳感」，應關注 **{marketSummary?.hotPicks?.[0]?.name}** 等高波動標的。
                  但建議：中租正在築底，不要在沒波動時殺出，等它回到 $110 獲利結案後，再拿 10 萬去博弈高動能標的。
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-indigo-100 flex justify-between items-center text-[9px] text-slate-400 font-medium italic">
                <span>* 訊號依據 J 值冰點與布林通道位階自動生成</span>
                <button onClick={() => setRadarView('tw50')} className="text-indigo-600 font-black hover:underline">查看完整機會掃描清單 →</button>
              </div>
            </div>
          )}
        </div>

        {/* --- 模式 1: 總覽 --- */}
        {radarView === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* 總覽數值橫條 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-white/70 backdrop-blur-md border border-slate-100 p-6 rounded-3xl shadow-sm">
              <div className="space-y-1">
                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-500" />
                  實戰總資產淨值
                </div>
                <div className="text-2xl font-black text-slate-800">
                  ${portfolioSummary.currentTotalValue.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  投入本金: ${portfolioSummary.totalInvested.toLocaleString()}
                </div>
              </div>

              <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  累積浮動損益
                </div>
                <div className={`text-2xl font-black ${portfolioSummary.totalPNL >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {portfolioSummary.totalPNL >= 0 ? '+' : ''}{portfolioSummary.totalPNL.toLocaleString()}
                </div>
                <div className={`text-[10px] font-bold ${portfolioSummary.totalPNL >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  投報率: {portfolioSummary.totalPNL >= 0 ? '+' : ''}{portfolioSummary.pnlPercent.toFixed(2)}%
                </div>
              </div>

              <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-500" />
                  數據庫更新時間
                </div>
                <div className="text-base font-black text-slate-700 mt-1">
                  {safeTimeStr(portfolioData?.last_updated)}
                </div>
                <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${cloudPortfolioData ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                  資料來源: {cloudPortfolioData ? '雲端即時同步' : '本地備援快取'}
                </div>
              </div>
            </div>

            {/* 雙欄內容 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* 左欄：當前實戰持股 (7 Columns) */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-slate-600" />
                    監控中的持股 ({portfolioData?.positions?.length || 0})
                  </h3>
                  <Button
                    onClick={() => {
                      setManualSymbol("");
                      setManualName("");
                      setNewAvgPrice("");
                      setNewShares("1000");
                      setSelectedRecStock({ s: "", n: "", p: 0, isManual: true });
                      setIsOpenAddDialog(true);
                    }}
                    className="h-8 px-3 text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl transition-all font-black flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" /> 新增持股監控
                  </Button>
                </div>

                {!portfolioData || !portfolioData.positions || portfolioData.positions.length === 0 ? (
                  <div className="bg-white/50 border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
                    <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <div className="text-slate-700 font-bold text-sm mb-1">目前無監控持股</div>
                    <p className="text-slate-400 text-[11px] max-w-sm mx-auto leading-relaxed">
                      尚未建立任何實戰持股。您可以參考右側「量化超賣推薦」標的，點擊加號一鍵加入監控。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {portfolioData.positions.map((pos: any, idx: number) => {
                      const hasJVal = pos.j_val !== undefined;
                      const hasBp = pos.bp !== undefined;
                      const isLoss = pos.pnl_value < 0;

                      return (
                        <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-md transition-all duration-300 relative group overflow-hidden">
                          {/* 右上角編輯按鈕 */}
                          <button
                            onClick={() => handleOpenEditDialog(pos)}
                            className="absolute top-4 right-10 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="調整持股成本/股數"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>

                          {/* 右上角刪除按鈕 */}
                          <button
                            onClick={() => handleDeletePosition(pos.symbol, pos.name)}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="移除此持股"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* 基本資訊與損益 */}
                            <div className="md:col-span-5 space-y-3">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-bold uppercase">
                                    持有中
                                  </span>
                                  <h4 className="font-black text-slate-800 text-base">{pos.name}</h4>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">{pos.symbol} • {(pos.shares || 1000).toLocaleString()} 股</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                                <div>
                                  <div className="text-[9px] text-slate-400">平均成本</div>
                                  <div className="text-xs font-black text-slate-700">${pos.avg_price}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] text-slate-400">當前現價</div>
                                  <div className="text-xs font-black text-slate-700">${pos.current_price}</div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                                <span className="text-[9px] text-slate-400">浮動損益</span>
                                <span className={`text-xs font-black ${isLoss ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isLoss ? '' : '+'}{pos.pnl_value.toLocaleString()} ({pos.pnl_percent}%)
                                </span>
                              </div>
                            </div>

                            {/* 技術指標與決策指令 */}
                            <div className="md:col-span-7 space-y-3.5 flex flex-col justify-between pt-2 md:pt-0 md:pl-4 md:border-l border-slate-50">
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                    <span>J 值 (目前: {hasJVal ? pos.j_val : '待同步'})</span>
                                    <span className={(pos.j_val || 0) < 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                      {(pos.j_val || 0) < 0 ? '超賣冰點' : '平穩區'}
                                    </span>
                                  </div>
                                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, ((pos.j_val || 0) + 20) * 0.8))}%` }}></div>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                    <span>布林通道 BP (目前: {hasBp ? pos.bp : '待同步'})</span>
                                    <span className={(pos.bp || 0.5) < 0.15 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                      {(pos.bp || 0.5) < 0.15 ? '下軌超賣' : '安全區'}
                                    </span>
                                  </div>
                                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, ((pos.bp || 0.5) + 0.5) * 60))}%` }}></div>
                                  </div>
                                </div>
                              </div>

                              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${(pos.j_val || 0) < 0 ? 'bg-rose-50/50 border-rose-100 text-rose-800' : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'}`}>
                                <div className="font-black flex items-center gap-1 mb-1 text-slate-800">
                                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
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
              </div>

              {/* 右欄：量化超賣推薦 (5 Columns) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-600" />
                    量化超賣推薦股票 ({recommendedStocks.length})
                  </h3>
                  <span title="自動篩選自台灣50成份股中，J值小於15且布林位階小於0.15的冰點超賣股票">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  </span>
                </div>

                {recommendedStocks.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 text-center text-slate-500 text-[11px] shadow-sm">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    目前大盤成分股中無符合超賣冰點之推薦標的。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendedStocks.map((stock: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl hover:shadow-sm transition-all duration-300 flex justify-between items-center gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 text-sm">{stock.n}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{stock.s}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">當前現價: <strong className="text-slate-800 font-black">${stock.p}</strong></div>
                          
                          <div className="flex gap-2 text-[9px] pt-1">
                            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              J值: {stock.j}
                            </span>
                            <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              布林位階: {stock.bp}
                            </span>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleOpenAddDialog(stock)}
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-700 rounded-xl p-2 shrink-0 h-8 w-8"
                          title="將此推薦股加入監控"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 心法卡片 */}
                <div className="bg-gradient-to-br from-indigo-50/70 to-slate-50/50 border border-indigo-100/50 p-6 rounded-3xl space-y-3 shadow-sm">
                  <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    量化選股核心思維
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    我們的主力策略在於 **「尋找別人恐慌時的黃金坑」**。
                    當一檔優質大盤成分股的 J 值觸及負值（或低於 15）且布林位階低於 0.15 時，代表其短線處於非理性極度超賣。歷史回測顯示，在此處逢低買入具有極高的反彈勝率。
                  </p>
                </div>
              </div>
            </div>

            {/* 戰略提示：守護利潤的紀律 */}
            <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-start gap-4 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-black text-blue-900 mb-1 text-sm">戰略提示：守護利潤的紀律</h4>
                <p className="text-xs text-blue-800/80 leading-relaxed font-medium">
                  目前的市場呈現出「核心持股穩健、業外短套」的局面。台積電風險係數健康，可以安心持有。中租目前的 J 軸冰點是系統贈與的低價獲利空間，切勿在此區域交出珍貴籌碼。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- 模式 2: 台積電詳情 --- */}
        {radarView === 'tsmc' && tsmcData && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-8">
            {/* 來源與時間標注 */}
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${cloudTsmcData ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {cloudTsmcData ? '☁️ 雲端即時' : '💾 本地快取'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">報價時間: {safeTimeStr(tsmcData?.last_update)}</span>
              <span className="text-[10px] text-slate-300">• 來源: {cloudTsmcData ? 'Firestore Realtime' : 'Local JSON'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row items-center gap-10">
                <div className="relative w-32 h-32 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle className="text-slate-100 stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent" />
                    <circle className="text-emerald-500 stroke-current transition-all duration-1000" strokeWidth="10" strokeDasharray={`${(tsmcData?.risk_score ?? 0) * 2.51} 251`} strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-800">{tsmcData?.risk_score ?? '--'}</span>
                    <span className="text-[8px] font-black text-slate-400">風險值</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className={`text-xs font-black px-2 py-0.5 rounded-full w-fit ${tsmcData?.risk_score < 30 ? 'text-emerald-600 bg-emerald-50' :
                    tsmcData?.risk_score < 70 ? 'text-amber-600 bg-amber-50' :
                      'text-rose-600 bg-rose-50'
                    }`}>
                    {tsmcData?.risk_score < 30 ? '目前位階極低' : (tsmcData?.risk_score < 70 ? '盤中盤整區域' : '極端過熱警戒')}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">
                    AI 策略建議：{
                      tsmcData?.risk_score < 30 ? '適宜佈局' :
                        tsmcData?.risk_score < 70 ? '中性觀望' :
                          '風險過熱 / 暫不追高'
                    }
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span>現價: ${tsmcData?.price ?? '--'} | 年線乖離率: {tsmcData?.bias ?? '--'}%</span>
                    <span className="bg-slate-50 px-2 py-0.5 rounded text-slate-400">
                      Sync: {safeTimeStr(tsmcData?.last_update)}
                    </span>
                  </p>
                </div>
              </div>
              <Card className="border-slate-200">
                <CardHeader className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">技術面細節</CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-600">J 值 (低位鈍化)</span>
                    <span className="text-lg font-black text-emerald-600">{tsmcData.j_val}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-600">布林位階 BP</span>
                    <span className="text-lg font-black text-slate-800">{tsmcData.bp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">VR 恐慌倍數</span>
                    <span className="text-lg font-black text-slate-800">{tsmcData.vr}x</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* --- 模式 3: 個人持倉詳情 --- */}
        {radarView === 'portfolio' && portfolioData && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-8">
            {/* 實戰持股頂部 Header 與手動新增入口 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800">實戰持股詳情</h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${cloudPortfolioData ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {cloudPortfolioData ? '☁️ 雲端即時' : '💾 本地快取'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">更新時間: {safeTimeStr(portfolioData?.last_updated)}</span>
                  <span className="text-[10px] text-slate-300">• 來源: {cloudPortfolioData ? 'Firestore Realtime' : 'Local JSON'}</span>
                </div>
              </div>
              <Button
                onClick={() => {
                  setManualSymbol("");
                  setManualName("");
                  setSelectedRecStock({ s: "", n: "", p: 0, isManual: true });
                  setIsOpenAddDialog(true);
                }}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100"
              >
                <Plus className="w-4 h-4 text-white" /> 手動新增持股監控
              </Button>
            </div>

            {portfolioData.positions.length === 0 ? (
              <div className="bg-white/50 border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
                <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <div className="text-slate-700 font-bold text-sm mb-1">目前無監控持股</div>
                <p className="text-slate-400 text-[11px] max-w-sm mx-auto leading-relaxed">
                  尚未建立任何實戰持股。您可以點擊上方「手動新增持股監控」或參考其他分頁之標的一鍵加入。
                </p>
              </div>
            ) : portfolioData.positions.map((pos: any, i: number) => (
              <div key={i} className="p-8 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-8">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                      <UserCheck className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-800">{pos.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 font-bold uppercase">
                          買入成本: ${pos.avg_price} | 持有 {(pos.shares || 1000).toLocaleString()} 股
                        </p>
                        <button
                          onClick={() => handleOpenEditDialog(pos)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                          title="調整持股成本/股數"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePosition(pos.symbol, pos.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all"
                          title="刪除此持股監控"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase">現價</div>
                    <div className="text-3xl font-black text-slate-800">${pos.current_price}</div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${pos.pnl_value >= 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {pos.pnl_value >= 0 ? '+' : ''}{pos.pnl_value.toLocaleString()} ({pos.pnl_percent}%)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8 pb-4">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">實時行情指標</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">J 指標 (中位)</div>
                        <div className="text-xl font-black text-slate-800">{pos.j_val}</div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">布林位階 BP</div>
                        <div className="text-xl font-black text-slate-800">{pos.bp}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI 行動決策</h4>
                    <div className={`p-6 rounded-2xl border flex items-start gap-4 ${pos.pnl_value >= 0 ? 'bg-rose-50/30 border-rose-100' : 'bg-emerald-50/30 border-emerald-100'}`}>
                      <AlertTriangle className={`w-6 h-6 shrink-0 ${pos.pnl_value >= 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
                      <div className={`text-sm leading-relaxed font-medium ${pos.pnl_value >= 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
                        目前的 J 值為 {pos.j_val}。系統指示：<span className="font-black underline">{pos.advice}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 模擬下單介面按鈕 (對照截圖：紅進綠出) */}
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => handleOpenTxDialog(pos, 'buy')}
                    className="flex-1 py-4 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95"
                  >
                    買進 (加碼)
                  </button>
                  <button 
                    onClick={() => handleOpenTxDialog(pos, 'sell')}
                    className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                  >
                    賣出 (減碼)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- 模式 4: TW50 機會掃描 --- */}
        {radarView === 'tw50' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-8">
            {/* 來源與時間標注 */}
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${cloudTw50Data ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {cloudTw50Data ? '☁️ 雲端即時' : '💾 本地快取'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                更新時間: {safeTimeStr(cloudTw50Data?.last_updated || cloudTw50Data?.updatedAt)}
              </span>
              <span className="text-[10px] text-slate-300">• 來源: {cloudTw50Data ? 'Firestore Realtime' : 'Local JSON / Fallback'}</span>
            </div>
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-800 mb-1">TW50 實戰機會監測</h3>
                <p className="text-xs text-slate-500 font-medium">基於 J 值、布林帶位階 (BP) 與新聞情勢之綜合判斷</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">掃描完畢</span>
                <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full">共 {tw50Data?.length || 0} 檔</span>
              </div>
            </header>

            {/* 篩選切換膠囊按鈕 */}
            <div className="flex gap-1 bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl w-fit border border-slate-200/50">
              <button
                onClick={() => setTw50Filter('opportunity')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  tw50Filter === 'opportunity'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                黃金機會 & 核心股
              </button>
              <button
                onClick={() => setTw50Filter('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  tw50Filter === 'all'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                全部 50 檔成份股
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(tw50Data && tw50Data.length > 0) ? (
                tw50Data
                  .filter((stock: any) => {
                    if (tw50Filter === 'opportunity') {
                      return stock?.st === 'BUY' || stock?.s === '2330.TW' || stock?.s === '2603.TW';
                    }
                    return true;
                  })
                  .map((stock: any, idx: number) => {
                    if (!stock) return null;
                    const isShipping = ['2603.TW', '2609.TW', '2615.TW'].includes(stock.s);
                    const isWeight = ['2330.TW', '2317.TW', '2454.TW'].includes(stock.s);

                    return (
                      <Card key={idx} className={`p-6 border-slate-200 shadow-sm hover:shadow-md transition-all ${
                        stock.st === 'BUY' ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10' : 
                        stock.st === 'SELL' ? 'border-l-4 border-l-rose-500 bg-rose-50/10' : ''
                      }`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xl font-black text-slate-800">{stock.n || nameMap[stock.s] || stock.s}</h4>
                              <span className="text-[10px] font-bold text-slate-400">({stock.s})</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {isWeight ? '電子權值龍頭' : isShipping ? '避險/航運板塊' : '技術轉機股'}
                            </p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            stock.st === 'BUY' ? 'bg-emerald-50 text-emerald-600' :
                            stock.st === 'SELL' ? 'bg-rose-50 text-rose-600' :
                            isShipping ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-50 text-slate-400'
                          }`}>
                            {stock.st === 'BUY' ? '機會凹洞區' : 
                             stock.st === 'SELL' ? '過熱警戒區' : 
                             isShipping ? '資金避風港' : '暫時觀望'}
                          </span>
                        </div>

                        <div className="flex items-end justify-between mb-4">
                          <div className="text-2xl font-black text-slate-800">${stock.p}</div>
                          <div className="text-right">
                            <div className="text-[8px] font-black text-slate-400 uppercase">J 指標</div>
                            <div className={`text-sm font-black ${stock.j < 20 ? 'text-emerald-500 animate-pulse' : 'text-slate-600'}`}>{stock.j}</div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-50">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-bold">布林位階 BP</span>
                            <span className="text-slate-700 font-black">{stock.bp}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                              <span className="font-black text-slate-700">判斷：</span>
                              {stock.analysis || (stock.s === '2330.TW' ? '受美伊新聞影響出現絕望性賣壓，J 值與 BP 顯示已進入長期價值區。' :
                                isShipping ? '受惠戰爭預期運價上漲，目前走勢與大盤背離，展現強勁防禦力。' :
                                  stock.st === 'BUY' ? '技術指標顯示已處於極度超跌，建議分批佈局。' :
                                  stock.st === 'SELL' ? '技術指標顯示短期已進入超買區，建議注意回檔風險或分批獲利了結。' :
                                    '股價處於中性整理，目前無顯著買入訊號，優先觀察電子權值動向。')}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
              ) : (tw50DataLocal === null || (isLoadingTw50 && !tw50Data)) ? (
                <div className="col-span-full py-20 text-center text-slate-400 font-bold">正在從雲端同步或載入本地數據...</div>
              ) : (
                <div className="col-span-full py-20 text-center text-slate-400 font-bold">目前市場中性，無顯著掃描機會。</div>
              )}
            </div>
          </div>
        )}

        {/* --- 模式 5: Alpha Factory 實驗室 --- */}
        {radarView === 'alpha' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-10 pb-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-black text-slate-800">Alpha Factory</h2>
                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-md">CORE ENGINE V2</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">基於波動壓縮 (Compression) 與 唐奇安突破 (Expansion) 的專業量化掃描器</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最後掃描時間</div>
                <div className="text-sm font-black text-slate-700">{safeTimeStr(alphaData?.updatedAt)}</div>
              </div>
            </header>

            {/* 1. Market Climate (市場氣候) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-1 border-slate-200">
                <CardHeader className="pb-4 border-b border-slate-50">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-rose-500" /> 市場氣候 (Market Climate)
                  </h4>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-black text-slate-700">全市場分佈 (Universe: {alphaData?.summary?.total_scanned})</span>
                    <span className={`text-base font-black ${alphaData?.market_state === 'Bull' ? 'text-rose-500' : 'text-slate-500'}`}>大盤: {alphaData?.market_state}</span>
                  </div>

                  <div className="space-y-4">
                    {['Bull', 'Bear', 'Sideways', 'High_Vol'].map((regime) => {
                      const count = alphaData?.regime_distribution?.[regime] || 0;
                      const total = alphaData?.summary?.total_scanned || 1;
                      const percent = Math.round((count / total) * 100);
                      const colorMap: any = { 'Bull': 'bg-rose-500', 'Bear': 'bg-emerald-500', 'Sideways': 'bg-slate-300', 'High_Vol': 'bg-amber-500' };

                      return (
                        <div key={regime} className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>{regime}</span>
                            <span>{percent}% ({count} 檔)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${colorMap[regime]} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 2. Alpha Signals (量化訊號) */}
              <Card className="lg:col-span-2 border-slate-200">
                <CardHeader className="pb-4 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> 今日強勢突破訊號 (Daily Signals)
                  </h4>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                    過濾剩餘: {alphaData?.signals?.length || 0} 檔
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">標的名稱</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">強度 (Score)</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">建議佔比</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">目前狀態</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(!alphaData?.signals || alphaData.signals.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold italic">
                              {isLoadingAlpha ? '正在同步雲端量化回報...' : '今日暫無符合「強勢突破」之訊號 (Regime Gate 生效中)'}
                            </td>
                          </tr>
                        ) : (
                          alphaData.signals.map((sig: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                                    {sig.symbol.split('.')[0]}
                                  </div>
                                  <div>
                                    <div className="text-sm font-black text-slate-800">{nameMap[sig.symbol] || sig.symbol}</div>
                                    <div className="text-[10px] text-slate-400 font-bold">${sig.price_est}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                                  {sig.score.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                {sig.pos_ratio}%
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600">
                                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                  READY TO ENTRY
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2.5 下單執行層 (Execution Layer) */}
            {alphaData?.orders && alphaData.orders.length > 0 && (
              <Card className="border-slate-800 bg-slate-900 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
                <CardHeader className="bg-slate-800/50 p-6 flex flex-row items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500 rounded-lg shadow-lg shadow-rose-500/20">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-widest uppercase">執行層：明日開盤掛單指令 (Execution Layer)</h4>
                      <p className="text-[10px] text-slate-400 font-bold">由 Portfolio Engine 自動生成，建議於 09:00 前預掛單</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">標的</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">方向</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">執行股數</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">執行類型</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">止損價格</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">策略基因 (Metadata)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {alphaData.orders.map((order: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-5">
                              <span className="text-sm font-black text-white">{nameMap[order.symbol] || order.symbol}</span>
                            </td>
                            <td className="px-6 py-5">
                              <span className="px-2 py-1 bg-rose-500/20 text-rose-500 text-[10px] font-black rounded border border-rose-500/30">{order.side}</span>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-lg font-black text-white">{order.shares?.toLocaleString()}</span>
                              <span className="text-[10px] text-slate-500 ml-1 font-bold">SHARES</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-300">Next Day Open</span>
                                <span className="text-[9px] text-slate-500 leading-tight">台股避免漲跌停滑價、最優流動性選擇</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-sm font-black text-emerald-400">${order.stop_price?.toFixed(1)}</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-wrap gap-2">
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded border border-slate-700">SCORE: {order.journal_metadata?.score?.toFixed(1)}</span>
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded border border-slate-700">ADX: {order.journal_metadata?.adx?.toFixed(1)}</span>
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded border border-slate-700 uppercase">{order.journal_metadata?.regime}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. 戰略提示與風險摘要 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-rose-500" />
                  <h4 className="font-black text-sm uppercase tracking-widest">Portfolio Risk Engine</h4>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">最大持倉上限</div>
                    <div className="text-xl font-black">20.0% <span className="text-[10px] text-slate-400">/ POSITION</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">風險承擔系數</div>
                    <div className="text-xl font-black">1.0% <span className="text-[10px] text-emerald-400">FIXED</span></div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium pt-2 border-t border-slate-800">
                  系統採用 Volatility Targeting 技術，股數根據最近 14 日 ATR 動態調整。當市場處於 『Bear』 或 『Sideways』 時，引擎會自動熔斷以保護資本。
                </p>
              </div>

              <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-black text-amber-900 text-sm uppercase tracking-widest">量化交易提示</h4>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  目前的 Alpha 指標顯示全市場多頭動能約為 {Math.round(((alphaData?.regime_distribution?.Bull || 0) / (alphaData?.summary?.total_scanned || 1)) * 100)}%。<br />
                  <span className="font-black underline">操作紀律：</span> 若標的可選數量過多，請優先選擇強度 (Score) 指標最高的板塊，並確保單一板塊不超過 2 檔持倉。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- 模式 6: 歷史研究報告 --- */}
        {radarView === 'research' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-10 pb-10">
            <header className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-3xl font-black text-slate-800">台積電實戰紀錄匯報</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                這是一份剔除所有感性文字的極致理性紀錄表。所有價格均為當時「未經還原」的真實報價。
              </p>
            </header>

            {/* 新增：2025 實戰回測入口 */}
            <div
              onClick={() => window.location.href = '/analysis/backtest'}
              className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 text-white relative overflow-hidden group cursor-pointer shadow-xl shadow-indigo-200 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl -z-10 group-hover:bg-white/20 transition-all"></div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-200" />
                    <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">實戰模擬</span>
                  </div>
                  <h3 className="text-2xl font-black italic">2025 年度：士電、鴻海 10 萬回測報告</h3>
                  <p className="text-indigo-100/70 text-sm font-medium max-w-sm">
                    針對高動能標的，系統在 2025 年一整年的進出場績效統計。內含交易明細與損益曲線。
                  </p>
                </div>
                <div className="px-6 py-3 bg-white text-indigo-700 font-black rounded-2xl shadow-lg flex items-center gap-2">
                  立即檢視報告 <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-12">
              {wavesAll.map((yearGroup, yIdx) => (
                <div key={yIdx} className="space-y-6">
                  <h3 className="text-xl font-black text-cyan-600 border-l-4 border-cyan-500 pl-4">{yearGroup.year}</h3>
                  <div className="space-y-6">
                    {yearGroup.waves.map((wave, wIdx) => (
                      <div key={wIdx} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-cyan-600" />
                            <span className="font-black text-slate-800">{wave.name}</span>
                          </div>
                          <div className="px-3 py-1 bg-emerald-50 text-emerald-600 font-black text-xs rounded-full">{wave.profit}</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white">
                          <div className="p-8 space-y-4">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black p-1 bg-emerald-50 text-emerald-600 rounded">進場 BUY</span>
                              <div className="text-right">
                                <div className="text-xs font-bold text-slate-400">{wave.buy.date}</div>
                                <div className="text-2xl font-black text-slate-800">{wave.buy.price}</div>
                              </div>
                            </div>
                            <ul className="space-y-1">
                              {wave.buy.reasons.map((r, i) => (
                                <li key={i} className="text-xs text-slate-500 font-medium">✓ {r}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-8 space-y-4">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black p-1 bg-rose-50 text-rose-600 rounded">了結 SELL</span>
                              <div className="text-right">
                                <div className="text-xs font-bold text-slate-400">{wave.sell.date}</div>
                                <div className="text-2xl font-black text-slate-800">{wave.sell.price}</div>
                              </div>
                            </div>
                            <ul className="space-y-1">
                              {wave.sell.reasons.map((r, i) => (
                                <li key={i} className="text-xs text-slate-500 font-medium">✗ {r}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 戰略總結區 */}
              <div className="p-8 bg-amber-50/50 border border-amber-100 rounded-3xl flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-amber-600 mt-1 shrink-0" />
                <div>
                  <h4 className="font-black text-amber-900 mb-2">歷史教訓：乖離率是最大的敵人</h4>
                  <p className="text-sm text-amber-800/70 leading-relaxed font-medium">
                    回顧過去四年的波段，絕大多數的「大回撤」都發生在年線乖離率超過 50% 的時候。保持冷靜，不在沸騰時加入，只在冰點時進場。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
      {/* 一鍵加入實戰對話框 */}
      <Dialog open={isOpenAddDialog} onOpenChange={setIsOpenAddDialog}>
        <DialogContent className="sm:max-w-[400px] bg-white border border-slate-200 text-slate-800 rounded-3xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              {selectedRecStock?.isManual ? "新增自訂持股監控" : "加入持股監控"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold">
              {selectedRecStock?.isManual 
                ? "請手動輸入股票代號（例如 2330）與持有明細，同步後系統將自動抓取股價。"
                : <span>正在將 <strong className="text-slate-800">{selectedRecStock?.n || (selectedRecStock && nameMap[selectedRecStock.s]) || selectedRecStock?.s}</strong> 加入您的持股清單，請設定您的買入明細。</span>
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPositionSubmit} className="space-y-4 py-2">
            <div className="space-y-3 text-xs font-bold text-slate-600">
              {selectedRecStock?.isManual && (
                <>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label htmlFor="dialog_symbol" className="text-right">
                      股票代號 <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="dialog_symbol"
                      type="text"
                      placeholder="例如 2330 或 2330.TW"
                      value={manualSymbol}
                      onChange={(e) => setManualSymbol(e.target.value)}
                      className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label htmlFor="dialog_name" className="text-right">
                      股票名稱
                    </Label>
                    <Input
                      id="dialog_name"
                      type="text"
                      placeholder="例如 台積電 (選填)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="dialog_price" className="text-right">
                  買入成本 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="dialog_price"
                  type="number"
                  step="0.01"
                  placeholder="買入單價"
                  value={newAvgPrice}
                  onChange={(e) => setNewAvgPrice(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="dialog_shares" className="text-right">
                  持有股數
                </Label>
                <Input
                  id="dialog_shares"
                  type="number"
                  placeholder="1000"
                  value={newShares}
                  onChange={(e) => setNewShares(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
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
                className="text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50"
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black px-6 rounded-xl transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? "正在儲存..." : "確認加入監控"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 調整持股對話框 */}
      <Dialog open={isOpenEditDialog} onOpenChange={setIsOpenEditDialog}>
        <DialogContent className="sm:max-w-[400px] bg-white border border-slate-200 text-slate-800 rounded-3xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              調整持股資訊
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold">
              調整 <strong className="text-slate-800">{selectedEditStock?.name} ({selectedEditStock?.symbol})</strong> 的買入均價與持有股數。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPositionSubmit} className="space-y-4 py-2">
            <div className="space-y-3 text-xs font-bold text-slate-600">
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="edit_price" className="text-right">
                  買入成本 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="edit_price"
                  type="number"
                  step="0.01"
                  value={editAvgPrice}
                  onChange={(e) => setEditAvgPrice(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="edit_shares" className="text-right">
                  持有股數
                </Label>
                <Input
                  id="edit_shares"
                  type="number"
                  value={editShares}
                  onChange={(e) => setEditShares(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpenEditDialog(false);
                  setSelectedEditStock(null);
                }}
                className="text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50"
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 rounded-xl transition-all"
                disabled={isSubmitting}
              >
                確認調整
              </Button>
              {/* 新增刪除按鈕，提供完整的調整彈性 */}
              <Button
                type="button"
                onClick={() => {
                  if (selectedEditStock) {
                    handleDeletePosition(selectedEditStock.symbol, selectedEditStock.name);
                    setIsOpenEditDialog(false);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 rounded-xl transition-all"
              >
                刪除監控
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 買進加碼 / 賣出減碼對話框 */}
      <Dialog open={isOpenTxDialog} onOpenChange={setIsOpenTxDialog}>
        <DialogContent className="sm:max-w-[420px] bg-white border border-slate-200 text-slate-800 rounded-3xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
              {txType === 'buy' ? (
                <>
                  <TrendingUp className="w-5 h-5 text-rose-500" />
                  <span>買進加碼 - {txStock?.name}</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-emerald-500" />
                  <span>賣出減碼 - {txStock?.name}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-bold">
              輸入本次交易的單價與股數，系統將自動計算最新的持股權重或損益。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTxSubmit} className="space-y-4 py-2">
            <div className="space-y-4 text-xs font-bold text-slate-600">
              {/* 交易單價 */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="tx_price" className="text-right">
                  交易單價 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="tx_price"
                  type="number"
                  step="0.01"
                  value={txPrice}
                  onChange={(e) => setTxPrice(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                  required
                />
              </div>

              {/* 交易股數 */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="tx_shares" className="text-right">
                  交易股數 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="tx_shares"
                  type="number"
                  placeholder="例如 1000"
                  value={txShares}
                  onChange={(e) => setTxShares(e.target.value)}
                  className="col-span-3 border-slate-200 rounded-xl focus:border-cyan-500 text-slate-800"
                  required
                />
              </div>

              {/* 即時動態計算與預覽視覺區 */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">即時試算預覽</div>
                {txStock && (
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span>當前持有股數:</span>
                      <span className="font-extrabold">{(txStock.shares || 1000).toLocaleString()} 股</span>
                    </div>
                    <div className="flex justify-between">
                      <span>當前平均成本:</span>
                      <span className="font-extrabold">${txStock.avg_price}</span>
                    </div>
                    
                    {txType === 'buy' ? (
                      <>
                        <div className="border-t border-dashed border-slate-200 my-2 pt-2 flex justify-between items-center">
                          <span className="text-rose-600">加碼後總股數:</span>
                          <span className="text-rose-600 font-extrabold">
                            {((txStock.shares || 1000) + (parseInt(txShares) || 0)).toLocaleString()} 股
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-rose-600 font-black">加碼後平均成本:</span>
                          <span className="text-rose-600 font-black text-lg">
                            ${(() => {
                              const origPrice = txStock.avg_price || 0;
                              const origShares = txStock.shares || 1000;
                              const pPrice = parseFloat(txPrice) || 0;
                              const pShares = parseInt(txShares) || 0;
                              if (pShares <= 0) return origPrice;
                              const totalCost = origPrice * origShares + pPrice * pShares;
                              const totalShares = origShares + pShares;
                              return Math.round((totalCost / totalShares) * 100) / 100;
                            })()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="border-t border-dashed border-slate-200 my-2 pt-2 flex justify-between items-center">
                          <span className="text-emerald-600">減碼後剩餘股數:</span>
                          <span className="text-emerald-600 font-extrabold">
                            {Math.max(0, (txStock.shares || 1000) - (parseInt(txShares) || 0)).toLocaleString()} 股
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-700 font-black">本次交易預估損益:</span>
                          <span className={`font-black text-lg ${
                            (() => {
                              const origPrice = txStock.avg_price || 0;
                              const pPrice = parseFloat(txPrice) || 0;
                              const pShares = parseInt(txShares) || 0;
                              return (pPrice - origPrice) * pShares;
                            })() >= 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {(() => {
                              const origPrice = txStock.avg_price || 0;
                              const pPrice = parseFloat(txPrice) || 0;
                              const pShares = parseInt(txShares) || 0;
                              const diff = (pPrice - origPrice) * pShares;
                              const formattedDiff = Math.round(diff).toLocaleString();
                              return diff >= 0 ? `+${formattedDiff}` : formattedDiff;
                            })()}
                          </span>
                        </div>

                        {/* 如果全部賣出，顯示警告 */}
                        {Math.max(0, (txStock.shares || 1000) - (parseInt(txShares) || 0)) === 0 && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                              剩餘持有股數將歸零。確認減碼後，系統將<strong>全數賣出並移出持股監控</strong>。
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 md:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpenTxDialog(false);
                  setTxStock(null);
                }}
                className="text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50"
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                className={`font-black px-6 rounded-xl transition-all ${
                  txType === 'buy' 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-100' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-100'
                }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "處理中..." : txType === 'buy' ? "確認加碼" : "確認減碼"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
