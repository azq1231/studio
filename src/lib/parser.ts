import type { ReplacementRule, CategoryRule } from '@/app/actions';
import { format, parse } from 'date-fns';

// Helper function to create a SHA-1 hash for generating consistent IDs
async function sha1(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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
    if (firstRow && firstRow.some(cell => typeof cell === 'string' && ['日期', '種類', '用途', '內容', '金額', 'date', 'category', 'type', 'description', 'amount'].includes(cell.toLowerCase()))) {
        dataRows = data.slice(1);
    }
    
    for (const row of dataRows) {
        if (!row || row.length < 4) continue;

        const rawDate = row[0];
        let dateStr: string;

        if (rawDate instanceof Date) {
            dateStr = format(rawDate, 'yyyy/MM/dd');
        } else if (typeof rawDate === 'string' && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
            dateStr = rawDate;
        } else if (typeof rawDate === 'number') { // Handle Excel date serial numbers
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
            dateStr = format(jsDate, 'yyyy/MM/dd');
        } else {
            continue; // Skip row if date is not in expected format
        }

        const type = String(row[1] || '').trim(); // "種類"
        const category = String(row[2] || '未分類').trim(); // "用途"
        const description = String(row[3] || '').trim(); // "內容"
        const amount = parseFloat(String(row[4] || '0').replace(/,/g, '')); // "金額"
        const notes = String(row[5] || '').trim();

        if (description && !isNaN(amount)) {
            detectedCategories.add(category);
            const idString = `${dateStr}-${description}-${amount}-${type}`;
            const id = await sha1(idString);

            switch (type) {
                case '玉山信':
                    creditResults.push({
                        id,
                        transactionDate: format(parse(dateStr, 'yyyy/MM/dd', new Date()), 'MM/dd'),
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
        transactionDate = format(parse(transactionDate, 'yyyy/MM/dd', new Date()), 'MM/dd')
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
      const idString = `${postingDate || transactionDate}-${description}-${amount}`;
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


type SpecialRule = {
  merge_remark: boolean;
  remark_col: number | null;
}

const special_rules: Record<string, SpecialRule> = {
  "國保保費": { merge_remark: true, remark_col: null },
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
  const results: (string|number)[][] = [];
  let currentDate = '';
  let temp: (string|number)[] | null = null;

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
      if (temp) {
        results.push(temp);
      }

      if (!currentDate) {
        try {
            currentDate = format(new Date(), 'yyyy/MM/dd');
        } catch {}
      }

      const parts = line.split('\t');
      let desc = parts[1]?.trim() ?? '';
      const withdraw = parts[2]?.replace(/,/g, '').trim() ?? '';
      const deposit = parts[3]?.replace(/,/g, '').trim() ?? '';
      let remark = parts.length > 5 ? (parts.slice(5).join(' ').trim() ?? '') : '';
      const amount = withdraw ? parseFloat(withdraw) : (deposit ? -parseFloat(deposit) : 0);
      
      const rule = special_rules[desc] || { merge_remark: true, remark_col: null };
      
      let finalDescription = '';
      if (rule.merge_remark) {
        finalDescription = `${desc} ${remark}`.trim();
      } else {
        finalDescription = desc;
      }

      const { processedText, shouldDelete } = applyRules(finalDescription);
      if(shouldDelete) {
        temp = null;
        continue;
      }
      finalDescription = processedText;
      
      const category = applyCategoryRules(finalDescription, categoryRules);
      
      const idString = `${currentDate}-${finalDescription}-${amount}`;
      const id = await sha1(idString);

      let bankCode = '';
      const remarkMatch = finalDescription.match(/(\[[^\]]+\])/);
      if (remarkMatch) {
        bankCode = remarkMatch[1];
        finalDescription = finalDescription.replace(remarkMatch[1], '').trim();
      }

      temp = [id, currentDate, category, finalDescription, amount, bankCode];
      
      if (!rule.merge_remark && rule.remark_col !== null && temp.length > rule.remark_col) {
        temp[rule.remark_col] = remark;
      }

      continue;
    }

    if (temp && line) {
      const match = line.match(/^([\d/]+)/);
      if (match) {
        const remarkMatch = line.match(/(\[[^\]]+\])/);
        if (remarkMatch) {
            if(temp.length > 5) temp[5] = remarkMatch[1];
        }
      }
    }
  }

  if (temp) {
    results.push(temp);
  }

  return results.map(r => ({
    id: r[0] as string,
    date: r[1] as string,
    category: r[2] as string,
    description: r[3] as string,
    amount: r[4] as number,
    bankCode: r[5] as string,
  }));
}
