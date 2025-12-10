
'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { User } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import type { CashData } from '@/lib/parser';
import { cn } from '@/lib/utils';

const cashTransactionSchema = z.object({
    date: z.date({ required_error: "請選擇日期" }),
    description: z.string().min(1, "請輸入交易項目"),
    category: z.string().min(1, "請選擇類型"),
    amount: z.number({ required_error: "請輸入金額", invalid_type_error: "請輸入有效數字" }).min(1, "金額必須大於 0"),
    notes: z.string().optional(),
    type: z.enum(['expense', 'income']).default('expense'),
});

type CashTransactionFormData = z.infer<typeof cashTransactionSchema>;

type CashTransactionFormProps = {
    availableCategories: string[];
    onSubmit: (data: Omit<CashData, 'id'| 'amount'> & {amount: number, type: 'expense' | 'income'}) => void;
    user: User | null;
};

export function CashTransactionForm({ availableCategories, onSubmit, user }: CashTransactionFormProps) {
    const form = useForm<CashTransactionFormData>({
        resolver: zodResolver(cashTransactionSchema),
        defaultValues: { description: '', category: '', notes: '', type: 'expense' },
    });

    const handleSubmit = (values: CashTransactionFormData) => {
        onSubmit({
            date: format(values.date, 'yyyy/MM/dd'),
            description: values.description,
            category: values.category,
            amount: values.amount,
            notes: values.notes,
            type: values.type,
        });
        form.reset();
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
                            <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>金額</FormLabel><FormControl><Input type="number" placeholder="120" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>} />
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
    