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
import { Skeleton } from '@/components/ui/skeleton';
import { Text, Settings, ClipboardCopy, FileText, BarChart2, Wallet, TrendingUp, Target, Activity, History, Calendar, AlertTriangle, UserCheck, TrendingDown, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { parse } from 'date-fns';
import { getCreditDisplayDate } from '@/lib/parser';

// CombinedData is used by both ResultsDisplay and FixedItemsSummary
export type CombinedData = {
  id: string;
  date: string;
  dateObj: Date; // Crucial for date-based calculations
  category: string;
  description: string;
  amount: number;
  source: '信用卡' | '活存帳戶' | '現金';
  notes?: string;
  bankCode?: string;
};

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

  // --- 股市雷達狀態 ---
  const [radarView, setRadarView] = useState<'overview' | 'tsmc' | 'portfolio' | 'tw50' | 'research'>('overview');
  const [tsmcDataLocal, setTsmcDataLocal] = useState<any>(null);
  const [portfolioDataLocal, setPortfolioDataLocal] = useState<any>(null);

  // Firestore 實時引用 (Cloud Sync)
  // marketRecords 是公開讀取的，所以只需要 firestore 實例即可
  const tsmcDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'marketRecords', 'tsmc') : null, [firestore]);
  const { data: cloudTsmcData } = useDoc<any>(tsmcDocRef);

  const portfolioDocRef = useMemoFirebase(() => (user && firestore) ? doc(firestore, 'users', user.uid, 'stockPositions', 'portfolio') : null, [user, firestore]);
  const { data: cloudPortfolioData } = useDoc<any>(portfolioDocRef);

  // 優先順序：雲端數據 > 本地 JSON 數據
  const tsmcData = cloudTsmcData || tsmcDataLocal;
  const portfolioData = cloudPortfolioData || portfolioDataLocal;

  // 1. 獲取本地 fallback 資料
  useEffect(() => {
    fetch("/data/tsmc_risk.json")
      .then(res => res.json())
      .then(json => setTsmcDataLocal(json))
      .catch(err => console.error("TSMC data error:", err));

    fetch("/data/portfolio_live.json")
      .then(res => res.json())
      .then(json => setPortfolioDataLocal(json))
      .catch(err => console.error("Portfolio data error:", err));
  }, []);

  // 2. 雲端自動同步 (Migration logic)
  useEffect(() => {
    if (!user || !firestore) return;

    // 如果雲端沒有 TSMC 資料，且本地已經獲取成功，則自動同步上雲 (一次性)
    if (tsmcDataLocal && !cloudTsmcData && tsmcDocRef) {
      console.log("Auto-syncing TSMC data to Firestore...");
      setDoc(tsmcDocRef, tsmcDataLocal, { merge: true });
    }

    // 如果雲端沒有持倉資料，且本地已經獲取成功，則同步上雲
    if (portfolioDataLocal && !cloudPortfolioData && portfolioDocRef) {
      console.log("Auto-syncing Portfolio data to Firestore...");
      setDoc(portfolioDocRef, portfolioDataLocal, { merge: true });
    }
  }, [user, firestore, tsmcDataLocal, cloudTsmcData, tsmcDocRef, portfolioDataLocal, cloudPortfolioData, portfolioDocRef]);

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
      <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
        <TabsTrigger value="importer">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          貼上報表
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="mr-2 h-4 w-4" />
          規則設定
        </TabsTrigger>
        <TabsTrigger value="results">
          <FileText className="mr-2 h-4 w-4" />
          處理結果
        </TabsTrigger>
        <TabsTrigger value="analysis">
          <BarChart2 className="mr-2 h-4 w-4" />
          詳細分析
        </TabsTrigger>
        <TabsTrigger value="balances">
          <Wallet className="mr-2 h-4 w-4" />
          專款餘額
        </TabsTrigger>
        <TabsTrigger value="stock-radar" className="text-cyan-600 font-black data-[state=active]:text-cyan-700 data-[state=active]:bg-cyan-50">
          <TrendingUp className="mr-2 h-4 w-4" />
          股市雷達
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
      <TabsContent value="stock-radar" className="mt-0 pt-6 outline-none">
        {/* 子導航選單 */}
        <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setRadarView('overview')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${radarView === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            戰略總覽
          </button>
          <button
            onClick={() => setRadarView('tsmc')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${radarView === 'tsmc' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            台積電監控
          </button>
          <button
            onClick={() => setRadarView('portfolio')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${radarView === 'portfolio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            我的實戰持倉
          </button>
          <button
            onClick={() => setRadarView('tw50')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${radarView === 'tw50' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            TW50 機會掃描
          </button>
          <button
            onClick={() => setRadarView('research')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${radarView === 'research' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            歷史研究報告
          </button>
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
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[8px] rounded-full border border-emerald-500/20">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                          Cloud Live
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
                        持倉動態 (5871)
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 text-[8px] rounded-full border border-cyan-500/20">
                          <span className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse"></span>
                          Syncing
                        </span>
                      </span>
                      <Target className="w-3 h-3 text-indigo-500" />
                    </div>
                    <div className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">
                      Updated: {portfolioData?.last_updated || '---'}
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
                    <span className="text-xs font-bold text-slate-700">中租 5871</span>
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full shadow-sm">超跌強彈觸發</span>
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
                    <span>* 數據採用 14:30 盤後定價結算價</span>
                    <span className="bg-slate-50 px-2 py-0.5 rounded text-slate-400">
                      Sync: {tsmcData?.last_update || '---'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-8 border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">可成 (2474)</h3>
                    <p className="text-xs text-slate-500 font-medium">技術面超跌轉機股</p>
                  </div>
                  <span className="text-xs font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full uppercase">強烈買進</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500 font-bold">預估預算配置</span>
                    <span className="text-slate-800 font-black">40,000 元 (分兩批)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium italic">
                    * 理由：金屬機殼龍頭轉型醫療、半導體。帳上現金雄厚，目前 J 值鈍化已久，具備極強安全邊際。
                  </p>
                </div>
              </Card>

              <Card className="p-8 border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">台達電 (2308)</h3>
                    <p className="text-xs text-slate-500 font-medium">能源轉型核心龍頭</p>
                  </div>
                  <span className="text-xs font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase">觀望冷卻</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                    <span className="text-slate-500 font-bold">目前位階</span>
                    <span className="text-slate-800 font-black">布林中軌盤整</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    目前股價處於不上不下的位階，無恐慌買點，亦無過熱賣點。建議先行略過，等待下一波 J 值冰點。
                  </p>
                </div>
              </Card>
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
    </Tabs>
  );
}
