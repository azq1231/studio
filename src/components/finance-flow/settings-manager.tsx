'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from 'firebase/auth';

import { useToast } from "@/hooks/use-toast";
import type { ReplacementRule, CategoryRule } from '@/lib/processor';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { AlertCircle, Trash2, ChevronsUpDown, ArrowDown, ArrowUp, Loader2, Settings, PlusCircle, RotateCcw, DatabaseZap, FileUp, Download as DownloadIcon, Search, ListFilter, Wallet, ArrowRightLeft, ShieldAlert } from 'lucide-react';

const replacementRuleSchema = z.object({
  find: z.string().min(1, { message: '請輸入要尋找的文字' }),
  replace: z.string(),
  deleteRow: z.boolean().or(z.undefined()).transform(v => !!v),
  notes: z.string().optional().or(z.null()).transform(v => v ?? ''),
});

const categoryRuleSchema = z.object({
  keyword: z.string().min(1, { message: '請輸入關鍵字' }),
  category: z.string().min(1, { message: '請選擇一個類型' }),
});

const quickFilterSchema = z.object({
  name: z.string().min(1, "請輸入名稱"),
  categories: z.array(z.string()),
});

const descriptionGroupingRuleSchema = z.object({
  groupName: z.string().min(1, { message: '請輸入群組名稱' }),
  keywords: z.string().min(1, { message: '請輸入至少一個關鍵字' }),
});

const balanceAccountSchema = z.object({
  name: z.string().min(1, { message: '請輸入帳戶名稱' }),
  category: z.string().min(1, { message: '請選擇一個類別' }),
  keywords: z.string().min(1, { message: '請輸入關鍵字（逗號分隔）' }),
});

const settingsFormSchema = z.object({
  replacementRules: z.array(replacementRuleSchema),
  categoryRules: z.array(categoryRuleSchema),
  quickFilters: z.array(quickFilterSchema),
  descriptionGroupingRules: z.array(descriptionGroupingRuleSchema),
  balanceAccounts: z.array(balanceAccountSchema),
});

export type DescriptionGroupingRule = {
  groupName: string;
  keywords: string;
};

export type BalanceAccount = {
  name: string;
  category: string;
  keywords: string;
};

export type AppSettings = {
  availableCategories: string[];
  replacementRules: ReplacementRule[];
  categoryRules: CategoryRule[];
  quickFilters: QuickFilter[];
  cashTransactionDescriptions: string[];
  descriptionGroupingRules: DescriptionGroupingRule[];
  balanceAccounts: BalanceAccount[];
};
type SettingsFormData = z.infer<typeof settingsFormSchema>;
type SortKey = 'keyword' | 'category';
type SortDirection = 'asc' | 'desc';
export type QuickFilter = z.infer<typeof quickFilterSchema>;

const DEFAULT_REPLACEMENT_RULES: ReplacementRule[] = [
  { find: '行銀非約跨優', replace: '', deleteRow: false, notes: '' },
  { find: 'ＣＤＭ存款', replace: '', deleteRow: true, notes: '' }
];

