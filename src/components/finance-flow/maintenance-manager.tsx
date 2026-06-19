'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wrench,
  Search,
  Trash2,
  Plus,
  Calendar,
  MapPin,
  User as UserIcon,
  DollarSign,
  FileText,
  Filter,
  Check,
  X,
  Loader2,
  Pencil
} from 'lucide-react';

export interface MaintenanceRecord {
  id: string;
  date: string;
  location: string;
  item: string;
  vendor: string;
  amount: number;
  notes?: string;
  createdAt?: any;
}

interface MaintenanceManagerProps {
  records: MaintenanceRecord[];
  onAddRecord: (record: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onUpdateRecord: (id: string, record: Partial<Omit<MaintenanceRecord, 'id'>>) => Promise<void>;
  user: User | null;
  isProcessing?: boolean;
}

export function MaintenanceManager({
  records = [],
  onAddRecord,
  onDeleteRecord,
  onUpdateRecord,
  user,
  isProcessing = false,
}: MaintenanceManagerProps) {
  // --- 表單狀態 ---
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [location, setLocation] = useState('');
  const [item, setItem] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 編輯狀態 ---
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- 自動建議狀態 ---
  const [showLocationSuggest, setShowLocationSuggest] = useState(false);
  const [showVendorSuggest, setShowVendorSuggest] = useState(false);

  // --- 搜尋與篩選狀態 ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');

  // --- 從歷史紀錄提取建議清單 ---
  const locationSuggestions = useMemo(() => {
    const locs = records.map(r => r.location).filter(Boolean);
    return Array.from(new Set(locs));
  }, [records]);

  const vendorSuggestions = useMemo(() => {
    const vends = records.map(r => r.vendor).filter(Boolean);
    return Array.from(new Set(vends));
  }, [records]);

  // 過濾建議清單
  const filteredLocSuggestions = useMemo(() => {
    if (!location) return locationSuggestions;
    return locationSuggestions.filter(loc =>
      loc.toLowerCase().includes(location.toLowerCase())
    );
  }, [location, locationSuggestions]);

  const filteredVendorSuggestions = useMemo(() => {
    if (!vendor) return vendorSuggestions;
    return vendorSuggestions.filter(v =>
      v.toLowerCase().includes(vendor.toLowerCase())
    );
  }, [vendor, vendorSuggestions]);

  // --- 搜尋與過濾邏輯 ---
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 地點過濾
      if (selectedLocation !== 'ALL' && record.location !== selectedLocation) {
        return false;
      }
      // 關鍵字過濾
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchItem = record.item?.toLowerCase().includes(query);
        const matchVendor = record.vendor?.toLowerCase().includes(query);
        const matchLocation = record.location?.toLowerCase().includes(query);
        const matchNotes = record.notes?.toLowerCase().includes(query);
        return matchItem || matchVendor || matchLocation || matchNotes;
      }
      return true;
    });
  }, [records, selectedLocation, searchQuery]);

  // 篩選後總金額
  const totalAmount = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [filteredRecords]);

  // --- 編輯功能處理 ---
  const handleStartEdit = (record: MaintenanceRecord) => {
    setEditingId(record.id);
    setFormError('');
    
    // 轉回 YYYY-MM-DD 格式以填入 input[type=date]
    const formattedDate = record.date.replace(/\//g, '-');
    setDate(formattedDate);
    setLocation(record.location);
    setItem(record.item);
    setVendor(record.vendor);
    setAmount(String(record.amount));
    setNotes(record.notes || '');

    // 滾動到頁面最上方以方便編輯
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormError('');
    
    // 重置所有欄位
    setLocation('');
    setItem('');
    setVendor('');
    setAmount('');
    setNotes('');
  };

  // --- 表單送出處理 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');

    if (!date) {
      setFormError('請選擇日期');
      return;
    }
    if (!location.trim()) {
      setFormError('請輸入維修地點');
      return;
    }
    if (!item.trim()) {
      setFormError('請輸入維修項目');
      return;
    }
    if (!vendor.trim()) {
      setFormError('請輸入廠商名稱');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('請輸入有效的金額 (必須大於 0)');
      return;
    }

    setIsSubmitting(true);
    try {
      // 轉換日期格式為 YYYY/MM/DD 以便與其他帳單一致
      const formattedDate = date.replace(/-/g, '/');
      const recordData = {
        date: formattedDate,
        location: location.trim(),
        item: item.trim(),
        vendor: vendor.trim(),
        amount: numAmount,
        notes: notes.trim() || undefined,
      };

      if (editingId) {
        await onUpdateRecord(editingId, recordData);
        setEditingId(null);
      } else {
        await onAddRecord(recordData);
      }

      // 成功後重置所有欄位（包括地點與廠商）
      setLocation('');
      setItem('');
      setVendor('');
      setAmount('');
      setNotes('');
    } catch (err) {
      setFormError(editingId ? '更新失敗，請稍後再試' : '新增失敗，請稍後再試');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 快速新增/編輯區塊 */}
      <Card className="shadow-md border-slate-200">
        <CardHeader className="bg-slate-50/50 pb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {editingId ? '編輯維修紀錄' : '新增維修紀錄'}
              </CardTitle>
              <CardDescription>
                {editingId ? '正在修改選定的維修紀錄欄位' : '記錄維修細節，系統會自動記憶常用地點與廠商'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 日期欄位 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> 日期
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm"
                  required
                />
              </div>

              {/* 地點欄位 (帶有自動完成) */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> 地點
                </label>
                <Input
                  type="text"
                  placeholder="例如：大安區A棟、家裡"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setShowLocationSuggest(true);
                  }}
                  onFocus={() => setShowLocationSuggest(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggest(false), 200)}
                  className="w-full text-sm"
                  autoComplete="off"
                  required
                />
                {showLocationSuggest && filteredLocSuggestions.length > 0 && (
                  <div className="absolute top-[100%] left-0 right-0 z-[100] mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {filteredLocSuggestions.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          setLocation(loc);
                          setShowLocationSuggest(false);
                        }}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 維修項目 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> 維修項目
                </label>
                <Input
                  type="text"
                  placeholder="例如：浴室漏水修復、冷氣洗濾網"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  className="w-full text-sm"
                  required
                />
              </div>

              {/* 廠商名稱 (帶有自動完成) */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> 廠商名稱
                </label>
                <Input
                  type="text"
                  placeholder="例如：極速水電工程、阿隆師"
                  value={vendor}
                  onChange={(e) => {
                    setVendor(e.target.value);
                    setShowVendorSuggest(true);
                  }}
                  onFocus={() => setShowVendorSuggest(true)}
                  onBlur={() => setTimeout(() => setShowVendorSuggest(false), 200)}
                  className="w-full text-sm"
                  autoComplete="off"
                  required
                />
                {showVendorSuggest && filteredVendorSuggestions.length > 0 && (
                  <div className="absolute top-[100%] left-0 right-0 z-[100] mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {filteredVendorSuggestions.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          setVendor(v);
                          setShowVendorSuggest(false);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 金額 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> 金額
                </label>
                <Input
                  type="number"
                  placeholder="請輸入金額"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-sm"
                  required
                  min="0"
                />
              </div>

              {/* 備註 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> 備註
                </label>
                <Input
                  type="text"
                  placeholder="選填，例如保固半年、附帶收據"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

            </div>

            {formError && (
              <div className="text-xs font-semibold text-red-500 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 shrink-0" /> {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-4"
                >
                  <X className="h-4 w-4" />
                  取消編輯
                </Button>
              )}
              <Button
                type="submit"
                disabled={!user || isSubmitting || isProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 px-4 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? '更新紀錄' : '新增紀錄'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 篩選與列表區塊 */}
      <Card className="shadow-md border-slate-200">
        <CardHeader className="bg-slate-50/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">歷史維修紀錄</CardTitle>
              <CardDescription>
                共 {filteredRecords.length} 筆紀錄
              </CardDescription>
            </div>
            
            {/* 統計金額 */}
            <div className="bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">篩選金額總計:</span>
              <span className="text-lg font-extrabold text-primary">
                ${totalAmount.toLocaleString()} 元
              </span>
            </div>
          </div>

          {/* 搜尋與過濾列 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {/* 關鍵字搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="搜尋項目、廠商、備註或地點..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* 地點篩選 */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="選擇篩選地點" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部地點</SelectItem>
                  {locationSuggestions.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4 px-0 sm:px-6">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Wrench className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-sm">無符合條件的維修紀錄</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto px-4 sm:px-0">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="group relative bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* 主要資訊 */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-primary/10 text-primary text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {record.location}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {record.date}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      {record.item}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3 text-slate-400" /> 廠商: {record.vendor}
                      </span>
                      {record.notes && (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <FileText className="h-3 w-3 text-slate-400" /> 備註: {record.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 金額與刪除/修改操作 */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <span className="text-lg font-black text-slate-700 sm:text-right">
                      ${record.amount.toLocaleString()}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(record)}
                        className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                        title="編輯此紀錄"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`確定要刪除這筆維修紀錄嗎？\n[${record.date} - ${record.location}: ${record.item}]`)) {
                            onDeleteRecord(record.id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                        title="刪除此紀錄"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
