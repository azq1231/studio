'use client';

import React, { useState, useMemo } from 'react';
import { getYear, getMonth } from 'date-fns';

import { AppSettings } from './settings-manager';
import { type CombinedData } from '../finance-flow-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react';
export function FixedItemsSummary({ combinedData, settings }: { combinedData: CombinedData[], settings: AppSettings }) {
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [selectedCategory, setSelectedCategory] = useState<'固定' | '收入'>('固定');
    const [analysisMode, setAnalysisMode] = useState<'monthly' | 'yearly'>('monthly');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Pre-process grouping rules
    const groupingRules = useMemo(() => (settings.descriptionGroupingRules || []).map((rule: any) => ({
        groupName: rule.groupName,
        keywords: rule.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
    })), [settings.descriptionGroupingRules]);

    const analysisData = useMemo(() => {
        const years = new Set<string>();
        const filteredByCategory = combinedData.filter(transaction => {
            if (transaction.category === selectedCategory) {
                const year = getYear(transaction.dateObj);
                years.add(String(year));
                return true;
            }
            return false;
        });

        // For Monthly Analysis (selected year)
        const itemsByDescriptionMonthly: Record<string, { monthly: Record<number, number>, total: number }> = {};
        filteredByCategory.filter(t => String(getYear(t.dateObj)) === selectedYear).forEach(transaction => {
            const desc = transaction.description;
            if (!itemsByDescriptionMonthly[desc]) {
                itemsByDescriptionMonthly[desc] = { monthly: {}, total: 0 };
            }
            const month = getMonth(transaction.dateObj);
            itemsByDescriptionMonthly[desc].monthly[month] = (itemsByDescriptionMonthly[desc].monthly[month] || 0) + (selectedCategory === '收入' ? Math.abs(transaction.amount) : transaction.amount);
            itemsByDescriptionMonthly[desc].total += (selectedCategory === '收入' ? Math.abs(transaction.amount) : transaction.amount);
        });

        // For Yearly Analysis (all years)
        const itemsByDescriptionYearly: Record<string, { yearly: Record<string, number>, total: number }> = {};
        filteredByCategory.forEach(transaction => {
            const desc = transaction.description;
            if (!itemsByDescriptionYearly[desc]) {
                itemsByDescriptionYearly[desc] = { yearly: {}, total: 0 };
            }
            const year = String(getYear(transaction.dateObj));
            itemsByDescriptionYearly[desc].yearly[year] = (itemsByDescriptionYearly[desc].yearly[year] || 0) + (selectedCategory === '收入' ? Math.abs(transaction.amount) : transaction.amount);
            itemsByDescriptionYearly[desc].total += (selectedCategory === '收入' ? Math.abs(transaction.amount) : transaction.amount);
        });

        const sortedYears = Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a));

        const getTableRows = (sourceData: Record<string, any>, valKey: 'monthly' | 'yearly', keys: (number | string)[]) => {
            const individualRows = Object.entries(sourceData).map(([description, data]) => ({
                description,
                ...data[valKey],
                total: data.total
            }));

            const groupedRows: Record<string, any[]> = {};
            const ungroupedRows: any[] = [];

            individualRows.forEach((row: any) => {
                let assignedGroup: string | null = null;
                for (const rule of groupingRules) {
                    if (rule.keywords.some((keyword: string) => row.description.includes(keyword))) {
                        assignedGroup = rule.groupName;
                        break;
                    }
                }
                if (assignedGroup) {
                    if (!groupedRows[assignedGroup]) groupedRows[assignedGroup] = [];
                    groupedRows[assignedGroup].push(row);
                } else {
                    ungroupedRows.push(row);
                }
            });

            const finalData = [
                ...Object.entries(groupedRows).map(([groupName, items]) => {
                    const groupTotals = items.reduce((acc, item) => {
                        keys.forEach(k => { acc[k] = (acc[k] || 0) + (item[k] || 0); });
                        return acc;
                    }, {} as Record<string | number, number>);
                    return {
                        isGroup: true,
                        description: groupName,
                        ...groupTotals,
                        total: items.reduce((sum: number, item: any) => sum + item.total, 0),
                        items: items.sort((a: any, b: any) => a.description.localeCompare(b.description, 'zh-Hant')),
                    };
                }).sort((a: any, b: any) => a.description.localeCompare(b.description, 'zh-Hant')),
                ...ungroupedRows.sort((a: any, b: any) => a.description.localeCompare(b.description, 'zh-Hant'))
            ];

            const colTotals = finalData.filter((r: any) => !r.isGroup).reduce((acc: number[], row: any) => {
                keys.forEach((k: string | number, idx: number) => { acc[idx] += (row[k] || 0); });
                return acc;
            }, Array(keys.length).fill(0));

            return { finalData, colTotals, grandTotal: colTotals.reduce((a, b) => a + b, 0) };
        };

        const monthlyResults = getTableRows(itemsByDescriptionMonthly, 'monthly', Array.from({ length: 12 }, (_, i) => i));
        const yearlyResults = getTableRows(itemsByDescriptionYearly, 'yearly', sortedYears);

        return {
            years: sortedYears,
            monthly: monthlyResults,
            yearly: yearlyResults
        };

    }, [combinedData, selectedYear, selectedCategory, groupingRules]);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

    return (
        <Card className="mt-6 border-primary/20 shadow-md">
            <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <BarChart2 className="w-6 h-6 text-primary" />
                            財務詳細分析
                        </CardTitle>
                        <CardDescription>
                            分析「{selectedCategory}」項目的趨勢與分佈
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedCategory} onValueChange={(v: any) => setSelectedCategory(v)}>
                            <SelectTrigger className="w-[110px] bg-primary/5 border-primary/20">
                                <SelectValue placeholder="類別" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="固定">固定支出</SelectItem>
                                <SelectItem value="收入">收入分析</SelectItem>
                            </SelectContent>
                        </Select>

                        {analysisMode === 'monthly' && analysisData.years.length > 0 && (
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue placeholder="年份" />
                                </SelectTrigger>
                                <SelectContent>
                                    {analysisData.years.map(year => (
                                        <SelectItem key={year} value={year}>{year} 年</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) || <div className="w-[110px]" />}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs value={analysisMode} onValueChange={(v: any) => setAnalysisMode(v)} className="w-full">
                    <TabsList className="mb-4 grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="monthly">月度明細 (單年)</TabsTrigger>
                        <TabsTrigger value="yearly">年度趨勢 (跨年)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="monthly">
                        {analysisData.monthly.finalData.length === 0 ? (
                            <div className="text-center py-20 border rounded-lg bg-muted/10">
                                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                                <p className="mt-4 text-muted-foreground italic">該年份無「{selectedCategory}」相關資料</p>
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="sticky left-0 bg-background z-10 w-[200px]">分析項目</TableHead>
                                            {months.map(m => <TableHead key={m} className="text-right px-2">{m}</TableHead>)}
                                            <TableHead className="text-right sticky right-0 bg-background z-10">總計</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysisData.monthly.finalData.map((row: any) => (
                                            <React.Fragment key={row.description}>
                                                <TableRow
                                                    className={cn(row.isGroup && "bg-primary/5 font-bold hover:bg-primary/10 cursor-pointer", row.isGroup && expandedGroups[row.description] && "border-b-0")}
                                                    onClick={() => row.isGroup && toggleGroup(row.description)}
                                                >
                                                    <TableCell className="sticky left-0 bg-inherit z-10">
                                                        <div className="flex items-center gap-2">
                                                            {row.isGroup ? (expandedGroups[row.description] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <div className="w-4" />}
                                                            {row.description}
                                                        </div>
                                                    </TableCell>
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <TableCell key={i} className="text-right font-mono text-sm">
                                                            {(row[i] || 0) !== 0 ? (row[i]).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit z-10">{row.total.toLocaleString()}</TableCell>
                                                </TableRow>
                                                {row.isGroup && expandedGroups[row.description] && row.items.map((item: any) => (
                                                    <TableRow key={item.description} className="hover:bg-muted/30 text-muted-foreground">
                                                        <TableCell className="pl-10 sticky left-0 bg-inherit z-10 text-xs">{item.description}</TableCell>
                                                        {Array.from({ length: 12 }).map((_, i) => (
                                                            <TableCell key={i} className="text-right font-mono text-xs">
                                                                {(item[i] || 0) !== 0 ? (item[i]).toLocaleString() : '-'}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit z-10 text-xs">{item.total.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        <TableRow className="bg-primary/10 font-bold border-t-2 border-primary">
                                            <TableCell className="sticky left-0 bg-inherit z-10">每月匯總</TableCell>
                                            {analysisData.monthly.colTotals.map((total: number, i: number) => (
                                                <TableCell key={i} className="text-right font-mono">{total > 0 ? total.toLocaleString() : '-'}</TableCell>
                                            ))}
                                            <TableCell className="text-right font-mono sticky right-0 bg-inherit z-10">{analysisData.monthly.grandTotal.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="yearly">
                        {analysisData.yearly.finalData.length === 0 ? (
                            <div className="text-center py-20 border rounded-lg bg-muted/10">
                                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                                <p className="mt-4 text-muted-foreground italic">查無跨年度相關資料</p>
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="sticky left-0 bg-background z-10 w-[200px]">分析項目</TableHead>
                                            {analysisData.years.map(year => <TableHead key={year} className="text-right px-2">{year} 年</TableHead>)}
                                            <TableHead className="text-right sticky right-0 bg-background z-10">歷史總計</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysisData.yearly.finalData.map((row: any) => (
                                            <React.Fragment key={row.description}>
                                                <TableRow
                                                    className={cn(row.isGroup && "bg-primary/5 font-bold hover:bg-primary/10 cursor-pointer", row.isGroup && expandedGroups[row.description] && "border-b-0")}
                                                    onClick={() => row.isGroup && toggleGroup(row.description)}
                                                >
                                                    <TableCell className="sticky left-0 bg-inherit z-10">
                                                        <div className="flex items-center gap-2">
                                                            {row.isGroup ? (expandedGroups[row.description] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <div className="w-4" />}
                                                            {row.description}
                                                        </div>
                                                    </TableCell>
                                                    {analysisData.years.map((year: string) => (
                                                        <TableCell key={year} className="text-right font-mono text-sm">
                                                            {(row[year] || 0) !== 0 ? (row[year]).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit z-10">{row.total.toLocaleString()}</TableCell>
                                                </TableRow>
                                                {row.isGroup && expandedGroups[row.description] && row.items.map((item: any) => (
                                                    <TableRow key={item.description} className="hover:bg-muted/30 text-muted-foreground">
                                                        <TableCell className="pl-10 sticky left-0 bg-inherit z-10 text-xs">{item.description}</TableCell>
                                                        {analysisData.years.map((year: string) => (
                                                            <TableCell key={year} className="text-right font-mono text-xs">
                                                                {(item[year] || 0) !== 0 ? (item[year]).toLocaleString() : '-'}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit z-10 text-xs">{item.total.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        <TableRow className="bg-primary/10 font-bold border-t-2 border-primary">
                                            <TableCell className="sticky left-0 bg-inherit z-10">年度匯總</TableCell>
                                            {analysisData.yearly.colTotals.map((total: number, i: number) => (
                                                <TableCell key={i} className="text-right font-mono">{total > 0 ? total.toLocaleString() : '-'}</TableCell>
                                            ))}
                                            <TableCell className="text-right font-mono sticky right-0 bg-inherit z-10">{analysisData.yearly.grandTotal.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
