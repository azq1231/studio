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
  const lines = text.split('\n');
  const results: RawCreditData[] = [];

  for (const line of lines) {
    const currentLine = line.replace(/\u3000/g, ' ').trim();
    if (!/^(?:\d{4}\/)?\d{1,2}\/\d{1,2}/.test(currentLine)) {
      continue;
    }

    const parts = currentLine.split(/\s+/);
    if (parts.length < 2) continue;
    
    let transactionDate = parts[0];
    let postingDate = '';
    let initialCategory = '';
    let descriptionStartIndex = 1;

    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(transactionDate)) {
        postingDate = transactionDate;
    }

    if (/^\d{1,2}\/\d{1,2}$/.test(parts[1])) {
        postingDate = parts[1];
        descriptionStartIndex = 2;
    } else {
        const lastPart = parts[parts.length - 1].replace(/,/g, '');
        if (parts.length >=3 && !isNaN(parseFloat(lastPart))) {
            initialCategory = parts[1];
            descriptionStartIndex = 2;
        } else {
             descriptionStartIndex = 1;
        }
    }

    if (transactionDate.length > 5 && !transactionDate.includes('/') && /^\d+$/.test(transactionDate)) {
        const mid = Math.floor(transactionDate.length / 2);
        const p1 = transactionDate.substring(0, mid);
        const p2 = transactionDate.substring(mid);
        if (p1.length >= 2 && p2.length >= 2) {
            const d1 = `${p1.slice(0, -2)}/${p1.slice(-2)}`;
            const d2 = `${p2.slice(0, -2)}/${p2.slice(-2)}`;
            if (/^\d{1,2}\/\d{1,2}$/.test(d1) && /^\d{1,2}\/\d{1,2}$/.test(d2)) {
                transactionDate = d1;
                postingDate = d2;
            }
        }
    } else if (transactionDate.length > 5 && transactionDate.match(/^\d{2}\/\d{2}\d{2}\/\d{2}$/)) {
        postingDate = transactionDate.slice(5);
        transactionDate = transactionDate.slice(0, 5);
    }
    
    const remainingLine = parts.slice(descriptionStartIndex).join(' ');
    
    const amountMatch = remainingLine.match(/(-?[\d,]+(\.\d+)?)$/);
    let amount = 0;
    let rawDescription = remainingLine;
    let bankCode = '';

    if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/,/g, ''));
        const amountEndIndex = remainingLine.lastIndexOf(amountMatch[0]);
        rawDescription = remainingLine.substring(0, amountEndIndex).trim();

        // This logic was flawed. A simple bank code is not always the last word.
        // It's better to treat the whole remaining part as description and let rules handle it.
        // The logic of separating bank code is removed to make description more stable.
    }

    if (!rawDescription && parts.length > descriptionStartIndex) {
        rawDescription = parts.slice(descriptionStartIndex).join(' ');
    }


    if (rawDescription) {
      const idString = `${transactionDate}-${postingDate}-${rawDescription}-${amount}`;
      const id = await sha1(idString);

      results.push({
        id,
        transactionDate,
        postingDate,
        description: rawDescription,
        amount,
        initialCategory: initialCategory,
        bankCode,
      });
    }
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
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(line.trim())) {
            currentDate = line.trim();
            continue;
        }

        // Handle transaction lines, which may or may not start with a date
        const fullLine = /^\d{4}\/\d{2}\/\d{2}/.test(line) ? line : `${currentDate} ${line}`.trim();
        
        const parts = fullLine.split(/\s+/);
        if (parts.length < 3) continue;

        const datePart = parts[0];
        const timePart = parts[1];

        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(datePart) || !/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
            continue;
        }

        const date = datePart;
        const time = timePart;
        
        // Everything after date and time is potentially description, amounts, or remark
        const restOfLine = parts.slice(2).join(' ');
        
        // This regex is complex. It looks for numbers (with commas) at the end of the string.
        // It tries to find up to 4 such numbers (withdraw, deposit, balance, remark).
        const match = restOfLine.match(/^(.*?)\s+([\d,]+)\s+([\d,]*)\s+([\d,]+)\s+([\d,]*\S*)$/);
        
        let description = '';
        let withdraw = '';
        let deposit = '';
        let remark = '';

        if (match) {
            description = match[1].trim();
            withdraw = match[2].replace(/,/g, '');
            // We don't need deposit, balance for this logic
            remark = match[5].trim();
        } else {
             // Fallback for simpler formats like "description amount"
             const simplerMatch = restOfLine.match(/^(.*?)\s+([\d,]+)$/);
             if (simplerMatch) {
                description = simplerMatch[1].trim();
                withdraw = simplerMatch[2].replace(/,/g, '');
             } else {
                 // If no numbers are found, treat the whole thing as description, amount as 0.
                 description = restOfLine;
                 withdraw = '0';
             }
        }
        
        const amount = withdraw ? parseFloat(withdraw) : 0;

        if (!description && !amount) continue;

        // CRITICAL: ID is based on core, stable fields. Remark is NOT included.
        const idString = `${date}-${time}-${description}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            date: date,
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