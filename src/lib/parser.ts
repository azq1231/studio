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

        const dateRegex = /^\d{1,2}\/\d{1,2}$/;
        if (dateRegex.test(parts[0])) {
            transactionDate = parts[0];
            postingDate = (dateRegex.test(parts[1])) ? parts[1] : transactionDate;

            const amountStr = parts[parts.length - 1].replace(/,/g, '');
            const potentialAmount = parseFloat(amountStr);

            if (!isNaN(potentialAmount)) {
                amount = potentialAmount;
                const descStartIndex = dateRegex.test(parts[1]) ? 2 : 1;
                let descEndIndex = parts.length - 1;

                // Check if the word before the amount is a category or part of the description
                if (descEndIndex > descStartIndex) {
                     const potentialCategory = parts[descStartIndex];
                     // Simple check if it's a short word, likely a category. This can be improved.
                     if (potentialCategory.length <= 5) {
                         initialCategory = potentialCategory;
                         description = parts.slice(descStartIndex + 1, descEndIndex).join(' ');
                     } else {
                         description = parts.slice(descStartIndex, descEndIndex).join(' ');
                     }
                }

            } else {
                continue; // Cannot determine amount
            }
        } else {
             continue; // Line doesn't start with a date
        }
        
        if (!description || !amount) continue;

        // Use only the most stable fields for ID generation
        const idString = `${transactionDate}-${description}-${amount}`;
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
  description:string;
  amount: number;
  notes?: string;
};

export async function parseDepositAccount(text: string): Promise<DepositData[]> {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l);
    const results: DepositData[] = [];
    
    // Step 1: Merge multi-line entries
    const mergedEntries: { date: string, content: string }[] = [];
    let currentDate = '';
    const dateLineRegex = /^(\d{4}\/\d{2}\/\d{2})$/;
    const transactionLineRegex = /^\d{2}:\d{2}:\d{2}\s+/;

    for (const line of rawLines) {
        if (dateLineRegex.test(line)) {
            currentDate = line;
            continue;
        }

        if (transactionLineRegex.test(line)) {
            mergedEntries.push({ date: currentDate, content: line });
        } else if (mergedEntries.length > 0 && line) {
            // This is a supplementary line, append it to the last entry's content
            const lastEntry = mergedEntries[mergedEntries.length - 1];
            lastEntry.content += ` ${line}`;
        }
    }
    
    // Step 2: Process each merged entry using the reverse-peel strategy
    for (const entry of mergedEntries) {
        if (!entry.date) continue;
        
        let parts = entry.content.split(/\s+/).filter(Boolean);
        if (parts.length < 4) continue; // Basic validation for time, desc, amount, balance

        // 1. Peel off remark from the end (if it exists)
        const lastPart = parts[parts.length - 1];
        let remark = '';
        // A remark can be purely numeric (like '11409') or text.
        // The balance before it is always numeric with commas.
        // So, we find the last part that is a valid number with/without comma, that's the balance. The part after it is remark.
        let balanceIndex = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (!isNaN(parseFloat(parts[i].replace(/,/g, '')))) {
                balanceIndex = i;
                break;
            }
        }
        
        if (balanceIndex !== -1 && balanceIndex < parts.length - 1) {
            remark = parts.slice(balanceIndex + 1).join(' ');
            parts = parts.slice(0, balanceIndex + 1);
        }


        // 2. Peel off balance
        if (parts.length > 0) parts.pop(); // Balance is not used, so just discard it

        // 3. Peel off deposit and withdrawal, then determine the amount
        const depositStr = parts.length > 0 ? parts.pop()?.replace(/,/g, '') || '' : '';
        const withdrawalStr = parts.length > 0 ? parts.pop()?.replace(/,/g, '') || '' : '';
        const withdrawalAmount = parseFloat(withdrawalStr) || 0;
        const depositAmount = parseFloat(depositStr) || 0;
        const amount = withdrawalAmount > 0 ? withdrawalAmount : (depositAmount > 0 ? -depositAmount : 0);

        if (amount === 0) continue;

        // 4. Peel off time
        const time = parts.shift() || '';

        // 5. The rest is the description
        let description = parts.join(' ');
        
        if (!description) continue;

        // SPECIAL LOGIC for '行銀非約跨優'
        if (description.includes('行銀非約跨優') && remark) {
            const originalDescription = description;
            description = remark; // Use the remark as the main description
            remark = originalDescription; // The original description becomes the remark/bankCode
        }

        const idString = `${entry.date}-${time}-${description}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            date: entry.date,
            category: '', 
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

    






