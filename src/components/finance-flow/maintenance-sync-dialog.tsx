'use client';
import React, { useState, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/firebase';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon, Camera, X, Loader2 } from 'lucide-react';

interface SyncFormState {
    txId: string;
    date: string;
    description: string;
    amount: number;
    location: string;
    notes: string;
    source: string;
    vendor?: string;
}

interface MaintenanceSyncDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    syncForm: SyncFormState | null;
    setSyncForm: React.Dispatch<React.SetStateAction<SyncFormState | null>>;
    locationSuggestions: string[];
    vendorSuggestions?: string[];
    onAddMaintenanceRecord?: (record: any) => Promise<void>;
}

// 圖片壓縮輔助函數
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

export function MaintenanceSyncDialog({
    open,
    onOpenChange,
    syncForm,
    setSyncForm,
    locationSuggestions,
    vendorSuggestions = [],
    onAddMaintenanceRecord,
}: MaintenanceSyncDialogProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const [syncLoading, setSyncLoading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [showLocationSuggest, setShowLocationSuggest] = useState(false);
    const [showVendorSuggest, setShowVendorSuggest] = useState(false);

    const filteredLocSuggestions = useMemo(() => {
        if (!syncForm) return [];
        const query = syncForm.location || '';
        if (!query) return locationSuggestions;
        return locationSuggestions.filter(loc =>
            loc.toLowerCase().includes(query.toLowerCase())
        );
    }, [syncForm, locationSuggestions]);

    const filteredVendorSuggestions = useMemo(() => {
        if (!syncForm) return [];
        const query = syncForm.vendor || '';
        if (!query) return vendorSuggestions;
        return vendorSuggestions.filter(v =>
            v.toLowerCase().includes(query.toLowerCase())
        );
    }, [syncForm, vendorSuggestions]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (selectedPhotos.length + files.length > 3) {
                setErrorMsg('最多只能上傳 3 張照片');
                return;
            }
            setErrorMsg('');
            setSelectedPhotos(prev => [...prev, ...files]);
        }
    };

    const handleRemovePhoto = (index: number) => {
        setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSyncSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!syncForm || !onAddMaintenanceRecord || !user) return;
        if (!syncForm.location.trim()) {
            toast({ variant: "destructive", title: "防呆提示", description: "請填寫或選擇施作位置/房屋" });
            return;
        }

        try {
            setSyncLoading(true);
            setUploadStatus('正在處理照片...');
            
            // 上傳照片
            const finalPhotos: string[] = [];
            const storage = getStorage();

            for (let i = 0; i < selectedPhotos.length; i++) {
                const photo = selectedPhotos[i];
                setUploadStatus(`正在壓縮並上傳第 ${i + 1}/${selectedPhotos.length} 張照片...`);
                try {
                    const compressedDataUrl = await compressImage(photo);
                    try {
                        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                        const fileRef = storageRef(storage, `users/${user.uid}/maintenancePhotos/${uniqueId}.jpg`);
                        await uploadString(fileRef, compressedDataUrl, 'data_url');
                        const downloadUrl = await getDownloadURL(fileRef);
                        finalPhotos.push(downloadUrl);
                    } catch (storageErr) {
                        console.warn("Storage upload failed, falling back to Base64:", storageErr);
                        finalPhotos.push(compressedDataUrl); // Base64 備援
                    }
                } catch (compressErr) {
                    console.error("Failed to compress or upload photo:", compressErr);
                }
            }

            setUploadStatus('正在儲存至資料庫...');
            await onAddMaintenanceRecord({
                txId: syncForm.txId,
                date: syncForm.date,
                item: syncForm.description, // 正確將交易的「施作項目/描述」對應到維修紀錄的「item」！
                vendor: syncForm.vendor || '',
                amount: syncForm.amount,
                location: syncForm.location,
                notes: syncForm.notes,
                photos: finalPhotos,
                source: syncForm.source
            });

            toast({ title: "同步成功", description: "已成功新增房屋維修紀錄。" });
            setSelectedPhotos([]);
            setErrorMsg('');
            onOpenChange(false);
            setSyncForm(null);
        } catch (error) {
            console.error("Sync failed:", error);
            toast({ variant: "destructive", title: "同步失敗", description: "無法新增維修紀錄，請重試。" });
        } finally {
            setSyncLoading(false);
            setUploadStatus('');
        }
    };

    if (!syncForm) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-800 rounded-3xl shadow-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <span>同步至房屋維修紀錄</span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-xs font-bold">
                        填寫下方維修細節以新增維修紀錄。施作位置與項目為必填。
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSyncSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="text-xs font-bold text-slate-600">交易日期</label>
                        <Input value={syncForm.date} disabled className="mt-1 border-slate-200 rounded-xl bg-slate-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600">維修項目/描述 <span className="text-rose-500">*</span></label>
                        <Input 
                            value={syncForm.description} 
                            onChange={e => setSyncForm({ ...syncForm, description: e.target.value })} 
                            className="mt-1 border-slate-200 rounded-xl" 
                            required 
                            placeholder="例如：馬桶修繕"
                        />
                    </div>
                    
                    {/* 廠商名稱欄位（含自動完成） */}
                    <div className="flex flex-col gap-1.5 relative">
                        <label className="text-xs font-bold text-slate-600">廠商名稱</label>
                        <Input
                            placeholder="例如：極速水電工程、阿隆師"
                            value={syncForm.vendor || ''}
                            onChange={e => {
                                setSyncForm({ ...syncForm, vendor: e.target.value });
                                setShowVendorSuggest(true);
                            }}
                            onFocus={() => setShowVendorSuggest(true)}
                            onBlur={() => setTimeout(() => setShowVendorSuggest(false), 200)}
                            className="w-full border-slate-200 rounded-xl"
                            autoComplete="off"
                        />
                        {showVendorSuggest && filteredVendorSuggestions.length > 0 && (
                            <div className="absolute top-[100%] left-0 right-0 z-[110] mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                                {filteredVendorSuggestions.map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                                        onClick={() => {
                                            setSyncForm({ ...syncForm, vendor: v });
                                            setShowVendorSuggest(false);
                                        }}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600">金額 (絕對值) <span className="text-rose-500">*</span></label>
                        <Input 
                            type="number" 
                            value={syncForm.amount} 
                            onChange={e => setSyncForm({ ...syncForm, amount: parseFloat(e.target.value) || 0 })} 
                            className="mt-1 border-slate-200 rounded-xl" 
                            required 
                        />
                    </div>

                    {/* 施作位置/房屋欄位 (帶有自動完成) */}
                    <div className="flex flex-col gap-1.5 relative">
                        <label className="text-xs font-bold text-slate-600">施作位置/房屋 <span className="text-rose-500">*</span></label>
                        <Input
                            placeholder="輸入施作位置，例如：大安區A棟"
                            value={syncForm.location}
                            onChange={e => {
                                setSyncForm({ ...syncForm, location: e.target.value });
                                setShowLocationSuggest(true);
                            }}
                            onFocus={() => setShowLocationSuggest(true)}
                            onBlur={() => setTimeout(() => setShowLocationSuggest(false), 200)}
                            className="w-full border-slate-200 rounded-xl"
                            autoComplete="off"
                            required
                        />
                        {showLocationSuggest && filteredLocSuggestions.length > 0 && (
                            <div className="absolute top-[100%] left-0 right-0 z-[110] mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                                {filteredLocSuggestions.map((loc) => (
                                    <button
                                        key={loc}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                                        onClick={() => {
                                            setSyncForm({ ...syncForm, location: loc });
                                            setShowLocationSuggest(false);
                                        }}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600">備註</label>
                        <Input 
                            value={syncForm.notes} 
                            onChange={e => setSyncForm({ ...syncForm, notes: e.target.value })} 
                            className="mt-1 border-slate-200 rounded-xl" 
                            placeholder="其他備註事項..."
                        />
                    </div>

                    {/* 照片上傳區域 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">上傳照片 (最多 3 張)</label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {selectedPhotos.map((photo, index) => {
                                const previewUrl = URL.createObjectURL(photo);
                                return (
                                    <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                                        <img src={previewUrl} alt="preview" className="object-cover w-full h-full" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePhoto(index)}
                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                );
                            })}
                            {selectedPhotos.length < 3 && (
                                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                                    <Camera className="w-5 h-5 text-slate-400" />
                                    <span className="text-[8px] text-slate-400 mt-1">選取</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple 
                                        onChange={handlePhotoSelect} 
                                        className="hidden" 
                                    />
                                </label>
                            )}
                        </div>
                        {errorMsg && <p className="text-[10px] text-rose-500 font-bold">{errorMsg}</p>}
                    </div>

                    {syncLoading && (
                        <div className="text-[11px] text-indigo-600 font-black flex items-center gap-1.5 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {uploadStatus}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={syncLoading} className="rounded-xl">取消</Button>
                        <Button type="submit" disabled={syncLoading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            確認同步
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
