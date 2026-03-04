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

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text, Settings, ClipboardCopy, FileText, BarChart2, Wallet, TrendingUp, Target, Activity, History, Calendar, AlertTriangle, UserCheck, TrendingDown, Clock, ShieldCheck, ArrowLeft, ArrowDown } from 'lucide-react';
import { parse } from 'date-fns';
import { formatCurrency, formatSafeDate } from "@/lib/utils";
import { getCreditDisplayDate } from '@/lib/parser';

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
  const [radarView, setRadarView] = useState<'overview' | 'tsmc' | 'portfolio' | 'tw50' | 'research'>('overview');
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

  // 優先順序：雲端數據 > 本地 JSON 數據
  const tsmcData = cloudTsmcData || tsmcDataLocal;
  const portfolioData = cloudPortfolioData || portfolioDataLocal;
  const tw50Data = (cloudTw50Data?.stocks || (Array.isArray(cloudTw50Data) ? cloudTw50Data : null)) || tw50DataLocal;

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
  // --- 手動同步邏輯 ---
  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    if (!firestore || isSyncing) return;
    setIsSyncing(true);
    try {
      console.log("Triggering manual sync...");
      const syncRef = doc(firestore, 'marketSync', 'trigger');
      await setDoc(syncRef, {
        last_requested_at: serverTimestamp(),
        status: 'pending',
        requested_by: user?.uid || 'anonymous'
      });
      toast({
        title: "🔄 同步指令已發送",
        description: "雲端伺服器正在啟動更新，請稍候約 30 秒後重新整理。",
      });
    } catch (error) {
      console.error("Sync trigger error:", error);
      toast({
        title: "同步失敗",
        description: "無法發送指令至雲端伺服器。",
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

  const settingsDocRef = useMemoFirebase(() => user && firestore ? doc(firestore, 'users', user.uid, 'settings', 'user-settings') : null, [user, firestore]);
  const { data: savedSettings, isLoading: isLoadingSettings } = useDoc<AppSettings>(settingsDocRef);


  useEffect(() => { if (savedCreditTransactions) setCreditData(savedCreditTransactions); }, [savedCreditTransactions]);
  useEffect(() => { if (savedDepositTransactions) setDepositData(savedDepositTransactions); }, [savedDepositTransactions]);
  useEffect(() => { if (savedCashTransactions) setCashData(savedCashTransactions); }, [savedCashTransactions]);

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

  const isLoadingData = isLoadingCredit || isLoadingDeposit || isLoadingCash || (user && isLoadingSettings);

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

        <div className="mb-4 overflow-hidden bg-rose-50 border border-rose-100 rounded-2xl transition-all duration-300">
          <button
            onClick={() => setIsWarningExpanded(!isWarningExpanded)}
            className="w-full flex items-center justify-between p-4 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-rose-500 rounded-full">
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              </div>
              <h4 className="font-bold text-rose-900 text-sm">市場警告：美伊衝突重挫 (點擊查看)</h4>
            </div>
            <ArrowDown className={`h-4 w-4 text-rose-400 transition-transform duration-300 ${isWarningExpanded ? 'rotate-180' : ''}`} />
          </button>

          {isWarningExpanded && (
            <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-rose-200/50">
                <div className="text-xs text-rose-800/80 leading-relaxed space-y-1.5">
                  <p><strong>🚨 事件：</strong> 軍事衝突爆發，川普稱行動可能持續四周。</p>
                  <p><strong>📉 影響：</strong> 台股跌逾 800 點，台積電（2330）報 1950 元失守支撐。</p>
                </div>
                <div className="bg-white/50 p-3 rounded-xl border border-rose-200/50">
                  <div className="text-[10px] font-black text-rose-900 mb-2 uppercase tracking-wider">避險動態</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">航運：抗跌</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-full">電子：拋售</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- 模式 1: 總覽 --- */}
        {radarView === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setRadarView('tsmc')}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        TSMC 監測
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[8px] rounded-full border ${cloudTsmcData ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                          <span className={`w-1 h-1 rounded-full ${cloudTsmcData ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                          {cloudTsmcData ? 'Cloud Live' : 'Local Cache'}
                        </span>
                      </span>
                      <Activity className="w-3 h-3 text-cyan-500 group-hover:animate-pulse" />
                    </div>
                    <div className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">
                      Src: Yahoo Finance • 10m Sync
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">{tsmcData?.risk_score ?? '--'}%</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tsmcData?.risk_score < 30 ? 'bg-emerald-50 text-emerald-600' :
                      tsmcData?.risk_score < 70 ? 'bg-amber-50 text-amber-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                      {tsmcData?.risk_score < 30 ? '核心安全區' : (tsmcData?.risk_score < 70 ? '中性盤整期' : '極端警戒區')}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-white border-slate-200 shadow-sm hover:shadow-md transition-all border-l-4 cursor-pointer group ${portfolioData?.positions?.[0]?.pnl_value >= 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`} onClick={() => setRadarView('portfolio')}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        持倉動態 ({nameMap[portfolioData?.positions?.[0]?.symbol] || portfolioData?.positions?.[0]?.name || portfolioData?.positions?.[0]?.symbol || '--'})
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[8px] rounded-full border ${cloudPortfolioData ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border-amber-500/20'}`}>
                          {cloudPortfolioData ? 'Cloud live' : 'Local file'}
                        </span>
                      </span>
                      <Target className="w-3 h-3 text-indigo-500" />
                    </div>
                    <div className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">
                      Updated: {safeTimeStr(portfolioData?.last_updated)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">${portfolioData?.positions?.[0]?.current_price || '--'}</span>
                    <span className={`text-[10px] font-black tracking-tighter animate-pulse ${portfolioData?.positions?.[0]?.pnl_value >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {portfolioData?.positions?.[0]?.pnl_value >= 0 ? '獲利中 +' : '盤整中 '}{portfolioData?.positions?.[0]?.pnl_percent}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setRadarView('tw50')}>
                <CardHeader className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">明日行情預測</CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {tw50Data?.find((s: any) => s.st === 'BUY')?.s === '2603.TW' ? '航海王：長榮' :
                        tw50Data?.find((s: any) => s.st === 'BUY')?.s === '5871.TW' ? '中租 5871' :
                          tw50Data?.find((s: any) => s.st === 'BUY')?.s === '2609.TW' ? '陽明 2609' :
                            tw50Data?.find((s: any) => s.st === 'BUY')?.s ? (tw50Data.find((s: any) => s.st === 'BUY').n || nameMap[tw50Data.find((s: any) => s.st === 'BUY').s] || tw50Data.find((s: any) => s.st === 'BUY').s) :
                              '市場中性'}
                    </span>
                    <span className={`text-[10px] font-black ${tw50Data?.some((s: any) => s.st === 'BUY') ? 'text-rose-600 bg-rose-50' : 'text-slate-400 bg-slate-50'} px-2 py-0.5 rounded-full shadow-sm`}>
                      {tw50Data?.some((s: any) => s.st === 'BUY') ? '超跌強彈觸發' : '無顯著機會'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-start gap-4">
              <ShieldCheck className="w-6 h-6 text-blue-500 mt-1 shrink-0" />
              <div>
                <h4 className="font-black text-blue-900 mb-2">戰略提示：守護利潤的紀律</h4>
                <p className="text-sm text-blue-800/70 leading-relaxed font-medium">
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
            {/* 來源與時間標注 */}
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${cloudPortfolioData ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {cloudPortfolioData ? '☁️ 雲端即時' : '💾 本地快取'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">更新時間: {safeTimeStr(portfolioData?.last_updated)}</span>
              <span className="text-[10px] text-slate-300">• 來源: {cloudPortfolioData ? 'Firestore Realtime' : 'Local JSON'}</span>
            </div>
            {portfolioData.positions.map((pos: any, i: number) => (
              <div key={i} className="p-8 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-8">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                      <UserCheck className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-800">{pos.name}</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1 uppercase">買入成本: ${pos.avg_price} | 持有 1,000 股</p>
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
                  <button className="flex-1 py-4 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95">買進 (加碼)</button>
                  <button className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">賣出 (減碼)</button>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(tw50Data && tw50Data.length > 0) ? (
                tw50Data
                  .filter((stock: any) => stock?.st === 'BUY' || stock?.s === '2330.TW' || stock?.s === '2603.TW')
                  .map((stock: any, idx: number) => {
                    if (!stock) return null;
                    const isShipping = ['2603.TW', '2609.TW', '2615.TW'].includes(stock.s);
                    const isWeight = ['2330.TW', '2317.TW', '2454.TW'].includes(stock.s);

                    return (
                      <Card key={idx} className={`p-6 border-slate-200 shadow-sm hover:shadow-md transition-all ${stock.st === 'BUY' ? 'border-l-4 border-l-emerald-500' : ''}`}>
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
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stock.st === 'BUY' ? 'bg-emerald-50 text-emerald-600' :
                            isShipping ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-50 text-slate-400'
                            }`}>
                            {stock.st === 'BUY' ? '機會凹洞區' : isShipping ? '資金避風港' : '暫時觀望'}
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

        {/* --- 模式 5: 歷史研究報告 --- */}
        {radarView === 'research' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-500 space-y-10 pb-10">
            <header className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-3xl font-black text-slate-800">台積電實戰紀錄匯報</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                這是一份剔除所有感性文字的極致理性紀錄表。所有價格均為當時「未經還原」的真實報價。
              </p>
            </header>

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
    </Tabs >
  );
}
