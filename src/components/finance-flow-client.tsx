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
import { processBankStatement, type ReplacementRule } from '@/app/actions';
import type { CreditData, DepositData } from '@/lib/parser';


const statementFormSchema = z.object({
  statement: z.string().min(10, { message: '報表內容至少需要10個字元。' }),
});

const replacementRuleSchema = z.object({
  find: z.string().min(1, { message: '請輸入要尋找的文字' }),
  replace: z.string(),
  deleteRow: z.boolean().default(false),
});

const settingsFormSchema = z.object({
  rules: z.array(replacementRuleSchema),
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
      rules: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: settingsForm.control,
    name: 'rules',
  });

  useEffect(() => {
    try {
      const savedRules = localStorage.getItem('replacementRules');
      if (savedRules) {
        const parsedRules = JSON.parse(savedRules);
        if (Array.isArray(parsedRules)) {
           settingsForm.reset({ rules: parsedRules });
        }
      } else {
        // Set default rules if nothing is saved
        settingsForm.reset({ rules: [
          { find: '行銀非約跨優', replace: '', deleteRow: false },
          { find: 'ＣＤＭ存款', replace: '', deleteRow: true }
        ] });
      }
    } catch (e) {
      console.error("Failed to load replacement rules from localStorage", e);
      settingsForm.reset({ rules: [
          { find: '行銀非約跨優', replace: '', deleteRow: false },
          { find: 'ＣＤＭ存款', replace: '', deleteRow: true }
      ] });
    }
  }, [settingsForm]);

  const handleSaveSettings = (data: SettingsFormData) => {
    try {
      localStorage.setItem('replacementRules', JSON.stringify(data.rules));
      toast({
        title: "設定已儲存",
        description: "您的取代規則已成功儲存。",
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

    const replacementRules = settingsForm.getValues('rules');
    const result = await processBankStatement(values.statement, replacementRules);
    
    if (result.success) {
      setCreditData(result.creditData);
      setDepositData(result.depositData);
      if (result.creditData.length === 0 && result.depositData.length === 0) {
        toast({
          variant: "default",
          title: "提醒",
          description: "未解析到任何有效資料，請檢查您的報表格式或取代規則是否正確。",
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
          '入帳日期': d.postingDate,
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
                        placeholder="例如：&#10;交易日期    入帳日期    交易摘要&#10;05/01       05/02       網路購物          -1,234"
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
              <span className="text-lg font-semibold">取代設定</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardDescription>
                  設定自動取代或刪除規則。當「取代為」留空並勾選「刪除整筆資料」時，符合條件的資料將被移除。
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <Form {...settingsForm}>
                  <form onSubmit={settingsForm.handleSubmit(handleSaveSettings)} className="space-y-4">
                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <div key={field.id} className="p-3 border rounded-md space-y-4">
                            <div className="flex items-end gap-2">
                                <FormField
                                    control={settingsForm.control}
                                    name={`rules.${index}.find`}
                                    render={({ field }) => (
                                    <FormItem className="flex-1">
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
                                    name={`rules.${index}.replace`}
                                    render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>取代為</FormLabel>
                                        <FormControl>
                                        <Input placeholder="新的文字 (留空為刪除)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                            <FormField
                                control={settingsForm.control}
                                name={`rules.${index}.deleteRow`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm text-muted-foreground">
                                      如果「取代為」為空，則刪除整筆資料
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                        </div>
                      ))}
                    </div>
                     <div className="flex justify-between items-center mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({ find: '', replace: '', deleteRow: false })}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          新增規則
                        </Button>
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
                            <TableHead>入帳日期</TableHead>
                            <TableHead>交易項目</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {creditData.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{row.transactionDate}</TableCell>
                              <TableCell className="font-mono">{row.postingDate}</TableCell>
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
