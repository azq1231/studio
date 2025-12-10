
'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from 'lucide-react';


const statementFormSchema = z.object({
  statement: z.string().min(10, { message: '報表內容至少需要10個字元。' }),
});

type StatementFormData = z.infer<typeof statementFormSchema>;

type StatementImporterProps = {
    isProcessing: boolean;
    onProcess: (data: { text?: string; excelData?: any[][] }) => Promise<void>;
    user: User | null;
}

export function StatementImporter({ isProcessing, onProcess, user }: StatementImporterProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const statementForm = useForm<StatementFormData>({
        resolver: zodResolver(statementFormSchema),
        defaultValues: { statement: '' },
        mode: 'onChange'
    });

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
              
              await onProcess({ excelData });
            }
          } catch (error) {
            toast({ variant: "destructive", title: "檔案解析失敗", description: "無法讀取或解析您提供的檔案，請確認格式是否正確。" });
          } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.readAsArrayBuffer(file);
    };

    async function onSubmit(values: StatementFormData) {
        await onProcess({ text: values.statement });
        statementForm.reset({ statement: '' });
    }

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>貼上報表內容</CardTitle>
                        <CardDescription className="mt-2">
                            {user
                            ? "將您的網路銀行報表內容直接複製並貼到下方文字框中，或點擊右方按鈕匯入 Excel 檔案。處理後的資料將會自動儲存到您的帳戶。"
                            : "將您的網路銀行報表內容直接複製並貼到下方文字框中，或點擊右方按鈕匯入 Excel 檔案。如需儲存資料，請先登入。"}
                        </CardDescription>
                    </div>
                    <div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                        <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={isProcessing}><Upload className="mr-2 h-4 w-4" />從檔案匯入</Button>
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
                        <Textarea placeholder="例如：&#10;11/02	吃	新東陽忠孝一門市	500" className="min-h-[250px] font-mono text-sm bg-background/50" {...field} disabled={isProcessing}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={isProcessing || !statementForm.formState.isValid} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    處理報表
                    </Button>
                </div>
                </form>
            </Form>
            </CardContent>
        </Card>
    );
}

    