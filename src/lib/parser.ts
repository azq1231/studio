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
    // Allow YYYY/MM/DD or MM/DD format
    if (!/^(?:\d{4}\/)?\d{1,2}\/\d{1,2}/.test(currentLine)) {
      continue;
    }

    const parts = currentLine.split(/\s+/);
    if (parts.length < 2) continue;
    
    let transactionDate = parts[0];
    let postingDate = '';
    let initialCategory = '';
    let descriptionStartIndex = 1;

    // Handle YYYY/MM/DD format
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

        const bankCodeMatch = rawDescription.match(/\s(\w+)$/);
        if (bankCodeMatch) {
            bankCode = bankCodeMatch[1];
            rawDescription = rawDescription.substring(0, rawDescription.lastIndexOf(bankCode)).trim();
        }

    } else {
        const lastPart = parts[parts.length - 1];
        const parsedAmount = parseFloat(lastPart.replace(/,/g, ''));
        if (!isNaN(parsedAmount)) {
            amount = parsedAmount;
            rawDescription = parts.slice(descriptionStartIndex, -1).join(' ');
        }
    }

    if (!rawDescription && parts.length > descriptionStartIndex) {
        rawDescription = parts.slice(descriptionStartIndex).join(' ');
    }


    if (rawDescription) {
      // Create a deterministic ID based on the most stable raw transaction content
      // CRITICAL: The ID must NOT include any category.
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
    if (/^\d{4}\/\d{2}\/\d{2}/.test(line)) {
      currentDate = line;
      continue;
    }

    if (/^\d{2}:\d{2}:\d{2}/.test(line)) {
      if (!currentDate) {
        try {
            currentDate = format(new Date(), 'yyyy/MM/dd');
        } catch {}
      }

      const parts = line.split(/\s+/); // Split by whitespace instead of tab
      if (parts.length < 2) continue;

      const time = parts[0];
      const description = parts[1];
      const withdraw = parts[2]?.replace(/,/g, '') || '';
      const deposit = parts[3]?.replace(/,/g, '') || '';
      const balance = parts[4]?.replace(/,/g, '') || '';
      const remark = parts.slice(5).join(' '); // Join the rest as remark
      
      const amount = withdraw ? parseFloat(withdraw) : (deposit ? -parseFloat(deposit) : 0);
      
      if (!description && !amount) continue;

      const idString = `${currentDate}-${time}-${description}-${amount}-${remark}`;
      const id = await sha1(idString);

      results.push({
        id,
        date: currentDate,
        category: '', // Category will be applied later
        description,
        amount,
        bankCode: remark
      });
    }
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

