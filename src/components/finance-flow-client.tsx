'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs, query, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast"
import { processBankStatement, type ReplacementRule, type CategoryRule } from '@/app/actions';
import type { CreditData, DepositData, CashData, ParsedExcelData } from '@/lib/parser';

import { StatementImporter } from '@/components/statement-importer';
import { SettingsAccordion } from '@/components/settings-accordion';
import { ResultsDisplay } from '@/components/results-display';
import { Skeleton } from '@/components/ui/skeleton';

async function sha1(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function FinanceFlowClient() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  
  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const [cashData, setCashData] = useState<CashData[]>([]);
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // --- Data Fetching ---
  const creditTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'creditCardTransactions') : null, [user, firestore]);
  const { data: savedCreditTransactions, isLoading: isLoadingCredit } = useCollection<CreditData>(creditTransactionsQuery);

  const depositTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'depositAccountTransactions') : null, [user, firestore]);
  const { data: savedDepositTransactions, isLoading: isLoadingDeposit } = useCollection<DepositData>(depositTransactionsQuery);

  const cashTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'cashTransactions') : null, [user, firestore]);
  const { data: savedCashTransactions, isLoading: isLoadingCash } = useCollection<CashData>(cashTransactionsQuery);

  useEffect(() => {
    if (savedCreditTransactions) setCreditData(savedCreditTransactions);
  }, [savedCreditTransactions]);

  useEffect(() => {
    if (savedDepositTransactions) setDepositData(savedDepositTransactions);
  }, [savedDepositTransactions]);

  useEffect(() => {
    if (savedCashTransactions) setCashData(savedCashTransactions);
  }, [savedCashTransactions]);

  // --- Core Logic ---

  const handleProcessAndSave = useCallback(async ({ text, excelData, replacementRules, categoryRules }: { text?: string; excelData?: any[][], replacementRules: ReplacementRule[], categoryRules: CategoryRule[] }) => {
    setIsLoading(true);
    setHasProcessed(false);
    
    const result = await processBankStatement(text || '', replacementRules, categoryRules, !!excelData, excelData);
    
    if (result.success) {
      if (result.detectedCategories.length > 0) {
        const currentCats = JSON.parse(localStorage.getItem('availableCategories') || '[]');
        const newCats = result.detectedCategories.filter(c => !currentCats.includes(c));
        if (newCats.length > 0) {
            const updated = [...currentCats, ...newCats];
            setAvailableCategories(updated);
            localStorage.setItem('availableCategories', JSON.stringify(updated));
            toast({ title: '自動新增類型', description: `已新增：${newCats.join(', ')}`});
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
            toast({ title: "儲存成功", description: `${transactionsSaved} 筆新資料已自動儲存到您的帳戶。` });
          } catch (e: any) {
            toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將資料儲存到資料庫。" });
          }
        }
      }

      if (result.creditData.length === 0 && result.depositData.length === 0 && result.cashData.length === 0) {
        toast({ variant: "default", title: "提醒", description: "未解析到任何有效資料，請檢查您的報表格式或規則是否正確。" });
      }
    } else {
      toast({ variant: "destructive", title: "處理失敗", description: result.error || '發生未知錯誤，請稍後再試。' });
    }
    
    setIsLoading(false);
    setHasProcessed(true);
  }, [user, firestore, toast]);

  const handleAddCashTransaction = useCallback(async (newTransactionData: Omit<CashData, 'id' | 'amount'> & {amount: number, type: 'expense' | 'income'}) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: '錯誤', description: '請先登入' });
      return;
    }

    const amount = newTransactionData.type === 'expense' ? newTransactionData.amount : -newTransactionData.amount;
    const { type, ...transData } = newTransactionData;

    const idString = `${transData.date}-${transData.description}-${amount}-${Date.now()}`;
    const id = await sha1(idString);

    const newTransaction: CashData = { ...transData, id, amount };

    try {
      const cashCollectionRef = collection(firestore, 'users', user.uid, 'cashTransactions');
      // No await, let the listener handle the update
      setDoc(doc(cashCollectionRef, newTransaction.id), { ...newTransaction, createdAt: serverTimestamp() });
      toast({ title: '成功', description: '現金交易已新增' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "儲存失敗", description: e.message || "無法將資料儲存到資料庫。" });
    }
  }, [user, firestore, toast]);

  const handleDeleteAllData = useCallback(async () => {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: '錯誤', description: '請先登入' });
        return;
    }
    setIsLoading(true);
    try {
        const batch = writeBatch(firestore);
        const collectionsToDelete = ['creditCardTransactions', 'depositAccountTransactions', 'cashTransactions'];
        for (const collectionName of collectionsToDelete) {
            const q = query(collection(firestore, 'users', user.uid, collectionName));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => batch.delete(doc.ref));
        }
        await batch.commit();
        setCreditData([]);
        setDepositData([]);
        setCashData([]);
        toast({ title: '成功', description: '您的所有交易資料已被刪除。' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: '刪除失敗', description: e.message || '刪除所有資料時發生錯誤。' });
    } finally {
        setIsLoading(false);
    }
  }, [user, firestore, toast]);
  
    const handleUpdateTransaction = useCallback(async (
        id: string,
        field: keyof CreditData | keyof DepositData | keyof CashData,
        value: string | number,
        type: 'credit' | 'deposit' | 'cash'
    ) => {
        if (!user || !firestore) return;

        const collectionNameMap = {
            credit: 'creditCardTransactions',
            deposit: 'depositAccountTransactions',
            cash: 'cashTransactions'
        };
        const collectionName = collectionNameMap[type];

        // Optimistic UI update
        const updater = (setter: React.Dispatch<React.SetStateAction<any[]>>) => {
            setter(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
        };
        if (type === 'credit') updater(setCreditData);
        if (type === 'deposit') updater(setDepositData);
        if (type === 'cash') updater(setCashData);
        
        try {
            const docRef = doc(firestore, 'users', user.uid, collectionName, id);
            await updateDoc(docRef, { [field]: value });
        } catch (error) {
            console.error(`Error updating ${String(field)} in Firestore:`, error);
            toast({ variant: "destructive", title: "更新失敗", description: `無法將變更儲存到資料庫。` });
            // Revert is handled by Firestore listener automatically
        }
    }, [user, firestore, toast]);

    const handleDeleteTransaction = useCallback(async (id: string, type: 'credit' | 'deposit' | 'cash') => {
        if (!user || !firestore) return;

        const collectionNameMap = {
            credit: 'creditCardTransactions',
            deposit: 'depositAccountTransactions',
            cash: 'cashTransactions'
        };
        const collectionName = collectionNameMap[type];

        // Optimistic UI update
        const originalDataMap = {
            credit: [...creditData],
            deposit: [...depositData],
            cash: [...cashData]
        };
        const updater = (setter: React.Dispatch<React.SetStateAction<any[]>>) => {
            setter(prev => prev.filter(item => item.id !== id));
        };
        if (type === 'credit') updater(setCreditData);
        if (type === 'deposit') updater(setDepositData);
        if (type === 'cash') updater(setCashData);

        try {
            const docRef = doc(firestore, 'users', user.uid, collectionName, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error(`Error deleting transaction from Firestore:`, error);
            toast({ variant: "destructive", title: "刪除失敗", description: `無法從資料庫中刪除此筆交易。` });
            // Revert optimistic update
            if (type === 'credit') setCreditData(originalDataMap.credit);
            if (type === 'deposit') setDepositData(originalDataMap.deposit);
            if (type === 'cash') setCashData(originalDataMap.cash);
        }
    }, [user, firestore, toast, creditData, depositData, cashData]);


  const isLoadingTransactions = isLoadingCredit || isLoadingDeposit || isLoadingCash;
  const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
  const showResults = (hasProcessed && hasData) || (!isUserLoading && !hasProcessed && hasData && !isLoadingTransactions);

  return (
    <div className="space-y-4">
        <StatementImporter
            isProcessing={isLoading}
            onProcess={handleProcessAndSave}
            user={user}
        />

        <SettingsAccordion 
            onDeleteAllData={handleDeleteAllData} 
            isProcessing={isLoading}
            user={user}
            availableCategories={availableCategories}
            setAvailableCategories={setAvailableCategories}
        />

        {(isLoading || (showResults && !isLoadingTransactions)) ? (
            <ResultsDisplay
                creditData={creditData}
                depositData={depositData}
                cashData={cashData}
                availableCategories={availableCategories}
                onAddCashTransaction={handleAddCashTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                hasProcessed={hasProcessed}
                user={user}
            />
        ) : (isLoadingTransactions && !hasData) ? (
            <div className="space-y-4">
                <div className="flex items-center space-x-4 p-6">
                    <Skeleton className="h-10 w-24 rounded-md" />
                    <Skeleton className="h-10 w-24 rounded-md" />
                </div>
                <div className="p-6 pt-0">
                  <Skeleton className="h-48 w-full rounded-md" />
                </div>
            </div>
        ) : null}
    </div>
  );
}

    