'use client';

import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { getCreditDisplayDate } from '@/lib/parser';
import type { CombinedData } from '@/types/index';

interface ResultsSummaryTabProps {
    settings: {
        availableCategories: string[];
        quickFilters: Array<{ name: string; categories: string[] }>;
    };
    summarySelectedCategories: string[];
    setSummarySelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
    summaryReportData: {
        headers: string[];
        rows: Array<Record<string, string | number>>;
    };
    combinedData: CombinedData[];
    onCellClick: (monthKey: string, category: string) => void;
}

export function ResultsSummaryTab({
    settings,
    summarySelectedCategories,
    setSummarySelectedCategories,
    summaryReportData,
    combinedData,
    onCellClick,
}: ResultsSummaryTabProps) {
    const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
    const [detailViewTitle, setDetailViewTitle] = useState('');
    const [detailViewData, setDetailViewData] = useState<CombinedData[]>([]);

    const handleSummaryCellClick = (monthKey: string, category: string) => {
        onCellClick(monthKey, category);
    };

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 my-4">
                <Popover open={isSummaryFilterOpen} onOpenChange={setIsSummaryFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline">
                            篩選類型 ({summarySelectedCategories.length}/{settings.availableCategories.length})
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                        <div className="p-2 space-y-1">
                            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories(settings.availableCategories)}>全選</Button>
                            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories([])}>全部取消</Button>
                        </div>
                        <div className="border-t max-h-60 overflow-y-auto p-2">
                            {[...settings.availableCategories].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map(category => (
                                <div key={category} className="flex items-center space-x-2 p-1">
                                    <Checkbox
                                        id={`cat-${category}`}
                                        checked={summarySelectedCategories.includes(category)}
                                        onCheckedChange={(c) => c ? setSummarySelectedCategories([...summarySelectedCategories, category]) : setSummarySelectedCategories(summarySelectedCategories.filter(i => i !== category))}
                                    />
                                    <label htmlFor={`cat-${category}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{category}</label>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                {settings.quickFilters.map((filter, index) => (
                    <Button key={index} variant="outline" size="sm" onClick={() => setSummarySelectedCategories(filter.categories)}>
                        {filter.name}
                    </Button>
                ))}
                <p className="text-sm text-muted-foreground hidden md:block ml-auto">點擊表格中的數字可查看該月份的交易明細。</p>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block rounded-md border overflow-x-auto bg-card">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            {summaryReportData.headers.map(h => (
                                <TableHead
                                    key={h}
                                    className={`whitespace-nowrap px-4 py-3 ${h === '日期（年月）' ? 'w-24' : 'text-right min-w-[80px]'}`}
                                >
                                    {h}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summaryReportData.rows.map((row, i) => (
                            <TableRow key={i}>
                                {summaryReportData.headers.map(header => {
                                    const value = row[header];
                                    const isClickable = header !== '日期（年月）' && header !== '總計' && typeof value === 'number' && value !== 0;
                                    let textColor = '';
                                    if (typeof value === 'number') {
                                        if (value < 0) textColor = 'text-green-600';
                                    }
                                    return (
                                        <TableCell
                                            key={header}
                                            className={`font-mono whitespace-nowrap px-4 py-2 ${header !== '日期（年月）' ? 'text-right' : ''} ${textColor}`}
                                        >
                                            {isClickable ? (
                                                <button
                                                    onClick={() => handleSummaryCellClick(row['日期（年月）'] as string, header)}
                                                    className="hover:underline hover:text-blue-500"
                                                >
                                                    {value.toLocaleString()}
                                                </button>
                                            ) : (
                                                typeof value === 'number' ? value.toLocaleString() : value
                                            )}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View (Accordion List) */}
            <div className="md:hidden space-y-3 pt-2">
                {summaryReportData.rows.map((row, index) => {
                    const month = row['日期（年月）'] as string;
                    const total = row['總計'] as number;
                    return (
                        <Accordion key={index} type="single" collapsible className="w-full border rounded-xl bg-card shadow-sm px-4">
                            <AccordionItem value={`month-${index}`} className="border-b-0">
                                <AccordionTrigger className="hover:no-underline py-3">
                                    <div className="flex justify-between items-center w-full pr-4">
                                        <span className="font-bold text-sm sm:text-base">{month}</span>
                                        <span className={cn("font-bold font-mono text-sm sm:text-base", total < 0 ? "text-green-600" : "text-foreground")}>
                                            {total.toLocaleString()}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 border-t border-dashed space-y-2.5">
                                    {summaryReportData.headers.filter(h => h !== '日期（年月）' && h !== '總計').map(header => {
                                        const value = row[header] as number;
                                        if (value === 0) return null;
                                        return (
                                            <div key={header} className="flex justify-between items-center py-1.5 border-b border-muted/30 last:border-0">
                                                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{header}</span>
                                                <button
                                                    onClick={() => handleSummaryCellClick(month, header)}
                                                    className={cn("text-xs sm:text-sm font-bold font-mono hover:underline text-blue-500", value < 0 ? "text-green-600 hover:text-blue-500" : "")}
                                                >
                                                    {value.toLocaleString()}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    );
                })}
            </div>
        </div>
    );
}
