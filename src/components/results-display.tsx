
'use client';

import { useState, useMemo, useId, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { format, parse, getYear, getMonth } from 'date-fns';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, AlertCircle, Trash2, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, Combine, Search, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import type { User } from 'firebase/auth';

import { CashTransactionForm } from './cash-transaction-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const quickFilterSchema = z.object({
  name: z.string().min(1, "請輸入名稱"),
  categories: z.array(z.string()),
});
type QuickFilter = z.infer<typeof quickFilterSchema>;

type CreditSortKey = 'date' | 'category' | 'description' | 'amount' | 'bankCode';
type DepositSortKey = 'date' | 'category' | 'description' | 'amount' | 'bankCode';
type CashSortKey = 'date' | 'category' | 'description' | 'amount' | 'notes';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;


const getCreditDisplayDate = (dateString: string) => {
    try {
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) {
            return dateString;
        }
        if (!/^\d{1,2}\/\d{1,2}$/.test(dateString)) {
            return dateString;
        }
        const now = new Date();
        const currentYear = getYear(now);
        const currentMonth = getMonth(now);
        const parsedDate = parse(dateString, 'MM/dd', new Date());
        const transactionMonth = getMonth(parsedDate);
        
        let dateObj;
        if (transactionMonth > currentMonth) {
            dateObj = new Date(new Date(parsedDate).setFullYear(currentYear - 1));
        } else {
            dateObj = new Date(new Date(parsedDate).setFullYear(currentYear));
        }
        return format(dateObj, 'yyyy/MM/dd');
    } catch {
        return dateString;
    }
};

type PaginationControlsProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

