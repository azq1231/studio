'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/firebase';
import { useToast } from "@/hooks/use-toast"
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import { format, getYear, getMonth, parse } from 'date-fns';
import type { User } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { getCreditDisplayDate } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Download, AlertCircle, Trash2, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, Combine, Search, ChevronsLeft, ChevronsRight, ArrowRight, CreditCard, Landmark, Banknote, Calendar, Tag, MoreHorizontal, Wrench, Check } from 'lucide-react';
import { AppSettings } from './settings-manager';
import { CashTransactionForm } from './cash-transaction-form';
import type { CombinedData } from '@/types/index';
import { Badge } from '@/components/ui/badge';
import { MaintenanceSyncDialog } from './maintenance-sync-dialog';
import { ResultsSummaryTab } from './results-summary-tab';


const EditableCell = ({ value, onUpdate, disabled }: { value: string; onUpdate: (value: string) => void; disabled?: boolean; }) => {
    const [currentValue, setCurrentValue] = useState(value);
    useEffect(() => { setCurrentValue(value); }, [value]);
    const handleBlur = () => { if (currentValue !== value) onUpdate(currentValue); };
    return <Input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onBlur={handleBlur} disabled={disabled} className="h-8" />;
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; }) => {
    const [jumpToPage, setJumpToPage] = useState(String(currentPage));
    useEffect(() => { setJumpToPage(String(currentPage)); }, [currentPage]);
    if (totalPages <= 1) return null;
    const handleJump = () => {
        let page = parseInt(jumpToPage, 10);
        if (isNaN(page) || page < 1) page = 1;
        else if (page > totalPages) page = totalPages;
        onPageChange(page);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleJump(); };
    return (
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="hidden md:flex"><ChevronsLeft className="h-4 w-4" />第一頁</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>上一頁</Button>
            <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">第</span>
                <Input type="number" value={jumpToPage} onChange={(e) => setJumpToPage(e.target.value)} onKeyDown={handleKeyDown} className="h-9 w-16 text-center" min="1" max={totalPages} />
                <Button variant="outline" size="sm" onClick={handleJump} className="sm:hidden"><ArrowRight className="h-4 w-4" /></Button>
                <span className="text-sm text-muted-foreground">/ {totalPages} 頁</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>下一頁</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="hidden md:flex">最後一頁<ChevronsRight className="h-4 w-4" /></Button>
        </div>
    );
};

