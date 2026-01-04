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

    for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 3) continue;

        let transactionDate = '';
        let postingDate = '';
        let description = '';
        let amount = 0;
        let bankCode = '';
        let initialCategory = '';

        // Case 1: 交易日 入帳日 類別 描述 金額 備註
        // 11/14 11/15 吃 摩斯漢堡 150 12345
        const dateRegex = /^\d{1,2}\/\d{1,2}$/;
        if (dateRegex.test(parts[0]) && dateRegex.test(parts[1])) {
            transactionDate = parts[0];
            postingDate = parts[1];
            
            const lastPart = parts[parts.length - 1].replace(/,/g, '');
            const secondLastPart = parts[parts.length - 2].replace(/,/g, '');

            if (!isNaN(parseFloat(lastPart)) && !isNaN(parseFloat(secondLastPart))) {
                // Format: ... DESC AMOUNT BANK_CODE
                amount = parseFloat(secondLastPart);
                bankCode = lastPart;
                initialCategory = parts[2];
                description = parts.slice(3, -2).join(' ');
            } else if (!isNaN(parseFloat(lastPart))) {
                // Format: ... DESC AMOUNT
                amount = parseFloat(lastPart);
                initialCategory = parts[2];
                description = parts.slice(3, -1).join(' ');
            }
        }
        // Case 2: 交易日 描述 金額
        // 11/14 摩斯漢堡 150
        else if (dateRegex.test(parts[0])) {
            transactionDate = parts[0];
            postingDate = transactionDate; // Assume posting date is the same

            const lastPart = parts[parts.length - 1].replace(/,/g, '');
            if (!isNaN(parseFloat(lastPart))) {
                amount = parseFloat(lastPart);
                description = parts.slice(1, -1).join(' ');
            }
        }
        
        if (!description || !amount) continue;

        // Use only the most stable fields for ID generation
        const idString = `${transactionDate}-${postingDate}-${description}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            transactionDate,
            postingDate,
            description,
            amount,
            bankCode,
            initialCategory,
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
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const results: DepositData[] = [];
    let currentDate = '';

    for (const line of lines) {
        // Handle lines that are just the date
        const dateMatch = line.match(/^(\d{4}\/\d{2}\/\d{2})$/);
        if (dateMatch) {
            currentDate = dateMatch[1];
            continue;
        }

        let datePart = currentDate;
        let lineContent = line;

        // Check if the line itself starts with a date, overriding the current sticky date
        const lineDateMatch = line.match(/^(\d{4}\/\d{2}\/\d{2})\s+(.*)$/);
        if (lineDateMatch) {
            datePart = lineDateMatch[1];
            lineContent = lineDateMatch[2];
        }
        
        if (!datePart) continue; // Skip if no date is established

        const timeMatch = lineContent.match(/^(\d{2}:\d{2}:\d{2})\s+(.*)$/);
        const time = timeMatch ? timeMatch[1] : '00:00:00';
        const restOfLine = timeMatch ? timeMatch[2] : lineContent;

        const parts = restOfLine.split(/\s+/).filter(Boolean);
        if (parts.length < 2) continue;
        
        // Reverse parsing from the end of the line
        let remark = '';
        let balance = 0;
        let deposit = 0;
        let withdraw = 0;
        
        const lastPart = parts[parts.length - 1].replace(/,/g, '');
        if (isNaN(parseFloat(lastPart))) {
            remark = parts.pop() || '';
        }

        const balancePart = parts.pop()?.replace(/,/g, '');
        if (balancePart) balance = parseFloat(balancePart) || 0;
        
        const depositPart = parts.pop()?.replace(/,/g, '');
        if (depositPart) deposit = parseFloat(depositPart) || 0;

        const withdrawPart = parts.pop()?.replace(/,/g, '');
        if (withdrawPart) withdraw = parseFloat(withdrawPart) || 0;
        
        const description = parts.join(' ');
        const amount = withdraw || (deposit > 0 ? -deposit : 0);

        if (!description || amount === 0) continue;

        // CRITICAL: ID is based on core, stable fields. Remark is NOT included.
        const idString = `${datePart}-${time}-${description}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            date: datePart,
            category: '', // Category will be applied later by the action
            description,
            amount,
            bankCode: remark
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

    