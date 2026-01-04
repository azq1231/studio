'use client';

import React, { useState, useMemo } from 'react';
import { getYear, getMonth } from 'date-fns';

import { AppSettings } from './settings-manager';
import { CombinedData } from './results-display';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';


export function FixedItemsSummary({ combinedData, settings }: { combinedData: CombinedData[], settings: AppSettings }) {
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const fixedItemsData = useMemo(() => {
        const years = new Set<string>();
        const filteredByYear = combinedData.filter(transaction => {
            if (transaction.category === '固定') {
                const year = getYear(transaction.dateObj);
                years.add(String(year));
                return String(year) === selectedYear;
            }
            return false;
        });

        // Pre-process rules for faster lookup
        const groupingRules = (settings.descriptionGroupingRules || []).map(rule => ({
            groupName: rule.groupName,
            keywords: rule.keywords.split(',').map(k => k.trim()).filter(Boolean)
        }));

        const itemsByDescription: Record<string, { monthly: Record<number, number>, total: number }> = {};
        
        filteredByYear.forEach(transaction => {
            const desc = transaction.description;
            if (!itemsByDescription[desc]) {
                itemsByDescription[desc] = { monthly: {}, total: 0 };
            }
            const month = getMonth(transaction.dateObj); // 0-11
            itemsByDescription[desc].monthly[month] = (itemsByDescription[desc].monthly[month] || 0) + transaction.amount;
            itemsByDescription[desc].total += transaction.amount;
        });
        
        const individualRows = Object.entries(itemsByDescription).map(([description, data]) => ({
            description,
            ...data.monthly,
            total: data.total
        }));
        
        const groupedRows: Record<string, typeof individualRows> = {};
        const ungroupedRows: typeof individualRows = [];

        individualRows.forEach(row => {
            let assignedGroup: string | null = null;
            for (const rule of groupingRules) {
                if (rule.keywords.some(keyword => row.description.includes(keyword))) {
                    assignedGroup = rule.groupName;
                    break;
                }
            }
            if (assignedGroup) {
                if (!groupedRows[assignedGroup]) {
                    groupedRows[assignedGroup] = [];
                }
                groupedRows[assignedGroup].push(row);
            } else {
                ungroupedRows.push(row);
            }
        });

        const finalTableData = [
            ...Object.entries(groupedRows).map(([groupName, items]) => {
                const groupTotalMonthly = items.reduce((acc, item) => {
                    for(let i=0; i<12; i++) {
                        acc[i] = (acc[i] || 0) + (item[i as keyof typeof item] as number || 0);
                    }
                    return acc;
                }, {} as Record<number, number>);

                const groupTotal = items.reduce((sum, item) => sum + item.total, 0);

                return {
                    isGroup: true,
                    description: groupName,
                    ...groupTotalMonthly,
                    total: groupTotal,
                    items: items.sort((a,b) => a.description.localeCompare(b.description, 'zh-Hant')),
                };
            }).sort((a,b) => a.description.localeCompare(b.description, 'zh-Hant')),
            ...ungroupedRows.sort((a,b) => a.description.localeCompare(b.description, 'zh-Hant'))
        ];

        const monthlyTotals = finalTableData
          .filter(row => !row.isGroup)
          .reduce((acc, row) => {
              for (let i = 0; i < 12; i++) {
                acc[i] += (row[i as keyof typeof row] as number || 0);
              }
              return acc;
          }, Array(12).fill(0));
          
        const grandTotal = monthlyTotals.reduce((sum, total) => sum + total, 0);

        return {
            years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
            tableData: finalTableData,
            monthlyTotals,
            grandTotal
        };

    }, [combinedData, selectedYear, settings.descriptionGroupingRules]);
    
    if (fixedItemsData.years.length === 0 && fixedItemsData.tableData.length === 0) {
        return (
            <Card className="mt-6">
                 <CardContent className="pt-6">
                    <div className="text-center py-10">
                        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">沒有固定項目資料</h3>
                        <p className="mt-2 text-sm text-muted-foreground">找不到任何類別為「固定」的交易紀錄可供分析。</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({...prev, [groupName]: !prev[groupName]}));
    };

    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    
    return (
        <Card className="mt-6">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>固定項目詳細分析</CardTitle>
                    {fixedItemsData.years.length > 0 && (
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="選擇年份" />
                            </SelectTrigger>
                            <SelectContent>
                                {fixedItemsData.years.map(year => (
                                    <SelectItem key={year} value={year}>{year} 年</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <CardDescription>查看「固定」分類下各項目在各月份的支出明細。點擊群組名稱可展開或收合。</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 bg-background/95 backdrop-blur-sm z-10 w-[250px] px-2">項目</TableHead>
                                {months.map(m => <TableHead key={m} className="text-right px-2">{m}</TableHead>)}
                                <TableHead className="text-right sticky right-0 bg-background/95 backdrop-blur-sm z-10 px-2">年度總計</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fixedItemsData.tableData.map(row => (
                                <React.Fragment key={row.description}>
                                    <TableRow 
                                        className={cn(row.isGroup && "bg-muted/50 font-bold hover:bg-muted/60", row.isGroup && expandedGroups[row.description] && "border-b-0")}
                                        onClick={() => row.isGroup && toggleGroup(row.description)}
                                    >
                                        <TableCell className="font-medium sticky left-0 bg-inherit backdrop-blur-sm z-10 px-2">
                                            <div className="flex items-center gap-2">
                                                {row.isGroup ? (
                                                     expandedGroups[row.description] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                                                ) : <div className="w-4"/>}
                                                {row.description}
                                            </div>
                                        </TableCell>
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <TableCell key={i} className="text-right font-mono px-2">
                                                {(row[i as keyof typeof row] as number || 0) !== 0 ? (row[i as keyof typeof row] as number).toLocaleString() : '-'}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit backdrop-blur-sm z-10 px-2">{row.total.toLocaleString()}</TableCell>
                                    </TableRow>
                                    {row.isGroup && expandedGroups[row.description] && row.items.map(item => (
                                         <TableRow key={item.description} className="hover:bg-muted/30">
                                             <TableCell className="font-normal sticky left-0 bg-inherit backdrop-blur-sm z-10 pl-10 px-2">{item.description}</TableCell>
                                             {Array.from({ length: 12 }).map((_, i) => (
                                                 <TableCell key={i} className="text-right font-mono text-sm px-2">
                                                     {(item[i as keyof typeof item] as number || 0) !== 0 ? (item[i as keyof typeof item] as number).toLocaleString() : '-'}
                                                 </TableCell>
                                             ))}
                                             <TableCell className="text-right font-mono font-bold sticky right-0 bg-inherit backdrop-blur-sm z-10 text-sm px-2">{item.total.toLocaleString()}</TableCell>
                                         </TableRow>
                                    ))}
                                </React.Fragment>
                            ))}
                        </TableBody>
                        <TableBody>
                           <TableRow className="bg-muted hover:bg-muted font-bold border-t-2 border-primary">
                               <TableCell className="sticky left-0 bg-muted/95 backdrop-blur-sm z-10 px-2">每月總計</TableCell>
                               {fixedItemsData.monthlyTotals.map((total, i) => (
                                   <TableCell key={i} className="text-right font-mono px-2">{total > 0 ? total.toLocaleString() : '-'}</TableCell>
                               ))}
                               <TableCell className="text-right font-mono sticky right-0 bg-muted/95 backdrop-blur-sm z-10 px-2">{fixedItemsData.grandTotal > 0 ? fixedItemsData.grandTotal.toLocaleString() : '-'}</TableCell>
                           </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