const TransactionCard = ({
    id, date, description, amount, category, type, extra, onUpdate, onDelete, categories, disabled,
    isSynced, onSync, showSync
}: {
    id: string; date: string; description: string; amount: number; category: string;
    type: 'credit' | 'deposit' | 'cash'; extra?: string;
    onUpdate: (id: string, field: any, value: string | number, type: 'credit' | 'deposit' | 'cash') => void;
    onDelete: (id: string, type: 'credit' | 'deposit' | 'cash') => void;
    categories: string[]; disabled?: boolean;
    isSynced?: boolean;
    onSync?: () => void;
    showSync?: boolean;
}) => {
    const iconMap = {
        credit: <CreditCard className="h-4 w-4 text-blue-500" />,
        deposit: <Landmark className="h-4 w-4 text-green-500" />,
        cash: <Banknote className="h-4 w-4 text-orange-500" />
    };

    return (
        <div className="p-4 border rounded-lg bg-card shadow-sm mb-3">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    {iconMap[type]}
                    <span className="text-xs font-mono text-muted-foreground">{date}</span>
                </div>
                <div className={cn("font-bold font-mono text-sm pr-1", amount < 0 ? "text-green-600" : "text-foreground")}>
                    {amount.toLocaleString()}
                </div>
            </div>

            <div className="mb-3">
                <EditableCell
                    value={description}
                    onUpdate={v => onUpdate(id, 'description', v, type)}
                    disabled={disabled}
                />
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2 flex-grow min-w-[120px]">
                    <Select
                        value={category}
                        onValueChange={(v) => onUpdate(id, 'category', v, type)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="h-8 py-0 px-2 text-xs w-auto min-w-[80px]">
                            <SelectValue placeholder="類型" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {extra && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={extra}>
                            {extra}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    {showSync && onSync && (
                        isSynced ? (
                            <div className="h-8 w-8 flex items-center justify-center text-green-600" title="已同步">
                                <Check className="h-4 w-4" />
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onSync}
                                disabled={disabled}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                title="同步至房屋維修紀錄"
                            >
                                <Wrench className="h-4 w-4" />
                            </Button>
                        )
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(id, type)}
                        disabled={disabled}
                        className="h-8 w-8 text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

const SortableHeader = <T extends string>({ sortKey, currentSortKey, sortDirection, onSort, children, style }: {
    sortKey: T; currentSortKey: T | null; sortDirection: 'asc' | 'desc'; onSort: (key: T) => void; children: React.ReactNode; style?: React.CSSProperties;
}) => {
    const isSorted = currentSortKey === sortKey;
    return (
        <TableHead style={style}>
            <Button variant="ghost" onClick={() => onSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
                {children}
                {isSorted ? (sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : (<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />)}
            </Button>
        </TableHead>
    );
};


export function ResultsDisplay({
    creditData, depositData, cashData, settings, onAddCashTransaction, onUpdateTransaction, onDeleteTransaction, hasProcessed, user,
    maintenanceRecords, onAddMaintenanceRecord
}: {
    creditData: CreditData[]; depositData: DepositData[]; cashData: CashData[]; settings: AppSettings;
    onAddCashTransaction: (data: Omit<CashData, 'id'>) => void;
    onUpdateTransaction: (id: string, field: keyof any, value: string | number, type: 'credit' | 'deposit' | 'cash') => void;
    onDeleteTransaction: (id: string, type: 'credit' | 'deposit' | 'cash') => void;
    hasProcessed: boolean; user: User | null;
    maintenanceRecords?: any[];
    onAddMaintenanceRecord?: (record: any) => Promise<void>;
}) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [listCategoryFilter, setListCategoryFilter] = useState('ALL');
    const [creditPage, setCreditPage] = useState(1);
    const [depositPage, setDepositPage] = useState(1);
    const [cashPage, setCashPage] = useState(1);
    const [combinedPage, setCombinedPage] = useState(1);

    useEffect(() => {
        setCombinedPage(1);
    }, [searchQuery, listCategoryFilter]);
    const [creditSortKey, setCreditSortKey] = useState<keyof CreditData | null>('transactionDate');
    const [creditSortDirection, setCreditSortDirection] = useState<'asc' | 'desc'>('desc');
    const [depositSortKey, setDepositSortKey] = useState<keyof DepositData | null>('date');
    const [depositSortDirection, setDepositSortDirection] = useState<'asc' | 'desc'>('desc');
    const [cashSortKey, setCashSortKey] = useState<keyof CashData | null>('date');
    const [cashSortDirection, setCashSortDirection] = useState<'asc' | 'desc'>('desc');
    const [detailViewData, setDetailViewData] = useState<(CreditData | DepositData | CashData)[]>([]);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
    const [detailViewTitle, setDetailViewTitle] = useState('');
    const [summarySelectedCategories, setSummarySelectedCategories] = useState<string[]>([]);
    const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);

    // Sync state
    const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
    const [syncForm, setSyncForm] = useState<{
        txId: string;
        date: string;
        description: string;
        amount: number;
        location: string;
        notes: string;
        source: string;
        vendor?: string;
    } | null>(null);


    const locationSuggestions = useMemo(() => {
        if (!maintenanceRecords) return [];
        const locations = maintenanceRecords.map(r => r.location).filter(Boolean);
        return Array.from(new Set(locations)) as string[];
    }, [maintenanceRecords]);

    const vendorSuggestions = useMemo(() => {
        if (!maintenanceRecords) return [];
        const vends = maintenanceRecords.map(r => r.vendor).filter(Boolean);
        return Array.from(new Set(vends)) as string[];
    }, [maintenanceRecords]);

    const syncedTxIds = useMemo(() => {
        const ids = new Set<string>();
        if (maintenanceRecords) {
            maintenanceRecords.forEach(r => {
                if (r.txId) ids.add(r.txId);
            });
        }
        return ids;
    }, [maintenanceRecords]);

    const checkIsSynced = React.useCallback((row: any) => {
        if (!maintenanceRecords || maintenanceRecords.length === 0) return false;
        
        // 1. 精確 ID 比對
        if (maintenanceRecords.some(r => r.txId === row.id)) return true;
        
        // 2. 彈性雙軌模糊比對
        const rowAmount = Math.abs(row.amount);
        
        // 取得 row 的標準化 MM/DD 日期
        const rowDateStr = row.date || (row.transactionDate ? getCreditDisplayDate(row.transactionDate) : '');
        const normalizeDate = (dStr: string) => {
            if (!dStr) return '';
            let s = dStr.replace(/[-.\s]/g, '/');
            const parts = s.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const mm = parts[parts.length - 2].padStart(2, '0');
                const dd = parts[parts.length - 1].padStart(2, '0');
                return `${mm}/${dd}`;
            }
            return s;
        };
        const normRowDate = normalizeDate(rowDateStr);
        const rowDesc = (row.description || '').trim().toLowerCase();
        
        return maintenanceRecords.some(r => {
            const rAmount = Math.abs(r.amount);
            const normRDate = normalizeDate(r.date || '');
            const rItem = (r.item || '').trim().toLowerCase();
            
            if (rAmount === rowAmount && normRDate === normRowDate) {
                if (rItem && rowDesc && (rItem.includes(rowDesc) || rowDesc.includes(rItem))) {
                    return true;
                }
            }
            return false;
        });
    }, [maintenanceRecords]);


    const handleSyncClick = (row: any, source: string) => {
        const amount = Math.abs(row.amount);
        const notesVal = row.bankCode || row.notes || '';
        const displayDate = source === '信用卡' ? getCreditDisplayDate(row.transactionDate) : row.date;
        setSyncForm({
            txId: row.id,
            date: displayDate || '',
            description: row.description || '',
            amount,
            location: '',
            notes: notesVal,
            source,
            vendor: ''
        });
        setIsSyncDialogOpen(true);
    };


    useEffect(() => {
        if (hasProcessed || creditData.length > 0 || depositData.length > 0 || cashData.length > 0) {
            setSummarySelectedCategories(settings.availableCategories);
        }
    }, [hasProcessed, settings.availableCategories, creditData, depositData, cashData]);

    const handleCreditSort = (key: keyof CreditData) => { setCreditPage(1); if (creditSortKey === key) setCreditSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCreditSortKey(key); setCreditSortDirection('desc'); } };
    const handleDepositSort = (key: keyof DepositData) => { setDepositPage(1); if (depositSortKey === key) setDepositSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setDepositSortKey(key); setDepositSortDirection('desc'); } };
    const handleCashSort = (key: keyof CashData) => { setCashPage(1); if (cashSortKey === key) setCashSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCashSortKey(key); setCashSortDirection('desc'); } };

    const sortAndPaginate = <T, K extends keyof T>(
        data: T[],
        sortKey: K | null,
        sortDirection: 'asc' | 'desc',
        page: number,
        searchFn: (item: T, query: string) => boolean,
        dateKey?: keyof T,
        dateParser?: (dateStr: string) => string,
        categoryKey?: keyof T
    ): { data: T[], totalPages: number } => {
        let filteredData = searchQuery ? data.filter(item => searchFn(item, searchQuery.toLowerCase())) : data;
        if (categoryKey && listCategoryFilter !== 'ALL') {
            filteredData = filteredData.filter(item => (item[categoryKey] as any) === listCategoryFilter);
        }
        if (sortKey) {
            filteredData.sort((a, b) => {
                let comparison = 0;
                if (sortKey === dateKey && dateParser) {
                    try {
                        const dateA = new Date(dateParser(a[sortKey] as any as string)).getTime();
                        const dateB = new Date(dateParser(b[sortKey] as any as string)).getTime();
                        comparison = dateA - dateB;
                    } catch { comparison = 0; }
                } else {
                    const aValue = a[sortKey], bValue = b[sortKey];
                    if (typeof aValue === 'string' && typeof bValue === 'string') comparison = aValue.localeCompare(bValue, 'zh-Hant');
                    else if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
                    else comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        const totalPages = Math.ceil(filteredData.length / 50);
        const paginatedData = filteredData.slice((page - 1) * 50, page * 50);
        return { data: paginatedData, totalPages };
    };

    const sortedCreditData = useMemo(() => sortAndPaginate(creditData, creditSortKey, creditSortDirection, creditPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'transactionDate', getCreditDisplayDate, 'category'), [creditData, creditSortKey, creditSortDirection, creditPage, searchQuery, listCategoryFilter]);
    const sortedDepositData = useMemo(() => sortAndPaginate(depositData, depositSortKey, depositSortDirection, depositPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'date', d => d, 'category'), [depositData, depositSortKey, depositSortDirection, depositPage, searchQuery, listCategoryFilter]);
    const sortedCashData = useMemo(() => sortAndPaginate(cashData, cashSortKey, cashSortDirection, cashPage, (item, q) => item.description.toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q), 'date', d => d, 'category'), [cashData, cashSortKey, cashSortDirection, cashPage, searchQuery, listCategoryFilter]);


    const combinedData = useMemo<CombinedData[]>(() => {
        const parseDateSafe = (dateString: string): Date => {
            const now = new Date();
            if (!dateString) return now;

            // Try yyyy/MM/dd first
            try {
                const d = parse(dateString, 'yyyy/MM/dd', now);
                if (!isNaN(d.getTime()) && d.getFullYear() > 1970) return d;
            } catch (e) { }

            // Try MM/dd
            try {
                const d = parse(dateString, 'MM/dd', now);
                if (!isNaN(d.getTime())) return d;
            } catch (e) { }

            return now;
        };

        const combined: CombinedData[] = [];

        const filterAndMap = (data: any[], source: CombinedData['source'], dateKey: string) => {
            let dbData = data;
            if (listCategoryFilter !== 'ALL') {
                dbData = dbData.filter(d => d.category === listCategoryFilter);
            }
            const q = searchQuery.toLowerCase();
            (searchQuery ? dbData.filter(d => (d.description && d.description.toLowerCase().includes(q)) || (d.bankCode && d.bankCode.toLowerCase().includes(q)) || (d.notes && d.notes.toLowerCase().includes(q))) : dbData).forEach(d => {
                const displayDate = dateKey === 'transactionDate' ? getCreditDisplayDate(d[dateKey]) : d[dateKey];
                const dateObj = parseDateSafe(displayDate);
                combined.push({ ...d, date: displayDate, dateObj, source });
            });
        };

        filterAndMap(creditData, '信用卡', 'transactionDate');
        filterAndMap(depositData, '活存帳戶', 'date');
        filterAndMap(cashData, '現金', 'date');

        return combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [creditData, depositData, cashData, searchQuery, listCategoryFilter]);

    const totalCombinedPages = Math.ceil(combinedData.length / 50);
    const paginatedCombinedData = useMemo(() => {
        return combinedData.slice((combinedPage - 1) * 50, combinedPage * 50);
    }, [combinedData, combinedPage]);

    const summaryReportData = useMemo(() => {
        const monthlyData: Record<string, Record<string, number>> = {};

        combinedData.forEach(transaction => {
            if (!summarySelectedCategories.includes(transaction.category)) {
                return;
            }
            try {
                const monthKey = format(transaction.dateObj, 'yyyy年M月');
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {};
                }
                monthlyData[monthKey][transaction.category] = (monthlyData[monthKey][transaction.category] || 0) + transaction.amount;

            } catch (e) { /* Ignore date parsing errors */ }
        });

        const categoriesToDisplay = [...summarySelectedCategories].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        const headers = ['日期（年月）', ...categoriesToDisplay, '總計'];

        const rows = Object.entries(monthlyData).map(([month, categoryData]) => {
            let total = 0;
            const row: Record<string, string | number> = { '日期（年月）': month };

            categoriesToDisplay.forEach(cat => {
                const value = categoryData[cat] || 0;
                row[cat] = value;
                total += value;
            });
            row['總計'] = total;

            return row;
        })
            .sort((a, b) => {
                try {
                    return parse(b['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime() - parse(a['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime();
                } catch {
                    return (b['日期（年月）'] as string).localeCompare(a['日期（年月）'] as string);
                }
            });

        const fixedItemsData = combinedData.filter(t => t.category === '固定');
        const fixedItemsByYear: Record<string, number> = {};
        const fixedMonths = new Set<string>();
        fixedItemsData.forEach(item => {
            try {
                const year = getYear(item.dateObj);
                const monthKey = format(item.dateObj, 'yyyy-MM');
                fixedItemsByYear[year] = (fixedItemsByYear[year] || 0) + item.amount;
                fixedMonths.add(monthKey);
            } catch (e) { }
        });
        const fixedItemsYearly = Object.entries(fixedItemsByYear).sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
        const fixedAverageMonthly = fixedMonths.size > 0 ? Object.values(fixedItemsByYear).reduce((a, b) => a + b, 0) / fixedMonths.size : 0;

        return { headers, rows, fixedItemsYearly, fixedAverageMonthly };
    }, [combinedData, summarySelectedCategories]);

    const handleSummaryCellClick = (monthKey: string, category: string) => {
        const [year, month] = monthKey.replace('年', '-').replace('月', '').split('-').map(Number);
        const filtered = combinedData.filter(t => t.category === category && getYear(t.dateObj) === year && getMonth(t.dateObj) + 1 === month).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        setDetailViewData(filtered); setDetailViewTitle(`${monthKey} - ${category}`); setIsDetailViewOpen(true);
    };

    const handleDownload = () => {
        try {
            const wb = XLSX.utils.book_new();
            if (combinedData.length > 0) {
                const sheetData = combinedData.map(d => ({ '日期': d.date, '類型': d.category, '交易項目': d.description, '金額': d.amount, '備註': d.bankCode || d.notes || '', '來源': d.source }));
                const ws = XLSX.utils.json_to_sheet(sheetData);
                XLSX.utils.book_append_sheet(wb, ws, '合併報表');
            }
            XLSX.writeFile(wb, `bank_data_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) { toast({ variant: "destructive", title: "下載失败", description: "產生 Excel 檔案時發生錯誤。" }); }
    };

    const noDataFound = hasProcessed && creditData.length === 0 && depositData.length === 0 && cashData.length === 0;
    const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
    const defaultTab = hasData ? (creditData.length > 0 ? "credit" : (depositData.length > 0 ? "deposit" : "cash")) : "statement";

    return (
        <Card className="border-b-0 md:border-b">
            <CardHeader><h3 className="text-xl font-semibold font-headline">處理結果</h3></CardHeader>
            <CardContent className="pb-24 md:pb-6">
                {hasData ? (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-xl">
                                <div className="relative w-full sm:max-w-sm flex-grow">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="尋找交易項目或備註..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                                </div>
                                <Select 
                                    value={listCategoryFilter} 
                                    onValueChange={(val) => {
                                        console.log("Select category filter changed to:", val);
                                        setListCategoryFilter(val);
                                    }}
                                    onOpenChange={(open) => {
                                        console.log("Select open state changed to:", open);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px] shrink-0">
                                        <SelectValue placeholder="所有交易類型" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[100] max-h-[300px] overflow-y-auto" position="popper" sideOffset={4}>
                                        <SelectItem value="ALL">所有交易類型</SelectItem>
                                        {Array.from(new Set(settings.availableCategories.filter(Boolean))).map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleDownload} className="shrink-0"><Download className="mr-2 h-4 w-4" />下載 Excel</Button>
                        </div>
                        <Tabs defaultValue={defaultTab} className="w-full">
                            {/* Desktop TabsList */}
                            <TabsList className="hidden md:flex flex-wrap h-auto bg-muted p-1">
                                {combinedData.length > 0 && (
                                    <TabsTrigger value="combined" className="px-3 py-1.5 text-xs sm:text-sm">
                                        <Combine className="w-4 h-4 mr-1 sm:mr-2" />
                                        <span>合併報表</span>
                                    </TabsTrigger>
                                )}
                                {creditData.length > 0 && (
                                    <TabsTrigger value="credit" className="px-3 py-1.5 text-xs sm:text-sm">
                                        信用卡 ({creditData.length})
                                    </TabsTrigger>
                                )}
                                {depositData.length > 0 && (
                                    <TabsTrigger value="deposit" className="px-3 py-1.5 text-xs sm:text-sm">
                                        活存 ({depositData.length})
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="cash" className="px-3 py-1.5 text-xs sm:text-sm">
                                    現金 ({cashData.length})
                                </TabsTrigger>
                                {hasData && (
                                    <TabsTrigger value="summary" className="px-3 py-1.5 text-xs sm:text-sm">
                                        <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                                        <span>彙總</span>
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            {/* Mobile Bottom Navigation Bar */}
                            <TabsList className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/60 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex justify-around items-center h-16 p-0 rounded-none pb-safe">
                                {combinedData.length > 0 && (
                                    <TabsTrigger value="combined" className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[10px] sm:text-xs gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                                        <Combine className="w-5 h-5" />
                                        <span>合併</span>
                                    </TabsTrigger>
                                )}
                                {creditData.length > 0 && (
                                    <TabsTrigger value="credit" className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[10px] sm:text-xs gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                                        <CreditCard className="w-5 h-5" />
                                        <span>信用卡</span>
                                    </TabsTrigger>
                                )}
                                {depositData.length > 0 && (
                                    <TabsTrigger value="deposit" className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[10px] sm:text-xs gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                                        <Landmark className="w-5 h-5" />
                                        <span>活存</span>
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="cash" className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[10px] sm:text-xs gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                                    <Banknote className="w-5 h-5" />
                                    <span>現金</span>
                                </TabsTrigger>
                                {hasData && (
                                    <TabsTrigger value="summary" className="flex-1 flex flex-col items-center justify-center h-full py-1 text-[10px] sm:text-xs gap-1 data-[state=active]:bg-transparent data-[state=active]:text-primary rounded-none">
                                        <FileText className="w-5 h-5" />
                                        <span>彙總</span>
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="combined">
                                {/* Desktop View */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">日期</TableHead>
                                                <TableHead className="w-[100px]">類型</TableHead>
                                                <TableHead className="min-w-[150px]">交易項目</TableHead>
                                                <TableHead className="min-w-[120px]">備註</TableHead>
                                                <TableHead className="w-[80px]">來源</TableHead>
                                                <TableHead className="text-right w-[125px] min-w-[125px]">金額</TableHead>
                                                {onAddMaintenanceRecord && <TableHead className="w-[80px] text-center">操作</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedCombinedData.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-mono whitespace-nowrap">{row.date}</TableCell>
                                                    <TableCell>{row.category}</TableCell>
                                                    <TableCell>{row.description}</TableCell>
                                                    <TableCell>{row.bankCode || row.notes || ''}</TableCell>
                                                    <TableCell>{row.source}</TableCell>
                                                    <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>
                                                    {onAddMaintenanceRecord && (
                                                        <TableCell className="text-center">
                                                            {checkIsSynced(row) ? (
                                                                <div className="h-8 w-8 mx-auto flex items-center justify-center text-green-600" title="已同步">
                                                                    <Check className="h-4 w-4" />
                                                                </div>
                                                            ) : (
                                                                <Button variant="ghost" size="icon" onClick={() => handleSyncClick(row, row.source)} disabled={!user} className="h-8 w-8 text-muted-foreground hover:text-primary mx-auto" title="同步至房屋維修紀錄">
                                                                    <Wrench className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden space-y-1">
                                    {paginatedCombinedData.length > 0 ? (
                                        paginatedCombinedData.map((row) => (
                                            <div key={row.id} className="p-3 border-b last:border-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-mono text-muted-foreground">{row.date} • {row.source}</span>
                                                    <span className={cn("font-bold text-sm font-mono", row.amount < 0 ? "text-green-600" : "")}>
                                                        {row.amount.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium mb-1">{row.description}</div>
                                                {(row.bankCode || row.notes) && (
                                                    <div className="text-xs text-muted-foreground mb-1">{row.bankCode || row.notes}</div>
                                                )}
                                                <div className="flex justify-between items-center mt-2">
                                                    <div className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                                                        {row.category}
                                                    </div>
                                                    {onAddMaintenanceRecord && (
                                                        checkIsSynced(row) ? (
                                                            <div className="h-6 w-6 flex items-center justify-center text-green-600" title="已同步">
                                                                <Check className="h-4 w-4" />
                                                            </div>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" onClick={() => handleSyncClick(row, row.source)} disabled={!user} className="h-8 w-8 text-muted-foreground hover:text-primary" title="同步至房屋維修紀錄">
                                                                <Wrench className="h-4 w-4" />
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">沒有資料</div>
                                    )}
                                </div>
                                <PaginationControls currentPage={combinedPage} totalPages={totalCombinedPages} onPageChange={setCombinedPage} />
                            </TabsContent>
                            <TabsContent value="credit">
                                {/* Desktop View */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <SortableHeader sortKey="transactionDate" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '100px' }}>日期</SortableHeader>
                                                <TableHead style={{ width: '100px' }}>類型</TableHead>
                                                <TableHead className="min-w-[150px]">交易項目</TableHead>
                                                <SortableHeader sortKey="amount" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '125px', minWidth: '125px' }}>金額</SortableHeader>
                                                <TableHead className="min-w-[120px]">銀行代碼/備註</TableHead>
                                                <TableHead className="w-[80px] text-center">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedCreditData.data.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <div className="font-mono whitespace-nowrap">{getCreditDisplayDate(row.transactionDate)}</div>
                                                    </TableCell>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'credit')} disabled={!user}>
                                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="類型" /></SelectTrigger>
                                                            <SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'credit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ width: '125px', minWidth: '125px' }}>
                                                        <EditableCell value={row.amount.toString()} onUpdate={v => onUpdateTransaction(row.id, 'amount', parseFloat(v) || 0, 'credit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ minWidth: '120px' }}>
                                                        <EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'credit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {onAddMaintenanceRecord && (
                                                                checkIsSynced(row) ? (
                                                                    <div className="h-8 w-8 flex items-center justify-center text-green-600" title="已同步">
                                                                        <Check className="h-4 w-4" />
                                                                    </div>
                                                                ) : (
                                                                    <Button variant="ghost" size="icon" onClick={() => handleSyncClick(row, '信用卡')} disabled={!user} className="h-8 w-8 text-muted-foreground hover:text-primary" title="同步至房屋維修紀錄">
                                                                        <Wrench className="h-4 w-4" />
                                                                    </Button>
                                                                )
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'credit')} disabled={!user} className="h-8 w-8 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden pt-2">
                                    {sortedCreditData.data.map((row) => (
                                        <TransactionCard
                                            key={row.id}
                                            id={row.id}
                                            date={getCreditDisplayDate(row.transactionDate)}
                                            description={row.description}
                                            amount={row.amount}
                                            category={row.category}
                                            type="credit"
                                            extra={row.bankCode}
                                            onUpdate={onUpdateTransaction}
                                            onDelete={onDeleteTransaction}
                                            categories={settings.availableCategories}
                                            disabled={!user}
                                            isSynced={syncedTxIds.has(row.id)}
                                            onSync={() => handleSyncClick(row, '信用卡')}
                                            showSync={!!onAddMaintenanceRecord}
                                        />
                                    ))}
                                </div>
                                <PaginationControls currentPage={creditPage} totalPages={sortedCreditData.totalPages} onPageChange={setCreditPage} />
                            </TabsContent>
                            <TabsContent value="deposit">
                                {/* Desktop View */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableCaption className="hidden md:table-caption">金額：支出為正，存入為負</TableCaption>
                                        <TableHeader>
                                            <TableRow>
                                                <SortableHeader sortKey="date" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '100px' }}>日期</SortableHeader>
                                                <SortableHeader sortKey="category" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '100px' }}>類型</SortableHeader>
                                                <SortableHeader sortKey="description" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort}>交易項目</SortableHeader>
                                                <SortableHeader sortKey="amount" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '125px', minWidth: '125px' }}>金額</SortableHeader>
                                                <TableHead className="min-w-[120px]">銀行代碼/備註</TableHead>
                                                <TableHead className="w-[80px] text-center">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedDepositData.data.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <div className="font-mono whitespace-nowrap">{row.date}</div>
                                                    </TableCell>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'deposit')} disabled={!user}>
                                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="類型" /></SelectTrigger>
                                                            <SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'deposit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ width: '125px', minWidth: '125px' }}>
                                                        <EditableCell value={row.amount.toString()} onUpdate={v => onUpdateTransaction(row.id, 'amount', parseFloat(v) || 0, 'deposit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ minWidth: '120px' }}>
                                                        <EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'deposit')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {onAddMaintenanceRecord && (
                                                                syncedTxIds.has(row.id) ? (
                                                                    <div className="h-8 w-8 flex items-center justify-center text-green-600" title="已同步">
                                                                        <Check className="h-4 w-4" />
                                                                    </div>
                                                                ) : (
                                                                    <Button variant="ghost" size="icon" onClick={() => handleSyncClick(row, '活存帳戶')} disabled={!user} className="h-8 w-8 text-muted-foreground hover:text-primary" title="同步至房屋維修紀錄">
                                                                        <Wrench className="h-4 w-4" />
                                                                    </Button>
                                                                )
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'deposit')} disabled={!user} className="h-8 w-8 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden pt-2">
                                    <div className="text-[10px] text-muted-foreground mb-4 px-1">金額：支出為正，存入為負</div>
                                    {sortedDepositData.data.map((row) => (
                                        <TransactionCard
                                            key={row.id}
                                            id={row.id}
                                            date={row.date}
                                            description={row.description}
                                            amount={row.amount}
                                            category={row.category}
                                            type="deposit"
                                            extra={row.bankCode}
                                            onUpdate={onUpdateTransaction}
                                            onDelete={onDeleteTransaction}
                                            categories={settings.availableCategories}
                                            disabled={!user}
                                            isSynced={syncedTxIds.has(row.id)}
                                            onSync={() => handleSyncClick(row, '活存帳戶')}
                                            showSync={!!onAddMaintenanceRecord}
                                        />
                                    ))}
                                </div>
                                <PaginationControls currentPage={depositPage} totalPages={sortedDepositData.totalPages} onPageChange={setDepositPage} />
                            </TabsContent>
                            <TabsContent value="cash">
                                <Accordion type="single" collapsible defaultValue="add-cash" className="w-full mb-4">
                                    <AccordionItem value="add-cash">
                                        <AccordionTrigger>新增現金交易</AccordionTrigger>
                                        <AccordionContent>
                                            <CashTransactionForm settings={settings} onSubmit={onAddCashTransaction} user={user} />
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                {/* Desktop View */}
                                <div className="hidden md:block">
                                    <Table>
                                        <TableCaption className="hidden md:table-caption">金額：支出為正，存入為負</TableCaption>
                                        <TableHeader>
                                            <TableRow>
                                                <SortableHeader sortKey="date" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '100px' }}>日期</SortableHeader>
                                                <TableHead style={{ width: '100px' }}>類型</TableHead>
                                                <TableHead className="min-w-[150px]">交易項目</TableHead>
                                                <SortableHeader sortKey="amount" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '125px', minWidth: '125px' }}>金額</SortableHeader>
                                                <TableHead className="min-w-[120px]">備註</TableHead>
                                                <TableHead className="w-[80px] text-center">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedCashData.data.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <div className="font-mono whitespace-nowrap">{row.date}</div>
                                                    </TableCell>
                                                    <TableCell style={{ width: '100px' }}>
                                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'cash')} disabled={!user}>
                                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="類型" /></SelectTrigger>
                                                            <SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'cash')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ width: '125px', minWidth: '125px' }}>
                                                        <EditableCell value={row.amount.toString()} onUpdate={v => onUpdateTransaction(row.id, 'amount', parseFloat(v) || 0, 'cash')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell style={{ minWidth: '120px' }}>
                                                        <EditableCell value={row.notes || ''} onUpdate={v => onUpdateTransaction(row.id, 'notes', v, 'cash')} disabled={!user} />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {onAddMaintenanceRecord && (
                                                                syncedTxIds.has(row.id) ? (
                                                                    <div className="h-8 w-8 flex items-center justify-center text-green-600" title="已同步">
                                                                        <Check className="h-4 w-4" />
                                                                    </div>
                                                                ) : (
                                                                    <Button variant="ghost" size="icon" onClick={() => handleSyncClick(row, '現金')} disabled={!user} className="h-8 w-8 text-muted-foreground hover:text-primary" title="同步至房屋維修紀錄">
                                                                        <Wrench className="h-4 w-4" />
                                                                    </Button>
                                                                )
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'cash')} disabled={!user} className="h-8 w-8 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden pt-2">
                                    <div className="text-[10px] text-muted-foreground mb-4 px-1">金額：支出為正，存入為負</div>
                                    {sortedCashData.data.map((row) => (
                                        <TransactionCard
                                            key={row.id}
                                            id={row.id}
                                            date={row.date}
                                            description={row.description}
                                            amount={row.amount}
                                            category={row.category}
                                            type="cash"
                                            extra={row.notes}
                                            onUpdate={onUpdateTransaction}
                                            onDelete={onDeleteTransaction}
                                            categories={settings.availableCategories}
                                            disabled={!user}
                                            isSynced={syncedTxIds.has(row.id)}
                                            onSync={() => handleSyncClick(row, '現金')}
                                            showSync={!!onAddMaintenanceRecord}
                                        />
                                    ))}
                                </div>
                                <PaginationControls currentPage={cashPage} totalPages={sortedCashData.totalPages} onPageChange={setCashPage} />
                            </TabsContent>
                            <TabsContent value="summary">
                                <ResultsSummaryTab
                                    settings={settings}
                                    summarySelectedCategories={summarySelectedCategories}
                                    setSummarySelectedCategories={setSummarySelectedCategories}
                                    summaryReportData={summaryReportData}
                                    combinedData={combinedData}
                                    onCellClick={handleSummaryCellClick}
                                />
                            </TabsContent>
                        </Tabs>
                    </>
                ) : (noDataFound && (
                    <div className="text-center py-10"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">沒有找到資料</h3><p className="mt-2 text-sm text-muted-foreground">我們無法從您提供的內容中解析出任何報表資料。<br />請確認格式是否正確，或嘗試貼上其他內容。</p></div>
                ))}
                
                {onAddMaintenanceRecord && (
                    <MaintenanceSyncDialog
                        open={isSyncDialogOpen}
                        onOpenChange={setIsSyncDialogOpen}
                        syncForm={syncForm}
                        setSyncForm={setSyncForm}
                        locationSuggestions={locationSuggestions}
                        vendorSuggestions={vendorSuggestions}
                        onAddMaintenanceRecord={onAddMaintenanceRecord}
                    />
                )}

                <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                    <DialogContent className="max-w-4xl h-4/5 flex flex-col">
                        <DialogHeader>
                            <DialogTitle>{detailViewTitle}</DialogTitle>
                            <DialogDescription className="sr-only">
                                顯示 {detailViewTitle} 的詳細交易清單表格
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-grow overflow-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[110px] whitespace-nowrap">日期</TableHead>
                                        <TableHead className="w-[80px] whitespace-nowrap">類型</TableHead>
                                        <TableHead className="min-w-[260px]">交易項目</TableHead>
                                        <TableHead className="min-w-[240px]">備註</TableHead>
                                        <TableHead className="w-[90px] whitespace-nowrap">來源</TableHead>
                                        <TableHead className="w-[110px] whitespace-nowrap text-right">金額</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detailViewData.length > 0 ? (
                                        detailViewData.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="whitespace-nowrap">{(item as any).date || getCreditDisplayDate((item as any).transactionDate)}</TableCell>
                                                <TableCell className="whitespace-nowrap">{item.category}</TableCell>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell>{(item as any).bankCode || (item as any).notes || ''}</TableCell>
                                                <TableCell className="whitespace-nowrap">{(item as any).source === '活存帳戶' ? '活存' : ((item as any).source || '信用卡')}</TableCell>
                                                <TableCell className={`whitespace-nowrap text-right ${item.amount < 0 ? 'text-green-600' : ''}`}>
                                                    {item.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center">
                                                沒有找到相關交易紀錄。
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
