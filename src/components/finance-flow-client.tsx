'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { format, parse, getYear, getMonth } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, AlertCircle, Trash2, PlusCircle, Settings, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, RotateCcw, Combine } from 'lucide-react';
import { processBankStatement, type ReplacementRule, type CategoryRule } from '@/app/actions';
import type { CreditData, DepositData } from '@/lib/parser';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';

const statementFormSchema = z.object({
  statement: z.string().min(10, { message: '報表內容至少需要10個字元。' }),
});

const replacementRuleSchema = z.object({
  find: z.string().min(1, { message: '請輸入要尋找的文字' }),
  replace: z.string(),
  deleteRow: z.boolean().default(false),
});

const categoryRuleSchema = z.object({
  keyword: z.string().min(1, { message: '請輸入關鍵字' }),
  category: z.string().min(1, { message: '請選擇一個類型' }),
});

const settingsFormSchema = z.object({
  replacementRules: z.array(replacementRuleSchema),
  categoryRules: z.array(categoryRuleSchema),
});

type StatementFormData = z.infer<typeof statementFormSchema>;
type SettingsFormData = z.infer<typeof settingsFormSchema>;
type SortKey = 'keyword' | 'category';
type SortDirection = 'asc' | 'desc';
type CreditSortKey = 'transactionDate' | 'category' | 'description' | 'amount';


const DEFAULT_REPLACEMENT_RULES: ReplacementRule[] = [
  { find: '行銀非約跨優', replace: '', deleteRow: false },
  { find: 'ＣＤＭ存款', replace: '', deleteRow: true }
];

const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
    { keyword: 'VULTR', category: '方' },
    { keyword: '國外交易服務費', category: '方' },
    { keyword: 'GOOGLE*CLOUD', category: '方' },
    { keyword: '悠遊卡自動加值', category: '方' },
    { keyword: 'REPLIT, INC.', category: '方' },
    { keyword: '伯朗咖啡', category: '方' },
    { keyword: '柒號洋樓', category: '方' },
    { keyword: 'ＰＣＨＯＭＥ', category: '方' },
    { keyword: 'OPENAI', category: '方' },
    { keyword: '新東陽', category: '吃' },
    { keyword: '全家', category: '吃' },
    { keyword: '元心燃麻辣堂', category: '吃' },
    { keyword: '統一超商', category: '吃' },
    { keyword: '玉喜飯店', category: '吃' },
    { keyword: '爭鮮', category: '吃' },
    { keyword: '八方雲集', category: '吃' },
    { keyword: '樂活養生健康鍋', category: '吃' },
    { keyword: '順成西點麵包', category: '吃' },
    { keyword: '誠品生活', category: '吃' },
    { keyword: '星巴克－自動加值', category: '吃' },
    { keyword: 'COMFORT BURGER', category: '吃' },
    { keyword: '雙月食品社', category: '吃' },
    { keyword: '秀泰全球影城', category: '吃' },
    { keyword: '台灣麥當勞', category: '吃' },
    { keyword: '筷子餐廳', category: '吃' },
    { keyword: '怡客咖啡', category: '吃' },
    { keyword: '起家雞', category: '吃' },
    { keyword: '彼得好咖啡', category: '吃' },
    { keyword: '御書園', category: '吃' },
    { keyword: '五花馬水餃館', category: '吃' },
    { keyword: '客美多咖啡', category: '吃' },
    { keyword: '明曜百貨', category: '吃' },
    { keyword: 'ＫＦＣ', category: '吃' },
    { keyword: '鬥牛士經典牛排', category: '吃' },
    { keyword: '街口電支', category: '吃' },
    { keyword: '必勝客', category: '吃' },
    { keyword: '丰禾', category: '吃' },
    { keyword: '春水堂', category: '吃' },
    { keyword: '上島珈琲店', category: '吃' },
    { keyword: '加油站', category: '家' },
    { keyword: '全聯', category: '家' },
    { keyword: '55688', category: '家' },
    { keyword: 'IKEA', category: '家' },
    { keyword: '優步', category: '家' },
    { keyword: 'OP錢包', category: '家' },
    { keyword: 'NET', category: '家' },
    { keyword: '威秀影城', category: '家' },
    { keyword: '中油', category: '家' },
    { keyword: '高鐵智慧型手機', category: '家' },
    { keyword: 'Ｍｉｓｔｅｒ　Ｄｏｎｕｔ', category: '家' },
    { keyword: '墊腳石圖書', category: '家' },
    { keyword: '燦坤３Ｃ', category: '家' },
    { keyword: '屈臣氏', category: '家' },
    { keyword: 'APPLE.COM/BILL', category: '家' },
    { keyword: '一之軒', category: '家' },
    { keyword: '城市車旅', category: '家' },
    { keyword: '台灣小米', category: '家' },
    { keyword: '麗冠有線電視', category: '固定' },
    { keyword: '09202***01', category: '固定' },
    { keyword: '國都汽車', category: '固定' },
    { keyword: '台灣電力', category: '固定' },
    { keyword: '台北市自來水費', category: '固定' },
    { keyword: '汽車驗車', category: '固定' },
    { keyword: '大台北瓦斯費', category: '固定' },
    { keyword: '大安文山有線電視', category: '固定' },
    { keyword: '橙印良品', category: '蘇' },
    { keyword: 'PayEasy', category: '蘇' },
    { keyword: '樂購蝦皮', category: '蘇' },
    { keyword: '饗賓餐旅', category: '蘇' },
    { keyword: 'TAOBAO.COM', category: '蘇' },
    { keyword: '拓元票務', category: '蘇' },
    { keyword: '三創數位', category: '蘇' },
    { keyword: '金玉堂', category: '秀' },
    { keyword: '寶雅', category: '秀' },
    { keyword: '特力屋', category: '秀' },
    { keyword: '悠遊付－臺北市立大學', category: '秀' },
    { keyword: '嘟嘟房', category: '弟' },
    { keyword: '台東桂田喜來登酒店', category: '玩' },
    { keyword: '家樂福', category: '玩' },
    { keyword: '台東原生應用植物園', category: '玩' },
    { keyword: '格上租車', category: '玩' },
    { keyword: '悠勢科技股份有限公司', category: '收入' },
    { keyword: '行政院發', category: '收入' },
    { keyword: 'linePay繳好市多', category: '家' },
    { keyword: '國保保費', category: '固定' },
    { keyword: '怡秀跆拳道', category: '華' },
    { keyword: 'iPassMoney儲值', category: '方' },
    { keyword: '逸安中醫', category: '蘇' },
    { keyword: '連結帳戶交易', category: '家' },
    { keyword: '花都管理費', category: '固定' },
];