const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  { keyword: 'VULTR', category: '方' }, { keyword: '國外交易服務費', category: '方' }, { keyword: 'GOOGLE*CLOUD', category: '方' }, { keyword: '悠遊卡自動加值', category: '方' }, { keyword: 'REPLIT, INC.', category: '方' }, { keyword: '伯朗咖啡', category: '方' }, { keyword: '柒號洋樓', category: '方' }, { keyword: 'ＰＣＨＯＭＥ', category: '方' }, { keyword: 'OPENAI', category: '方' }, { keyword: '新東陽', category: '吃' }, { keyword: '全家', category: '吃' }, { keyword: '元心燃麻辣堂', category: '吃' }, { keyword: '統一超商', category: '吃' }, { keyword: '玉喜飯店', category: '吃' }, { keyword: '爭鮮', category: '吃' }, { keyword: '八方雲集', category: '吃' }, { keyword: '樂活養生健康鍋', category: '吃' }, { keyword: '順成西點麵包', category: '吃' }, { keyword: '誠品生活', category: '吃' }, { keyword: '星巴克－自動加值', category: '吃' }, { keyword: 'COMFORT BURGER', category: '吃' }, { keyword: '雙月食品社', category: '吃' }, { keyword: '秀泰全球影城', category: '吃' }, { keyword: '台灣麥當勞', category: '吃' }, { keyword: '筷子餐廳', category: '吃' }, { keyword: '怡客咖啡', category: '吃' }, { keyword: '起家雞', category: '吃' }, { keyword: '彼得好咖啡', category: '吃' }, { keyword: '御書園', category: '吃' }, { keyword: '五花馬水餃館', category: '吃' }, { keyword: '客美多咖啡', category: '吃' }, { keyword: '明曜百貨', category: '吃' }, { keyword: 'ＫＦＣ', category: '吃' }, { keyword: '鬥牛士經典牛排', category: '吃' }, { keyword: '街口電支', category: '吃' }, { keyword: '必勝客', category: '吃' }, { keyword: '丰禾', category: '吃' }, { keyword: '春水堂', category: '吃' }, { keyword: '上島珈琲店', category: '吃' }, { keyword: '加油站', category: '家' }, { keyword: '全聯', category: '家' }, { keyword: '55688', category: '家' }, { keyword: 'IKEA', category: '家' }, { keyword: '優步', category: '家' }, { keyword: 'OP錢包', category: '家' }, { keyword: 'NET', category: '家' }, { keyword: '威秀影城', category: '家' }, { keyword: '中油', category: '家' }, { keyword: '高鐵智慧型手機', category: '家' }, { keyword: 'Ｍｉｓｔｅｒ　Ｄｏｎｕｔ', category: '家' }, { keyword: '墊腳石圖書', category: '家' }, { keyword: '燦坤３Ｃ', category: '家' }, { keyword: '屈臣氏', category: '家' }, { keyword: 'APPLE.COM/BILL', category: '家' }, { keyword: '一之軒', category: '家' }, { keyword: '城市車旅', category: '家' }, { keyword: '台灣小米', category: '家' }, { keyword: '麗冠有線電視', category: '固定' }, { keyword: '09202***01', category: '固定' }, { keyword: '國都汽車', category: '固定' }, { keyword: '台灣電力', category: '固定' }, { keyword: '台北市自來水費', category: '固定' }, { keyword: '汽車驗車', category: '固定' }, { keyword: '大安文山有線電視', category: '固定' }, { keyword: '橙印良品', category: '蘇' }, { keyword: 'PayEasy', category: '蘇' }, { keyword: '樂購蝦皮', category: '蘇' }, { keyword: '饗賓餐旅', category: '蘇' }, { keyword: 'TAOBAO.COM', category: '蘇' }, { keyword: '拓元票務', category: '蘇' }, { keyword: '三創數位', category: '蘇' }, { keyword: '金玉堂', category: '秀' }, { keyword: '寶雅', category: '秀' }, { keyword: '特力屋', category: '秀' }, { keyword: '悠遊付－臺北市立大學', category: '秀' }, { keyword: '嘟嘟房', category: '弟' }, { keyword: '台東桂田喜來登酒店', category: '玩' }, { keyword: '家樂福', category: '玩' }, { keyword: '台東原生應用植物園', category: '玩' }, { keyword: '格上租車', category: '玩' }, { keyword: '悠勢科技股份有限公司', category: '收入' }, { keyword: '行政院發', category: '收入' }, { keyword: 'linePay繳好市多', category: '家' }, { keyword: '國保保費', category: '固定' }, { keyword: '怡秀跆拳道', category: '華' }, { keyword: 'iPassMoney儲值', category: '方' }, { keyword: '逸安中醫', category: '蘇' }, { keyword: '連結帳戶交易', category: '家' }, { keyword: '花都管理費', category: '固定' }, { keyword: '9/11', category: '姊' }, { keyword: '6/18', category: '姊' },
];

const DEFAULT_QUICK_FILTERS: QuickFilter[] = [
  { name: '篩選一', categories: ['吃', '家', '固定', '秀', '弟', '玩', '姊', '華'] },
  { name: '篩選二', categories: ['方', '蘇'] },
];

const DEFAULT_DESCRIPTION_GROUPING_RULES: DescriptionGroupingRule[] = [
  { groupName: '汽車', keywords: '汽車,中油,加油站,城市車旅,汽車驗車' },
];

const DEFAULT_CATEGORIES = ['方', '吃', '家', '固定', '蘇', '秀', '弟', '玩', '姊', '收入', '華', '投資'];
const DEFAULT_CASH_DESCRIPTIONS = ['現金餘額', '提款', '生活費', '零用錢'];

export const DEFAULT_SETTINGS: AppSettings = {
  availableCategories: DEFAULT_CATEGORIES,
  replacementRules: DEFAULT_REPLACEMENT_RULES,
  categoryRules: DEFAULT_CATEGORY_RULES,
  quickFilters: DEFAULT_QUICK_FILTERS,
  cashTransactionDescriptions: DEFAULT_CASH_DESCRIPTIONS,
  descriptionGroupingRules: DEFAULT_DESCRIPTION_GROUPING_RULES,
  balanceAccounts: [
    { name: '老弟停車費', category: '弟', keywords: '停車費, 預付' }
  ],
};

