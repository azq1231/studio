'use client';

import { useState, useEffect, useMemo, useId, useRef } from 'react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, AlertCircle, Trash2, PlusCircle, Settings, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, RotateCcw, Combine, Search, Calendar as CalendarIcon, Coins, Upload, DatabaseZap, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';
import { processBankStatement, type ReplacementRule, type CategoryRule } from '@/app/actions';
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, updateDoc, deleteDoc, addDoc, getDocs, query } from 'firebase/firestore';
import { cn } from '@/lib/utils';


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

const quickFilterSchema = z.object({
  name: z.string().min(1, "請輸入名稱"),
  categories: z.array(z.string()),
});

const settingsFormSchema = z.object({
  replacementRules: z.array(replacementRuleSchema),
  categoryRules: z.array(categoryRuleSchema),
  quickFilters: z.array(quickFilterSchema),
});

const cashTransactionSchema = z.object({
    date: z.date({
        required_error: "請選擇日期",
    }),
    description: z.string().min(1, "請輸入交易項目"),
    category: z.string().min(1, "請選擇類型"),
    amount: z.number({
        required_error: "請輸入金額",
        invalid_type_error: "請輸入有效數字",
    }).min(1, "金額必須大於 0"),
    notes: z.string().optional(),
    type: z.enum(['expense', 'income']).default('expense'),
});

type StatementFormData = z.infer<typeof statementFormSchema>;
type SettingsFormData = z.infer<typeof settingsFormSchema>;
type CashTransactionFormData = z.infer<typeof cashTransactionSchema>;

type SortKey = 'keyword' | 'category';
type SortDirection = 'asc' | 'desc';
type CreditSortKey = 'date' | 'category' | 'description' | 'amount' | 'bankCode';
type DepositSortKey = 'date' | 'category' | 'description' | 'amount' | 'bankCode';
type CashSortKey = 'date' | 'category' | 'description' | 'amount' | 'notes';

type QuickFilter = z.infer<typeof quickFilterSchema>;

const ITEMS_PER_PAGE = 50;

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

const DEFAULT_QUICK_FILTERS: QuickFilter[] = [
  { name: '篩選一', categories: ['吃', '家', '固定', '秀', '弟', '玩', '姊', '華'] },
  { name: '篩選二', categories: ['方', '蘇'] },
];

