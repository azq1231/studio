
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, getDocs, query, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast"
import { processBankStatement, type ReplacementRule, type CategoryRule } from '@/app/actions';
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import { StatementImporter } from '@/components/statement-importer';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { format, parse, getYear, getMonth } from 'date-fns';
import type { User } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Download, AlertCircle, Trash2, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, Combine, Search, ChevronsLeft, ChevronsRight, ArrowRight, Loader2, Calendar as CalendarIcon, Settings, PlusCircle, RotateCcw, DatabaseZap, Text, ClipboardCopy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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
// COMPONENT: SettingsAccordion
// =======================================================================
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

type SettingsFormData = z.infer<typeof settingsFormSchema>;
type SortKey = 'keyword' | 'category';
type SortDirection = 'asc' | 'desc';
export type QuickFilter = z.infer<typeof quickFilterSchema>;

const DEFAULT_REPLACEMENT_RULES: ReplacementRule[] = [
  { find: '行銀非約跨優', replace: '', deleteRow: false },
  { find: 'ＣＤＭ存款', replace: '', deleteRow: true }
];

const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
    { keyword: 'VULTR', category: '方' }, { keyword: '國外交易服務費', category: '方' }, { keyword: 'GOOGLE*CLOUD', category: '方' }, { keyword: '悠遊卡自動加值', category: '方' }, { keyword: 'REPLIT, INC.', category: '方' }, { keyword: '伯朗咖啡', category: '方' }, { keyword: '柒號洋樓', category: '方' }, { keyword: 'ＰＣＨＯＭＥ', category: '方' }, { keyword: 'OPENAI', category: '方' }, { keyword: '新東陽', category: '吃' }, { keyword: '全家', category: '吃' }, { keyword: '元心燃麻辣堂', category: '吃' }, { keyword: '統一超商', category: '吃' }, { keyword: '玉喜飯店', category: '吃' }, { keyword: '爭鮮', category: '吃' }, { keyword: '八方雲集', category: '吃' }, { keyword: '樂活養生健康鍋', category: '吃' }, { keyword: '順成西點麵包', category: '吃' }, { keyword: '誠品生活', category: '吃' }, { keyword: '星巴克－自動加值', category: '吃' }, { keyword: 'COMFORT BURGER', category: '吃' }, { keyword: '雙月食品社', category: '吃' }, { keyword: '秀泰全球影城', category: '吃' }, { keyword: '台灣麥當勞', category: '吃' }, { keyword: '筷子餐廳', category: '吃' }, { keyword: '怡客咖啡', category: '吃' }, { keyword: '起家雞', category: '吃' }, { keyword: '彼得好咖啡', category: '吃' }, { keyword: '御書園', category: '吃' }, { keyword: '五花馬水餃館', category: '吃' }, { keyword: '客美多咖啡', category: '吃' }, { keyword: '明曜百貨', category: '吃' }, { keyword: 'ＫＦＣ', category: '吃' }, { keyword: '鬥牛士經典牛排', category: '吃' }, { keyword: '街口電支', category: '吃' }, { keyword: '必勝客', category: '吃' }, { keyword: '丰禾', category: '吃' }, { keyword: '春水堂', category: '吃' }, { keyword: '上島珈琲店', category: '吃' }, { keyword: '加油站', category: '家' }, { keyword: '全聯', category: '家' }, { keyword: '55688', category: '家' }, { keyword: 'IKEA', category: '家' }, { keyword: '優步', category: '家' }, { keyword: 'OP錢包', category: '家' }, { keyword: 'NET', category: '家' }, { keyword: '威秀影城', category: '家' }, { keyword: '中油', category: '家' }, { keyword: '高鐵智慧型手機', category: '家' }, { keyword: 'Ｍｉｓｔｅｒ　Ｄｏｎｕｔ', category: '家' }, { keyword: '墊腳石圖書', category: '家' }, { keyword: '燦坤３Ｃ', category: '家' }, { keyword: '屈臣氏', category: '家' }, { keyword: 'APPLE.COM/BILL', category: '家' }, { keyword: '一之軒', category: '家' }, { keyword: '城市車旅', category: '家' }, { keyword: '台灣小米', category: '家' }, { keyword: '麗冠有線電視', category: '固定' }, { keyword: '09202***01', category: '固定' }, { keyword: '國都汽車', category: '固定' }, { keyword: '台灣電力', category: '固定' }, { keyword: '台北市自來水費', category: '固定' }, { keyword: '汽車驗車', category: '固定' }, { keyword: '大台北瓦斯費', category: '固定' }, { keyword: '大安文山有線電視', category: '固定' }, { keyword: '橙印良品', category: '蘇' }, { keyword: 'PayEasy', category: '蘇' }, { keyword: '樂購蝦皮', category: '蘇' }, { keyword: '饗賓餐旅', category: '蘇' }, { keyword: 'TAOBAO.COM', category: '蘇' }, { keyword: '拓元票務', category: '蘇' }, { keyword: '三創數位', category: '蘇' }, { keyword: '金玉堂', category: '秀' }, { keyword: '寶雅', category: '秀' }, { keyword: '特力屋', category: '秀' }, { keyword: '悠遊付－臺北市立大學', category: '秀' }, { keyword: '嘟嘟房', category: '弟' }, { keyword: '台東桂田喜來登酒店', category: '玩' }, { keyword: '家樂福', category: '玩' }, { keyword: '台東原生應用植物園', category: '玩' }, { keyword: '格上租車', category: '玩' }, { keyword: '悠勢科技股份有限公司', category: '收入' }, { keyword: '行政院發', category: '收入' }, { keyword: 'linePay繳好市多', category: '家' }, { keyword: '國保保費', category: '固定' }, { keyword: '怡秀跆拳道', category: '華' }, { keyword: 'iPassMoney儲值', category: '方' }, { keyword: '逸安中醫', category: '蘇' }, { keyword: '連結帳戶交易', category: '家' }, { keyword: '花都管理費', category: '固定' },
];