const PaginationControls = ({ currentPage, totalPages, onPageChange }: PaginationControlsProps) => {
    const [jumpToPage, setJumpToPage] = useState(String(currentPage));

    useEffect(() => {
        setJumpToPage(String(currentPage));
    }, [currentPage]);
    
    if (totalPages <= 1) return null;

    const handleJump = () => {
        let page = parseInt(jumpToPage, 10);
        if (isNaN(page) || page < 1) page = 1;
        else if (page > totalPages) page = totalPages;
        onPageChange(page);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleJump();
    };

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


type SortableHeaderProps<T> = {
    sortKey: T;
    currentSortKey: T | null;
    sortDirection: SortDirection;
    onSort: (key: T) => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
};

const SortableHeader = <T extends string>({ sortKey, currentSortKey, sortDirection, onSort, children, style }: SortableHeaderProps<T>) => {
    const isSorted = currentSortKey === sortKey;
    return (
      <TableHead style={style}>
        <Button variant="ghost" onClick={() => onSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
          {children}
          {isSorted ? (
            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </TableHead>
    );
};

type EditableCellProps = {
    value: string;
    onUpdate: (value: string) => void;
    disabled?: boolean;
};

const EditableCell = ({ value, onUpdate, disabled }: EditableCellProps) => {
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    const handleBlur = () => {
        if (currentValue !== value) {
            onUpdate(currentValue);
        }
    };

    return (
        <Input
            type="text"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className="h-8"
        />
    );
};


type ResultsDisplayProps = {
    creditData: CreditData[];
    depositData: DepositData[];
    cashData: CashData[];
    availableCategories: string[];
    onAddCashTransaction: (data: Omit<CashData, 'id'| 'amount'> & {amount: number, type: 'expense' | 'income'}) => void;
    onUpdateTransaction: (id: string, field: keyof any, value: string | number, type: 'credit' | 'deposit' | 'cash') => void;
    onDeleteTransaction: (id: string, type: 'credit' | 'deposit' | 'cash') => void;
    hasProcessed: boolean;
    user: User | null;
}

export function ResultsDisplay({
    creditData,
    depositData,
    cashData,
    availableCategories,
    onAddCashTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
    hasProcessed,
    user,
}: ResultsDisplayProps) {

    const { toast } = useToast();
    const detailDialogId = useId();

    const [searchQuery, setSearchQuery] = useState('');
    const [creditPage, setCreditPage] = useState(1);
    const [depositPage, setDepositPage] = useState(1);
    const [cashPage, setCashPage] = useState(1);
    
    const [creditSortKey, setCreditSortKey] = useState<CreditSortKey | null>('date');
    const [creditSortDirection, setCreditSortDirection] = useState<SortDirection>('desc');
    const [depositSortKey, setDepositSortKey] = useState<DepositSortKey | null>('date');
    const [depositSortDirection, setDepositSortDirection] = useState<SortDirection>('desc');
    const [cashSortKey, setCashSortKey] = useState<CashSortKey | null>('date');
    const [cashSortDirection, setCashSortDirection] = useState<SortDirection>('desc');
    
    const [detailViewData, setDetailViewData] = useState<(CreditData | DepositData | CashData)[]>([]);
    const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
    const [detailViewTitle, setDetailViewTitle] = useState('');
    
    const [summarySelectedCategories, setSummarySelectedCategories] = useState<string[]>([]);
    const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
    const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);

    useEffect(() => {
        try {
            const savedQuickFilters = localStorage.getItem('quickFilters');
            if (savedQuickFilters) {
                setQuickFilters(JSON.parse(savedQuickFilters));
            }
        } catch(e) {
            console.error("Failed to load quick filters from localStorage", e);
        }
    }, []);

    useEffect(() => {
        // When processing is done, auto-select all categories for the summary report
        if (hasProcessed) {
          setSummarySelectedCategories(availableCategories);
        }
    }, [hasProcessed, availableCategories]);


    const handleCreditSort = (key: CreditSortKey) => {
        setCreditPage(1);
        if (creditSortKey === key) setCreditSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setCreditSortKey(key); setCreditSortDirection('desc'); }
    };
    const handleDepositSort = (key: DepositSortKey) => {
        setDepositPage(1);
        if (depositSortKey === key) setDepositSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setDepositSortKey(key); setDepositSortDirection('desc'); }
    };
    const handleCashSort = (key: CashSortKey) => {
        setCashPage(1);
        if (cashSortKey === key) setCashSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setCashSortKey(key); setCashSortDirection('desc'); }
    };
    
    const sortAndPaginate = <T, K extends keyof T>(
        data: T[],
        sortKey: K | null,
        sortDirection: SortDirection,
        page: number,
        searchFn: (item: T, query: string) => boolean,
        dateKey?: keyof T,
        dateParser?: (dateStr: string) => string
    ): { data: T[], totalPages: number } => {
        let filteredData = data;
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            filteredData = data.filter(item => searchFn(item, lowercasedQuery));
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
                    const aValue = a[sortKey];
                    const bValue = b[sortKey];
                    if (typeof aValue === 'string' && typeof bValue === 'string') comparison = aValue.localeCompare(bValue, 'zh-Hant');
                    else if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
                    else comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }
        
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        return { data: paginatedData, totalPages };
    };

    const sortedCreditData = useMemo(() => sortAndPaginate(creditData, creditSortKey, creditSortDirection, creditPage, 
        (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q),
        'transactionDate', getCreditDisplayDate
    ), [creditData, creditSortKey, creditSortDirection, creditPage, searchQuery]);
    
    const sortedDepositData = useMemo(() => sortAndPaginate(depositData, depositSortKey, depositSortDirection, depositPage, 
        (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q),
        'date', (d) => d
    ), [depositData, depositSortKey, depositSortDirection, depositPage, searchQuery]);
    
    const sortedCashData = useMemo(() => sortAndPaginate(cashData, cashSortKey, cashSortDirection, cashPage, 
        (item, q) => item.description.toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q),
        'date', (d) => d
    ), [cashData, cashSortKey, cashSortDirection, cashPage, searchQuery]);

    type CombinedData = {
        id: string; date: string; dateObj: Date; category: string; description: string; amount: number; source: '信用卡' | '活存帳戶' | '現金'; notes?: string; bankCode?: string;
    };
      
    const combinedData = useMemo<CombinedData[]>(() => {
        let combined: CombinedData[] = [];
        
        const filterAndMap = (data: any[], source: CombinedData['source'], dateKey: string) => {
            let filtered = data;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                filtered = data.filter(d => 
                    d.description.toLowerCase().includes(q) ||
                    (d.bankCode && d.bankCode.toLowerCase().includes(q)) ||
                    (d.notes && d.notes.toLowerCase().includes(q))
                );
            }
            filtered.forEach(d => {
                const displayDate = dateKey === 'transactionDate' ? getCreditDisplayDate(d[dateKey]) : d[dateKey];
                let dateObj; try { dateObj = parse(displayDate, 'yyyy/MM/dd', new Date()); } catch { dateObj = new Date(0); }
                combined.push({ ...d, date: displayDate, dateObj, source });
            });
        };

        filterAndMap(creditData, '信用卡', 'transactionDate');
        filterAndMap(depositData, '活存帳戶', 'date');
        filterAndMap(cashData, '現金', 'date');
    
        return combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    }, [creditData, depositData, cashData, searchQuery]);

    const summaryReportData = useMemo(() => {
        const monthlyData: Record<string, Record<string, number>> = {};
        const allCategoriesInReport = new Set<string>();
    
        combinedData.forEach(transaction => {
            try {
                if (summarySelectedCategories.length > 0 && !summarySelectedCategories.includes(transaction.category)) return;
                allCategoriesInReport.add(transaction.category);
                const monthKey = format(transaction.dateObj, 'yyyy年M月');
                if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
                monthlyData[monthKey][transaction.category] = (monthlyData[monthKey][transaction.category] || 0) + transaction.amount;
            } catch(e) {/* ignore */}
        });
    
        const sortedCategories = Array.from(allCategoriesInReport).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        const headers = ['日期（年月）', ...sortedCategories, '總計'];
    
        const rows = Object.entries(monthlyData).map(([month, categoryData]) => {
          let total = 0;
          const row: Record<string, string | number> = { '日期（年月）': month };
          sortedCategories.forEach(cat => {
            const value = categoryData[cat] || 0;
            row[cat] = value;
            total += value;
          });
          row['總計'] = total;
          return row;
        }).sort((a, b) => {
            try {
                return parse(a['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime() - parse(b['日期（年月）'] as string, 'yyyy年M月', new Date()).getTime();
            } catch {
                return (a['日期（年月）'] as string).localeCompare(b['日期（年月）'] as string);
            }
        });
        
        return { headers, rows };
    }, [combinedData, summarySelectedCategories]);

    const categoryChartData = useMemo(() => {
        if (!creditData || creditData.length === 0) return [];
        const categoryTotals = creditData.reduce((acc, transaction) => {
          if (transaction.amount > 0) {
            const category = transaction.category || '未分類';
            acc[category] = (acc[category] || 0) + transaction.amount;
          }
          return acc;
        }, {} as Record<string, number>);
        return Object.entries(categoryTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    }, [creditData]);

    const handleSummaryCellClick = (monthKey: string, category: string) => {
        const [year, month] = monthKey.replace('年', '-').replace('月', '').split('-').map(Number);
        const filtered = combinedData.filter(t => 
            t.category === category && getYear(t.dateObj) === year && getMonth(t.dateObj) + 1 === month
        ).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
        setDetailViewData(filtered);
        setDetailViewTitle(`${monthKey} - ${category}`);
        setIsDetailViewOpen(true);
    };

    const handleDownload = () => {
        try {
            const wb = XLSX.utils.book_new();
            const allData = [...sortedCreditData.data, ...sortedDepositData.data, ...sortedCashData.data];
      
            if (allData.length > 0) {
              const sheetData = combinedData.map(d => ({
                  '日期': d.date,
                  '類型': d.category,
                  '交易項目': d.description,
                  '金額': d.amount,
                  '備註': d.bankCode || d.notes || '',
                  '來源': d.source
              }));
              const ws = XLSX.utils.json_to_sheet(sheetData);
              XLSX.utils.book_append_sheet(wb, ws, '合併報表');
            }
      
            const today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `bank_data_${today}.xlsx`);
        } catch(error) {
            toast({ variant: "destructive", title: "下載失败", description: "產生 Excel 檔案時發生錯誤。" });
            console.error("Failed to download Excel file:", error);
        }
    };


    const noDataFound = hasProcessed && creditData.length === 0 && depositData.length === 0 && cashData.length === 0;
    const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
    const defaultTab = hasData ? (creditData.length > 0 ? "credit" : (depositData.length > 0 ? "deposit" : "cash")) : "statement";

    return (
        <Card>
            <CardHeader>
                <h3 className="text-xl font-semibold font-headline">處理結果</h3>
            </CardHeader>
            <CardContent>
                {hasData ? (
                  <>
                    <div className="flex justify-between items-center mb-4 gap-4">
                       <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="尋找交易項目或備註..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />下載 Excel</Button>
                    </div>

                    <Tabs defaultValue={defaultTab} className="w-full">
                      <TabsList>
                        {combinedData.length > 0 && <TabsTrigger value="combined"><Combine className="w-4 h-4 mr-2"/>合併報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="credit">信用卡 ({creditData.length})</TabsTrigger>}
                        {depositData.length > 0 && <TabsTrigger value="deposit">活存帳戶 ({depositData.length})</TabsTrigger>}
                        <TabsTrigger value="cash">現金 ({cashData.length})</TabsTrigger>
                        {hasData && <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-2"/>彙總報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="chart"><BarChart2 className="w-4 h-4 mr-2"/>統計圖表</TabsTrigger>}
                      </TabsList>
                      
                      <TabsContent value="combined">
                        <Table>
                            <TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="w-[120px]">類型</TableHead><TableHead>交易項目</TableHead><TableHead className="w-[100px]">來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
                            <TableBody>
                            {combinedData.map((row) => (
                                <TableRow key={row.id}>
                                <TableCell className="font-mono">{row.date}</TableCell>
                                <TableCell>{row.category}</TableCell>
                                <TableCell>{row.description}</TableCell>
                                <TableCell>{row.source}</TableCell>
                                <TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                      </TabsContent>

                      <TabsContent value="credit">
                        <Table>
                            <TableHeader><TableRow>
                                <SortableHeader sortKey="transactionDate" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '110px' }}>日期</SortableHeader>
                                <TableHead style={{ width: '110px' }}>類型</TableHead>
                                <TableHead>交易項目</TableHead>
                                <SortableHeader sortKey="amount" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '100px' }}>金額</SortableHeader>
                                <TableHead>銀行代碼/備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                            {sortedCreditData.data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell style={{ width: '110px' }}><div className="font-mono">{getCreditDisplayDate(row.transactionDate)}</div></TableCell>
                                    <TableCell style={{ width: '110px' }}>
                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'credit')} disabled={!user}>
                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger>
                                            <SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'credit')} disabled={!user} /></TableCell>
                                    <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell>
                                    <TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'credit')} disabled={!user} /></TableCell>
                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'credit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        <PaginationControls currentPage={creditPage} totalPages={sortedCreditData.totalPages} onPageChange={setCreditPage} />
                      </TabsContent>
                      
                      <TabsContent value="deposit">
                        <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader><TableRow>
                                <SortableHeader sortKey="date" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>日期</SortableHeader>
                                <SortableHeader sortKey="category" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>類型</SortableHeader>
                                <SortableHeader sortKey="description" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort}>交易項目</SortableHeader>
                                <SortableHeader sortKey="amount" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '100px' }}>金額</SortableHeader>
                                <TableHead>銀行代碼/備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                            {sortedDepositData.data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell>
                                    <TableCell style={{ width: '110px' }}>
                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'deposit')} disabled={!user}>
                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger>
                                            <SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'deposit')} disabled={!user} /></TableCell>
                                    <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                                    <TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'deposit')} disabled={!user} /></TableCell>
                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'deposit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        <PaginationControls currentPage={depositPage} totalPages={sortedDepositData.totalPages} onPageChange={setDepositPage} />
                      </TabsContent>
                      
                      <TabsContent value="cash">
                        <CashTransactionForm availableCategories={availableCategories} onSubmit={onAddCashTransaction} user={user} />
                        <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader><TableRow>
                                <SortableHeader sortKey="date" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '110px' }}>日期</SortableHeader>
                                <TableHead style={{ width: '110px' }}>類型</TableHead>
                                <TableHead>交易項目</TableHead>
                                <SortableHeader sortKey="amount" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '100px' }}>金額</SortableHeader>
                                <TableHead>備註</TableHead>
                                <TableHead className="w-[80px] text-center">操作</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                            {sortedCashData.data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell>
                                    <TableCell style={{ width: '110px' }}>
                                        <Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'cash')} disabled={!user}>
                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger>
                                            <SelectContent>{availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'cash')} disabled={!user} /></TableCell>
                                    <TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell>
                                    <TableCell><EditableCell value={row.notes || ''} onUpdate={v => onUpdateTransaction(row.id, 'notes', v, 'cash')} disabled={!user} /></TableCell>
                                    <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'cash')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        <PaginationControls currentPage={cashPage} totalPages={sortedCashData.totalPages} onPageChange={setCashPage} />
                      </TabsContent>
                      
                      <TabsContent value="summary">
                        <div className="flex flex-wrap items-center gap-2 my-4">
                            <Popover open={isSummaryFilterOpen} onOpenChange={setIsSummaryFilterOpen}>
                                <PopoverTrigger asChild>
                                <Button variant="outline">篩選類型 ({summarySelectedCategories.length}/{availableCategories.length})<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0">
                                    <div className="p-2 space-y-1"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories(availableCategories)}>全選</Button><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories([])}>全部取消</Button></div>
                                    <div className="border-t max-h-60 overflow-y-auto p-2">
                                        {availableCategories.sort((a,b)=> a.localeCompare(b, 'zh-Hant')).map(category => (
                                        <div key={category} className="flex items-center space-x-2 p-1">
                                            <Checkbox id={`cat-${category}`} checked={summarySelectedCategories.includes(category)} onCheckedChange={(c) => c ? setSummarySelectedCategories([...summarySelectedCategories, category]) : setSummarySelectedCategories(summarySelectedCategories.filter(i => i !== category))} />
                                            <label htmlFor={`cat-${category}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{category}</label>
                                        </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {quickFilters.map((filter, index) => <Button key={index} variant="outline" size="sm" onClick={() => setSummarySelectedCategories(filter.categories)}>{filter.name}</Button>)}
                            <p className="text-sm text-muted-foreground hidden md:block ml-auto">點擊表格中的數字可查看該月份的交易明細。</p>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader><TableRow>{summaryReportData.headers.map(h => <TableHead key={h} className={h !== '日期（年月）' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
                                <TableBody>
                                {summaryReportData.rows.map((row, i) => (
                                    <TableRow key={i}>
                                    {summaryReportData.headers.map(header => {
                                        const value = row[header];
                                        const isClickable = header !== '日期（年月）' && header !== '總計' && typeof value === 'number' && value !== 0;
                                        let textColor = '';
                                        if (typeof value === 'number') {
                                            if (header.includes('收入')) textColor = 'text-green-600';
                                            else if (value < 0) textColor = 'text-green-600';
                                            else if (value > 0) textColor = 'text-destructive';
                                        }
                                        return (
                                            <TableCell key={header} className={`font-mono ${header !== '日期（年月）' ? 'text-right' : ''} ${textColor}`}>
                                            {isClickable ? <button onClick={() => handleSummaryCellClick(row['日期（年月）'] as string, header)} className="hover:underline hover:text-blue-500">{value.toLocaleString()}</button> : (typeof value === 'number' ? value.toLocaleString() : value)}
                                            </TableCell>
                                        );
                                    })}
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </div>
                      </TabsContent>

                      <TabsContent value="chart">
                        <Card>
                            <CardHeader><CardTitle>信用卡消費分類統計</CardTitle><CardDescription>此圖表顯示信用卡的各類別總支出。 (僅計算正數金額)</CardDescription></CardHeader>
                            <CardContent><div style={{ width: '100%', height: 400 }}><ResponsiveContainer><BarChart layout="vertical" data={categoryChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} /><Tooltip formatter={(v: number) => v.toLocaleString()} /><Legend /><Bar dataKey="total" fill="var(--color-chart-1)" name="總支出" /></BarChart></ResponsiveContainer></div></CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (noDataFound && (
                    <div className="text-center py-10">
                        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">沒有找到資料</h3>
                        <p className="mt-2 text-sm text-muted-foreground">我們無法從您提供的內容中解析出任何報表資料。<br />請確認格式是否正確，或嘗試貼上其他內容。</p>
                    </div>
                ))}

            </CardContent>
             <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                <DialogContent className="max-w-4xl h-4/5 flex flex-col" id={detailDialogId}>
                    <DialogHeader><DialogTitle>{detailViewTitle}</DialogTitle></DialogHeader>
                    <div className="flex-grow overflow-y-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>日期</TableHead><TableHead>交易項目</TableHead><TableHead>來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader>
                            <TableBody>
                            {detailViewData.length > 0 ? ( detailViewData.map(item => (
                                <TableRow key={item.id}>
                                <TableCell>{(item as any).date || getCreditDisplayDate((item as any).transactionDate)}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{(item as any).source || '信用卡'}</TableCell>
                                <TableCell className={`text-right ${item.amount < 0 ? 'text-green-600' : ''}`}>{item.amount.toLocaleString()}</TableCell>
                                </TableRow>
                            ))) : (<TableRow><TableCell colSpan={4} className="text-center">沒有找到相關交易紀錄。</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

    