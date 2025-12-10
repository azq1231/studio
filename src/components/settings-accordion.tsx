
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, Settings, ChevronsUpDown, ArrowDown, ArrowUp, RotateCcw, DatabaseZap } from 'lucide-react';
import type { ReplacementRule, CategoryRule } from '@/app/actions';

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
type QuickFilter = z.infer<typeof quickFilterSchema>;

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

type SettingsAccordionProps = {
    onDeleteAllData: () => Promise<void>;
    isProcessing: boolean;
    user: User | null;
    availableCategories: string[];
    setAvailableCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

export function SettingsAccordion({ onDeleteAllData, isProcessing, user, availableCategories, setAvailableCategories }: SettingsAccordionProps) {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const settingsForm = useForm<SettingsFormData>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: {
            replacementRules: [],
            categoryRules: [],
            quickFilters: [],
        },
    });

    const { fields: replacementFields, append: appendReplacement, remove: removeReplacement, replace: replaceReplacementRules } = useFieldArray({ control: settingsForm.control, name: 'replacementRules' });
    const { fields: categoryFields, append: appendCategory, remove: removeCategory, replace: replaceCategoryRules } = useFieldArray({ control: settingsForm.control, name: 'categoryRules' });
    const { fields: quickFilterFields, append: appendQuickFilter, remove: removeQuickFilter, replace: replaceQuickFilters } = useFieldArray({ control: settingsForm.control, name: "quickFilters" });

    useEffect(() => {
        setIsClient(true);
        try {
            const savedCategories = localStorage.getItem('availableCategories');
            if (savedCategories) setAvailableCategories(JSON.parse(savedCategories));
            else {
                const defaultCategories = ['方', '吃', '家', '固定', '蘇', '秀', '弟', '玩', '姊', '收入', '華'];
                setAvailableCategories(defaultCategories);
                localStorage.setItem('availableCategories', JSON.stringify(defaultCategories));
            }
            
            const savedReplacementRules = localStorage.getItem('replacementRules');
            settingsForm.setValue('replacementRules', savedReplacementRules ? JSON.parse(savedReplacementRules) : DEFAULT_REPLACEMENT_RULES);
            
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
            settingsForm.setValue('categoryRules', finalCategoryRules);
            localStorage.setItem('categoryRules', JSON.stringify(finalCategoryRules));

            const savedQuickFilters = localStorage.getItem('quickFilters');
            settingsForm.setValue('quickFilters', savedQuickFilters ? JSON.parse(savedQuickFilters) : DEFAULT_QUICK_FILTERS);

        } catch (e) { console.error("Failed to load settings from localStorage", e); }
    }, [settingsForm, setAvailableCategories]);


    const handleSaveSettings = (data: SettingsFormData) => {
        try {
            const uniqueReplacementRules = Array.from(new Map(data.replacementRules.map(r => [r.find, r])).values());
            const uniqueCategoryRules = Array.from(new Map(data.categoryRules.map(r => [r.keyword, r])).values());

            localStorage.setItem('replacementRules', JSON.stringify(uniqueReplacementRules));
            localStorage.setItem('categoryRules', JSON.stringify(uniqueCategoryRules));
            localStorage.setItem('quickFilters', JSON.stringify(data.quickFilters));
            
            settingsForm.reset({ replacementRules: uniqueReplacementRules, categoryRules: uniqueCategoryRules, quickFilters: data.quickFilters });
            toast({ title: "設定已儲存", description: "您的規則已成功儲存。" });
        } catch (e) {
           toast({ variant: "destructive", title: "儲存失敗", description: "無法儲存設定到您的瀏覽器。" });
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
        setAvailableCategories(prev => prev.filter(c => c !== categoryToRemove));
        localStorage.setItem('availableCategories', JSON.stringify(availableCategories.filter(c => c !== categoryToRemove)));
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

    const resetReplacementRules = () => { replaceReplacementRules(DEFAULT_REPLACEMENT_RULES); localStorage.setItem('replacementRules', JSON.stringify(DEFAULT_REPLACEMENT_RULES)); toast({ title: '取代規則已重置' }); };
    const resetCategoryRules = () => { replaceCategoryRules(DEFAULT_CATEGORY_RULES); localStorage.setItem('categoryRules', JSON.stringify(DEFAULT_CATEGORY_RULES)); toast({ title: '分類規則已重置' }); };
    const resetQuickFilters = () => { replaceQuickFilters(DEFAULT_QUICK_FILTERS); localStorage.setItem('quickFilters', JSON.stringify(DEFAULT_QUICK_FILTERS)); toast({ title: '快速篩選已重置' }); };

    if (!isClient) return null;

    return (
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>
            <div className="flex items-center gap-2"><Settings className="w-5 h-5" /><span className="text-lg font-semibold">規則設定</span></div>
          </AccordionTrigger>
          <AccordionContent>
            <Card><CardContent className="pt-6">
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
                    </TabsContent>

                    <TabsContent value="category" className="mt-4">
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
                    </TabsContent>

                    <TabsContent value="quick-filters" className="mt-4">
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
                    </TabsContent>

                    <TabsContent value="manage-categories" className="mt-4">
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
                    </TabsContent>

                    <TabsContent value="data-management" className="mt-4">
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
                    </TabsContent>
                  </Tabs>
                  <div className="flex justify-end items-center mt-6"><Button type="submit">儲存設定</Button></div>
                </form>
              </Form>
            </CardContent></Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
}

    