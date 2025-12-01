'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';

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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, AlertCircle, Trash2, PlusCircle, Settings } from 'lucide-react';
import { processBankStatement, type ReplacementRule, type CategoryRule } from '@/app/actions';
import type { CreditData, DepositData } from '@/lib/parser';


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
  category: z.string().min(1, { message: '請輸入類型' }),
});

const settingsFormSchema = z.object({
  replacementRules: z.array(replacementRuleSchema),
  categoryRules: z.array(categoryRuleSchema),
});

type StatementFormData = z.infer<typeof statementFormSchema>;
type SettingsFormData = z.infer<typeof settingsFormSchema>;


export function FinanceFlowClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const { toast } = useToast();

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

  const { fields: replacementFields, append: appendReplacement, remove: removeReplacement } = useFieldArray({
    control: settingsForm.control,
    name: 'replacementRules',
  });
  
  const { fields: categoryFields, append: appendCategory, remove: removeCategory } = useFieldArray({
    control: settingsForm.control,
    name: 'categoryRules',
  });


  useEffect(() => {
    try {
      const savedReplacementRules = localStorage.getItem('replacementRules');
      if (savedReplacementRules) {
        const parsed = JSON.parse(savedReplacementRules);
        if (Array.isArray(parsed)) {
           settingsForm.setValue('replacementRules', parsed);
        }
      } else {
        settingsForm.setValue('replacementRules', [
          { find: '行銀非約跨優', replace: '', deleteRow: false },
          { find: 'ＣＤＭ存款', replace: '', deleteRow: true }
        ]);
      }

      const savedCategoryRules = localStorage.getItem('categoryRules');
       if (savedCategoryRules) {
        const parsed = JSON.parse(savedCategoryRules);
        if (Array.isArray(parsed)) {
           settingsForm.setValue('categoryRules', parsed);
        }
      } else {
        settingsForm.setValue('categoryRules', [
          { keyword: 'VULTR', category: '方' },
          { keyword: '國外交易服務費', category: '方' },
          { keyword: 'GOOGLE*CLOUD', category: '方' },
          { keyword: '悠遊卡自動加值', category: '方' },
          { keyword: 'REPLIT, INC.', category: '方' },
          { keyword: '伯朗咖啡', category: '方' },
          { keyword: '柒號洋樓', category: '方' },
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
          { keyword: '加油站', category: '家' },
          { keyword: '全聯', category: '家' },
          { keyword: '55688', category: '家' },
          { keyword: 'IKEA', category: '家' },
          { keyword: '優步', category: '家' },
          { keyword: 'OP錢包', category: '家' },
          { keyword: 'NET', category: '家' },
          { keyword: '麗冠有線電視', category: '固定' },
          { keyword: '09202***01', category: '固定' },
          { keyword: '國都汽車', category: '固定' },
          { keyword: '台灣電力', category: '固定' },
          { keyword: '橙印良品', category: '蘇' },
          { keyword: 'PayEasy', category: '蘇' },
          { keyword: '金玉堂', category: '秀' },
          { keyword: '秀泰全球影城', category: '吃' }, // Per user's list
          { keyword: '寶雅', category: '秀' },
        ]);
      }
    } catch (e) {
      console.error("Failed to load rules from localStorage", e);
    }
  }, [settingsForm]);

  const handleSaveSettings = (data: SettingsFormData) => {
    try {
      localStorage.setItem('replacementRules', JSON.stringify(data.replacementRules));
      localStorage.setItem('categoryRules', JSON.stringify(data.categoryRules));
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

  async function onSubmit(values: StatementFormData) {
    setIsLoading(true);
    setHasProcessed(false);
    setCreditData([]);
    setDepositData([]);

    const { replacementRules, categoryRules } = settingsForm.getValues();
    const result = await processBankStatement(values.statement, replacementRules, categoryRules);
    
    if (result.success) {
      setCreditData(result.creditData);
      setDepositData(result.depositData);
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
          '時間': d.time,
          '摘要＋存摺備註': d.description,
          '金額（支出正、存入負）': d.amount,
          '空白': d.blank,
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
        title: "下載失敗",
        description: "產生 Excel 檔案時發生錯誤。",
      });
      console.error("Failed to download Excel file:", error);
    }
  }

  const noDataFound = hasProcessed && !isLoading && creditData.length === 0 && depositData.length === 0;
  const hasData = creditData.length > 0 || depositData.length > 0;
  const defaultTab = creditData.length > 0 ? "credit" : "deposit";

  return (
    <div className="space-y-4">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>貼上報表內容</CardTitle>
          <CardDescription>將您的網路銀行報表內容直接複製並貼到下方文字框中，然後點擊「處理報表」。</CardDescription>
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
                        placeholder="例如：&#10;11/02	吃	新東陽忠孝一門市	500"
                        className="min-h-[250px] font-mono text-sm bg-background/50"
                        {...field}
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
                    <Tabs defaultValue="category">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="replacement">取代規則</TabsTrigger>
                        <TabsTrigger value="category">分類規則</TabsTrigger>
                      </TabsList>
                      <TabsContent value="replacement" className="mt-4">
                        <CardDescription className="mb-4">
                          設定自動取代或刪除規則。勾選「刪除整筆資料」後，符合條件的資料將被整筆移除。
                        </CardDescription>
                        <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                          {replacementFields.map((field, index) => (
                            <div key={field.id} className="p-3 border rounded-md space-y-3 bg-background/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={settingsForm.control}
                                        name={`replacementRules.${index}.find`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>尋找文字</FormLabel>
                                            <FormControl>
                                            <Input placeholder="要被取代的文字" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={settingsForm.control}
                                        name={`replacementRules.${index}.replace`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>取代為</FormLabel>
                                            <FormControl>
                                            <Input placeholder="新的文字 (留空為刪除文字)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                  <FormField
                                      control={settingsForm.control}
                                      name={`replacementRules.${index}.deleteRow`}
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal text-sm text-muted-foreground">
                                            刪除整筆資料
                                          </FormLabel>
                                        </FormItem>
                                      )}
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeReplacement(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                          ))}
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
                        <CardDescription className="mb-4">
                           設定交易項目關鍵字與對應的類型。處理報表時，將會自動帶入符合的第一個類型。
                        </CardDescription>
                         <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                          {categoryFields.map((field, index) => (
                            <div key={field.id} className="p-3 border rounded-md space-y-3 bg-background/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={settingsForm.control}
                                        name={`categoryRules.${index}.keyword`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>關鍵字</FormLabel>
                                            <FormControl>
                                            <Input placeholder="交易項目中的文字" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={settingsForm.control}
                                        name={`categoryRules.${index}.category`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>類型</FormLabel>
                                            <FormControl>
                                            <Input placeholder="要指定的類型" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCategory(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                          ))}
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

      {(isLoading || hasProcessed) && (
        <Card>
          <CardHeader>
            <h3 className="text-xl font-semibold font-headline">處理結果</h3>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-24 rounded-md" />
                  <Skeleton className="h-10 w-24 rounded-md" />
                </div>
                <Skeleton className="h-48 w-full rounded-md" />
              </div>
            )}
            
            {hasData && !isLoading && (
              <div>
                <div className="flex justify-end items-center mb-4">
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    下載 Excel
                  </Button>
                </div>
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList>
                    {creditData.length > 0 && <TabsTrigger value="credit">信用卡 ({creditData.length})</TabsTrigger>}
                    {depositData.length > 0 && <TabsTrigger value="deposit">活存帳戶 ({depositData.length})</TabsTrigger>}
                  </TabsList>
                  {creditData.length > 0 && (
                    <TabsContent value="credit">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>交易日期</TableHead>
                            <TableHead>類型</TableHead>
                            <TableHead>交易項目</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {creditData.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{row.transactionDate}</TableCell>
                              <TableCell>{row.category}</TableCell>
                              <TableCell>{row.description}</TableCell>
                              <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-destructive' : ''}`}>{row.amount.toLocaleString()}</TableCell>
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
                            <TableHead>時間</TableHead>
                            <TableHead>摘要</TableHead>
                            <TableHead>銀行代碼</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {depositData.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{row.date}</TableCell>
                              <TableCell className="font-mono">{row.time}</TableCell>
                              <TableCell>{row.description}</TableCell>
                              <TableCell className="font-mono">{row.bankCode}</TableCell>
                              <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}

            {noDataFound && (
              <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12" />
                <p className="mt-4 text-lg">無有效資料</p>
                <p className="mt-2 text-sm">我們無法從您提供的內容中解析出任何報表資料。<br/>請確認格式是否正確，或嘗試貼上其他內容。</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    