const DEFAULT_QUICK_FILTERS: QuickFilter[] = [
  { name: '篩選一', categories: ['吃', '家', '固定', '秀', '弟', '玩', '姊', '華'] },
  { name: '篩選二', categories: ['方', '蘇'] },
];

function SettingsManager({ 
    onDeleteAllData, 
    isProcessing, 
    user, 
    availableCategories, 
    setAvailableCategories,
    quickFilters,
    setQuickFilters,
    replacementRules,
    setReplacementRules,
    categoryRules,
    setCategoryRules
}: {
    onDeleteAllData: () => Promise<void>;
    isProcessing: boolean;
    user: User | null;
    availableCategories: string[];
    setAvailableCategories: (value: string[]) => void;
    quickFilters: QuickFilter[];
    setQuickFilters: (value: QuickFilter[]) => void;
    replacementRules: ReplacementRule[];
    setReplacementRules: (value: ReplacementRule[]) => void;
    categoryRules: CategoryRule[];
    setCategoryRules: (value: CategoryRule[]) => void;
}) {
    const { toast } = useToast();
    const [newCategory, setNewCategory] = useState('');
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const settingsForm = useForm<SettingsFormData>({
        resolver: zodResolver(settingsFormSchema),
        values: {
            replacementRules,
            categoryRules,
            quickFilters,
        }
    });

    const { fields: replacementFields, append: appendReplacement, remove: removeReplacement, replace: replaceReplacementRules } = useFieldArray({ control: settingsForm.control, name: 'replacementRules' });
    const { fields: categoryFields, append: appendCategory, remove: removeCategory, replace: replaceCategoryRules } = useFieldArray({ control: settingsForm.control, name: 'categoryRules' });
    const { fields: quickFilterFields, append: appendQuickFilter, remove: removeQuickFilter, replace: replaceQuickFilters } = useFieldArray({ control: settingsForm.control, name: "quickFilters" });


    const handleSaveSettings = (data: SettingsFormData) => {
        try {
            const uniqueReplacementRules = Array.from(new Map(data.replacementRules.map(r => [r.find, r])).values());
            const uniqueCategoryRules = Array.from(new Map(data.categoryRules.map(r => [r.keyword, r])).values());
            
            setReplacementRules(uniqueReplacementRules);
            setCategoryRules(uniqueCategoryRules);
            setQuickFilters(data.quickFilters);

            toast({ title: "設定已儲存", description: "您的規則已成功儲存。" });
        } catch (e) {
           toast({ variant: "destructive", title: "儲存失敗", description: "無法儲存設定到您的瀏覽器。" });
        }
    };
    
    const handleAddCategory = () => {
        if (newCategory && !availableCategories.includes(newCategory)) {
            const updatedCategories = [...availableCategories, newCategory];
            setAvailableCategories(updatedCategories);
            setNewCategory('');
            toast({ title: '類型已新增', description: `「${newCategory}」已成功新增。` });
        } else if (availableCategories.includes(newCategory)) {
            toast({ variant: 'destructive', title: '新增失敗', description: '此類型已存在。' });
        }
    };

    const handleRemoveCategory = (categoryToRemove: string) => {
        const updatedCategories = availableCategories.filter(c => c !== categoryToRemove);
        setAvailableCategories(updatedCategories);
        settingsForm.setValue('categoryRules', settingsForm.getValues('categoryRules').filter(rule => rule.category !== categoryToRemove));
        toast({ title: '類型已刪除', description: `「${categoryToRemove}」已被移除。` });
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
    };
    
    const renderSortedCategoryFields = useMemo(() => {
        if (!sortKey) return categoryFields;
        return [...categoryFields].sort((a, b) => {
            const aValue = settingsForm.getValues(`categoryRules.${categoryFields.findIndex(f => f.id === a.id)}.keyword`) || '';
            const bValue = settingsForm.getValues(`categoryRules.${categoryFields.findIndex(f => f.id === b.id)}.keyword`) || '';
            const comparison = aValue.localeCompare(bValue, 'zh-Hant');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [categoryFields, sortKey, sortDirection, settingsForm]);

    const resetReplacementRules = () => { replaceReplacementRules(DEFAULT_REPLACEMENT_RULES); toast({ title: '取代規則已重置' }); };
    const resetCategoryRules = () => { replaceCategoryRules(DEFAULT_CATEGORY_RULES); toast({ title: '分類規則已重置' }); };
    const resetQuickFilters = () => { replaceQuickFilters(DEFAULT_QUICK_FILTERS); toast({ title: '快速篩選已重置' }); };

    return (
        <Card>
            <CardHeader>
                <CardTitle>規則設定</CardTitle>
                <CardDescription>管理報表處理、分類和資料的規則。</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(handleSaveSettings)} className="space-y-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="replacement">
                      <AccordionTrigger>取代規則</AccordionTrigger>
                      <AccordionContent>
                          <div className="flex justify-between items-center mb-4">
                            <CardDescription>設定自動取代或刪除規則。勾選「刪除整筆資料」後，符合條件的資料將被整筆移除。</CardDescription>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm"><RotateCcw className="mr-2 h-4 w-4" />重置</Button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定要重置取代規則嗎？</AlertDialogTitle><AlertDialogDescription>此操作將會清除所有您自訂的取代規則，並恢復為系統預設值。此動作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={resetReplacementRules}>確定重置</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                          </div>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader><TableRow><TableHead className="w-2/5">尋找文字</TableHead><TableHead className="w-2_5">取代為</TableHead><TableHead className="w-1/5 text-center">刪除整筆資料</TableHead><TableHead className="w-[50px]">操作</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {replacementFields.map((field, index) => (
                                  <TableRow key={field.id}>
                                    <TableCell className="p-1"><FormField control={settingsForm.control} name={`replacementRules.${index}.find`} render={({ field }) => <FormItem><FormControl><Input placeholder="要被取代的文字" {...field} className="h-9"/></FormControl><FormMessage className="text-xs px-2"/></FormItem>}/></TableCell>
                                    <TableCell className="p-1"><FormField control={settingsForm.control} name={`replacementRules.${index}.replace`} render={({ field }) => <FormItem><FormControl><Input placeholder="新的文字 (留空為刪除)" {...field} className="h-9"/></FormControl><FormMessage className="text-xs px-2"/></FormItem>}/></TableCell>
                                    <TableCell className="p-1 text-center"><FormField control={settingsForm.control} name={`replacementRules.${index}.deleteRow`} render={({ field }) => <FormItem className="flex justify-center items-center h-full"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl></FormItem>}/></TableCell>
                                    <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReplacement(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendReplacement({ find: '', replace: '', deleteRow: false })}><PlusCircle className="mr-2 h-4 w-4" />新增取代規則</Button>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="category">
                       <AccordionTrigger>分類規則</AccordionTrigger>
                       <AccordionContent>
                          <div className="flex justify-between items-center mb-4">
                            <CardDescription>設定交易項目關鍵字與對應的類型。處理報表時，將會自動帶入符合的第一個類型。</CardDescription>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm"><RotateCcw className="mr-2 h-4 w-4" />重置</Button></AlertDialogTrigger>
                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定要重置分類規則嗎？</AlertDialogTitle><AlertDialogDescription>此操作將會清除所有您自訂的分類規則，並恢復為系統預設值。此動作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={resetCategoryRules}>確定重置</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                          </div>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader><TableRow>
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
                                      <TableCell className="p-1 w-1/2"><FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.keyword`} render={({ field }) => <FormItem><FormControl><Input placeholder="交易項目中的文字" {...field} className="h-9"/></FormControl><FormMessage className="text-xs px-2"/></FormItem>}/></TableCell>
                                      <TableCell className="p-1 w-1/2"><FormField control={settingsForm.control} name={`categoryRules.${originalIndex}.category`} render={({ field }) => <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue placeholder="選擇一個類型" /></SelectTrigger></FormControl><SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage className="text-xs px-2"/></FormItem>}/></TableCell>
                                      <TableCell className="p-1 text-right"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCategory(originalIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendCategory({ keyword: '', category: '' })}><PlusCircle className="mr-2 h-4 w-4" />新增分類規則</Button>
                       </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="quick-filters">
                       <AccordionTrigger>快速篩選</AccordionTrigger>
                       <AccordionContent>
                          <div className="flex justify-between items-center mb-4">
                            <CardDescription>自訂彙總報表中的快速篩選按鈕，方便您一鍵切換常用的類別組合。</CardDescription>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm"><RotateCcw className="mr-2 h-4 w-4" />重置</Button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定要重置快速篩選嗎？</AlertDialogTitle><AlertDialogDescription>此操作將會清除所有您自訂的快速篩選，並恢復為系統預設值。此動作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={resetQuickFilters}>確定重置</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                          </div>
                          <div className="space-y-4">
                            {quickFilterFields.map((field, index) => (
                              <Card key={field.id} className="p-4 relative">
                                <div className="space-y-4">
                                  <FormField control={settingsForm.control} name={`quickFilters.${index}.name`} render={({ field }) => <FormItem><FormLabel>按鈕名稱</FormLabel><FormControl><Input {...field} className="max-w-xs"/></FormControl><FormMessage/></FormItem>}/>
                                  <FormField control={settingsForm.control} name={`quickFilters.${index}.categories`} render={() => (
                                    <FormItem>
                                      <FormLabel>包含的類型</FormLabel>
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 rounded-md border p-4">
                                        {availableCategories.map((cat) => (
                                          <FormField key={cat} control={settingsForm.control} name={`quickFilters.${index}.categories`} render={({ field }) => (
                                            <FormItem key={cat} className="flex flex-row items-start space-x-2 space-y-0">
                                              <FormControl><Checkbox checked={field.value?.includes(cat)} onCheckedChange={(c) => c ? field.onChange([...(field.value || []), cat]) : field.onChange((field.value || []).filter(v => v !== cat))}/></FormControl>
                                              <FormLabel className="font-normal">{cat}</FormLabel>
                                            </FormItem>
                                          )}/>
                                        ))}
                                      </div><FormMessage/>
                                    </FormItem>
                                  )}/>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => removeQuickFilter(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </Card>
                            ))}
                          </div>
                          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendQuickFilter({ name: `篩選 ${quickFilterFields.length + 1}`, categories: [] })}><PlusCircle className="mr-2 h-4 w-4"/>新增快速篩選</Button>
                       </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="manage-categories">
                      <AccordionTrigger>管理類型</AccordionTrigger>
                      <AccordionContent>
                          <CardDescription className="mb-4">新增或刪除在「分類規則」下拉選單中看到的類型選項。</CardDescription>
                          <div className="space-y-4">
                            <div className="flex gap-2"><Input placeholder="輸入新的類型名称" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }}}/><Button type="button" onClick={handleAddCategory}>新增類型</Button></div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 rounded-md border p-2">
                              {availableCategories.length > 0 ? (availableCategories.sort((a,b) => a.localeCompare(b, 'zh-Hant')).map(cat => (
                                <div key={cat} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                                  <span className="text-sm">{cat}</span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveCategory(cat)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                              ))) : <p className="text-sm text-muted-foreground text-center p-4">尚未新增任何類型。</p>}
                            </div>
                          </div>
                      </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="data-management">
                        <AccordionTrigger>資料管理</AccordionTrigger>
                        <AccordionContent>
                            <CardDescription className="mb-4">執行永久性的資料操作。請謹慎使用。</CardDescription>
                              <Card className="border-destructive">
                                <CardHeader><CardTitle className="text-destructive">危險區域</CardTitle></CardHeader>
                                <CardContent>
                                  <p className="text-sm mb-4">此操作將會永久刪除您帳戶中**所有**的交易紀錄，包含信用卡、活存帳戶與現金收支。此動作無法復原。</p>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={!user || isProcessing}><DatabaseZap className="mr-2 h-4 w-4" />刪除所有交易資料</Button></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>您確定嗎？</AlertDialogTitle><AlertDialogDescription>您即將永久刪除所有交易資料。此動作無法復原，所有已儲存的報表資料都將遺失。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={onDeleteAllData}>確定刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                  </AlertDialog>
                                </CardContent>
                              </Card>
                        </AccordionContent>
                     </AccordionItem>
                  </Accordion>
                  <div className="flex justify-end items-center mt-6"><Button type="submit">儲存設定</Button></div>
                </form>
              </Form>
            </CardContent>
        </Card>
    );
}

// =======================================================================
// COMPONENT: ResultsDisplay
// =======================================================================
const cashTransactionSchema = z.object({
    date: z.date({ required_error: "請選擇日期" }),
    description: z.string().min(1, "請輸入交易項目"),
    category: z.string().min(1, "請選擇類型"),
    amount: z.number({ required_error: "請輸入金額", invalid_type_error: "請輸入有效數字" }).min(1, "金額必須大於 0"),
    notes: z.string().optional(),
    type: z.enum(['expense', 'income']).default('expense'),
});
type CashTransactionFormData = z.infer<typeof cashTransactionSchema>;

const getCreditDisplayDate = (dateString: string) => {
    try {
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) return dateString;
        if (!/^\d{1,2}\/\d{1,2}$/.test(dateString)) return dateString;
        const now = new Date();
        const currentYear = getYear(now);
        const currentMonth = getMonth(now);
        const parsedDate = parse(dateString, 'MM/dd', new Date());
        const transactionMonth = getMonth(parsedDate);
        const dateObj = new Date(new Date(parsedDate).setFullYear(transactionMonth > currentMonth ? currentYear - 1 : currentYear));
        return format(dateObj, 'yyyy/MM/dd');
    } catch {
        return dateString;
    }
};

const EditableCell = ({ value, onUpdate, disabled }: { value: string; onUpdate: (value: string) => void; disabled?: boolean; }) => {
    const [currentValue, setCurrentValue] = useState(value);
    useEffect(() => { setCurrentValue(value); }, [value]);
    const handleBlur = () => { if (currentValue !== value) onUpdate(currentValue); };
    return <Input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onBlur={handleBlur} disabled={disabled} className="h-8" />;
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; }) => {
    const [jumpToPage, setJumpToPage] = useState(String(currentPage));
    useEffect(() => { setJumpToPage(String(currentPage)); }, [currentPage]);
    if (totalPages <= 1) return null;
    const handleJump = () => {
        let page = parseInt(jumpToPage, 10);
        if (isNaN(page) || page < 1) page = 1;
        else if (page > totalPages) page = totalPages;
        onPageChange(page);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleJump(); };
    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="hidden md:flex"><ChevronsLeft className="h-4 w-4" />第一頁</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>上一頁</Button>
            <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">第</span>
                <Input type="number" value={jumpToPage} onChange={(e) => setJumpToPage(e.target.value)} onKeyDown={handleKeyDown} className="h-9 w-16 text-center" min="1" max={totalPages} />
                <Button variant="outline" size="sm" onClick={handleJump} className="sm:hidden"><ArrowRight className="h-4 w-4" /></Button>
                <span className="text-sm text-muted-foreground">/ {totalPages} 頁</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>下一頁</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="hidden md:flex">最後一頁<ChevronsRight className="h-4 w-4" /></Button>
        </div>
    );
};

const SortableHeader = <T extends string>({ sortKey, currentSortKey, sortDirection, onSort, children, style }: {
    sortKey: T; currentSortKey: T | null; sortDirection: 'asc' | 'desc'; onSort: (key: T) => void; children: React.ReactNode; style?: React.CSSProperties;
}) => {
    const isSorted = currentSortKey === sortKey;
    return (
      <TableHead style={style}>
        <Button variant="ghost" onClick={() => onSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />)}
        </Button>
      </TableHead>
    );
};

function CashTransactionForm({ availableCategories, onSubmit, user }: {
    availableCategories: string[];
    onSubmit: (data: Omit<CashData, 'id'| 'amount'> & {amount: number, type: 'expense' | 'income'}) => void;
    user: User | null;
}) {
    const form = useForm<CashTransactionFormData>({
        resolver: zodResolver(cashTransactionSchema),
        defaultValues: { description: '', category: '', notes: '', type: 'expense' },
    });
    const { formState: { isSubmitSuccessful } } = form;
    
    useEffect(() => {
        if (isSubmitSuccessful) {
            form.reset({ description: '', category: '', notes: '', type: 'expense', date: undefined, amount: undefined });
        }
    }, [isSubmitSuccessful, form]);
    
    const handleSubmit = (values: CashTransactionFormData) => {
        onSubmit({
            date: format(values.date, 'yyyy/MM/dd'),
            description: values.description,
            category: values.category,
            amount: values.amount,
            notes: values.notes,
            type: values.type,
        });
    };

    return (
        <Card className="mb-4">
            <CardHeader><CardTitle>新增現金交易</CardTitle></CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>日期</FormLabel><Popover>
                                <PopoverTrigger asChild><FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "yyyy/MM/dd") : <span>選擇日期</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => d > new Date() || d < new Date("1900-01-01")} initialFocus/></PopoverContent>
                                </Popover><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>交易項目</FormLabel><FormControl><Input placeholder="例如：午餐" {...field} /></FormControl><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>金額</FormLabel><FormControl><Input type="number" placeholder="120" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="category" render={({ field }) => <FormItem><FormLabel>類型</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="選擇一個類型" /></SelectTrigger></FormControl><SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                            <FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>備註</FormLabel><FormControl><Input placeholder="（選填）" {...field} /></FormControl><FormMessage /></FormItem>} />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!user || form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}新增
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

function ResultsDisplay({
    creditData, depositData, cashData, availableCategories, onAddCashTransaction, onUpdateTransaction, onDeleteTransaction, hasProcessed, user, quickFilters
}: {
    creditData: CreditData[]; depositData: DepositData[]; cashData: CashData[]; availableCategories: string[];
    onAddCashTransaction: (data: Omit<CashData, 'id' | 'amount'> & {amount: number, type: 'expense' | 'income'}) => void;
    onUpdateTransaction: (id: string, field: keyof any, value: string | number, type: 'credit' | 'deposit' | 'cash') => void;
    onDeleteTransaction: (id: string, type: 'credit' | 'deposit' | 'cash') => void;
    hasProcessed: boolean; user: User | null; quickFilters: QuickFilter[];
}) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [creditPage, setCreditPage] = useState(1);
    const [depositPage, setDepositPage] = useState(1);
    const [cashPage, setCashPage] = useState(1);
    const [creditSortKey, setCreditSortKey] = useState<keyof CreditData | null>('transactionDate');
    const [creditSortDirection, setCreditSortDirection] = useState<'asc' | 'desc'>('desc');
    const [depositSortKey, setDepositSortKey] = useState<keyof DepositData | null>('date');
    const [depositSortDirection, setDepositSortDirection] = useState<'asc' | 'desc'>('desc');
    const [cashSortKey, setCashSortKey] = useState<keyof CashData | null>('date');
    const [cashSortDirection, setCashSortDirection] = useState<'asc' | 'desc'>('desc');
    const [detailViewData, setDetailViewData] = useState<(CreditData | DepositData | CashData)[]>([]);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
    const [detailViewTitle, setDetailViewTitle] = useState('');
    const [summarySelectedCategories, setSummarySelectedCategories] = useState<string[]>([]);
    const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
    
    useEffect(() => { if (hasProcessed) setSummarySelectedCategories(availableCategories); }, [hasProcessed, availableCategories]);
    
    const handleCreditSort = (key: keyof CreditData) => { setCreditPage(1); if (creditSortKey === key) setCreditSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCreditSortKey(key); setCreditSortDirection('desc'); } };
    const handleDepositSort = (key: keyof DepositData) => { setDepositPage(1); if (depositSortKey === key) setDepositSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setDepositSortKey(key); setDepositSortDirection('desc'); } };
    const handleCashSort = (key: keyof CashData) => { setCashPage(1); if (cashSortKey === key) setCashSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCashSortKey(key); setCashSortDirection('desc'); } };
    
    const sortAndPaginate = <T, K extends keyof T>(data: T[], sortKey: K | null, sortDirection: 'asc' | 'desc', page: number, searchFn: (item: T, query: string) => boolean, dateKey?: keyof T, dateParser?: (dateStr: string) => string): { data: T[], totalPages: number } => {
        let filteredData = searchQuery ? data.filter(item => searchFn(item, searchQuery.toLowerCase())) : data;
        if (sortKey) {
            filteredData.sort((a, b) => {
                let comparison = 0;
                if (sortKey === dateKey && dateParser) {
                    try {
                        const dateA = new Date(dateParser(a[sortKey] as any as string)).getTime();
                        const dateB = new Date(dateParser(b[sortKey] as any as string)).getTime();
                        comparison = dateA - dateB;
                    } catch { comparison = 0; }
                } else {
                    const aValue = a[sortKey], bValue = b[sortKey];
                    if (typeof aValue === 'string' && typeof bValue === 'string') comparison = aValue.localeCompare(bValue, 'zh-Hant');
                    else if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
                    else comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        const totalPages = Math.ceil(filteredData.length / 50);
        const paginatedData = filteredData.slice((page - 1) * 50, page * 50);
        return { data: paginatedData, totalPages };
    };

    const sortedCreditData = useMemo(() => sortAndPaginate(creditData, creditSortKey, creditSortDirection, creditPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'transactionDate', getCreditDisplayDate), [creditData, creditSortKey, creditSortDirection, creditPage, searchQuery]);
    const sortedDepositData = useMemo(() => sortAndPaginate(depositData, depositSortKey, depositSortDirection, depositPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'date', d => d), [depositData, depositSortKey, depositSortDirection, depositPage, searchQuery]);
    const sortedCashData = useMemo(() => sortAndPaginate(cashData, cashSortKey, cashSortDirection, cashPage, (item, q) => item.description.toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q), 'date', d => d), [cashData, cashSortKey, cashSortDirection, cashPage, searchQuery]);
    
    type CombinedData = { id: string; date: string; dateObj: Date; category: string; description: string; amount: number; source: '信用卡' | '活存帳戶' | '現金'; notes?: string; bankCode?: string; };
    const combinedData = useMemo<CombinedData[]>(() => {
        const combined: CombinedData[] = [];
        const filterAndMap = (data: any[], source: CombinedData['source'], dateKey: string) => {
            const q = searchQuery.toLowerCase();
            (searchQuery ? data.filter(d => (d.description && d.description.toLowerCase().includes(q)) || (d.bankCode && d.bankCode.toLowerCase().includes(q)) || (d.notes && d.notes.toLowerCase().includes(q))) : data).forEach(d => {
                const displayDate = dateKey === 'transactionDate' ? getCreditDisplayDate(d[dateKey]) : d[dateKey];
                let dateObj; try { dateObj = parse(displayDate, 'yyyy/MM/dd', new Date()); } catch { dateObj = new Date(0); }
                combined.push({ ...d, date: displayDate, dateObj, source });
            });
        };
        filterAndMap(creditData, '信用卡', 'transactionDate'); filterAndMap(depositData, '活存帳戶', 'date'); filterAndMap(cashData, '現金', 'date');
        return combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [creditData, depositData, cashData, searchQuery]);

    const summaryReportData = useMemo(() => {
        const monthlyData: Record<string, Record<string, number>> = {}; const allCategoriesInReport = new Set<string>();
        combinedData.forEach(transaction => {
            try {
                if (summarySelectedCategories.length > 0 && !summarySelectedCategories.includes(transaction.category)) return;
                allCategoriesInReport.add(transaction.category);
                const monthKey = format(transaction.dateObj, 'yyyy年M月');
                if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
                monthlyData[monthKey][transaction.category] = (monthlyData[monthKey][transaction.category] || 0) + transaction.amount;
            } catch(e) {}
        });
        const sortedCategories = Array.from(allCategoriesInReport).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        const headers = ['日期（年月）', ...sortedCategories, '總計'];
        const rows = Object.entries(monthlyData).map(([month, categoryData]) => {
          let total = 0; const row: Record<string, string | number> = { '日期（年月）': month };
          sortedCategories.forEach(cat => { const value = categoryData[cat] || 0; row[cat] = value; total += value; });
          row['總計'] = total; return row;
        }).sort((a, b) => { try { return parse(a['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime() - parse(b['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime(); } catch { return (a['日期（年月）'] as string).localeCompare(b['日期（年月）'] as string); } });
        return { headers, rows };
    }, [combinedData, summarySelectedCategories]);

    const categoryChartData = useMemo(() => {
        if (!creditData || creditData.length === 0) return [];
        const categoryTotals = creditData.reduce((acc, t) => { if (t.amount > 0) { const c = t.category || '未分類'; acc[c] = (acc[c] || 0) + t.amount; } return acc; }, {} as Record<string, number>);
        return Object.entries(categoryTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    }, [creditData]);

    const handleSummaryCellClick = (monthKey: string, category: string) => {
        const [year, month] = monthKey.replace('年', '-').replace('月', '').split('-').map(Number);
        const filtered = combinedData.filter(t => t.category === category && getYear(t.dateObj) === year && getMonth(t.dateObj) + 1 === month).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        setDetailViewData(filtered); setDetailViewTitle(`${monthKey} - ${category}`); setIsDetailViewOpen(true);
    };

    const handleDownload = () => {
        try {
            const wb = XLSX.utils.book_new();
            if (combinedData.length > 0) {
              const sheetData = combinedData.map(d => ({ '日期': d.date, '類型': d.category, '交易項目': d.description, '金額': d.amount, '備註': d.bankCode || d.notes || '', '來源': d.source }));
              const ws = XLSX.utils.json_to_sheet(sheetData);
              XLSX.utils.book_append_sheet(wb, ws, '合併報表');
            }
            XLSX.writeFile(wb, `bank_data_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch(error) { toast({ variant: "destructive", title: "下載失败", description: "產生 Excel 檔案時發生錯誤。" }); }
    };

    const noDataFound = hasProcessed && creditData.length === 0 && depositData.length === 0 && cashData.length === 0;
    const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
    const defaultTab = hasData ? (creditData.length > 0 ? "credit" : (depositData.length > 0 ? "deposit" : "cash")) : "statement";

    return (
        <Card>
            <CardHeader><h3 className="text-xl font-semibold font-headline">處理結果</h3></CardHeader>
            <CardContent>
                {hasData ? (
                  <>
                    <div className="flex justify-between items-center mb-4 gap-4">
                       <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="尋找交易項目或備註..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
                      <Button variant="outline" size="sm" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />下載 Excel</Button>
                    </div>
                    <Tabs defaultValue={defaultTab} className="w-full">
                      <TabsList>
                        {combinedData.length > 0 && <TabsTrigger value="combined"><Combine className="w-4 h-4 mr-2"/>合併報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="credit">信用卡 ({creditData.length})</TabsTrigger>}
                        {depositData.length > 0 && <TabsTrigger value="deposit">活存帳戶 ({depositData.length})</TabsTrigger>}
                        <TabsTrigger value="cash">現金 ({cashData.length})</TabsTrigger>
                        {hasData && <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-2"/>彙總報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="chart"><BarChart2 className="w-4 h-4 mr-2"/>統計圖表</TabsTrigger>}
                      </TabsList>
                      
                      <TabsContent value="combined"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="w-[120px]">類型</TableHead><TableHead>交易項目</TableHead><TableHead className="w-[100px]">來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader><TableBody>{combinedData.map((row) => (<TableRow key={row.id}><TableCell className="font-mono">{row.date}</TableCell><TableCell>{row.category}</TableCell><TableCell>{row.description}</TableCell><TableCell>{row.source}</TableCell><TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></TabsContent>
                      <TabsContent value="credit"><Table><TableHeader><TableRow><SortableHeader sortKey="transactionDate" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '110px' }}>日期</SortableHeader><TableHead style={{ width: '110px' }}>類型</TableHead><TableHead>交易項目</TableHead><SortableHeader sortKey="amount" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>銀行代碼/備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader><TableBody>{sortedCreditData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{getCreditDisplayDate(row.transactionDate)}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'credit')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'credit')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'credit')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'credit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody></Table><PaginationControls currentPage={creditPage} totalPages={sortedCreditData.totalPages} onPageChange={setCreditPage} /></TabsContent>
                      <TabsContent value="deposit"><Table><TableCaption>金額：支出為正，存入為負</TableCaption><TableHeader><TableRow><SortableHeader sortKey="date" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>日期</SortableHeader><SortableHeader sortKey="category" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>類型</SortableHeader><SortableHeader sortKey="description" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort}>交易項目</SortableHeader><SortableHeader sortKey="amount" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>銀行代碼/備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader><TableBody>{sortedDepositData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'deposit')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'deposit')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'deposit')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'deposit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody></Table><PaginationControls currentPage={depositPage} totalPages={sortedDepositData.totalPages} onPageChange={setDepositPage} /></TabsContent>
                      <TabsContent value="cash">
                        <Accordion type="single" collapsible className="w-full mb-4">
                            <AccordionItem value="add-cash">
                                <AccordionTrigger>新增現金交易</AccordionTrigger>
                                <AccordionContent>
                                    <CashTransactionForm availableCategories={availableCategories} onSubmit={onAddCashTransaction} user={user} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader><TableRow><SortableHeader sortKey="date" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '110px' }}>日期</SortableHeader><TableHead style={{ width: '110px' }}>類型</TableHead><TableHead>交易項目</TableHead><SortableHeader sortKey="amount" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader>
                            <TableBody>{sortedCashData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'cash')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'cash')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.notes || ''} onUpdate={v => onUpdateTransaction(row.id, 'notes', v, 'cash')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'cash')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody>
                        </Table>
                        <PaginationControls currentPage={cashPage} totalPages={sortedCashData.totalPages} onPageChange={setCashPage} />
                      </TabsContent>
                      <TabsContent value="summary"><div className="flex flex-wrap items-center gap-2 my-4"><Popover open={isSummaryFilterOpen} onOpenChange={setIsSummaryFilterOpen}><PopoverTrigger asChild><Button variant="outline">篩選類型 ({summarySelectedCategories.length}/{availableCategories.length})<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[250px] p-0"><div className="p-2 space-y-1"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories(availableCategories)}>全選</Button><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories([])}>全部取消</Button></div><div className="border-t max-h-60 overflow-y-auto p-2">{availableCategories.sort((a,b)=> a.localeCompare(b, 'zh-Hant')).map(category => (<div key={category} className="flex items-center space-x-2 p-1"><Checkbox id={`cat-${category}`} checked={summarySelectedCategories.includes(category)} onCheckedChange={(c) => c ? setSummarySelectedCategories([...summarySelectedCategories, category]) : setSummarySelectedCategories(summarySelectedCategories.filter(i => i !== category))} /><label htmlFor={`cat-${category}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{category}</label></div>))}</div></PopoverContent></Popover>{quickFilters.map((filter, index) => <Button key={index} variant="outline" size="sm" onClick={() => setSummarySelectedCategories(filter.categories)}>{filter.name}</Button>)}<p className="text-sm text-muted-foreground hidden md:block ml-auto">點擊表格中的數字可查看該月份的交易明細。</p></div><div className="rounded-md border"><Table><TableHeader><TableRow>{summaryReportData.headers.map(h => <TableHead key={h} className={h !== '日期（年月）' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{summaryReportData.rows.map((row, i) => (<TableRow key={i}>{summaryReportData.headers.map(header => { const value = row[header]; const isClickable = header !== '日期（年月）' && header !== '總計' && typeof value === 'number' && value !== 0; let textColor = ''; if (typeof value === 'number') { if (header.includes('收入')) textColor = 'text-green-600'; else if (value < 0) textColor = 'text-green-600'; else if (value > 0) textColor = 'text-destructive'; } return (<TableCell key={header} className={`font-mono ${header !== '日期（年月）' ? 'text-right' : ''} ${textColor}`}>{isClickable ? <button onClick={() => handleSummaryCellClick(row['日期（年月）'] as string, header)} className="hover:underline hover:text-blue-500">{value.toLocaleString()}</button> : (typeof value === 'number' ? value.toLocaleString() : value)}</TableCell>);})}</TableRow>))}</TableBody></Table></div></TabsContent>
                      <TabsContent value="chart"><Card><CardHeader><CardTitle>信用卡消費分類統計</CardTitle><CardDescription>此圖表顯示信用卡的各類別總支出。 (僅計算正數金額)</CardDescription></CardHeader><CardContent><div style={{ width: '100%', height: 400 }}><ResponsiveContainer><BarChart layout="vertical" data={categoryChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} /><Tooltip formatter={(v: number) => v.toLocaleString()} /><Legend /><Bar dataKey="total" fill="hsl(var(--chart-1))" name="總支出" /></BarChart></ResponsiveContainer></div></CardContent></Card></TabsContent>
                    </Tabs>
                  </>
                ) : (noDataFound && (
                    <div className="text-center py-10"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">沒有找到資料</h3><p className="mt-2 text-sm text-muted-foreground">我們無法從您提供的內容中解析出任何報表資料。<br />請確認格式是否正確，或嘗試貼上其他內容。</p></div>
                ))}
                <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                    <DialogContent className="max-w-4xl h-4/5 flex flex-col"><DialogHeader><DialogTitle>{detailViewTitle}</DialogTitle></DialogHeader><div className="flex-grow overflow-y-auto"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>交易項目</TableHead><TableHead>來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader><TableBody>{detailViewData.length > 0 ? ( detailViewData.map(item => (<TableRow key={item.id}><TableCell>{(item as any).date || getCreditDisplayDate((item as any).transactionDate)}</TableCell><TableCell>{item.description}</TableCell><TableCell>{(item as any).source || '信用卡'}</TableCell><TableCell className={`text-right ${item.amount < 0 ? 'text-green-600' : ''}`}>{item.amount.toLocaleString()}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={4} className="text-center">沒有找到相關交易紀錄。</TableCell></TableRow>)}</TableBody></Table></div></DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
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
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [replacementRules, setReplacementRules] = useState<ReplacementRule[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);


  // --- Data Fetching ---
  const creditTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'creditCardTransactions') : null, [user, firestore]);
  const { data: savedCreditTransactions, isLoading: isLoadingCredit } = useCollection<CreditData>(creditTransactionsQuery);

  const depositTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'depositAccountTransactions') : null, [user, firestore]);
  const { data: savedDepositTransactions, isLoading: isLoadingDeposit } = useCollection<DepositData>(depositTransactionsQuery);

  const cashTransactionsQuery = useMemoFirebase(() => user && firestore ? collection(firestore, 'users', user.uid, 'cashTransactions') : null, [user, firestore]);
  const { data: savedCashTransactions, isLoading: isLoadingCash } = useCollection<CashData>(cashTransactionsQuery);

  useEffect(() => { if (savedCreditTransactions) setCreditData(savedCreditTransactions); }, [savedCreditTransactions]);
  useEffect(() => { if (savedDepositTransactions) setDepositData(savedDepositTransactions); }, [savedDepositTransactions]);
  useEffect(() => { if (savedCashTransactions) setCashData(savedCashTransactions); }, [savedCashTransactions]);

  useEffect(() => {
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
        setReplacementRules(savedReplacementRules ? JSON.parse(savedReplacementRules) : DEFAULT_REPLACEMENT_RULES);
        
        const savedCategoryRulesRaw = localStorage.getItem('categoryRules');
        let finalCategoryRules = [...DEFAULT_CATEGORY_RULES];
        if (savedCategoryRulesRaw) {
            try {
                const savedRules = JSON.parse(savedCategoryRulesRaw) as CategoryRule[];
                const finalRulesMap = new Map(finalCategoryRules.map(r => [r.keyword, r]));
                savedRules.forEach(savedRule => finalRulesMap.set(savedRule.keyword, savedRule));
                finalCategoryRules = Array.from(finalRulesMap.values());
            } catch {}
        }
        setCategoryRules(finalCategoryRules);
        localStorage.setItem('categoryRules', JSON.stringify(finalCategoryRules));

        const savedQuickFilters = localStorage.getItem('quickFilters');
        setQuickFilters(savedQuickFilters ? JSON.parse(savedQuickFilters) : DEFAULT_QUICK_FILTERS);

    } catch (e) { console.error("Failed to load settings from localStorage", e); }
  }, []);

  const handleSetAvailableCategories = (value: string[]) => {
      setAvailableCategories(value);
      localStorage.setItem('availableCategories', JSON.stringify(value));
  };
  const handleSetQuickFilters = (value: QuickFilter[]) => {
      setQuickFilters(value);
      localStorage.setItem('quickFilters', JSON.stringify(value));
  };
  const handleSetReplacementRules = (value: ReplacementRule[]) => {
      setReplacementRules(value);
      localStorage.setItem('replacementRules', JSON.stringify(value));
  };
  const handleSetCategoryRules = (value: CategoryRule[]) => {
      setCategoryRules(value);
      localStorage.setItem('categoryRules', JSON.stringify(value));
  };


  const handleProcessAndSave = useCallback(async ({ text, excelData }: { text?: string; excelData?: any[][] }) => {
    setIsLoading(true);
    setHasProcessed(false);
    
    const result = await processBankStatement(text || '', replacementRules, categoryRules, !!excelData, excelData);
    
    if (result.success) {
      if (result.detectedCategories.length > 0) {
        const currentCats = availableCategories;
        const newCats = result.detectedCategories.filter(c => !currentCats.includes(c));
        if (newCats.length > 0) {
            const updated = [...currentCats, ...newCats];
            handleSetAvailableCategories(updated);
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
  }, [user, firestore, toast, replacementRules, categoryRules, availableCategories, handleSetAvailableCategories]);

  const handleAddCashTransaction = useCallback(async (newTransactionData: Omit<CashData, 'id' | 'amount'> & {amount: number, type: 'expense' | 'income'}) => {
    if (!user || !firestore) { toast({ variant: 'destructive', title: '錯誤', description: '請先登入' }); return; }
    const amount = newTransactionData.type === 'expense' ? newTransactionData.amount : -newTransactionData.amount;
    const { type, ...transData } = newTransactionData;
    const id = await sha1(`${transData.date}-${transData.description}-${amount}-${Date.now()}`);
    const newTransaction: CashData = { ...transData, id, amount };
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
        
        setterMap[type](prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
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
        setterMap[type](prev => prev.filter(item => item.id !== id));
        try {
            await deleteDoc(doc(firestore, 'users', user.uid, collectionNameMap[type], id));
        } catch (error) {
            toast({ variant: "destructive", title: "刪除失敗", description: `無法從資料庫中刪除此筆交易。` });
        }
    }, [user, firestore, toast]);

  const isLoadingTransactions = isLoadingCredit || isLoadingDeposit || isLoadingCash;
  const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
  const showResults = (hasProcessed && hasData) || (!isUserLoading && !hasProcessed && hasData && !isLoadingTransactions);

  return (
    <Tabs defaultValue="importer" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
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
      </TabsList>
      <TabsContent value="importer" className="mt-4">
        <StatementImporter isProcessing={isLoading} onProcess={handleProcessAndSave} user={user} />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <SettingsManager 
            onDeleteAllData={handleDeleteAllData} 
            isProcessing={isLoading} 
            user={user} 
            availableCategories={availableCategories} 
            setAvailableCategories={handleSetAvailableCategories}
            quickFilters={quickFilters}
            setQuickFilters={handleSetQuickFilters}
            replacementRules={replacementRules}
            setReplacementRules={handleSetReplacementRules}
            categoryRules={categoryRules}
            setCategoryRules={handleSetCategoryRules}
        />
      </TabsContent>
      <TabsContent value="results" className="mt-4">
        {(isLoading || (showResults && !isLoadingTransactions)) ? (
            <ResultsDisplay
                creditData={creditData}
                depositData={depositData}
                cashData={cashData}
                availableCategories={availableCategories}
                quickFilters={quickFilters}
                onAddCashTransaction={handleAddCashTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                hasProcessed={hasProcessed}
                user={user}
            />
        ) : (isLoadingTransactions && !hasData) ? (
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
    </Tabs>
  );
}

      

    