export function FinanceFlowClient() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const { toast } = useToast();

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [creditSortKey, setCreditSortKey] = useState<CreditSortKey | null>('transactionDate');
  const [creditSortDirection, setCreditSortDirection] = useState<SortDirection>('desc');

  const creditTransactionsQuery = useMemoFirebase(
    () => (user && firestore ? collection(firestore, 'users', user.uid, 'creditCardTransactions') : null),
    [user, firestore]
  );
  
  const { data: savedCreditTransactions, isLoading: isLoadingCreditTransactions } = useCollection<CreditData>(creditTransactionsQuery);

  const depositTransactionsQuery = useMemoFirebase(
    () => (user && firestore ? collection(firestore, 'users', user.uid, 'depositAccountTransactions') : null),
    [user, firestore]
  );

  const { data: savedDepositTransactions, isLoading: isLoadingDepositTransactions } = useCollection<DepositData>(depositTransactionsQuery);


  const statementForm = useForm<StatementFormData>({
    resolver: zodResolver(statementFormSchema),
    defaultValues: { statement: '' },
    mode: 'onChange'
  });

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      replacementRules: [],
      categoryRules: [],
    },
  });

  const { fields: replacementFields, append: appendReplacement, remove: removeReplacement, replace: replaceReplacementRules } = useFieldArray({
    control: settingsForm.control,
    name: 'replacementRules',
  });
  
  const { fields: categoryFields, append: appendCategory, remove: removeCategory, replace: replaceCategoryRules } = useFieldArray({
    control: settingsForm.control,
    name: 'categoryRules',
  });

  useEffect(() => {
    if (isUserLoading || !savedCreditTransactions) return;

    setCreditData(prevData => {
        const existingIds = new Set(prevData.map(d => d.id));
        const newSaved = savedCreditTransactions.filter(t => !existingIds.has(t.id));
        
        if (newSaved.length === 0 && prevData.length === savedCreditTransactions.length) {
            return prevData;
        }
        
        const mergedData = [...prevData, ...newSaved];
        const uniqueData = Array.from(new Map(mergedData.map(item => [item.id, item])).values());
        
        return uniqueData;
    });

  }, [isUserLoading, savedCreditTransactions]);

  useEffect(() => {
    if (isUserLoading || !savedDepositTransactions) return;

    setDepositData(prevData => {
        const existingIds = new Set(prevData.map(d => d.id));
        const newSaved = savedDepositTransactions.filter(t => !existingIds.has(t.id));
        
        if (newSaved.length === 0 && prevData.length === savedDepositTransactions.length) {
            return prevData;
        }
        
        const mergedData = [...prevData, ...newSaved];
        const uniqueData = Array.from(new Map(mergedData.map(item => [item.id, item])).values());
        
        return uniqueData;
    });

  }, [isUserLoading, savedDepositTransactions]);


  const resetReplacementRules = () => {
    replaceReplacementRules(DEFAULT_REPLACEMENT_RULES);
    localStorage.setItem('replacementRules', JSON.stringify(DEFAULT_REPLACEMENT_RULES));
    toast({ title: '取代規則已重置', description: '已恢復為預設規則。' });
  };

  const resetCategoryRules = () => {
    replaceCategoryRules(DEFAULT_CATEGORY_RULES);
    localStorage.setItem('categoryRules', JSON.stringify(DEFAULT_CATEGORY_RULES));
    toast({ title: '分類規則已重置', description: '已恢復為預設規則。' });
  };

  useEffect(() => {
    if (!isClient) return;
    try {
      // Load available categories
      const savedCategories = localStorage.getItem('availableCategories');
      if (savedCategories) {
        setAvailableCategories(JSON.parse(savedCategories));
      } else {
        const defaultCategories = ['方', '吃', '家', '固定', '蘇', '秀', '弟', '玩', '姊', '收入', '華'];
        setAvailableCategories(defaultCategories);
        localStorage.setItem('availableCategories', JSON.stringify(defaultCategories));
      }

      // Replacement Rules
      const savedReplacementRules = localStorage.getItem('replacementRules');
      if (savedReplacementRules) {
        const parsed = JSON.parse(savedReplacementRules);
        if (Array.isArray(parsed)) {
           settingsForm.setValue('replacementRules', parsed);
        }
      } else {
        settingsForm.setValue('replacementRules', DEFAULT_REPLACEMENT_RULES);
      }

      // Category Rules - Smart Merging on load
      const savedCategoryRulesRaw = localStorage.getItem('categoryRules');
      let finalCategoryRules = [...DEFAULT_CATEGORY_RULES];

      if (savedCategoryRulesRaw) {
        try {
            const savedRules = JSON.parse(savedCategoryRulesRaw) as CategoryRule[];
            if (Array.isArray(savedRules)) {
                const finalRulesMap = new Map(finalCategoryRules.map(r => [r.keyword, r]));
                savedRules.forEach(savedRule => {
                    finalRulesMap.set(savedRule.keyword, savedRule);
                });
                finalCategoryRules = Array.from(finalRulesMap.values());
            }
        } catch {
            // If parsing fails, stick with defaults
        }
      }
      
      settingsForm.setValue('categoryRules', finalCategoryRules);
      localStorage.setItem('categoryRules', JSON.stringify(finalCategoryRules));

    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
  }, [settingsForm, isClient]);

  const handleSaveSettings = (data: SettingsFormData) => {
    try {
      const uniqueReplacementRules = Array.from(new Map(data.replacementRules.map(r => [r.find, r])).values());
      const uniqueCategoryRules = Array.from(new Map(data.categoryRules.map(r => [r.keyword, r])).values());

      localStorage.setItem('replacementRules', JSON.stringify(uniqueReplacementRules));
      localStorage.setItem('categoryRules', JSON.stringify(uniqueCategoryRules));
      
      settingsForm.setValue('replacementRules', uniqueReplacementRules);
      settingsForm.setValue('categoryRules', uniqueCategoryRules);

      toast({
        title: "設定已儲存",
        description: "您的規則已成功儲存。",
      });
    } catch (e) {
       toast({
        variant: "destructive",
        title: "儲存失敗",
        description: "無法儲存設定到您的瀏覽器。",
      });
    }
  };


  const handleAddCategory = () => {
    if (newCategory && !availableCategories.includes(newCategory)) {
      const updatedCategories = [...availableCategories, newCategory];
      setAvailableCategories(updatedCategories);
      localStorage.setItem('availableCategories', JSON.stringify(updatedCategories));
      setNewCategory('');
      toast({ title: '類型已新增', description: `「${newCategory}」已成功新增。` });
    } else if (availableCategories.includes(newCategory)) {
      toast({ variant: 'destructive', title: '新增失敗', description: '此類型已存在。' });
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    const updatedCategories = availableCategories.filter(c => c !== categoryToRemove);
    setAvailableCategories(updatedCategories);
    localStorage.setItem('availableCategories', JSON.stringify(updatedCategories));

    const currentRules = settingsForm.getValues('categoryRules');
    const updatedRules = currentRules.filter(rule => rule.category !== categoryToRemove);
    settingsForm.setValue('categoryRules', updatedRules, { shouldDirty: true, shouldValidate: true });

    toast({ title: '類型已刪除', description: `「${categoryToRemove}」已被移除。` });
  };


  async function onSubmit(values: StatementFormData) {
    setIsLoading(true);
    setHasProcessed(false);
    
    const { replacementRules, categoryRules } = settingsForm.getValues();
    const result = await processBankStatement(values.statement, replacementRules, categoryRules);
    
    if (result.success) {
      if (result.creditData.length > 0) {
        setCreditData(prevData => {
          const combined = [...prevData, ...result.creditData];
          return Array.from(new Map(combined.map(item => [item.id, item])).values());
        });
      }
      if (result.depositData.length > 0) {
        setDepositData(prevData => {
          const combined = [...prevData, ...result.depositData];
          return Array.from(new Map(combined.map(item => [item.id, item])).values());
        });
      }
      
      if (user && firestore) {
        const batch = writeBatch(firestore);
        let transactionsSaved = 0;

        if (result.creditData.length > 0) {
          const creditCollection = collection(firestore, 'users', user.uid, 'creditCardTransactions');
          result.creditData.forEach(transaction => {
            const docRef = doc(creditCollection, transaction.id);
            batch.set(docRef, transaction, { merge: true });
          });
          transactionsSaved += result.creditData.length;
        }

        if (result.depositData.length > 0) {
          const depositCollection = collection(firestore, 'users', user.uid, 'depositAccountTransactions');
          result.depositData.forEach(transaction => {
            const docRef = doc(depositCollection, transaction.id);
            batch.set(docRef, transaction, { merge: true });
          });
          transactionsSaved += result.depositData.length;
        }
        
        if (transactionsSaved > 0) {
          try {
            await batch.commit();
            toast({
              title: "儲存成功",
              description: `${transactionsSaved} 筆新資料已自動儲存到您的帳戶。`
            });
          } catch (e: any) {
            console.error("Error saving to Firestore:", e);
            toast({
              variant: "destructive",
              title: "儲存失敗",
              description: e.message || "無法將資料儲存到資料庫。",
            });
          }
        }
      }

      if (result.creditData.length === 0 && result.depositData.length === 0) {
        toast({
          variant: "default",
          title: "提醒",
          description: "未解析到任何有效資料，請檢查您的報表格式或規則是否正確。",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "處理失敗",
        description: result.error || '發生未知錯誤，請稍後再試。',
      });
    }
    
    setIsLoading(false);
    setHasProcessed(true);
    statementForm.reset({ statement: '' });
  }

  function handleDownload() {
    try {
      const wb = XLSX.utils.book_new();

      if (creditData.length > 0) {
        const creditSheetData = creditData.map(d => ({
          '交易日期': d.transactionDate,
          '類型': d.category,
          '交易項目': d.description,
          '金額': d.amount,
        }));
        const ws = XLSX.utils.json_to_sheet(creditSheetData);
        XLSX.utils.book_append_sheet(wb, ws, '信用卡報表');
      }

      if (depositData.length > 0) {
        const depositSheetData = depositData.map(d => ({
          '交易日期': d.date,
          '類型': d.category,
          '摘要＋存摺備註': d.description,
          '金額（支出正、存入負）': d.amount,
          '空白': '',
          '對方銀行代碼': d.bankCode,
          '對方帳號（留空）': d.accountNumber,
        }));
        const ws = XLSX.utils.json_to_sheet(depositSheetData);
        XLSX.utils.book_append_sheet(wb, ws, '活存報表');
      }

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `bank_data_${today}.xlsx`);
    } catch(error) {
       toast({
        variant: "destructive",
        title: "下載失败",
        description: "產生 Excel 檔案時發生錯誤。",
      });
      console.error("Failed to download Excel file:", error);
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleCreditSort = (key: CreditSortKey) => {
    if (creditSortKey === key) {
        setCreditSortDirection(creditSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
        setCreditSortKey(key);
        setCreditSortDirection('asc');
    }
  };

    const handleUpdateCategory = async (transactionId: string, newCategory: string) => {
        setCreditData(prevData =>
            prevData.map(item =>
                item.id === transactionId ? { ...item, category: newCategory } : item
            )
        );

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'creditCardTransactions', transactionId);
                await updateDoc(docRef, { category: newCategory });
            } catch (error) {
                console.error("Error updating category in Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "更新失敗",
                    description: "無法將類型變更儲存到資料庫。",
                });
                if (savedCreditTransactions) {
                   const originalItem = savedCreditTransactions.find(t => t.id === transactionId);
                   if (originalItem) {
                       setCreditData(prevData => prevData.map(item => item.id === transactionId ? originalItem : item));
                   }
                }
            }
        }
    };

    const handleDeleteTransaction = async (transactionId: string) => {
        const originalData = [...creditData];
        setCreditData(prevData => prevData.filter(item => item.id !== transactionId));

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'creditCardTransactions', transactionId);
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Error deleting transaction from Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "刪除失敗",
                    description: "無法從資料庫中刪除此筆交易。",
                });
                setCreditData(originalData);
            }
        }
    };

  const renderSortedCategoryFields = useMemo(() => {
     if (!sortKey) {
      return categoryFields;
    }
    return [...categoryFields].sort((a, b) => {
      const aValue = settingsForm.getValues(`categoryRules.${categoryFields.findIndex(f => f.id === a.id)}.keyword`) || '';
      const bValue = settingsForm.getValues(`categoryRules.${categoryFields.findIndex(f => f.id === b.id)}.keyword`) || '';
      const comparison = aValue.localeCompare(bValue, 'zh-Hant');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categoryFields, sortKey, sortDirection, settingsForm]);

  const sortedCreditData = useMemo(() => {
    if (!creditSortKey) return creditData;

    return [...creditData].sort((a, b) => {
        const aValue = a[creditSortKey];
        const bValue = b[creditSortKey];

        let comparison = 0;
        if (creditSortKey === 'transactionDate') {
            try {
                // Assuming MM/DD format, might need adjustment for YYYY/MM/DD
                const dateA = parse(aValue, 'MM/dd', new Date());
                const dateB = parse(bValue, 'MM/dd', new Date());
                comparison = dateA.getTime() - dateB.getTime();
            } catch {
                comparison = (aValue || '').localeCompare(bValue || '');
            }
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'zh-Hant');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue), 'zh-Hant');
        }

        return creditSortDirection === 'asc' ? comparison : -comparison;
    });
}, [creditData, creditSortKey, creditSortDirection]);


  const categoryChartData = useMemo(() => {
    if (!creditData || creditData.length === 0) return [];
    
    const categoryTotals = creditData.reduce((acc, transaction) => {
      const category = transaction.category || '未分類';
      const amount = transaction.amount || 0;
      if (amount > 0) { // Only count expenses
        if (!acc[category]) {
          acc[category] = 0;
        }
        acc[category] += amount;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryTotals).map(([name, total]) => ({
      name,
      total,
    })).sort((a, b) => b.total - a.total);

  }, [creditData]);

  const summaryReportData = useMemo(() => {
    if (!creditData || creditData.length === 0) return { headers: [], rows: [] };

    const monthlyData: Record<string, Record<string, number>> = {};
    const categories = new Set<string>();

    creditData.forEach(transaction => {
      try {
        const { transactionDate, category, amount } = transaction;
        if (amount <= 0) return; 

        // Attempt to parse MM/DD format, but handle other formats gracefully.
        const date = parse(transactionDate, 'MM/dd', new Date());
        // Basic validation: if the year is in the past, it's likely a valid parse.
        // This is a simple heuristic and might need refinement.
        if (date.getFullYear() < 1970) return;

        const monthKey = format(date, 'yyyy年M月');
        
        categories.add(category);

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {};
        }
        if (!monthlyData[monthKey][category]) {
          monthlyData[monthKey][category] = 0;
        }
        monthlyData[monthKey][category] += amount;
      } catch(e) {
        // Ignore parsing errors for dates that are not in MM/dd format
      }
    });

    const sortedCategories = Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const headers = ['日期（年月）', ...sortedCategories, '總計'];

    const rows = Object.entries(monthlyData).map(([month, categoryData]) => {
      let total = 0;
      const row: Record<string, string | number> = { '日期（年月）': month };

      sortedCategories.forEach(cat => {
        const value = categoryData[cat] || 0;
        row[cat] = value;
        total += value;
      });
      row['總計'] = total;
      
      return row;
    }).sort((a, b) => (a['日期（年月）'] as string).localeCompare(b['日期（年月）'] as string));
    
    return { headers, rows };
  }, [creditData]);
  
  type CombinedData = {
    id: string;
    date: string;
    dateObj: Date;
    category: string;
    description: string;
    amount: number;
    source: '信用卡' | '活存帳戶';
  };

  const combinedData = useMemo<CombinedData[]>(() => {
    const combined: CombinedData[] = [];
    const now = new Date();
    const currentYear = getYear(now);
    const currentMonth = getMonth(now);

    creditData.forEach(d => {
      let dateObj;
      try {
        // Handle MM/dd format by intelligently guessing the year.
        const parsedDate = parse(d.transactionDate, 'MM/dd', new Date());
        const transactionMonth = getMonth(parsedDate);

        // If transaction month is in the future relative to current month, assume it's from last year.
        // e.g., current date is Jan 2024, transaction is Dec 20, assume it's Dec 20, 2023.
        if (transactionMonth > currentMonth) {
            dateObj = new Date(parsedDate.setFullYear(currentYear - 1));
        } else {
            dateObj = parsedDate;
        }
        
      } catch {
        dateObj = new Date(0); // Invalid date
      }
      combined.push({
        id: d.id,
        date: format(dateObj, 'yyyy/MM/dd'),
        dateObj: dateObj,
        category: d.category,
        description: d.description,
        amount: d.amount,
        source: '信用卡',
      });
    });

    depositData.forEach(d => {
       let dateObj;
       try {
         dateObj = parse(d.date, 'yyyy/MM/dd', new Date());
       } catch {
         dateObj = new Date(0); // Invalid date
       }
      combined.push({
        id: d.id,
        date: d.date,
        dateObj: dateObj,
        category: d.category,
        description: d.description,
        amount: d.amount,
        source: '活存帳戶',
      });
    });

    return combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [creditData, depositData]);


  const noDataFound = hasProcessed && !isLoading && creditData.length === 0 && depositData.length === 0;
  const hasData = creditData.length > 0 || depositData.length > 0;
  
  const defaultTab = hasData
    ? (creditData.length > 0 ? "credit" : "deposit")
    : "statement";

  const isLoadingTransactions = isLoadingCreditTransactions || isLoadingDepositTransactions;
  const showResults = (hasProcessed && hasData) || (!isUserLoading && !hasProcessed && hasData && !isLoadingTransactions);


  const SortableHeader = ({ sortKey: key, children }: { sortKey: SortKey, children: React.ReactNode }) => {
    const isSorted = sortKey === key;
    return (
      <TableHead>
        <Button variant="ghost" onClick={() => handleSort(key)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (
            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </TableHead>
    );
  };

  const SortableCreditHeader = ({ sortKey: key, children, className }: { sortKey: CreditSortKey, children: React.ReactNode, className?: string }) => {
    const isSorted = creditSortKey === key;
    return (
      <TableHead className={className}>
        <Button variant="ghost" onClick={() => handleCreditSort(key)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (
            creditSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </TableHead>
    );
};


  return (
    <div className="space-y-4">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>貼上報表內容</CardTitle>
          <CardDescription>
            {isClient && user
              ? "將您的網路銀行報表內容直接複製並貼到下方文字框中，處理後的資料將會自動儲存到您的帳戶。"
              : "將您的網路銀行報表內容直接複製並貼到下方文字框中。如需儲存資料，請先登入。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...statementForm}>
            <form onSubmit={statementForm.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={statementForm.control}
                name="statement"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="例如：
11/02	吃	新東陽忠孝一門市	500"
                        className="min-h-[250px] font-mono text-sm bg-background/50"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || !statementForm.formState.isValid} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  處理報表
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {isClient && (
        <>
          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <span className="text-lg font-semibold">規則設定</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6">
                    <Form {...settingsForm}>
                      <form onSubmit={settingsForm.handleSubmit(handleSaveSettings)} className="space-y-6">
                        <Tabs defaultValue="category" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="replacement">取代規則</TabsTrigger>
                            <TabsTrigger value="category">分類規則</TabsTrigger>
                            <TabsTrigger value="manage-categories">管理類型</TabsTrigger>
                          </TabsList>
                          <TabsContent value="replacement" className="mt-4">
                            <div className="flex justify-between items-center mb-4">
                              <CardDescription>
                                設定自動取代或刪除規則。勾選「刪除整筆資料」後，符合條件的資料將被整筆移除。
                              </CardDescription>
                               <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    重置
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>確定要重置取代規則嗎？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      此操作將會清除所有您自訂的取代規則，並恢復為系統預設值。此動作無法復原。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={resetReplacementRules}>確定重置</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-2/5">尋找文字</TableHead>
                                    <TableHead className="w-2/5">取代為</TableHead>
                                    <TableHead className="w-1/5 text-center">刪除整筆資料</TableHead>
                                    <TableHead className="w-[50px]">操作</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {replacementFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                      <TableCell className="p-1">
                                        <FormField
                                          control={settingsForm.control}
                                          name={`replacementRules.${index}.find`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Input placeholder="要被取代的文字" {...field} className="h-9"/>
                                              </FormControl>
                                              <FormMessage className="text-xs px-2"/>
                                            </FormItem>
                                          )}
                                        />
                                      </TableCell>
                                      <TableCell className="p-1">
                                        <FormField
                                          control={settingsForm.control}
                                          name={`replacementRules.${index}.replace`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Input placeholder="新的文字 (留空為刪除)" {...field} className="h-9"/>
                                              </FormControl>
                                              <FormMessage className="text-xs px-2"/>
                                            </FormItem>
                                          )}
                                        />
                                      </TableCell>
                                      <TableCell className="p-1 text-center">
                                        <FormField
                                          control={settingsForm.control}
                                          name={`replacementRules.${index}.deleteRow`}
                                          render={({ field }) => (
                                            <FormItem className="flex justify-center items-center h-full">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value}
                                                  onCheckedChange={field.onChange}
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </TableCell>
                                      <TableCell className="p-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReplacement(index)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => appendReplacement({ find: '', replace: '', deleteRow: false })}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              新增取代規則
                            </Button>
                          </TabsContent>
                          <TabsContent value="category" className="mt-4">
                            <div className="flex justify-between items-center mb-4">
                              <CardDescription>
                                設定交易項目關鍵字與對應的類型。處理報表時，將會自動帶入符合的第一個類型。
                              </CardDescription>
                               <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    重置
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>確定要重置分類規則嗎？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      此操作將會清除所有您自訂的分類規則，並恢復為系統預設值。此動作無法復原。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={resetCategoryRules}>確定重置</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader sortKey="keyword">關鍵字</SortableHeader>
                                        <SortableHeader sortKey="category">類型</SortableHeader>
                                        <TableHead className="w-[50px] text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {renderSortedCategoryFields.map((field) => {
                                      const originalIndex = categoryFields.findIndex(f => f.id === field.id);
                                      if (originalIndex === -1) return null;
                                      return (
                                        <TableRow key={field.id}>
                                            <TableCell className="p-1 w-1/2">
                                                <FormField
                                                    control={settingsForm.control}
                                                    name={`categoryRules.${originalIndex}.keyword`}
                                                    render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                        <Input placeholder="交易項目中的文字" {...field} className="h-9"/>
                                                        </FormControl>
                                                        <FormMessage className="text-xs px-2"/>
                                                    </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 w-1/2">
                                                <FormField
                                                    control={settingsForm.control}
                                                    name={`categoryRules.${originalIndex}.category`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-9">
                                                                        <SelectValue placeholder="選擇一個類型" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {availableCategories.map(cat => (
                                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage className="text-xs px-2"/>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 text-right">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCategory(originalIndex)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                </TableBody>
                              </Table>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() => appendCategory({ keyword: '', category: '' })}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              新增分類規則
                            </Button>
                          </TabsContent>
                          <TabsContent value="manage-categories" className="mt-4">
                            <CardDescription className="mb-4">
                              新增或刪除在「分類規則」下拉選單中看到的類型選項。
                            </CardDescription>
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <Input 
                                  placeholder="輸入新的類型名稱" 
                                  value={newCategory}
                                  onChange={(e) => setNewCategory(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddCategory();
                                    }
                                  }}
                                />
                                <Button type="button" onClick={handleAddCategory}>新增類型</Button>
                              </div>
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 rounded-md border p-2">
                                {availableCategories.length > 0 ? (
                                    availableCategories.sort((a,b) => a.localeCompare(b, 'zh-Hant')).map(cat => (
                                    <div key={cat} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                                        <span className="text-sm">{cat}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveCategory(cat)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center p-4">尚未新增任何類型。</p>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                        <div className="flex justify-end items-center mt-6">
                            <Button type="submit">儲存設定</Button>
                          </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {(isLoading || showResults) && (
            <Card>
              <CardHeader>
                <h3 className="text-xl font-semibold font-headline">處理結果</h3>
              </CardHeader>
              <CardContent>
                {(isLoading || isLoadingTransactions) && !hasData && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-24 rounded-md" />
                      <Skeleton className="h-10 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-48 w-full rounded-md" />
                  </div>
                )}
                
                {hasData && (
                  <div>
                    <div className="flex justify-end items-center mb-4">
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        下載 Excel
                      </Button>
                    </div>
                    <Tabs defaultValue={defaultTab} className="w-full">
                      <TabsList>
                        {combinedData.length > 0 && <TabsTrigger value="combined"><Combine className="w-4 h-4 mr-2"/>合併報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="credit">信用卡 ({creditData.length})</TabsTrigger>}
                        {depositData.length > 0 && <TabsTrigger value="deposit">活存帳戶 ({depositData.length})</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-2"/>彙總報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="chart"><BarChart2 className="w-4 h-4 mr-2"/>統計圖表</TabsTrigger>}
                      </TabsList>
                      {combinedData.length > 0 && (
                        <TabsContent value="combined">
                           <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>日期</TableHead>
                                <TableHead className="w-[120px]">類型</TableHead>
                                <TableHead>交易項目</TableHead>
                                <TableHead className="w-[100px]">來源</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {combinedData.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono">{row.date}</TableCell>
                                  <TableCell>{row.category}</TableCell>
                                  <TableCell>{row.description}</TableCell>
                                  <TableCell>{row.source}</TableCell>
                                  <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TabsContent>
                      )}
                      {creditData.length > 0 && (
                        <TabsContent value="credit">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <SortableCreditHeader sortKey="transactionDate">交易日期</SortableCreditHeader>
                                <SortableCreditHeader sortKey="category" className="w-[120px]">類型</SortableCreditHeader>
                                <TableHead>交易項目</TableHead>
                                <SortableCreditHeader sortKey="amount" className="text-right">金額</SortableCreditHeader>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedCreditData.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono">{row.transactionDate}</TableCell>
                                  <TableCell>
                                    <Select
                                        value={row.category}
                                        onValueChange={(newCategory) => handleUpdateCategory(row.id, newCategory)}
                                        disabled={!user}
                                    >
                                        <SelectTrigger className="h-8 w-full">
                                            <SelectValue placeholder="選擇類型" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>{row.description}</TableCell>
                                  <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>

                                  <TableCell className="text-center">
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteTransaction(row.id)}
                                        disabled={!user}
                                        className="h-8 w-8"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                     </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TabsContent>
                      )}
                      {depositData.length > 0 && (
                        <TabsContent value="deposit">
                          <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader>
                              <TableRow>
                                <TableHead>交易日期</TableHead>
                                <TableHead>類型</TableHead>
                                <TableHead>摘要</TableHead>
                                <TableHead>銀行代碼</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {depositData.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono">{row.date}</TableCell>
                                  <TableCell>{row.category}</TableCell>
                                  <TableCell>{row.description}</TableCell>
                                  <TableCell className="font-mono">{row.bankCode}</TableCell>
                                  <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TabsContent>
                      )}
                       {creditData.length > 0 && (
                        <TabsContent value="summary">
                           <div className="rounded-md border mt-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {summaryReportData.headers.map(header => (
                                    <TableHead key={header} className={header !== '日期（年月）' ? 'text-right' : ''}>{header}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {summaryReportData.rows.map((row, i) => (
                                  <TableRow key={i}>
                                    {summaryReportData.headers.map(header => (
                                      <TableCell key={header} className={`font-mono ${header !== '日期（年月）' ? 'text-right' : ''}`}>
                                        {typeof row[header] === 'number' ? (row[header] as number).toLocaleString() : row[header]}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      )}
                       {creditData.length > 0 && (
                        <TabsContent value="chart">
                           <div className="h-[400px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={categoryChartData}
                                margin={{
                                  top: 5, right: 30, left: 20, bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ 
                                    background: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))"
                                  }}
                                  formatter={(value: number) => value.toLocaleString()}
                                />
                                <Legend formatter={(value) => "總金額"}/>
                                <Bar dataKey="total" fill="hsl(var(--primary))" name="總金額"/>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                )}

                {noDataFound && !isLoading && !isLoadingTransactions && (
                  <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                    <AlertCircle className="mx-auto h-12 w-12" />
                    <p className="mt-4 text-lg">無有效資料</p>
                    <p className="mt-2 text-sm">我們無法從您提供的內容中解析出任何報表資料。<br/>請確認格式是否正確，或嘗試貼上其他內容。</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
