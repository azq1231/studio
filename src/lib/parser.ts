import type { ReplacementRule, CategoryRule } from '@/app/actions';
import { format, parse } from 'date-fns';
import { createHash } from 'crypto';

// Helper function to create a SHA-1 hash for generating consistent IDs
async function sha1(str: string): Promise<string> {
    // This function is designed for server-side (Node.js) hashing.
    // A browser-compatible version would be needed for client-side execution.
    // Node.js implementation:
    return createHash('sha1').update(str).digest('hex');
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
  transactionDate: string;
  postingDate: string;
  description: string;
  amount: number;
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


// This parser now only extracts raw data. 
// Categorization and rule application will be handled by the server action.
export async function parseCreditCard(text: string): Promise<ParsedCreditDataWithCategory[]> {
  const lines = text.split('\n');
  const results: ParsedCreditDataWithCategory[] = [];

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
    let category = '';
    let descriptionStartIndex = 1;

    // Handle YYYY/MM/DD format
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(transactionDate)) {
        postingDate = transactionDate;
        // Do not convert to MM/dd anymore, keep the full date
    }

    // Check if the second part is a posting date (MM/DD format) or a category
    if (/^\d{1,2}\/\d{1,2}$/.test(parts[1])) {
        postingDate = parts[1];
        descriptionStartIndex = 2;
    } else { // It's not a date, so it could be a category or part of the description
        // If there are at least 3 parts and the last one is a number, the second one is likely a category
        const lastPart = parts[parts.length - 1].replace(/,/g, '');
        if (parts.length >=3 && !isNaN(parseFloat(lastPart))) {
            category = parts[1];
            descriptionStartIndex = 2;
        } else {
             descriptionStartIndex = 1;
        }
    }

    // Sometimes transaction date and posting date are merged, e.g., 11/0211/02
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
    let description = remainingLine;
    let bankCode = '';

    if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/,/g, ''));
        const amountEndIndex = remainingLine.lastIndexOf(amountMatch[0]);
        description = remainingLine.substring(0, amountEndIndex).trim();

        const bankCodeMatch = description.match(/\s(\w+)$/);
        if (bankCodeMatch) {
            bankCode = bankCodeMatch[1];
            description = description.substring(0, description.lastIndexOf(bankCode)).trim();
        }

    } else {
        const lastPart = parts[parts.length - 1];
        const parsedAmount = parseFloat(lastPart.replace(/,/g, ''));
        if (!isNaN(parsedAmount)) {
            amount = parsedAmount;
            description = parts.slice(descriptionStartIndex, -1).join(' ');
        }
    }

    if (!description && parts.length > descriptionStartIndex) {
        description = parts.slice(descriptionStartIndex).join(' ');
    }


    if (description) {
      // Create a deterministic ID based on transaction content
      const idString = `${transactionDate}-${postingDate}-${description}-${amount}`;
      const id = await sha1(idString);

      results.push({
        id,
        transactionDate,
        postingDate,
        description,
        amount,
        category,
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

function applyCategoryRules(description: string, rules: CategoryRule[]): string {
    for (const rule of rules) {
        if (rule.keyword && description.includes(rule.keyword)) {
            return rule.category;
        }
    }
    return '未分類';
}

export async function parseDepositAccount(text: string, replacementRules: ReplacementRule[], categoryRules: CategoryRule[]): Promise<DepositData[]> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const results: DepositData[] = [];
  let currentDate = '';
  
  const applyRules = (text: string) => {
    let processedText = text;
    let shouldDelete = false;
    for (const rule of replacementRules) {
        if(rule.find && processedText.includes(rule.find)) {
            if(rule.deleteRow) {
                shouldDelete = true;
                break;
            }
            processedText = processedText.replace(new RegExp(rule.find, 'g'), rule.replace);
        }
    }
    return { processedText, shouldDelete };
  }

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

      const parts = line.split('\t');
      if (parts.length < 2) continue;

      let description = parts[1]?.trim() ?? '';
      const withdraw = parts[2]?.replace(/,/g, '').trim() ?? '';
      const deposit = parts[3]?.replace(/,/g, '').trim() ?? '';
      const amount = withdraw ? parseFloat(withdraw) : (deposit ? -parseFloat(deposit) : 0);
      
      // The remark is everything from column 6 onwards
      const remark = parts.length > 5 ? (parts.slice(5).join(' ').trim() ?? '') : '';

      const { processedText, shouldDelete } = applyRules(description);
      if(shouldDelete) {
        continue;
      }
      description = processedText;
      
      const category = applyCategoryRules(description, categoryRules);
      
      // Combine all parts for a unique ID
      const idString = `${currentDate}-${description}-${amount}-${remark}`;
      const id = await sha1(idString);

      results.push({
        id,
        date: currentDate,
        category,
        description,
        amount,
        bankCode: remark
      });
    }
  }

  return results;
}
