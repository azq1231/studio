'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, TrendingUp, TrendingDown, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { formatCurrency, cn } from '@/lib/utils';
import type { BalanceAccount } from './settings-manager';

// Define a local interface compatible with CombinedData
interface Transaction {
    id: string;
    date: string; // yyyy/MM/dd
    description: string;
    amount: number;
    category: string;
    bankCode?: string;
    notes?: string;
    // Allow for other properties if needed
    [key: string]: any;
}

interface BalanceTrackerProps {
    balanceAccounts: BalanceAccount[];
    transactions: Transaction[];
}

export function BalanceTracker({ balanceAccounts, transactions }: BalanceTrackerProps) {
    const accountBalances = useMemo(() => {
        return balanceAccounts.map(account => {
            const accountTransactions = transactions.filter(t => {
                const keywords = account.keywords.split(',').map(k => k.trim()).filter(k => k);

                const category = t.category || '';
                const description = t.description || '';
                const note = t.bankCode || t.notes || '';

                const matchesCategory = category === account.category;
                const matchesKeyword = keywords.some(k => description.includes(k) || note.includes(k));

                // 篩選邏輯 (Strict Mode)：交易必須「同時」符合指定的分類 (Category) 與 關鍵字 (Keyword)
                // 這是為了確保只有真正屬於該專款的項目被列入，避免誤判。
                return matchesCategory && matchesKeyword;
            });

            const totalBalance = accountTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalIn = accountTransactions.filter(t => (t.amount || 0) > 0).reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalOut = accountTransactions.filter(t => (t.amount || 0) < 0).reduce((sum, t) => sum + (t.amount || 0), 0);

            return {
                ...account,
                balance: totalBalance,
                totalIn,
                totalOut,
                transactions: accountTransactions.sort((a, b) => {
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    return dateB - dateA;
                })
            };
        });
    }, [balanceAccounts, transactions]);

    if (balanceAccounts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">專款餘額追蹤</h3>
                <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                    (需同時符合分類與關鍵字)
                </span>
            </div>

            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {accountBalances.map((acc) => (
                    <Card key={acc.name} className="overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <CardHeader className="py-3 px-4 bg-muted/20 pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">{acc.name}</CardTitle>
                                    <div className={cn("text-2xl font-bold mt-1", acc.balance < 0 ? "text-destructive" : "text-primary")}>
                                        {formatCurrency(acc.balance)}
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-xs font-normal bg-background/50">
                                    {acc.category}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 py-2 flex-1">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> 收入</span>
                                <span className="text-emerald-600 font-medium">{formatCurrency(acc.totalIn)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-rose-500" /> 支出</span>
                                <span className="text-rose-600 font-medium">{formatCurrency(Math.abs(acc.totalOut))}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 pb-2 px-2 h-10">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-primary hover:bg-primary/5 hover:text-primary">
                                        <Eye className="w-3 h-3 mr-2" /> 檢視收支明細
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0">
                                    <div className="p-4 border-b">
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            {acc.name} - 明細
                                            <Badge variant={acc.balance >= 0 ? "default" : "destructive"}>
                                                餘額: {formatCurrency(acc.balance)}
                                            </Badge>
                                        </h2>
                                    </div>
                                    <div className="flex-1 overflow-auto p-0">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-secondary/90 backdrop-blur-sm z-10 shadow-sm">
                                                <TableRow>
                                                    <TableHead className="w-[100px]">日期</TableHead>
                                                    <TableHead className="min-w-[150px]">說明</TableHead>
                                                    <TableHead className="text-right whitespace-nowrap">金額</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {acc.transactions.length > 0 ? (
                                                    acc.transactions.map((t) => (
                                                        <TableRow key={t.id} className="hover:bg-muted/50">
                                                            <TableCell className="py-2 text-xs">{t.date}</TableCell>
                                                            <TableCell className="py-2">
                                                                <div className="text-sm font-medium truncate max-w-[180px] md:max-w-xs" title={t.description}>{t.description}</div>
                                                                {(t.notes || t.bankCode) && <div className="text-xs text-muted-foreground truncate max-w-[180px] md:max-w-xs">{t.notes || t.bankCode}</div>}
                                                            </TableCell>
                                                            <TableCell className={cn("py-2 text-right font-medium text-sm whitespace-nowrap", t.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                {formatCurrency(t.amount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                            無相關交易紀錄
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            {accountBalances.some(a => a.balance < 0) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-xs border border-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>注意：部分專款帳戶餘額為負，請確認是否透支或尚未提撥款項。</p>
                </div>
            )}
        </div>
    );
}
