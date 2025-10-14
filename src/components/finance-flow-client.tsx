'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { processBankStatement } from '@/app/actions';
import type { CreditData, DepositData } from '@/lib/parser';

const formSchema = z.object({
  statement: z.string().min(10, { message: '報表內容至少需要10個字元。' }),
});

type FormData = z.infer<typeof formSchema>;

export function FinanceFlowClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [creditData, setCreditData] = useState<CreditData[]>([]);
  const [depositData, setDepositData] = useState<DepositData[]>([]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { statement: '' },
    mode: 'onChange'
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    setHasProcessed(false);
    setCreditData([]);
    setDepositData([]);

    const result = await processBankStatement(values.statement);
    
    if (result.success) {
      setCreditData(result.creditData);
      setDepositData(result.depositData);
      if (result.creditData.length === 0 && result.depositData.length === 0) {
        toast({
          variant: "default",
          title: "提醒",
          description: "未解析到任何有效資料，請檢查您的報表格式是否正確。",
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
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>貼上報表內容</CardTitle>
        <CardDescription>將您的網路銀行報表內容直接複製並貼到下方文字框中，然後點擊「處理報表」。</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
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
              <Button type="submit" disabled={isLoading || !form.formState.isValid} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                處理報表
              </Button>
            </div>
          </form>
        </Form>
        
        {isLoading && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-10 w-24 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
            <Skeleton className="h-48 w-full rounded-md" />
          </div>
        )}
        
        {hasData && !isLoading && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h3 className="text-xl font-semibold font-headline">處理結果</h3>
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
          <div className="mt-8 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12" />
            <p className="mt-4 text-lg">無有效資料</p>
            <p className="mt-2 text-sm">我們無法從您提供的內容中解析出任何報表資料。<br/>請確認格式是否正確，或嘗試貼上其他內容。</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