export function SettingsManager({
  onDeleteAllData,
  onSaveSettings,
  isProcessing,
  user,
  settings,
  setSettings,
}: {
  onDeleteAllData: () => Promise<void>;
  onSaveSettings: (newSettings: AppSettings, isInitial?: boolean) => Promise<void>;
  isProcessing: boolean;
  user: User | null;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}) {
  const { toast } = useToast();
  const [newCategory, setNewCategory] = useState('');
  const [newCashDescription, setNewCashDescription] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      replacementRules: settings.replacementRules.map(r => ({
        find: r.find,
        replace: r.replace,
        deleteRow: !!r.deleteRow,
        notes: r.notes || ''
      })),
      categoryRules: settings.categoryRules,
      quickFilters: settings.quickFilters,
      descriptionGroupingRules: settings.descriptionGroupingRules,
      balanceAccounts: settings.balanceAccounts || [],
    }
  });

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    const data = settingsForm.getValues();

    const keywords = new Set<string>();
    for (const rule of data.categoryRules) {
      if (keywords.has(rule.keyword)) {
        toast({
          variant: 'destructive',
          title: '儲存失敗',
          description: `分類規則中的關鍵字 「${rule.keyword}」 重複了。請移除重複的項目後再儲存。`,
        });
        setIsSaving(false);
        return;
      }
      keywords.add(rule.keyword);
    }

    const newSettings: AppSettings = {
      ...settings,
      ...data,
    };

    try {
      await onSaveSettings(newSettings);
      setIsDirty(false);
    } catch (error) {
      // Error toast is handled in the parent component
    } finally {
      setIsSaving(false);
    }
  }, [settings, onSaveSettings, toast, settingsForm]);

  // Removed redundant reset Effect as useForm uses the 'values' property for automatic syncing

  const { fields: replacementFields, append: appendReplacement, remove: removeReplacement } = useFieldArray({ control: settingsForm.control, name: 'replacementRules' });
  const { fields: categoryFields, append: appendCategory, remove: removeCategory } = useFieldArray({ control: settingsForm.control, name: 'categoryRules' });
  const { fields: quickFilterFields, append: appendQuickFilter, remove: removeQuickFilter } = useFieldArray({ control: settingsForm.control, name: "quickFilters" });
  const { fields: groupingRuleFields, append: appendGroupingRule, remove: removeGroupingRule } = useFieldArray({ control: settingsForm.control, name: "descriptionGroupingRules" });
  const { fields: balanceAccountFields, append: appendBalanceAccount, remove: removeBalanceAccount } = useFieldArray({ control: settingsForm.control, name: "balanceAccounts" });



  const handleAddCategory = () => {
    if (newCategory && !settings.availableCategories.includes(newCategory)) {
      const newCategories = [...settings.availableCategories, newCategory];
      setSettings(prev => ({ ...prev, availableCategories: newCategories }));
      onSaveSettings({ ...settings, availableCategories: newCategories });
      setNewCategory('');
      toast({ title: '類型已新增', description: `「${newCategory}」已成功新增。` });
    } else if (settings.availableCategories.includes(newCategory)) {
      toast({ variant: 'destructive', title: '新增失敗', description: '此類型已存在。' });
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    const newCategories = settings.availableCategories.filter(c => c !== categoryToRemove);
    const newCategoryRules = settingsForm.getValues('categoryRules').filter(rule => rule.category !== categoryToRemove);
    setSettings(prev => ({ ...prev, availableCategories: newCategories }));
    settingsForm.setValue('categoryRules', newCategoryRules);
    onSaveSettings({ ...settings, availableCategories: newCategories, categoryRules: newCategoryRules });
    toast({ title: '類型已刪除', description: `「${categoryToRemove}」已被移除。` });
  };

  const handleAddCashDescription = () => {
    if (newCashDescription && !settings.cashTransactionDescriptions.includes(newCashDescription)) {
      const newDescriptions = [...settings.cashTransactionDescriptions, newCashDescription];
      setSettings(prev => ({ ...prev, cashTransactionDescriptions: newDescriptions }));
      onSaveSettings({ ...settings, cashTransactionDescriptions: newDescriptions });
      setNewCashDescription('');
      toast({ title: '現金項目已新增', description: `「${newCashDescription}」已成功新增。` });
    } else if (settings.cashTransactionDescriptions.includes(newCashDescription)) {
      toast({ variant: 'destructive', title: '新增失敗', description: '此項目已存在。' });
    }
  };

  const handleRemoveCashDescription = (descriptionToRemove: string) => {
    const newDescriptions = settings.cashTransactionDescriptions.filter(d => d !== descriptionToRemove);
    setSettings(prev => ({ ...prev, cashTransactionDescriptions: newDescriptions }));
    onSaveSettings({ ...settings, cashTransactionDescriptions: newDescriptions });
    toast({ title: '現金項目已刪除', description: `「${descriptionToRemove}」已被移除。` });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  };

  const renderSortedCategoryFields = useMemo(() => {
    let filtered = [...categoryFields];

    // Search Filter
    if (ruleSearch) {
      filtered = filtered.filter(field => {
        const index = categoryFields.findIndex(f => f.id === field.id);
        const keyword = settingsForm.getValues(`categoryRules.${index}.keyword`) || '';
        const category = settingsForm.getValues(`categoryRules.${index}.category`) || '';
        return keyword.toLowerCase().includes(ruleSearch.toLowerCase()) ||
          category.toLowerCase().includes(ruleSearch.toLowerCase());
      });
    }

    // Category Filter
    if (selectedFilterCategory) {
      filtered = filtered.filter(field => {
        const index = categoryFields.findIndex(f => f.id === field.id);
        return settingsForm.getValues(`categoryRules.${index}.category`) === selectedFilterCategory;
      });
    }

    // Sorting
    if (!sortKey) return filtered;
    return filtered.sort((a, b) => {
      const aIndex = categoryFields.findIndex(f => f.id === a.id);
      const bIndex = categoryFields.findIndex(f => f.id === b.id);
      const aValue = settingsForm.getValues(`categoryRules.${aIndex}.${sortKey}`) || '';
      const bValue = settingsForm.getValues(`categoryRules.${bIndex}.${sortKey}`) || '';
      const comparison = aValue.localeCompare(bValue, 'zh-Hant');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categoryFields, sortKey, sortDirection, settingsForm, ruleSearch, selectedFilterCategory]);

  const resetAllSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    onSaveSettings(DEFAULT_SETTINGS);
    toast({ title: '所有設定已重置為預設值' });
  };

  const handleExportSettings = () => {
    try {
      const currentSettings: AppSettings = {
        ...settingsForm.getValues(),
        availableCategories: settings.availableCategories,
        cashTransactionDescriptions: settings.cashTransactionDescriptions,
      };
      const jsonString = JSON.stringify(currentSettings, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finance-flow-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: '設定已匯出' });
    } catch (error) {
      toast({ variant: 'destructive', title: '匯出失敗', description: '匯出設定時發生錯誤。' });
    }
  };

  const handleImportFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('無法讀取檔案內容');
        }
        const importedSettings = JSON.parse(text) as AppSettings;

        // Basic validation
        if (
          !importedSettings ||
          !Array.isArray(importedSettings.availableCategories) ||
          !Array.isArray(importedSettings.replacementRules) ||
          !Array.isArray(importedSettings.categoryRules) ||
          !Array.isArray(importedSettings.quickFilters) ||
          !Array.isArray(importedSettings.cashTransactionDescriptions)
        ) {
          throw new Error('檔案格式不符');
        }

        setSettings(importedSettings);
        onSaveSettings(importedSettings);

        toast({ title: '設定已成功匯入', description: '請檢查匯入的規則。' });

      } catch (error: any) {
        toast({ variant: 'destructive', title: '匯入失敗', description: error.message || '無法解析設定檔案，請確認檔案是否正確。' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>規則設定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">請先登入</h3>
            <p className="mt-2 text-sm text-muted-foreground">登入後即可管理您的個人化規則設定。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>規則設定</CardTitle>
        <CardDescription>管理報表處理、分類和資料的規則。您的設定將會自動儲存到雲端。</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...settingsForm}>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <Tabs defaultValue="category" className="w-full">
              <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="w-full justify-start md:justify-center md:grid md:grid-cols-5 h-auto p-1">
                  <TabsTrigger value="basic" className="text-xs px-2 py-2">基礎規則</TabsTrigger>
                  <TabsTrigger value="category" className="text-xs px-2 py-2">自動分類</TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs px-2 py-2">進階設定</TabsTrigger>
                  <TabsTrigger value="balance" className="text-xs px-2 py-2">專款管理</TabsTrigger>
                  <TabsTrigger value="system" className="text-xs px-2 py-2">系統維護</TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Basic Rules */}
              <TabsContent value="basic" className="space-y-4">
                <Accordion type="single" collapsible className="w-full" defaultValue="replacement">
                  <AccordionItem value="replacement">
                    <AccordionTrigger className="text-base font-semibold">文字取代規則</AccordionTrigger>
                    <AccordionContent>
                      <CardDescription className="mb-4">設定自動取代或刪除規則。勾選「刪除整筆資料」後，符合條件的資料將被整筆移除。</CardDescription>
                      <div className="mb-4">
                        <details className="group border border-dashed border-primary/30 rounded-lg bg-muted/50 overflow-hidden">
                          <summary className="flex items-center gap-2 p-3 font-semibold text-primary cursor-pointer hover:bg-primary/5 transition-colors list-none">
                            <DatabaseZap className="h-4 w-4" /> 💡 技巧：如何自動提取案號/序號
                          </summary>
                          <div className="px-3 pb-3 text-sm text-muted-foreground border-t border-primary/10 pt-2">
                            <ul className="list-disc list-inside space-y-1 ml-1">
                              <li>使用 <code>(\d+)</code> 抓取變動數字（如：案號、序號）。</li>
                              <li>使用 <code>(.*)</code> 抓取任何剩餘文字。</li>
                              <li><strong>範例</strong>：尋找 <code>代繳健保費 (\d+)</code> 取代為 <code>代繳健保費</code>，系統會自動將案號移至備註。</li>
                            </ul>
                          </div>
                        </details>
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block rounded-md border">
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-1/4">尋找文字</TableHead><TableHead className="w-1/4">取代為</TableHead><TableHead className="w-1/4">備註</TableHead><TableHead className="w-1/6 text-center">刪除整筆資料</TableHead><TableHead className="w-[50px]">操作</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {replacementFields.map((field, index) => (
                              <TableRow key={field.id}>
                                <TableCell className="p-1"><FormField control={settingsForm.control} name={`replacementRules.${index}.find`} render={({ field }) => <FormItem><FormControl><Input placeholder="要被取代的文字" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                                <TableCell className="p-1"><FormField control={settingsForm.control} name={`replacementRules.${index}.replace`} render={({ field }) => <FormItem><FormControl><Input placeholder="新的文字 (留空為刪除)" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                                <TableCell className="p-1"><FormField control={settingsForm.control} name={`replacementRules.${index}.notes`} render={({ field }) => <FormItem><FormControl><Input placeholder="新增備註說明" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                                <TableCell className="p-1 text-center"><FormField control={settingsForm.control} name={`replacementRules.${index}.deleteRow`} render={({ field }) => <FormItem className="flex justify-center items-center h-full"><FormControl><Checkbox checked={field.value} onCheckedChange={(value) => { field.onChange(value); handleSaveSettings(); }} /></FormControl></FormItem>} /></TableCell>
                                <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReplacement(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-4">
                        {replacementFields.map((field, index) => (
                          <Card key={field.id} className="relative overflow-hidden border-primary/10 shadow-sm">
                            <CardHeader className="py-2 px-3 bg-muted/30 flex flex-row items-center justify-between">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">規則 #{index + 1}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeReplacement(index)}><Trash2 className="h-4 w-4" /></Button>
                            </CardHeader>
                            <CardContent className="p-3 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="space-y-1"><label className="font-semibold text-muted-foreground">尋找文字</label><FormField control={settingsForm.control} name={`replacementRules.${index}.find`} render={({ field }) => <FormItem><FormControl><Input placeholder="要被取代的文字" {...field} className="h-8 text-xs" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                                <div className="space-y-1"><label className="font-semibold text-muted-foreground">取代為</label><FormField control={settingsForm.control} name={`replacementRules.${index}.replace`} render={({ field }) => <FormItem><FormControl><Input placeholder="留空為刪除" {...field} className="h-8 text-xs" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                              </div>
                              <div className="space-y-1"><label className="text-xs font-semibold text-muted-foreground">備註</label><FormField control={settingsForm.control} name={`replacementRules.${index}.notes`} render={({ field }) => <FormItem><FormControl><Input placeholder="備註說明" {...field} className="h-8 text-xs" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                              <div className="flex items-center justify-between pt-1 border-t border-dashed"><span className="text-xs font-semibold text-muted-foreground">刪除整筆資料</span><FormField control={settingsForm.control} name={`replacementRules.${index}.deleteRow`} render={({ field }) => <FormItem><FormControl><Checkbox checked={field.value} onCheckedChange={(value) => { field.onChange(value); handleSaveSettings(); }} /></FormControl></FormItem>} /></div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendReplacement({ find: '', replace: '', deleteRow: false, notes: '' })}><PlusCircle className="mr-2 h-4 w-4" />新增取代規則</Button>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="manage-categories">
                    <AccordionTrigger className="text-base font-semibold">管理分類選項</AccordionTrigger>
                    <AccordionContent>
                      <CardDescription className="mb-4">設定分類規則時可選用的類別。</CardDescription>
                      <div className="space-y-4">
                        <div className="flex gap-2"><Input placeholder="輸入新的類型名称" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }} /><Button type="button" onClick={handleAddCategory}>新增類型</Button></div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 rounded-md border p-2">
                          {settings.availableCategories.length > 0 ? ([...settings.availableCategories].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map(cat => (
                            <div key={cat} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                              <span className="text-sm">{cat}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveCategory(cat)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          ))) : <p className="text-sm text-muted-foreground text-center p-4">尚未新增任何類型。</p>}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* Tab 2: Category Rules */}
              <TabsContent value="category">
                <div className="space-y-4 mb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardDescription className="flex-1">關鍵字 → 自動分類。系統會自動抓取符合的第一個類型。</CardDescription>
                    <Button type="button" variant="default" size="sm" onClick={() => {
                      appendCategory({ keyword: '', category: '' });
                      setRuleSearch('');
                      setSelectedFilterCategory(null);
                    }}><PlusCircle className="mr-2 h-4 w-4" />新增分類規則</Button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Loader2 className={cn("absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin", !isProcessing && "hidden")} />
                      <Search className={cn("absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground", isProcessing && "hidden")} />
                      <Input placeholder="搜尋關鍵字或類型..." className="pl-9 h-10 w-full" value={ruleSearch} onChange={(e) => setRuleSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center pb-2 border-b">
                    <Button type="button" variant={selectedFilterCategory === null ? "default" : "outline"} size="sm" className="h-7 px-3 text-xs rounded-full" onClick={() => setSelectedFilterCategory(null)}>全部</Button>
                    {settings.availableCategories.map(cat => (
                      <Button key={cat} type="button" variant={selectedFilterCategory === cat ? "default" : "outline"} size="sm" className="h-7 px-3 text-xs rounded-full" onClick={() => setSelectedFilterCategory(selectedFilterCategory === cat ? null : cat)}>{cat}</Button>
                    ))}
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-md border max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10"><TableRow>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('keyword')} className="px-2 py-1 h-auto -ml-2">關鍵字{sortKey === 'keyword' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}</Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('category')} className="px-2 py-1 h-auto -ml-2">類型{sortKey === 'category' ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}</Button></TableHead>
                      <TableHead className="w-[50px] text-right">操作</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {renderSortedCategoryFields.map((field) => {
                        const originalIndex = categoryFields.findIndex(f => f.id === field.id);
                        if (originalIndex === -1) return null;
                        return (
                          <TableRow key={field.id}>
                            <TableCell className="p-1 w-1/2 md:w-2/3"><FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.keyword`} render={({ field }) => <FormItem><FormControl><Input placeholder="交易項目中的文字" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                            <TableCell className="p-1 w-1/2 md:w-1/4"><FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.category`} render={({ field }) => <FormItem><Select onValueChange={(value) => { field.onChange(value); setIsDirty(true); handleSaveSettings(); }} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue placeholder="選擇一個類型" /></SelectTrigger></FormControl><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                            <TableCell className="p-1 text-right"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { removeCategory(originalIndex); handleSaveSettings(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View - Optimized List */}
                <div className="md:hidden space-y-2">
                  {renderSortedCategoryFields.map((field) => {
                    const originalIndex = categoryFields.findIndex(f => f.id === field.id);
                    if (originalIndex === -1) return null;
                    return (
                      <div key={field.id} className="flex items-center gap-2 p-3 border rounded-lg bg-card shadow-sm">
                        <div className="flex-1 space-y-1">
                          <FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.keyword`} render={({ field }) => <FormItem><FormControl><Input placeholder="關鍵字" {...field} className="h-9 text-sm font-medium" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} />
                        </div>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="w-[100px] shrink-0">
                          <FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.category`} render={({ field }) => <FormItem><Select onValueChange={(value) => { field.onChange(value); setIsDirty(true); handleSaveSettings(); }} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="類型" /></SelectTrigger></FormControl><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select></FormItem>} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0" onClick={() => { removeCategory(originalIndex); handleSaveSettings(); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              {/* Tab 3: Advanced */}
              <TabsContent value="advanced" className="space-y-4">
                <Accordion type="single" collapsible className="w-full" defaultValue="grouping">
                  <AccordionItem value="grouping">
                    <AccordionTrigger className="text-base font-semibold">項目群組規則</AccordionTrigger>
                    <AccordionContent>
                      <CardDescription className="mb-4">為「固定項目分析」建立可收合的群組（如：汽車、保險）。</CardDescription>
                      <div className="hidden md:block rounded-md border">
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-1/3">群組名稱</TableHead><TableHead className="w-2/3">關鍵字 (用逗號 , 分隔)</TableHead><TableHead className="w-[50px]">操作</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {groupingRuleFields.map((field, index) => (
                              <TableRow key={field.id}>
                                <TableCell className="p-1"><FormField control={settingsForm.control} name={`descriptionGroupingRules.${index}.groupName`} render={({ field }) => <FormItem><FormControl><Input placeholder="例如：汽車" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                                <TableCell className="p-1"><FormField control={settingsForm.control} name={`descriptionGroupingRules.${index}.keywords`} render={({ field }) => <FormItem><FormControl><Input placeholder="例如：汽車,中油,加油站" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                                <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { removeGroupingRule(index); handleSaveSettings(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="md:hidden space-y-3">
                        {groupingRuleFields.map((field, index) => (
                          <div key={field.id} className="p-3 border rounded-lg bg-card shadow-sm space-y-3">
                            <div className="flex justify-between items-center bg-muted/20 -m-3 mb-1 px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b border-primary/5">
                              <span>群組規則 #{index + 1}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { removeGroupingRule(index); handleSaveSettings(); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                            <div className="space-y-3 pt-1">
                              <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">群組名稱</label><FormField control={settingsForm.control} name={`descriptionGroupingRules.${index}.groupName`} render={({ field }) => <FormItem><FormControl><Input placeholder="例如：汽車" {...field} className="h-8 text-xs px-2" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                              <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">關鍵字 (逗號分隔)</label><FormField control={settingsForm.control} name={`descriptionGroupingRules.${index}.keywords`} render={({ field }) => <FormItem><FormControl><Input placeholder="中油, 加油站..." {...field} className="h-8 text-xs px-2" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => { appendGroupingRule({ groupName: '', keywords: '' }); setIsDirty(true); }}><PlusCircle className="mr-2 h-4 w-4" />新增群組規則</Button>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="quick-filters">
                    <AccordionTrigger className="text-base font-semibold">快速篩選設定</AccordionTrigger>
                    <AccordionContent>
                      <CardDescription className="mb-4">自訂彙總報表中的快速篩選按鈕。</CardDescription>
                      <div className="space-y-4">
                        {quickFilterFields.map((field, index) => (
                          <Card key={field.id} className="p-4 relative">
                            <div className="space-y-4">
                              <FormField control={settingsForm.control} name={`quickFilters.${index}.name`} render={({ field }) => <FormItem><FormLabel>按鈕名稱</FormLabel><FormControl><Input {...field} className="max-w-xs" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage /></FormItem>} />
                              <FormField control={settingsForm.control} name={`quickFilters.${index}.categories`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel>包含的類型</FormLabel>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 rounded-md border p-4">
                                    {settings.availableCategories.map((cat) => (
                                      <div key={cat} className="flex flex-row items-start space-x-2 space-y-0">
                                        <Checkbox
                                          checked={field.value?.includes(cat)}
                                          onCheckedChange={(checked) => {
                                            const newValue = checked
                                              ? [...(field.value || []), cat]
                                              : (field.value || []).filter(v => v !== cat);
                                            field.onChange(newValue);
                                            handleSaveSettings();
                                          }}
                                        />
                                        <FormLabel className="font-normal">{cat}</FormLabel>
                                      </div>
                                    ))}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => { removeQuickFilter(index); handleSaveSettings(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </Card>
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => { appendQuickFilter({ name: `篩選 ${quickFilterFields.length + 1}`, categories: [] }); setIsDirty(true); }}><PlusCircle className="mr-2 h-4 w-4" />新增快速篩選</Button>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="manage-cash">
                    <AccordionTrigger className="text-base font-semibold">現金項目管理</AccordionTrigger>
                    <AccordionContent>
                      <CardDescription className="mb-4">管理「新增現金交易」中「交易項目」的下拉選單選項。</CardDescription>
                      <div className="space-y-4">
                        <div className="flex gap-2"><Input placeholder="輸入新的項目名稱" value={newCashDescription} onChange={(e) => setNewCashDescription(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCashDescription(); } }} /><Button type="button" onClick={handleAddCashDescription}>新增項目</Button></div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 rounded-md border p-2">
                          {settings.cashTransactionDescriptions.length > 0 ? ([...settings.cashTransactionDescriptions].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map(desc => (
                            <div key={desc} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                              <span className="text-sm">{desc}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveCashDescription(desc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          ))) : <p className="text-sm text-muted-foreground text-center p-4">尚未新增任何項目。</p>}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* Tab 4: Balance */}
              <TabsContent value="balance" className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <CardDescription className="flex-1">設定需要自動追蹤餘額的「專款帳戶」。只有屬於該類別且描述包含「關鍵字」的交易會被計算入內。</CardDescription>
                  <Button type="button" variant="default" size="sm" onClick={() => { appendBalanceAccount({ name: '', category: '', keywords: '' }); setIsDirty(true); }}><PlusCircle className="mr-2 h-4 w-4" />新增餘額帳戶</Button>
                </div>

                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-1/4">帳戶名稱</TableHead><TableHead className="w-1/4">監控類別</TableHead><TableHead className="w-1/2">關鍵字 (逗號分隔)</TableHead><TableHead className="w-[50px]">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {balanceAccountFields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="p-1"><FormField control={settingsForm.control} name={`balanceAccounts.${index}.name`} render={({ field }) => <FormItem><FormControl><Input placeholder="例如：弟的停車費" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                          <TableCell className="p-1"><FormField control={settingsForm.control} name={`balanceAccounts.${index}.category`} render={({ field }) => (<FormItem><Select onValueChange={(value) => { field.onChange(value); handleSaveSettings(); }} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue placeholder="選擇類別" /></SelectTrigger></FormControl><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></FormItem>)} /></TableCell>
                          <TableCell className="p-1"><FormField control={settingsForm.control} name={`balanceAccounts.${index}.keywords`} render={({ field }) => <FormItem><FormControl><Input placeholder="例如：停車費, 預付" {...field} className="h-9" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl><FormMessage className="text-xs px-2" /></FormItem>} /></TableCell>
                          <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { removeBalanceAccount(index); handleSaveSettings(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {balanceAccountFields.map((field, index) => (
                    <div key={field.id} className="p-3 border rounded-lg bg-card shadow-sm space-y-3">
                      <div className="flex justify-between items-center bg-muted/20 -m-3 mb-1 px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b border-primary/5">
                        <span>帳戶設定 #{index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { removeBalanceAccount(index); handleSaveSettings(); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">帳戶名稱</label><FormField control={settingsForm.control} name={`balanceAccounts.${index}.name`} render={({ field }) => <FormItem><FormControl><Input placeholder="帳戶名稱" {...field} className="h-8 text-xs px-2" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                          <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">監控類別</label><FormField control={settingsForm.control} name={`balanceAccounts.${index}.category`} render={({ field }) => (<FormItem><Select onValueChange={(value) => { field.onChange(value); handleSaveSettings(); }} value={field.value}><FormControl><SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="類別" /></SelectTrigger></FormControl><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select></FormItem>)} /></div>
                        </div>
                        <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">關鍵字 (逗號分隔)</label><FormField control={settingsForm.control} name={`balanceAccounts.${index}.keywords`} render={({ field }) => <FormItem><FormControl><Input placeholder="停車費, 預付..." {...field} className="h-8 text-xs px-2" onChange={(e) => { field.onChange(e); setIsDirty(true); }} onBlur={handleSaveSettings} /></FormControl></FormItem>} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Tab 5: System */}
              <TabsContent value="system" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">備份與還原</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <CardDescription>將您的設定匯出為檔案，或從檔案還原。</CardDescription>
                      <div className="flex gap-2 mt-2">
                        <input type="file" ref={fileInputRef} onChange={handleImportFileSelected} className="hidden" accept=".json" />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1"><FileUp className="mr-2 h-4 w-4" />匯入</Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleExportSettings} className="flex-1"><DownloadIcon className="mr-2 h-4 w-4" />匯出</Button>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">系統重置</CardTitle></CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <CardDescription>將所有設定恢復為初始預設值。</CardDescription>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm" className="mt-2 text-muted-foreground hover:text-foreground"><RotateCcw className="mr-2 h-4 w-4" />重置設定</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>確定要重置所有設定嗎？</AlertDialogTitle><AlertDialogDescription>此操作將會清除您所有自訂的規則與類型，並恢復為系統預設值。此動作無法復原。</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={resetAllSettings}>確定重置</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-destructive/30 bg-destructive/5 mt-6">
                  <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> 危險區域</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4 text-muted-foreground">此操作將會永久刪除您帳戶中**所有**的交易紀錄，包含信用卡、活存帳戶與現金收支。請謹慎操作。</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={!user || isProcessing}><DatabaseZap className="mr-2 h-4 w-4" />刪除所有交易資料</Button></AlertDialogTrigger>
                      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>您確定嗎？</AlertDialogTitle><AlertDialogDescription>您即將永久刪除所有交易資料。此動作無法復原，所有已儲存的報表資料都將遺失。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={onDeleteAllData}>確定刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end items-center mt-6 h-6">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {isSaving && <><Loader2 className="h-4 w-4 animate-spin" />儲存中...</>}
                {!isSaving && isDirty && "編輯中..."}
                {!isSaving && !isDirty && "所有變更已儲存"}
              </p>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