async function sha1(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function FinanceFlowClient() {
  const getCreditDisplayDate = (dateString: string) => {
    try {
      // If the date is already in yyyy/MM/dd format, return it directly
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) {
          return dateString;
      }
      // This function is specifically for MM/DD format
      if (!/^\d{1,2}\/\d{1,2}$/.test(dateString)) {
          return dateString; // Return as-is if not in MM/DD format
      }
      const now = new Date();
      const currentYear = getYear(now);
      const currentMonth = getMonth(now);
      const parsedDate = parse(dateString, 'MM/dd', new Date());
      const transactionMonth = getMonth(parsedDate);
      
      let dateObj;
      if (transactionMonth > currentMonth) {
          dateObj = new Date(new Date(parsedDate).setFullYear(currentYear - 1));
      } else {
          dateObj = new Date(new Date(parsedDate).setFullYear(currentYear));
      }
      return format(dateObj, 'yyyy/MM/dd');
    } catch {
      return dateString;
    }
  };

  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isClient, setIsClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const [cashData, setCashData] = useState<CashData[]>([]);

  const { toast } = useToast();

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [creditSortKey, setCreditSortKey] = useState<CreditSortKey | null>('date');
  const [creditSortDirection, setCreditSortDirection] = useState<SortDirection>('desc');

  const [depositSortKey, setDepositSortKey] = useState<DepositSortKey | null>('date');
  const [depositSortDirection, setDepositSortDirection] = useState<SortDirection>('desc');
  
  const [cashSortKey, setCashSortKey] = useState<CashSortKey | null>('date');
  const [cashSortDirection, setCashSortDirection] = useState<SortDirection>('desc');

  const [detailViewData, setDetailViewData] = useState<CreditData[]>([]);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [detailViewTitle, setDetailViewTitle] = useState('');
  
  const [summarySelectedCategories, setSummarySelectedCategories] = useState<string[]>([]);
  const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [creditPage, setCreditPage] = useState(1);
  const [depositPage, setDepositPage] = useState(1);
  const [cashPage, setCashPage] = useState(1);


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

  const cashTransactionsQuery = useMemoFirebase(
    () => (user && firestore ? collection(firestore, 'users', user.uid, 'cashTransactions') : null),
    [user, firestore]
  );

  const { data: savedCashTransactions, isLoading: isLoadingCashTransactions } = useCollection<CashData>(cashTransactionsQuery);


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
      quickFilters: [],
    },
  });
  
  const cashTransactionForm = useForm<CashTransactionFormData>({
    resolver: zodResolver(cashTransactionSchema),
    defaultValues: {
        description: '',
        category: '',
        notes: '',
        type: 'expense'
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
  
  const { fields: quickFilterFields, append: appendQuickFilter, remove: removeQuickFilter, replace: replaceQuickFilters } = useFieldArray({
    control: settingsForm.control,
    name: "quickFilters",
  });


  useEffect(() => {
    if (isUserLoading || !savedCreditTransactions) return;

    setCreditData(prevData => {
        const existingIds = new Set(prevData.map(d => d.id));
        const newSaved = savedCreditTransactions.filter(t => !existingIds.has(t.id));
        
        const updatedData = prevData.map(old => {
            const updated = savedCreditTransactions.find(s => s.id === old.id);
            return updated ? updated : old;
        });

        if (newSaved.length === 0 && prevData.length === updatedData.length) {
            return prevData;
        }
        
        const mergedData = [...updatedData, ...newSaved];
        const uniqueData = Array.from(new Map(mergedData.map(item => [item.id, item])).values());
        
        return uniqueData;
    });

  }, [isUserLoading, savedCreditTransactions]);

  useEffect(() => {
    if (isUserLoading || !savedDepositTransactions) return;

    setDepositData(prevData => {
        const existingIds = new Set(prevData.map(d => d.id));
        const newSaved = savedDepositTransactions.filter(t => !existingIds.has(t.id));
        
        const updatedData = prevData.map(old => {
            const updated = savedDepositTransactions.find(s => s.id === old.id);
            return updated ? updated : old;
        });
        
        if (newSaved.length === 0 && prevData.length === updatedData.length) {
            return prevData;
        }
        
        const mergedData = [...updatedData, ...newSaved];
        const uniqueData = Array.from(new Map(mergedData.map(item => [item.id, item])).values());
        
        return uniqueData;
    });

  }, [isUserLoading, savedDepositTransactions]);

  useEffect(() => {
    if (isUserLoading || !savedCashTransactions) return;

    setCashData(prevData => {
        const existingIds = new Set(prevData.map(d => d.id));
        const newSaved = savedCashTransactions.filter(t => !existingIds.has(t.id));
        
        const updatedData = prevData.map(old => {
            const updated = savedCashTransactions.find(s => s.id === old.id);
            return updated ? updated : old;
        });

        if (newSaved.length === 0 && prevData.length === updatedData.length) {
            return prevData;
        }

        const mergedData = [...updatedData, ...newSaved];
        const uniqueData = Array.from(new Map(mergedData.map(item => [item.id, item])).values());

        return uniqueData;
    });
}, [isUserLoading, savedCashTransactions]);


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
  
  const resetQuickFilters = () => {
    replaceQuickFilters(DEFAULT_QUICK_FILTERS);
    localStorage.setItem('quickFilters', JSON.stringify(DEFAULT_QUICK_FILTERS));
    toast({ title: '快速篩選已重置', description: '已恢復為預設篩選。' });
  };


  useEffect(() => {
    if (!isClient) return;
    try {
      const savedCategories = localStorage.getItem('availableCategories');
      if (savedCategories) {
        setAvailableCategories(JSON.parse(savedCategories));
      } else {
        const defaultCategories = ['方', '吃', '家', '固定', '蘇', '秀', '弟', '玩', '姊', '收入', '華'];
        setAvailableCategories(defaultCategories);
        localStorage.setItem('availableCategories', JSON.stringify(defaultCategories));
      }
      const savedReplacementRules = localStorage.getItem('replacementRules');
      if (savedReplacementRules) {
        const parsed = JSON.parse(savedReplacementRules);
        if (Array.isArray(parsed)) {
           settingsForm.setValue('replacementRules', parsed);
        }
      } else {
        settingsForm.setValue('replacementRules', DEFAULT_REPLACEMENT_RULES);
      }
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
        } catch {}
      }
      settingsForm.setValue('categoryRules', finalCategoryRules);
      localStorage.setItem('categoryRules', JSON.stringify(finalCategoryRules));

      const savedQuickFilters = localStorage.getItem('quickFilters');
      if (savedQuickFilters) {
        settingsForm.setValue('quickFilters', JSON.parse(savedQuickFilters));
      } else {
        settingsForm.setValue('quickFilters', DEFAULT_QUICK_FILTERS);
      }
    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
  }, [isClient, settingsForm]);

  const handleSaveSettings = (data: SettingsFormData) => {
    try {
      const uniqueReplacementRules = Array.from(new Map(data.replacementRules.map(r => [r.find, r])).values());
      const uniqueCategoryRules = Array.from(new Map(data.categoryRules.map(r => [r.keyword, r])).values());

      localStorage.setItem('replacementRules', JSON.stringify(uniqueReplacementRules));
      localStorage.setItem('categoryRules', JSON.stringify(uniqueCategoryRules));
      localStorage.setItem('quickFilters', JSON.stringify(data.quickFilters));
      
      settingsForm.setValue('replacementRules', uniqueReplacementRules);
      settingsForm.setValue('categoryRules', uniqueCategoryRules);
      settingsForm.setValue('quickFilters', data.quickFilters);

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


  async function processAndSaveData({ text, excelData }: { text?: string; excelData?: any[][] }) {
    setIsLoading(true);
    setHasProcessed(false);
    
    const { replacementRules, categoryRules } = settingsForm.getValues();
    const result = await processBankStatement(
        text || '', 
        replacementRules, 
        categoryRules, 
        !!excelData, 
        excelData
    );
    
    if (result.success) {
      if (result.detectedCategories.length > 0) {
        const currentCats = JSON.parse(localStorage.getItem('availableCategories') || '[]');
        const newCats = result.detectedCategories.filter(c => !currentCats.includes(c));
        if (newCats.length > 0) {
            const updated = [...currentCats, ...newCats];
            setAvailableCategories(updated);
            localStorage.setItem('availableCategories', JSON.stringify(updated));
            toast({ title: '自動新增類型', description: `已新增：${newCats.join(', ')}`})
        }
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

  async function onSubmit(values: StatementFormData) {
    await processAndSaveData({ text: values.statement });
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (data instanceof ArrayBuffer) {
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy/mm/dd' });
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          const excelData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, defval: '', raw: false });
          
          await processAndSaveData({ excelData });
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        toast({
          variant: "destructive",
          title: "檔案解析失敗",
          description: "無法讀取或解析您提供的檔案，請確認格式是否正確。",
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };


  async function handleAddCashTransaction(values: CashTransactionFormData) {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: '錯誤', description: '請先登入' });
      return;
    }

    const amount = values.type === 'expense' ? values.amount : -values.amount;

    const idString = `${format(values.date, 'yyyy/MM/dd')}-${values.description}-${amount}`;
    const id = await sha1(idString);

    const newTransaction: CashData = {
      id,
      date: format(values.date, 'yyyy/MM/dd'),
      category: values.category,
      description: values.description,
      amount: amount,
      notes: values.notes,
    };

    try {
      const cashCollectionRef = collection(firestore, 'users', user.uid, 'cashTransactions');
      await addDoc(cashCollectionRef, newTransaction);
      
      toast({ title: '成功', description: '現金交易已新增' });
      cashTransactionForm.reset();

    } catch (e: any) {
      console.error("Error adding cash transaction:", e);
      toast({
        variant: "destructive",
        title: "儲存失敗",
        description: e.message || "無法將資料儲存到資料庫。",
      });
    }
  }

  function handleDownload() {
    try {
      const wb = XLSX.utils.book_new();
      
      const allData = [...sortedCreditData.data, ...sortedDepositData.data, ...sortedCashData.data];

      if (allData.length > 0) {
        const sheetData = allData.map(d => {
            if ('transactionDate' in d) { // CreditData
                return {
                    '日期': getCreditDisplayDate(d.transactionDate),
                    '類型': d.category,
                    '交易項目': d.description,
                    '金額': d.amount,
                    '備註': d.bankCode || '',
                    '來源': '信用卡'
                }
            } else if ('notes' in d) { // CashData
                 return {
                    '日期': d.date,
                    '類型': d.category,
                    '交易項目': d.description,
                    '金額': d.amount,
                    '備註': d.notes || '',
                    '來源': '現金'
                }
            } else { // DepositData
                 return {
                    '日期': d.date,
                    '類型': d.category,
                    '交易項目': d.description,
                    '金額': d.amount,
                    '備註': d.bankCode || '',
                    '來源': '活存帳戶'
                }
            }
        });
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, '合併報表');
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
        setCreditSortDirection('desc');
    }
  };

  const handleDepositSort = (key: DepositSortKey) => {
    if (depositSortKey === key) {
        setDepositSortDirection(depositSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
        setDepositSortKey(key);
        setDepositSortDirection('desc');
    }
  };
  
  const handleCashSort = (key: CashSortKey) => {
    if (cashSortKey === key) {
        setCashSortDirection(cashSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
        setCashSortKey(key);
        setCashSortDirection('desc');
    }
  };

  const handleUpdateCreditData = async (transactionId: string, field: keyof CreditData, value: string | number) => {
        // Optimistic update
        setCreditData(prevData =>
            prevData.map(item =>
                item.id === transactionId ? { ...item, [field]: value } : item
            )
        );

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'creditCardTransactions', transactionId);
                await updateDoc(docRef, { [field]: value });
            } catch (error) {
                console.error(`Error updating ${field} in Firestore:`, error);
                toast({
                    variant: "destructive",
                    title: "更新失敗",
                    description: `無法將變更儲存到資料庫。`,
                });
                // Revert optimistic update is handled by the listener
            }
        }
    };

    const handleDeleteCreditTransaction = async (transactionId: string) => {
        // Optimistic update
        const originalData = [...creditData];
        setCreditData(prevData => prevData.filter(item => item.id !== transactionId));

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'creditCardTransactions', transactionId);
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Error deleting credit transaction from Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "刪除失敗",
                    description: "無法從資料庫中刪除此筆交易。",
                });
                setCreditData(originalData); // Revert
            }
        }
    };

    const handleUpdateDepositData = async (transactionId: string, field: keyof DepositData, value: string | number) => {
        // Optimistic update
        setDepositData(prevData =>
            prevData.map(item =>
                item.id === transactionId ? { ...item, [field]: value } : item
            )
        );

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'depositAccountTransactions', transactionId);
                await updateDoc(docRef, { [field]: value });
            } catch (error) {
                console.error(`Error updating ${field} in Firestore:`, error);
                toast({
                    variant: "destructive",
                    title: "更新失敗",
                    description: "無法將變更儲存到資料庫。",
                });
                // Revert handled by listener
            }
        }
    };

    const handleDeleteDepositTransaction = async (transactionId: string) => {
        // Optimistic update
        const originalData = [...depositData];
        setDepositData(prevData => prevData.filter(item => item.id !== transactionId));

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'depositAccountTransactions', transactionId);
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Error deleting deposit transaction from Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "刪除失敗",
                    description: "無法從資料庫中刪除此筆交易。",
                });
                setDepositData(originalData); // Revert
            }
        }
    };
    
    const handleUpdateCashData = async (transactionId: string, field: keyof CashData, value: string | number) => {
        // Optimistic update
        setCashData(prevData =>
            prevData.map(item =>
                item.id === transactionId ? { ...item, [field]: value } : item
            )
        );

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'cashTransactions', transactionId);
                await updateDoc(docRef, { [field]: value });
            } catch (error) {
                console.error(`Error updating ${field} in Firestore:`, error);
                toast({
                    variant: "destructive",
                    title: "更新失敗",
                    description: `無法將變更儲存到資料庫。`,
                });
                // Revert handled by listener
            }
        }
    };

    const handleDeleteCashTransaction = async (transactionId: string) => {
        // Optimistic update
        const originalData = [...cashData];
        setCashData(prevData => prevData.filter(item => item.id !== transactionId));

        if (user && firestore) {
            try {
                const docRef = doc(firestore, 'users', user.uid, 'cashTransactions', transactionId);
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Error deleting cash transaction from Firestore:", error);
                toast({
                    variant: "destructive",
                    title: "刪除失敗",
                    description: "無法從資料庫中刪除此筆交易。",
                });
                setCashData(originalData); // Revert
            }
        }
    };

    const handleDeleteAllData = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: '錯誤', description: '請先登入' });
            return;
        }
        setIsLoading(true);
        try {
            const batch = writeBatch(firestore);

            const collectionsToDelete = [
                'creditCardTransactions',
                'depositAccountTransactions',
                'cashTransactions'
            ];

            for (const collectionName of collectionsToDelete) {
                const collectionRef = collection(firestore, 'users', user.uid, collectionName);
                const q = query(collectionRef);
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }
            
            await batch.commit();

            // Optimistically clear local state
            setCreditData([]);
            setDepositData([]);
            setCashData([]);

            toast({
                title: '成功',
                description: '您的所有交易資料已被刪除。'
            });

        } catch (e: any) {
            console.error("Error deleting all data:", e);
            toast({
                variant: 'destructive',
                title: '刪除失敗',
                description: e.message || '刪除所有資料時發生錯誤。'
            });
        } finally {
            setIsLoading(false);
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
    let filteredData = creditData;
    if (searchQuery) {
        filteredData = creditData.filter(item => 
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    if (!creditSortKey) return { data: filteredData, totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE) };

    const sorted = [...filteredData].sort((a, b) => {
        let comparison = 0;
        if (creditSortKey === 'date') {
            try {
                const dateA = new Date(getCreditDisplayDate(a.transactionDate)).getTime();
                const dateB = new Date(getCreditDisplayDate(b.transactionDate)).getTime();
                comparison = dateA - dateB;
            } catch {
                comparison = a.transactionDate.localeCompare(b.transactionDate);
            }
        } else {
            const aValue = a[creditSortKey as keyof Omit<CreditData, 'transactionDate'>];
            const bValue = b[creditSortKey as keyof Omit<CreditData, 'transactionDate'>];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue, 'zh-Hant');
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                comparison = String(aValue || '').localeCompare(String(bValue || ''), 'zh-Hant');
            }
        }

        return creditSortDirection === 'asc' ? comparison : -comparison;
    });
    const startIndex = (creditPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { data: paginatedData, totalPages: Math.ceil(sorted.length / ITEMS_PER_PAGE) };

  }, [creditData, creditSortKey, creditSortDirection, getCreditDisplayDate, searchQuery, creditPage]);

  const sortedDepositData = useMemo(() => {
    let filteredData = depositData;
    if (searchQuery) {
        filteredData = depositData.filter(item => 
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    if (!depositSortKey) return { data: filteredData, totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE) };

    const sorted = [...filteredData].sort((a, b) => {
        const aValue = a[depositSortKey];
        const bValue = b[depositSortKey];

        let comparison = 0;
        if (depositSortKey === 'date') {
            try {
                const dateA = parse(aValue as string, 'yyyy/MM/dd', new Date());
                const dateB = parse(bValue as string, 'yyyy/MM/dd', new Date());
                comparison = dateA.getTime() - dateB.getTime();
            } catch {
                comparison = (aValue as string || '').localeCompare(bValue as string || '');
            }
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'zh-Hant');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue || '').localeCompare(String(bValue || ''), 'zh-Hant');
        }

        return depositSortDirection === 'asc' ? comparison : -comparison;
    });

    const startIndex = (depositPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { data: paginatedData, totalPages: Math.ceil(sorted.length / ITEMS_PER_PAGE) };

  }, [depositData, depositSortKey, depositSortDirection, searchQuery, depositPage]);

  const sortedCashData = useMemo(() => {
    let filteredData = cashData;
    if (searchQuery) {
        filteredData = cashData.filter(item => 
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    if (!cashSortKey) return { data: filteredData, totalPages: Math.ceil(filteredData.length / ITEMS_PER_PAGE) };

    const sorted = [...filteredData].sort((a, b) => {
        const aValue = a[cashSortKey];
        const bValue = b[cashSortKey];
        let comparison = 0;
        if (cashSortKey === 'date') {
             try {
                const dateA = parse(aValue as string, 'yyyy/MM/dd', new Date());
                const dateB = parse(bValue as string, 'yyyy/MM/dd', new Date());
                comparison = dateA.getTime() - dateB.getTime();
            } catch {
                comparison = (aValue as string || '').localeCompare(bValue as string || '');
            }
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'zh-Hant');
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
             comparison = String(aValue || '').localeCompare(String(bValue || ''), 'zh-Hant');
        }

        return cashSortDirection === 'asc' ? comparison : -comparison;
    });

    const startIndex = (cashPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { data: paginatedData, totalPages: Math.ceil(sorted.length / ITEMS_PER_PAGE) };
  }, [cashData, cashSortKey, cashSortDirection, searchQuery, cashPage]);


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

  type CombinedData = {
    id: string;
    date: string;
    dateObj: Date;
    category: string;
    description: string;
    amount: number;
    source: '信用卡' | '活存帳戶' | '現金';
  };

  const combinedData = useMemo<CombinedData[]>(() => {
    let combined: CombinedData[] = [];
    
    let filteredCreditData = creditData;
    let filteredDepositData = depositData;
    let filteredCashData = cashData;

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filteredCreditData = creditData.filter(d => d.description.toLowerCase().includes(lowercasedQuery));
        filteredDepositData = depositData.filter(d => d.description.toLowerCase().includes(lowercasedQuery));
        filteredCashData = cashData.filter(d => d.description.toLowerCase().includes(lowercasedQuery));
    }

    filteredCreditData.forEach(d => {
        const displayDate = getCreditDisplayDate(d.transactionDate);
        let dateObj;
        try {
            dateObj = parse(displayDate, 'yyyy/MM/dd', new Date());
        } catch {
            dateObj = new Date(0);
        }
        combined.push({
            id: d.id,
            date: displayDate,
            dateObj: dateObj,
            category: d.category,
            description: d.description,
            amount: d.amount,
            source: '信用卡',
        });
    });

    filteredDepositData.forEach(d => {
       let dateObj;
       try {
         dateObj = parse(d.date, 'yyyy/MM/dd', new Date());
       } catch {
         dateObj = new Date(0);
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
    
    filteredCashData.forEach(d => {
       let dateObj;
       try {
         dateObj = parse(d.date, 'yyyy/MM/dd', new Date());
       } catch {
         dateObj = new Date(0);
       }
      combined.push({
        id: d.id,
        date: d.date,
        dateObj: dateObj,
        category: d.category,
        description: d.description,
        amount: d.amount,
        source: '現金',
      });
    });

    return combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [creditData, depositData, cashData, getCreditDisplayDate, searchQuery]);
  
  const summaryReportData = useMemo(() => {
    const monthlyData: Record<string, Record<string, number>> = {};
    const allCategoriesInReport = new Set<string>();

    const sourceData = combinedData.filter(item => {
        if(searchQuery){
            return item.description.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
    });

    sourceData.forEach(transaction => {
        try {
            const { dateObj, category, amount } = transaction;
            
            if (summarySelectedCategories.length > 0 && !summarySelectedCategories.includes(category)) {
                return;
            }

            allCategoriesInReport.add(category);

            const monthKey = format(dateObj, 'yyyy年M月');
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {};
            }
            if (!monthlyData[monthKey][category]) {
                monthlyData[monthKey][category] = 0;
            }
            monthlyData[monthKey][category] += amount;
        } catch(e) {
            // Ignore parsing errors
        }
    });

    const sortedCategories = Array.from(allCategoriesInReport).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
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
    }).sort((a, b) => (a['日期（年月）'] as string).localeCompare(b['日期（年月）'] as string, 'zh-Hant', { numeric: true }));
    
    return { headers, rows };
  }, [combinedData, summarySelectedCategories, searchQuery]);


  useEffect(() => {
    if (hasProcessed) {
      const currentCats = JSON.parse(localStorage.getItem('availableCategories') || '[]');
      setSummarySelectedCategories(currentCats);
    }
  }, [hasProcessed]);


  const handleSummaryCellClick = (monthKey: string, category: string) => {
    const [year, month] = monthKey.replace('年', '-').replace('月', '').split('-').map(Number);
    
    const filteredData = combinedData.filter(transaction => {
      if (transaction.category !== category) {
        return false;
      }
      try {
        const transactionYear = getYear(transaction.dateObj);
        const transactionMonth = getMonth(transaction.dateObj) + 1;
        
        return transactionYear === year && transactionMonth === month;
      } catch {
        return false;
      }
    });

    const sortedFilteredData = filteredData.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    setDetailViewData(sortedFilteredData as any);
    setDetailViewTitle(`${monthKey} - ${category}`);
    setIsDetailViewOpen(true);
  };
  
  const applyQuickFilter = (categories: string[]) => {
    const currentCats = JSON.parse(localStorage.getItem('availableCategories') || '[]');
    setAvailableCategories(currentCats);
    setSummarySelectedCategories(categories);
  }

  const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
    const [jumpToPage, setJumpToPage] = useState(String(currentPage));

    useEffect(() => {
        setJumpToPage(String(currentPage));
    }, [currentPage]);
    
    if (totalPages <= 1) return null;

    const handleJump = () => {
        let page = parseInt(jumpToPage, 10);
        if (isNaN(page) || page < 1) {
            page = 1;
        } else if (page > totalPages) {
            page = totalPages;
        }
        onPageChange(page);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleJump();
        }
    };

    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="hidden md:flex"
            >
                <ChevronsLeft className="h-4 w-4" />
                第一頁
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                上一頁
            </Button>
            <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                    第
                </span>
                <Input
                    type="number"
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9 w-16 text-center"
                    min="1"
                    max={totalPages}
                />
                 <Button variant="outline" size="sm" onClick={handleJump} className="sm:hidden">
                    <ArrowRight className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                    / {totalPages} 頁
                </span>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                下一頁
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="hidden md:flex"
            >
                最後一頁
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
  };


  const noDataFound = hasProcessed && !isLoading && creditData.length === 0 && depositData.length === 0 && cashData.length === 0;
  const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
  
  const defaultTab = hasData
    ? (creditData.length > 0 ? "credit" : (depositData.length > 0 ? "deposit" : "cash"))
    : "statement";

  const isLoadingTransactions = isLoadingCreditTransactions || isLoadingDepositTransactions || isLoadingCashTransactions;
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

  const SortableCreditHeader = ({ sortKey: key, children, style }: { sortKey: CreditSortKey, children: React.ReactNode, style?: React.CSSProperties }) => {
    const isSorted = creditSortKey === key;
    return (
      <TableHead style={style}>
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

  const SortableDepositHeader = ({ sortKey: key, children, style }: { sortKey: DepositSortKey, children: React.ReactNode, style?: React.CSSProperties }) => {
    const isSorted = depositSortKey === key;
    return (
      <TableHead style={style}>
        <Button variant="ghost" onClick={() => handleDepositSort(key)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (
            depositSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </TableHead>
    );
  };
  
  const SortableCashHeader = ({ sortKey: key, children, style }: { sortKey: CashSortKey, children: React.ReactNode, style?: React.CSSProperties }) => {
    const isSorted = cashSortKey === key;
    return (
      <TableHead style={style}>
        <Button variant="ghost" onClick={() => handleCashSort(key)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (
            cashSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </TableHead>
    );
  };
  
  const detailDialogId = useId();

  return (
    <div className="space-y-4">
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>貼上報表內容</CardTitle>
                    <CardDescription className="mt-2">
                        {isClient && user
                        ? "將您的網路銀行報表內容直接複製並貼到下方文字框中，或點擊右方按鈕匯入 Excel 檔案。處理後的資料將會自動儲存到您的帳戶。"
                        : "將您的網路銀行報表內容直接複製並貼到下方文字框中，或點擊右方按鈕匯入 Excel 檔案。如需儲存資料，請先登入。"}
                    </CardDescription>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        從檔案匯入
                    </Button>
                </div>
            </div>
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
                          <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="replacement">取代規則</TabsTrigger>
                            <TabsTrigger value="category">分類規則</TabsTrigger>
                             <TabsTrigger value="quick-filters">快速篩選</TabsTrigger>
                            <TabsTrigger value="manage-categories">管理類型</TabsTrigger>
                            <TabsTrigger value="data-management">資料管理</TabsTrigger>
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
                                    <TableHead className="w-2_5">取代為</TableHead>
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
                          <TabsContent value="quick-filters" className="mt-4">
                             <div className="flex justify-between items-center mb-4">
                              <CardDescription>
                                自訂彙總報表中的快速篩選按鈕，方便您一鍵切換常用的類別組合。
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
                                    <AlertDialogTitle>確定要重置快速篩選嗎？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      此操作將會清除所有您自訂的快速篩選，並恢復為系統預設值。此動作無法復原。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={resetQuickFilters}>確定重置</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                            <div className="space-y-4">
                                {quickFilterFields.map((field, index) => (
                                  <Card key={field.id} className="p-4 relative">
                                    <div className="space-y-4">
                                      <FormField
                                          control={settingsForm.control}
                                          name={`quickFilters.${index}.name`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>按鈕名稱</FormLabel>
                                              <FormControl>
                                                <Input {...field} className="max-w-xs" />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      <FormField
                                        control={settingsForm.control}
                                        name={`quickFilters.${index}.categories`}
                                        render={() => (
                                          <FormItem>
                                            <FormLabel>包含的類型</FormLabel>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 rounded-md border p-4">
                                              {availableCategories.map((cat) => (
                                                <FormField
                                                  key={cat}
                                                  control={settingsForm.control}
                                                  name={`quickFilters.${index}.categories`}
                                                  render={({ field }) => {
                                                    return (
                                                      <FormItem
                                                        key={cat}
                                                        className="flex flex-row items-start space-x-2 space-y-0"
                                                      >
                                                        <FormControl>
                                                          <Checkbox
                                                            checked={field.value?.includes(cat)}
                                                            onCheckedChange={(checked) => {
                                                              return checked
                                                                ? field.onChange([...(field.value || []), cat])
                                                                : field.onChange(
                                                                    (field.value || []).filter(
                                                                      (value) => value !== cat
                                                                    )
                                                                  )
                                                            }}
                                                          />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                          {cat}
                                                        </FormLabel>
                                                      </FormItem>
                                                    )
                                                  }}
                                                />
                                              ))}
                                            </div>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute top-2 right-2 h-8 w-8"
                                      onClick={() => removeQuickFilter(index)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </Card>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => appendQuickFilter({ name: `篩選 ${quickFilterFields.length + 1}`, categories: [] })}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                新增快速篩選
                              </Button>
                          </TabsContent>
                          <TabsContent value="manage-categories" className="mt-4">
                            <CardDescription className="mb-4">
                              新增或刪除在「分類規則」下拉選單中看到的類型選項。
                            </CardDescription>
                            <div className="space-y-4">
                              <div className="flex gap-2">
                                <Input 
                                  placeholder="輸入新的類型名称" 
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
                          <TabsContent value="data-management" className="mt-4">
                            <CardDescription className="mb-4">
                                執行永久性的資料操作。請謹慎使用。
                            </CardDescription>
                            <Card className="border-destructive">
                                <CardHeader>
                                    <CardTitle className="text-destructive">危險區域</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm mb-4">
                                        此操作將會永久刪除您帳戶中**所有**的交易紀錄，包含信用卡、活存帳戶與現金收支。
                                        此動作無法復原。
                                    </p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button type="button" variant="destructive" disabled={!user}>
                                            <DatabaseZap className="mr-2 h-4 w-4" />
                                            刪除所有交易資料
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>您確定嗎？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              您即將永久刪除所有交易資料。此動作無法復原，所有已儲存的報表資料都將遺失。
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteAllData}>確定刪除</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                </CardContent>
                            </Card>
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
                    <div className="flex justify-between items-center mb-4 gap-4">
                       <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="尋找交易項目..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
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
                        <TabsTrigger value="cash">現金 ({cashData.length})</TabsTrigger>}
                        {(creditData.length > 0 || depositData.length > 0 || cashData.length > 0) && <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-2"/>彙總報表</TabsTrigger>}
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
                                <SortableCreditHeader sortKey="date" style={{ width: '110px' }}>日期</SortableCreditHeader>
                                <TableHead style={{ width: '110px' }}>類型</TableHead>
                                <TableHead>交易項目</TableHead>
                                <SortableCreditHeader sortKey="amount" style={{ width: '100px' }}>金額</SortableCreditHeader>
                                <TableHead>銀行代碼/備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedCreditData.data.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell style={{ width: '110px' }}>
                                    <div className="font-mono">{getCreditDisplayDate(row.transactionDate)}</div>
                                  </TableCell>
                                  <TableCell style={{ width: '110px' }}>
                                    <Select
                                        value={row.category}
                                        onValueChange={(newCategory) => handleUpdateCreditData(row.id, 'category', newCategory)}
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
                                  <TableCell>
                                    <Input
                                        type="text"
                                        defaultValue={row.description}
                                        onBlur={(e) => handleUpdateCreditData(row.id, 'description', e.target.value)}
                                        disabled={!user}
                                        className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Input
                                        type="text"
                                        defaultValue={row.bankCode || ''}
                                        onBlur={(e) => handleUpdateCreditData(row.id, 'bankCode', e.target.value)}
                                        disabled={!user}
                                        className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCreditTransaction(row.id)}
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
                          <PaginationControls
                            currentPage={creditPage}
                            totalPages={sortedCreditData.totalPages}
                            onPageChange={setCreditPage}
                           />
                        </TabsContent>
                      )}
                      {depositData.length > 0 && (
                        <TabsContent value="deposit">
                          <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader>
                              <TableRow>
                                <SortableDepositHeader sortKey="date" style={{ width: '110px' }}>日期</SortableDepositHeader>
                                <SortableDepositHeader sortKey="category" style={{ width: '110px' }}>類型</SortableDepositHeader>
                                <SortableDepositHeader sortKey="description">交易項目</SortableDepositHeader>
                                <SortableDepositHeader sortKey="amount" style={{ width: '100px' }}>金額</SortableDepositHeader>
                                <TableHead>銀行代碼/備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedDepositData.data.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell style={{ width: '110px' }}>
                                    <div className="font-mono">{row.date}</div>
                                  </TableCell>
                                  <TableCell style={{ width: '110px' }}>
                                     <Select
                                        value={row.category}
                                        onValueChange={(newCategory) => handleUpdateDepositData(row.id, 'category', newCategory)}
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
                                  <TableCell>
                                    <Input
                                        type="text"
                                        defaultValue={row.description}
                                        onBlur={(e) => handleUpdateDepositData(row.id, 'description', e.target.value)}
                                        disabled={!user}
                                        className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                                  <TableCell>
                                      <Input
                                        type="text"
                                        defaultValue={row.bankCode || ''}
                                        onBlur={(e) => handleUpdateDepositData(row.id, 'bankCode', e.target.value)}
                                        disabled={!user}
                                        className="h-8"
                                    />
                                  </TableCell>
                                   <TableCell className="text-center">
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteDepositTransaction(row.id)}
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
                          <PaginationControls
                            currentPage={depositPage}
                            totalPages={sortedDepositData.totalPages}
                            onPageChange={setDepositPage}
                          />
                        </TabsContent>
                      )}
                      
                        <TabsContent value="cash">
                          <Card className="mb-4">
                            <CardHeader>
                                <CardTitle>新增現金交易</CardTitle>
                            </CardHeader>
                            <CardContent>
                               <Form {...cashTransactionForm}>
                                    <form onSubmit={cashTransactionForm.handleSubmit(handleAddCashTransaction)} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormField
                                                control={cashTransactionForm.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                    <FormLabel>日期</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                            >
                                                            {field.value ? (
                                                                format(field.value, "yyyy/MM/dd")
                                                            ) : (
                                                                <span>選擇日期</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
                                                            }
                                                            initialFocus
                                                        />
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={cashTransactionForm.control}
                                                name="description"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>交易項目</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="例如：午餐" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                             <FormField
                                                control={cashTransactionForm.control}
                                                name="amount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>金額</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" placeholder="120" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={cashTransactionForm.control}
                                                name="category"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>類型</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="選擇一個類型" />
                                                            </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {availableCategories.map(cat => (
                                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={cashTransactionForm.control}
                                                name="notes"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>備註</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="（選填）" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={!user || cashTransactionForm.formState.isSubmitting}>
                                                {cashTransactionForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                新增
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                          </Card>
                          <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader>
                              <TableRow>
                                <SortableCashHeader sortKey="date" style={{ width: '110px' }}>日期</SortableCashHeader>
                                <TableHead style={{ width: '110px' }}>類型</TableHead>
                                <TableHead>交易項目</TableHead>
                                <SortableCashHeader sortKey="amount" style={{ width: '100px' }}>金額</SortableCashHeader>
                                <TableHead>備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedCashData.data.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell>
                                  <TableCell style={{ width: '110px' }}>
                                    <Select
                                      value={row.category}
                                      onValueChange={(newCategory) => handleUpdateCashData(row.id, 'category', newCategory)}
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
                                  <TableCell>
                                    <Input
                                      type="text"
                                      defaultValue={row.description}
                                      onBlur={(e) => handleUpdateCashData(row.id, 'description', e.target.value)}
                                      disabled={!user}
                                      className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="text"
                                      defaultValue={row.notes || ''}
                                      onBlur={(e) => handleUpdateCashData(row.id, 'notes', e.target.value)}
                                      disabled={!user}
                                      className="h-8"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteCashTransaction(row.id)}
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
                          <PaginationControls
                            currentPage={cashPage}
                            totalPages={sortedCashData.totalPages}
                            onPageChange={setCashPage}
                          />
                        </TabsContent>
                      
                       {(creditData.length > 0 || depositData.length > 0 || cashData.length > 0) && (
                        <TabsContent value="summary">
                          <div className="flex flex-wrap items-center gap-2 my-4">
                              <Popover open={isSummaryFilterOpen} onOpenChange={setIsSummaryFilterOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline">
                                    篩選類型 ({summarySelectedCategories.length}/{availableCategories.length})
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0">
                                   <div className="p-2 space-y-1">
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories(availableCategories)}>
                                      全選
                                    </Button>
                                     <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories([])}>
                                      全部取消
                                    </Button>
                                  </div>
                                  <div className="border-t max-h-60 overflow-y-auto p-2">
                                  {availableCategories.sort((a,b)=> a.localeCompare(b, 'zh-Hant')).map(category => (
                                    <div key={category} className="flex items-center space-x-2 p-1">
                                      <Checkbox
                                        id={`cat-${category}`}
                                        checked={summarySelectedCategories.includes(category)}
                                        onCheckedChange={(checked) => {
                                          const currentCats = JSON.parse(localStorage.getItem('availableCategories') || '[]');
                                          setAvailableCategories(currentCats);
                                          return checked
                                            ? setSummarySelectedCategories([...summarySelectedCategories, category])
                                            : setSummarySelectedCategories(summarySelectedCategories.filter(c => c !== category))
                                        }}
                                      />
                                      <label
                                        htmlFor={`cat-${category}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        {category}
                                      </label>
                                    </div>
                                  ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {settingsForm.getValues('quickFilters').map((filter, index) => (
                                <Button key={index} variant="outline" size="sm" onClick={() => applyQuickFilter(filter.categories)}>
                                  {filter.name}
                                </Button>
                              ))}
                              <p className="text-sm text-muted-foreground hidden md:block ml-auto">點擊表格中的數字可查看該月份的交易明細。</p>
                          </div>
                           <div className="rounded-md border">
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
                                    {summaryReportData.headers.map(header => {
                                      const isClickable = header !== '日期（年月）' && header !== '總計' && typeof row[header] === 'number' && (row[header] as number) !== 0;
                                      const value = row[header];
                                      let textColor = '';
                                      if (typeof value === 'number') {
                                          if (header.includes('收入')) textColor = 'text-green-600';
                                          else if (value < 0) textColor = 'text-green-600';
                                          else if (value > 0) textColor = 'text-destructive';
                                      }

                                      return (
                                        <TableCell key={header} className={`font-mono ${header !== '日期（年月）' ? 'text-right' : ''} ${textColor}`}>
                                          {isClickable ? (
                                             <button onClick={() => handleSummaryCellClick(row['日期（年月）'] as string, header)} className="hover:underline hover:text-blue-500">
                                                {(row[header] as number).toLocaleString()}
                                              </button>
                                          ) : (
                                            typeof row[header] === 'number' ? (row[header] as number).toLocaleString() : row[header]
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      )}
                       {creditData.length > 0 && (
                        <TabsContent value="chart">
                           <Card>
                            <CardHeader>
                                <CardTitle>信用卡消費分類統計</CardTitle>
                                <CardDescription>此圖表顯示信用卡的各類別總支出。 (僅計算正數金額)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div style={{ width: '100%', height: 400 }}>
                                  <ResponsiveContainer>
                                      <BarChart
                                        layout="vertical"
                                        data={categoryChartData}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={80} />
                                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                        <Legend />
                                        <Bar dataKey="total" fill="var(--color-chart-1)" name="總支出" />
                                      </BarChart>
                                  </ResponsiveContainer>
                                </div>
                            </CardContent>
                           </Card>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                )}

                {noDataFound && !isLoading && !isLoadingTransactions && (
                  <div className="text-center py-10">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">沒有找到資料</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                    我們無法從您提供的內容中解析出任何報表資料。
                    <br />
                    請確認格式是否正確，或嘗試貼上其他內容。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
        <DialogContent className="max-w-4xl h-4/5 flex flex-col" id={detailDialogId}>
            <DialogHeader>
                <DialogTitle>{detailViewTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>日期</TableHead>
                            <TableHead>交易項目</TableHead>
                            <TableHead>來源</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {detailViewData.length > 0 ? (
                        detailViewData.map(item => (
                            <TableRow key={item.id}>
                            <TableCell>{(item as any).date || getCreditDisplayDate((item as any).transactionDate)}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{(item as any).source || '信用卡'}</TableCell>
                            <TableCell className={`text-right ${item.amount < 0 ? 'text-green-600' : ''}`}>{item.amount.toLocaleString()}</TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">沒有找到相關交易紀錄。</TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
