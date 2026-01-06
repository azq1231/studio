'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
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
import { Text, Settings, ClipboardCopy, FileText, BarChart2, Wallet } from 'lucide-react';
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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const [hasProcessed, setHasProcessed] = useState(false);

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
      if (!isInitial) {
        // toast({ title: "設定已儲存", description: "您的變更已成功同步到雲端。" });
      }
    } catch (e: any) {
      console.error("Failed to save settings:", e);
      if (!isInitial) toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將設定儲存到資料庫。" });
    }
  }, [user, firestore, settingsDocRef, toast]);


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

    (setterMap[type] as React.Dispatch<React.SetStateAction<any[]>>)(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    try {
      await updateDoc(doc(firestore, 'users', user.uid, collectionNameMap[type], id), { [field]: value });
    } catch (error) {
      toast({ variant: "destructive", title: "更新失敗", description: `無法將變更儲存到資料庫。` });
    }
  }, [user, firestore, toast]);

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
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="importer">
          <ClipboardCopy className="mr-2" />
          貼上報表
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="mr-2" />
          規則設定
        </TabsTrigger>
        <TabsTrigger value="results">
          <FileText className="mr-2" />
          處理結果
        </TabsTrigger>
        <TabsTrigger value="analysis">
          <BarChart2 className="mr-2" />
          詳細分析
        </TabsTrigger>
        <TabsTrigger value="balances">
          <Wallet className="mr-2" />
          專款餘額
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
          <BalanceTracker combinedData={combinedData} balanceAccounts={settings.balanceAccounts || []} />
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
    </Tabs>
  );
}
