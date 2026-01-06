'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CombinedData } from '@/components/finance-flow-client';
import { BalanceAccount } from './settings-manager';
import { Wallet, ArrowDownCircle, ArrowUpCircle, AlertCircle, Calendar, Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addDays, differenceInDays, format, parseISO } from 'date-fns';

export function BalanceTracker({ combinedData, balanceAccounts }: { combinedData: CombinedData[], balanceAccounts: BalanceAccount[] }) {
    const [selectedAccount, setSelectedAccount] = useState<any>(null);

    const accountBalances = useMemo(() => {
        if (!balanceAccounts || balanceAccounts.length === 0) return [];

        return balanceAccounts.map(account => {
            const keywords = account.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

            const transactions = combinedData.filter(t => {
                const matchesCategory = t.category === account.category;
                const matchesKeywords = keywords.length === 0 || keywords.some(k => t.description.toLowerCase().includes(k));
                return matchesCategory && matchesKeywords;
            }).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

            let totalIn = 0;
            let totalOut = 0;

            transactions.forEach(t => {
                if (t.amount < 0) {
                    totalIn += Math.abs(t.amount);
                } else {
                    totalOut += t.amount;
                }
            });

            const balance = totalIn - totalOut;
            const lastTransaction = transactions.length > 0 ? transactions[0] : null;

            // Runway Calculation (Prediction)
            let estimatedDaysLeft = null;
            let estimatedEndDate = null;
            let dailyRate = 0;

            if (transactions.length > 1 && totalOut > 0) {
                const oldestDate = transactions[transactions.length - 1].dateObj;
                const newestDate = transactions[0].dateObj;
                const daysDiff = Math.max(1, differenceInDays(newestDate, oldestDate));
                dailyRate = totalOut / daysDiff;

                if (balance > 0 && dailyRate > 0) {
                    estimatedDaysLeft = Math.floor(balance / dailyRate);
                    estimatedEndDate = addDays(new Date(), estimatedDaysLeft);
                }
            }

            return {
                ...account,
                totalIn,
                totalOut,
                balance,
                count: transactions.length,
                lastDate: lastTransaction?.date,
                transactions,
                dailyRate,
                estimatedEndDate
            };
        });
    }, [combinedData, balanceAccounts]);

    if (!balanceAccounts || balanceAccounts.length === 0) return null;

    return (
        <div className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accountBalances.map((acc) => (
                    <Card key={acc.name} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-primary">
                            <div>
                                <CardTitle className="text-lg font-bold">{acc.name}</CardTitle>
                                <CardDescription>
                                    分類: <Badge variant="secondary" className="ml-1 text-[10px] h-5">{acc.category}</Badge>
                                </CardDescription>
                            </div>
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Wallet className="w-5 h-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="flex flex-col space-y-3">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">目前餘額</span>
                                    <span className={cn(
                                        "text-2xl font-black font-mono",
                                        acc.balance >= 0 ? "text-emerald-600" : "text-destructive"
                                    )}>
                                        ${acc.balance.toLocaleString()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-muted">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                            <ArrowDownCircle className="w-3 h-3 text-emerald-500" /> 累計存入
                                        </span>
                                        <span className="text-sm font-bold font-mono text-emerald-600">
                                            +{acc.totalIn.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                            <ArrowUpCircle className="w-3 h-3 text-orange-500" /> 累計支出
                                        </span>
                                        <span className="text-sm font-bold font-mono text-orange-600">
                                            -{acc.totalOut.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-muted">
                                    <div className="flex justify-between items-center text-[11px] text-muted-foreground italic">
                                        <span className="flex items-center gap-1"><Search className="w-3 h-3" /> 共 {acc.count} 筆交易</span>
                                        {acc.lastDate && <span>最後異動: {acc.lastDate}</span>}
                                    </div>

                                    {acc.estimatedEndDate && acc.balance > 0 ? (
                                        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-md flex items-center justify-between">
                                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> 預計可用至
                                            </span>
                                            <span className="text-sm font-bold text-emerald-700">
                                                {format(acc.estimatedEndDate, 'yyyy/MM/dd')}
                                            </span>
                                        </div>
                                    ) : acc.balance > 0 ? (
                                        <div className="p-2 bg-muted/50 rounded-md text-[10px] text-muted-foreground text-center">
                                            數據不足，尚無法預估時長
                                        </div>
                                    ) : null}

                                    {acc.balance < 0 && (
                                        <div className="p-2 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-xs font-semibold">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>預付款已用盡 (超支 {Math.abs(acc.balance).toLocaleString()})</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 pb-3 h-10">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-primary hover:bg-primary/5 hover:text-primary">
                                        <Eye className="w-3 h-3 mr-2" /> 檢視收支明細
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center justify-between pr-6">
                                            <span>{acc.name} - 交易明細</span>
                                            <span className={cn("text-lg", acc.balance >= 0 ? "text-emerald-600" : "text-destructive")}>
                                                餘額: ${acc.balance.toLocaleString()}
                                            </span>
                                        </DialogTitle>
                                        <DialogDescription>
                                            顯示類別 「{acc.category}」 中包含關鍵字 「{acc.keywords}」 的所有歷史交易
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="overflow-y-auto mt-4 rounded-md border">
                                        <Table>
                                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="w-[100px]">日期</TableHead>
                                                    <TableHead>交易項目</TableHead>
                                                    <TableHead className="text-right">金額</TableHead>
                                                    <TableHead>備註</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {acc.transactions.map((t: CombinedData, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-xs font-mono">{t.date}</TableCell>
                                                        <TableCell className="text-xs font-medium">{t.description}</TableCell>
                                                        <TableCell className={cn(
                                                            "text-xs font-bold font-mono text-right",
                                                            t.amount < 0 ? "text-emerald-600" : "text-destructive"
                                                        )}>
                                                            {t.amount < 0 ? '+' : ''}{Math.abs(t.amount).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-[10px] text-muted-foreground italic">{t.notes}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

// Helper components that should have been imported but since this is a self-contained fix
function Button({ className, variant, size, ...props }: any) {
    const variants: any = {
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    };
    const sizes: any = {
        sm: "h-9 rounded-md px-3",
        xs: "h-7 rounded-md px-2",
    };
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                variants[variant || 'outline'],
                sizes[size || 'sm'],
                className
            )}
            {...props}
        />
    );
}
