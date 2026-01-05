import { createHash } from 'crypto';
import { format } from 'date-fns';
export { parse } from 'date-fns';

// Helper function to create a SHA-1 hash for generating consistent IDs
async function sha1(str: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        // Browser environment
        const buffer = new TextEncoder().encode(str);
        const hash = await window.crypto.subtle.digest('SHA-1', buffer);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
        // Node.js environment
        return createHash('sha1').update(str).digest('hex');
    }
}


// This is the final, categorized data structure
export type CreditData = {
    id: string; // Added for unique identification
    transactionDate: string; // MM/DD format
    category: string;
    description: string;
    amount: number;
    bankCode?: string;
};

// This is the initial raw parsed data before categorization
export type RawCreditData = {
    id: string;
    transactionDate: string; // MM/DD format
    postingDate: string;
    description: string;
    amount: number;
    bankCode?: string;
    initialCategory: string; // The category found on the raw statement text, if any
};


export type ParsedCreditDataWithCategory = CreditData & {
    postingDate: string;
}

export type ParsedExcelData = {
    creditData: CreditData[];
    depositData: DepositData[];
    cashData: CashData[];
    detectedCategories: string[];
}

export async function parseExcelData(data: any[][]): Promise<ParsedExcelData> {
    const creditResults: CreditData[] = [];
    const depositResults: DepositData[] = [];
    const cashResults: CashData[] = [];
    const detectedCategories = new Set<string>();

    if (!data || data.length === 0) {
        return { creditData: [], depositData: [], cashData: [], detectedCategories: [] };
    }

    let dataRows = data;
    const firstRow = data[0];
    if (firstRow && firstRow.some(cell => typeof cell === 'string' && ['日期', '用途', '內容', '金額', '種類', '帳號備註'].some(header => cell.toLowerCase().includes(header.toLowerCase())))) {
        dataRows = data.slice(1);
    }

    for (const [index, row] of dataRows.entries()) {
        if (!row || row.every(cell => cell === null || cell === '')) continue;

        const rawDate = row[0];
        let dateStr: string;

        if (rawDate instanceof Date) {
            dateStr = format(rawDate, 'yyyy/MM/dd');
        } else if (typeof rawDate === 'string' && (/\d{4}\/\d{1,2}\/\d{1,2}/.test(rawDate) || /\d{1,2}\/\d{1,2}/.test(rawDate))) {
            dateStr = rawDate;
        } else if (typeof rawDate === 'number') { // Handle Excel date serial numbers
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
            dateStr = format(jsDate, 'yyyy/MM/dd');
        } else {
            // If date is unrecognizable, use a placeholder but still process the row
            dateStr = `無效日期 (行 ${index + 2})`;
        }

        const category = String(row[1] || '未分類').trim();
        const description = String(row[2] || '').trim();
        // More robust amount parsing, defaults to 0 if invalid
        const rawAmount = String(row[3] || '0').replace(/,/g, '');
        const amount = !isNaN(parseFloat(rawAmount)) ? parseFloat(rawAmount) : 0;

        const type = String(row[4] || '').trim();
        const notes = String(row[5] || '').trim();

        // The core logic for not dropping data: process the row even if some fields are imperfect.
        // We only require some semblance of a row existing.
        detectedCategories.add(category);

        // Use row index in ID to guarantee uniqueness even if content is identical
        const idString = `${dateStr}-${description}-${amount}-${type}-${notes}`;
        const id = await sha1(idString);

        switch (type) {
            case '玉山信':
                creditResults.push({
                    id,
                    transactionDate: dateStr, // Keep original yyyy/MM/dd format
                    category,
                    description,
                    amount,
                    bankCode: notes
                });
                break;
            case '現金':
                cashResults.push({
                    id,
                    date: dateStr,
                    category,
                    description,
                    amount,
                    notes
                });
                break;
            case '兆豐匯':
            case '玉山匯':
            default: // Default to deposit account
                depositResults.push({
                    id,
                    date: dateStr,
                    category,
                    description,
                    amount,
                    bankCode: notes
                });
                break;
        }
    }

    return {
        creditData: creditResults,
        depositData: depositResults,
        cashData: cashResults,
        detectedCategories: Array.from(detectedCategories),
    };
}


