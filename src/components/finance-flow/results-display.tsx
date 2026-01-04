'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/firebase';
import { useToast } from "@/hooks/use-toast"
import type { CreditData, DepositData, CashData } from '@/lib/parser';
import { format, getYear, getMonth } from 'date-fns';
import type { User } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { getCreditDisplayDate, parse } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Download, AlertCircle, Trash2, ChevronsUpDown, ArrowDown, ArrowUp, BarChart2, FileText, Combine, Search, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';
import { AppSettings } from './settings-manager';
import { CashTransactionForm } from './cash-transaction-form';
import type { CombinedData } from '../finance-flow-client';


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
    creditData, depositData, cashData, settings, onAddCashTransaction, onUpdateTransaction, onDeleteTransaction, hasProcessed, user
}: {
    creditData: CreditData[]; depositData: DepositData[]; cashData: CashData[]; settings: AppSettings;
    onAddCashTransaction: (data: Omit<CashData, 'id'>) => void;
    onUpdateTransaction: (id: string, field: keyof any, value: string | number, type: 'credit' | 'deposit' | 'cash') => void;
    onDeleteTransaction: (id: string, type: 'credit' | 'deposit' | 'cash') => void;
    hasProcessed: boolean; user: User | null;
}) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [creditPage, setCreditPage] = useState(1);
    const [depositPage, setDepositPage] = useState(1);
    const [cashPage, setCashPage] = useState(1);
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
    
    useEffect(() => { 
        if (hasProcessed || creditData.length > 0 || depositData.length > 0 || cashData.length > 0) {
            setSummarySelectedCategories(settings.availableCategories); 
        }
    }, [hasProcessed, settings.availableCategories, creditData, depositData, cashData]);
    
    const handleCreditSort = (key: keyof CreditData) => { setCreditPage(1); if (creditSortKey === key) setCreditSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCreditSortKey(key); setCreditSortDirection('desc'); } };
    const handleDepositSort = (key: keyof DepositData) => { setDepositPage(1); if (depositSortKey === key) setDepositSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setDepositSortKey(key); setDepositSortDirection('desc'); } };
    const handleCashSort = (key: keyof CashData) => { setCashPage(1); if (cashSortKey === key) setCashSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); else { setCashSortKey(key); setCashSortDirection('desc'); } };
    
    const sortAndPaginate = <T, K extends keyof T>(data: T[], sortKey: K | null, sortDirection: 'asc' | 'desc', page: number, searchFn: (item: T, query: string) => boolean, dateKey?: keyof T, dateParser?: (dateStr: string) => string): { data: T[], totalPages: number } => {
        let filteredData = searchQuery ? data.filter(item => searchFn(item, searchQuery.toLowerCase())) : data;
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

    const sortedCreditData = useMemo(() => sortAndPaginate(creditData, creditSortKey, creditSortDirection, creditPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'transactionDate', getCreditDisplayDate), [creditData, creditSortKey, creditSortDirection, creditPage, searchQuery]);
    const sortedDepositData = useMemo(() => sortAndPaginate(depositData, depositSortKey, depositSortDirection, depositPage, (item, q) => item.description.toLowerCase().includes(q) || (item.bankCode || '').toLowerCase().includes(q), 'date', d => d), [depositData, depositSortKey, depositSortDirection, depositPage, searchQuery]);
    const sortedCashData = useMemo(() => sortAndPaginate(cashData, cashSortKey, cashSortDirection, cashPage, (item, q) => item.description.toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q), 'date', d => d), [cashData, cashSortKey, cashSortDirection, cashPage, searchQuery]);
    
    
    const combinedData = useMemo<CombinedData[]>(() => {
        const parseDateSafe = (dateString: string, formatString: string): Date => {
            try {
                return parse(dateString, formatString, new Date());
            } catch {
                return new Date(0); // Invalid date
            }
        };

        const combined: CombinedData[] = [];
        
        const filterAndMap = (data: any[], source: CombinedData['source'], dateKey: string) => {
            const q = searchQuery.toLowerCase();
            (searchQuery ? data.filter(d => (d.description && d.description.toLowerCase().includes(q)) || (d.bankCode && d.bankCode.toLowerCase().includes(q)) || (d.notes && d.notes.toLowerCase().includes(q))) : data).forEach(d => {
                const displayDate = dateKey === 'transactionDate' ? getCreditDisplayDate(d[dateKey]) : d[dateKey];
                let dateObj = parseDateSafe(displayDate, 'yyyy/MM/dd');
                if (dateObj.getTime() === new Date(0).getTime()) {
                   // Handle cases where date might be MM/DD
                   dateObj = parseDateSafe(displayDate, 'MM/dd', new Date());
                }
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
    
            } catch(e) { /* Ignore date parsing errors */ }
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
            } catch(e) {}
        });
        const fixedItemsYearly = Object.entries(fixedItemsByYear).sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
        const fixedAverageMonthly = fixedMonths.size > 0 ? Object.values(fixedItemsByYear).reduce((a,b) => a + b, 0) / fixedMonths.size : 0;
        
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
        } catch(error) { toast({ variant: "destructive", title: "下載失败", description: "產生 Excel 檔案時發生錯誤。" }); }
    };

    const noDataFound = hasProcessed && creditData.length === 0 && depositData.length === 0 && cashData.length === 0;
    const hasData = creditData.length > 0 || depositData.length > 0 || cashData.length > 0;
    const defaultTab = hasData ? (creditData.length > 0 ? "credit" : (depositData.length > 0 ? "deposit" : "cash")) : "statement";

    return (
        <Card>
            <CardHeader><h3 className="text-xl font-semibold font-headline">處理結果</h3></CardHeader>
            <CardContent>
                {hasData ? (
                  <>
                    <div className="flex justify-between items-center mb-4 gap-4">
                       <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="尋找交易項目或備註..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
                      <Button variant="outline" size="sm" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />下載 Excel</Button>
                    </div>
                    <Tabs defaultValue={defaultTab} className="w-full">
                      <TabsList>
                        {combinedData.length > 0 && <TabsTrigger value="combined"><Combine className="w-4 h-4 mr-2"/>合併報表</TabsTrigger>}
                        {creditData.length > 0 && <TabsTrigger value="credit">信用卡 ({creditData.length})</TabsTrigger>}
                        {depositData.length > 0 && <TabsTrigger value="deposit">活存帳戶 ({depositData.length})</TabsTrigger>}
                        <TabsTrigger value="cash">現金 ({cashData.length})</TabsTrigger>
                        {hasData && <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-2"/>彙總報表</TabsTrigger>}
                      </TabsList>
                      
                      <TabsContent value="combined"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="w-[120px]">類型</TableHead><TableHead>交易項目</TableHead><TableHead className="w-[100px]">來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader><TableBody>{combinedData.map((row) => (<TableRow key={row.id}><TableCell className="font-mono">{row.date}</TableCell><TableCell>{row.category}</TableCell><TableCell>{row.description}</TableCell><TableCell>{row.source}</TableCell><TableCell className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></TabsContent>
                      <TabsContent value="credit"><Table><TableHeader><TableRow><SortableHeader sortKey="transactionDate" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '110px' }}>日期</SortableHeader><TableHead style={{ width: '110px' }}>類型</TableHead><TableHead>交易項目</TableHead><SortableHeader sortKey="amount" currentSortKey={creditSortKey} sortDirection={creditSortDirection} onSort={handleCreditSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>銀行代碼/備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader><TableBody>{sortedCreditData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{getCreditDisplayDate(row.transactionDate)}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'credit')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'credit')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : ''}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'credit')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'credit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody></Table><PaginationControls currentPage={creditPage} totalPages={sortedCreditData.totalPages} onPageChange={setCreditPage} /></TabsContent>
                      <TabsContent value="deposit"><Table><TableCaption>金額：支出為正，存入為負</TableCaption><TableHeader><TableRow><SortableHeader sortKey="date" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>日期</SortableHeader><SortableHeader sortKey="category" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '110px' }}>類型</SortableHeader><SortableHeader sortKey="description" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort}>交易項目</SortableHeader><SortableHeader sortKey="amount" currentSortKey={depositSortKey} sortDirection={depositSortDirection} onSort={handleDepositSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>銀行代碼/備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader><TableBody>{sortedDepositData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'deposit')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'deposit')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.bankCode || ''} onUpdate={v => onUpdateTransaction(row.id, 'bankCode', v, 'deposit')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'deposit')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody></Table><PaginationControls currentPage={depositPage} totalPages={sortedDepositData.totalPages} onPageChange={setDepositPage} /></TabsContent>
                      <TabsContent value="cash">
                        <Accordion type="single" collapsible defaultValue="add-cash" className="w-full mb-4">
                            <AccordionItem value="add-cash">
                                <AccordionTrigger>新增現金交易</AccordionTrigger>
                                <AccordionContent>
                                    <CashTransactionForm settings={settings} onSubmit={onAddCashTransaction} user={user} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <Table>
                            <TableCaption>金額：支出為正，存入為負</TableCaption>
                            <TableHeader><TableRow><SortableHeader sortKey="date" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '110px' }}>日期</SortableHeader><TableHead style={{ width: '110px' }}>類型</TableHead><TableHead>交易項目</TableHead><SortableHeader sortKey="amount" currentSortKey={cashSortKey} sortDirection={cashSortDirection} onSort={handleCashSort} style={{ width: '100px' }}>金額</SortableHeader><TableHead>備註</TableHead><TableHead className="w-[80px] text-center">操作</TableHead></TableRow></TableHeader>
                            <TableBody>{sortedCashData.data.map((row) => (<TableRow key={row.id}><TableCell style={{ width: '110px' }}><div className="font-mono">{row.date}</div></TableCell><TableCell style={{ width: '110px' }}><Select value={row.category} onValueChange={(v) => onUpdateTransaction(row.id, 'category', v, 'cash')} disabled={!user}><SelectTrigger className="h-8 w-full"><SelectValue placeholder="選擇類型" /></SelectTrigger><SelectContent>{settings.availableCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><EditableCell value={row.description} onUpdate={v => onUpdateTransaction(row.id, 'description', v, 'cash')} disabled={!user} /></TableCell><TableCell style={{ width: '100px' }} className={`text-right font-mono ${row.amount < 0 ? 'text-green-600' : 'text-destructive'}`}>{row.amount.toLocaleString()}</TableCell><TableCell><EditableCell value={row.notes || ''} onUpdate={v => onUpdateTransaction(row.id, 'notes', v, 'cash')} disabled={!user} /></TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => onDeleteTransaction(row.id, 'cash')} disabled={!user} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}</TableBody>
                        </Table>
                        <PaginationControls currentPage={cashPage} totalPages={sortedCashData.totalPages} onPageChange={setCashPage} />
                      </TabsContent>
                      <TabsContent value="summary">
                        <div className="flex flex-wrap items-center gap-2 my-4">
                            <Popover open={isSummaryFilterOpen} onOpenChange={setIsSummaryFilterOpen}>
                                <PopoverTrigger asChild><Button variant="outline">篩選類型 ({summarySelectedCategories.length}/{settings.availableCategories.length})<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0">
                                    <div className="p-2 space-y-1"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories(settings.availableCategories)}>全選</Button><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setSummarySelectedCategories([])}>全部取消</Button></div>
                                    <div className="border-t max-h-60 overflow-y-auto p-2">{[...settings.availableCategories].sort((a,b)=> a.localeCompare(b, 'zh-Hant')).map(category => (<div key={category} className="flex items-center space-x-2 p-1"><Checkbox id={`cat-${category}`} checked={summarySelectedCategories.includes(category)} onCheckedChange={(c) => c ? setSummarySelectedCategories([...summarySelectedCategories, category]) : setSummarySelectedCategories(summarySelectedCategories.filter(i => i !== category))} /><label htmlFor={`cat-${category}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{category}</label></div>))}</div>
                                </PopoverContent>
                            </Popover>
                            {settings.quickFilters.map((filter, index) => <Button key={index} variant="outline" size="sm" onClick={() => setSummarySelectedCategories(filter.categories)}>{filter.name}</Button>)}
                            <p className="text-sm text-muted-foreground hidden md:block ml-auto">點擊表格中的數字可查看該月份的交易明細。</p>
                        </div>
                        <div className="rounded-md border">
                            <Table><TableHeader><TableRow>{summaryReportData.headers.map(h => <TableHead key={h} className={h !== '日期（年月）' ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{summaryReportData.rows.map((row, i) => (<TableRow key={i}>{summaryReportData.headers.map(header => { const value = row[header]; const isClickable = header !== '日期（年月）' && header !== '總計' && typeof value === 'number' && value !== 0; let textColor = ''; if (typeof value === 'number') { if (value < 0) textColor = 'text-green-600'; } return (<TableCell key={header} className={`font-mono ${header !== '日期（年月）' ? 'text-right' : ''} ${textColor}`}>{isClickable ? <button onClick={() => handleSummaryCellClick(row['日期（年月）'] as string, header)} className="hover:underline hover:text-blue-500">{value.toLocaleString()}</button> : (typeof value === 'number' ? value.toLocaleString() : value)}</TableCell>);})}</TableRow>))}</TableBody></Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (noDataFound && (
                    <div className="text-center py-10"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">沒有找到資料</h3><p className="mt-2 text-sm text-muted-foreground">我們無法從您提供的內容中解析出任何報表資料。<br />請確認格式是否正確，或嘗試貼上其他內容。</p></div>
                ))}
                <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
                    <DialogContent className="max-w-4xl h-4/5 flex flex-col"><DialogHeader><DialogTitle>{detailViewTitle}</DialogTitle></DialogHeader><div className="flex-grow overflow-y-auto"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>類型</TableHead><TableHead>交易項目</TableHead><TableHead>備註</TableHead><TableHead>來源</TableHead><TableHead className="text-right">金額</TableHead></TableRow></TableHeader><TableBody>{detailViewData.length > 0 ? ( detailViewData.map(item => (<TableRow key={item.id}><TableCell>{(item as any).date || getCreditDisplayDate((item as any).transactionDate)}</TableCell><TableCell>{item.category}</TableCell><TableCell>{item.description}</TableCell><TableCell>{(item as any).bankCode || (item as any).notes || ''}</TableCell><TableCell>{(item as any).source || '信用卡'}</TableCell><TableCell className={`text-right ${item.amount < 0 ? 'text-green-600' : ''}`}>{item.amount.toLocaleString()}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="text-center">沒有找到相關交易紀錄。</TableCell></TableRow>)}</TableBody></Table></div></DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
