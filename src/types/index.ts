export type CombinedData = {
    id: string;
    date: string;
    dateObj: Date;
    category: string;
    description: string;
    amount: number;
    source: '信用卡' | '活存帳戶' | '現金';
    notes?: string;
    bankCode?: string;
};