// This parser now only extracts raw data with a stable ID.
// Categorization and rule application will be handled by the server action.
export async function parseCreditCard(text: string): Promise<RawCreditData[]> {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results: RawCreditData[] = [];

    const dateRegex = /^\d{1,2}\/\d{1,2}$/;
    const amountRegex = /^-?[\d,]+(\.\d+)?$/;

    for (const line of lines) {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length < 3) continue;

        let transactionDate = '';
        let postingDate = '';
        let description = '';
        let amount = 0;
        let bankCode: string | undefined = undefined;

        // 1. Identify date(s)
        if (dateRegex.test(parts[0])) {
            transactionDate = parts[0];
            let descStartIndex = 1;
            if (dateRegex.test(parts[1])) {
                postingDate = parts[1];
                descStartIndex = 2;
            } else {
                postingDate = transactionDate;
            }

            // 2. Identify amount from the end
            const lastPart = parts[parts.length - 1];
            if (amountRegex.test(lastPart)) {
                amount = parseFloat(lastPart.replace(/,/g, ''));

                // 3. Identify potential bankCode (the part before amount)
                const secondLastPart = parts[parts.length - 2];
                let descEndIndex = parts.length - 1;

                // Check if the second to last part is NOT part of a multi-word description
                // by seeing if it's purely numeric or alphanumeric, common for remarks.
                // This is a heuristic. A more robust way might need more rules.
                const potentialRemarkRegex = /^[a-zA-Z0-9/.-]+$/;
                if (potentialRemarkRegex.test(secondLastPart) && isNaN(parseFloat(secondLastPart))) {
                    // It's likely a remark/bank code.
                    const thirdLastPart = parts.length > 3 ? parts[parts.length - 3] : '';
                    const thirdLastIsNumeric = !isNaN(parseFloat(thirdLastPart));

                    // Avoid grabbing final word of a description like 'UBER TRIP 12345'
                    // If the word before the potential remark is not numeric, it's safer to assume it's a remark.
                    if (!thirdLastIsNumeric) {
                        bankCode = secondLastPart;
                        descEndIndex = parts.length - 2;
                    }
                }

                description = parts.slice(descStartIndex, descEndIndex).join(' ');

            } else {
                continue; // Cannot determine amount
            }
        } else {
            continue; // Line doesn't start with a date
        }

        if (!description || !amount) continue;

        const idString = `${transactionDate}-${description}-${bankCode || ''}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            transactionDate,
            postingDate,
            description,
            amount,
            bankCode,
            initialCategory: '', // No initial category from this format
        });
    }
    return results;
}


export type DepositData = {
    id: string; // Add ID for uniqueness
    date: string; // yyyy/MM/dd format
    category: string;
    description: string;
    amount: number;
    bankCode?: string;
};

export type CashData = {
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    notes?: string;
};

export async function parseDepositAccount(text: string): Promise<DepositData[]> {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l);
    const results: DepositData[] = [];

    // Step 1: Merge multi-line entries
    // 銀行報表格式 (以 TAB 分隔):
    // 第一行: 日期 (yyyy/MM/dd)
    // 第二行: 時間 \t 交易類型 \t 提出 \t 存入 \t 餘額 \t 摘要
    // 第三行 (可選): 帳號/備註資訊
    const mergedEntries: { date: string, mainLine: string, supplementaryLine: string }[] = [];
    let currentDate = '';
    const dateLineRegex = /^(\d{4}\/\d{2}\/\d{2})$/;
    const transactionLineRegex = /^\d{2}:\d{2}:\d{2}/;

    for (const line of rawLines) {
        if (dateLineRegex.test(line)) {
            currentDate = line;
            continue;
        }

        if (transactionLineRegex.test(line)) {
            mergedEntries.push({ date: currentDate, mainLine: line, supplementaryLine: '' });
        } else if (mergedEntries.length > 0 && line) {
            // 這是補充行 (帳號/備註)，追加到最後一筆
            const lastEntry = mergedEntries[mergedEntries.length - 1];
            lastEntry.supplementaryLine = lastEntry.supplementaryLine
                ? `${lastEntry.supplementaryLine} ${line}`
                : line;
        }
    }

    for (const entry of mergedEntries) {
        if (!entry.date) continue;

        // 優先使用 TAB 分隔解析主行
        // 格式: 時間 \t 交易類型 \t 提出 \t 存入 \t 餘額 \t 摘要
        const tabParts = entry.mainLine.split('\t').map(p => p.trim());

        let time = '';
        let transactionType = '';
        let withdrawalStr = '';
        let depositStr = '';
        let balanceStr = '';
        let description = '';

        if (tabParts.length >= 6) {
            // TAB 分隔格式
            time = tabParts[0] || '';
            transactionType = tabParts[1] || '';
            withdrawalStr = tabParts[2] || '';
            depositStr = tabParts[3] || '';
            balanceStr = tabParts[4] || '';
            description = tabParts[5] || '';
        } else {
            // 回退到空白分隔解析
            const parts = entry.mainLine.split(/\s+/).filter(Boolean);
            if (parts.length < 4) continue;

            time = parts.shift() || '';
            // 反向剝離: 餘額、存入、提出
            const reverseParts = [...parts].reverse();
            balanceStr = reverseParts.shift() || '';
            depositStr = reverseParts.shift() || '';
            withdrawalStr = reverseParts.shift() || '';
            // 剩餘的是交易類型 + 摘要
            const remaining = reverseParts.reverse();
            if (remaining.length > 0) {
                transactionType = remaining.shift() || '';
                description = remaining.join(' ');
            }
        }

        // 解析金額
        const withdrawalAmount = parseFloat(withdrawalStr.replace(/,/g, '')) || 0;
        const depositAmount = parseFloat(depositStr.replace(/,/g, '')) || 0;
        let amount = 0;
        if (withdrawalAmount > 0) {
            amount = withdrawalAmount;
        } else if (depositAmount > 0) {
            amount = -depositAmount;
        }

        if (amount === 0) continue;

        // 處理補充行 (帳號/備註)
        let finalBankCode = entry.supplementaryLine || '';

        // 項目/摘要 = 交易類型 + 最後欄位（合併）
        // 例如：「連結帳戶交易 391-1504531614」、「行銀非約跨優 花都管理費」、「匯款存入 吳葉秀屘」
        // 取代規則會在後續的 applyReplacementRules 中處理（例如移除「行銀非約跨優」）
        let finalDescription = '';
        if (transactionType && description) {
            finalDescription = `${transactionType} ${description}`;
        } else if (transactionType) {
            finalDescription = transactionType;
        } else if (description) {
            finalDescription = description;
        }

        const idString = `${entry.date}-${time}-${finalDescription}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            date: entry.date,
            category: '',
            description: finalDescription,
            amount,
            bankCode: finalBankCode,
        });
    }

    return results;
}


export const getCreditDisplayDate = (dateString: string) => {
    try {
        // If the date is already in yyyy/MM/dd format, return it directly.
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) {
            return dateString;
        }
        // If the date is not in MM/dd format, return it as is to avoid errors.
        if (!/^\d{1,2}\/\d{1,2}$/.test(dateString)) {
            return dateString;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const parsedDate = parse(dateString, 'MM/dd', new Date());
        const transactionMonth = parsedDate.getMonth();

        // If the transaction month is later in the year than the current month,
        // it likely belongs to the previous year.
        const yearToSet = transactionMonth > currentMonth ? currentYear - 1 : currentYear;

        const dateObj = new Date(parsedDate);
        dateObj.setFullYear(yearToSet);

        return format(dateObj, 'yyyy/MM/dd');
    } catch {
        // Return original string if any parsing fails.
        return dateString;
    }
};











