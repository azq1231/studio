import type { ReplacementRule, CategoryRule } from '@/app/actions';
import { randomUUID } from 'crypto';

// This is the final, categorized data structure
export type CreditData = {
  id: string; // Added for unique identification
  transactionDate: string;
  category: string; // This will hold either the rule-based category or the original posting date
  description: string;
  amount: number;
};

// This is the initial raw parsed data before categorization
export type RawCreditData = {
  transactionDate: string;
  postingDate: string;
  description: string;
  amount: number;
};

// This parser now only extracts raw data. 
// Categorization and rule application will be handled by the server action.
export function parseCreditCard(text: string): RawCreditData[] {
  const lines = text.split('\n');
  const results: RawCreditData[] = [];

  for (const line of lines) {
    const currentLine = line.replace(/\u3000/g, ' ').trim();
    if (!/^\d{1,2}\/\d{1,2}/.test(currentLine)) {
      continue;
    }

    const parts = currentLine.split(/\s+/);
    if (parts.length < 2) continue;
    
    let transactionDate = parts[0];
    let postingDate = '';
    let descriptionStartIndex = 1;

    // Check if the second part is a posting date (MM/DD format)
    if (/^\d{1,2}\/\d{1,2}$/.test(parts[1])) {
        postingDate = parts[1];
        descriptionStartIndex = 2;
    } else {
        // If not, it's part of the description, and postingDate is unknown
        postingDate = ''; // Or some other placeholder
        descriptionStartIndex = 1;
    }

    // Sometimes transaction date and posting date are merged, e.g., 11/0211/02
    if (transactionDate.length > 5 && /^\d{1,2}\/\d{1,2}\d{1,2}\/\d{1,2}/.test(transactionDate)) {
        postingDate = transactionDate.slice(transactionDate.length / 2);
        transactionDate = transactionDate.slice(0, transactionDate.length / 2);
    }
    
    const remainingLine = parts.slice(descriptionStartIndex).join(' ');
    
    const amountMatch = remainingLine.match(/(-?[\d,]+(\.\d+)?)$/);
    let amount = 0;
    let description = remainingLine;

    if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/,/g, ''));
        const amountEndIndex = remainingLine.lastIndexOf(amountMatch[0]);
        description = remainingLine.substring(0, amountEndIndex).trim();
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
      results.push({
        transactionDate,
        postingDate,
        description,
        amount,
      });
    }
  }
  return results;
}


export type DepositData = {
  id: string; // Add ID for uniqueness
  date: string;
  category: string;
  description: string;
  amount: number;
  blank: string;
  bankCode: string;
  accountNumber: string;
};

type SpecialRule = {
  merge_remark: boolean;
  remark_col: number | null;
}

const special_rules: Record<string, SpecialRule> = {
  "國保保費": { merge_remark: false, remark_col: 5 },
};

function applyCategoryRules(description: string, rules: CategoryRule[]): string {
    for (const rule of rules) {
        if (rule.keyword && description.includes(rule.keyword)) {
            return rule.category;
        }
    }
    return '未分類';
}

export function parseDepositAccount(text: string, replacementRules: ReplacementRule[], categoryRules: CategoryRule[]): DepositData[] {
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

      const parts = line.split('\t');
      let desc = parts[1]?.trim() ?? '';
      const withdraw = parts[2]?.replace(/,/g, '').trim() ?? '';
      const deposit = parts[3]?.replace(/,/g, '').trim() ?? '';
      let remark = parts.length > 5 ? (parts[5]?.trim() ?? '') : '';
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

      // [id, date, category, description, amount, blank, bankCode, accountNumber]
      temp = [randomUUID(), currentDate, category, finalDescription, amount, '', '', ''];
      
      if (!rule.merge_remark && rule.remark_col !== null && temp.length > rule.remark_col) {
        temp[rule.remark_col] = remark;
      }

      continue;
    }

    if (temp && line) {
      const match = line.match(/^([\d/]+)/);
      if (match) {
        if(temp.length > 6) temp[6] = match[1]; // bankCode
        if(temp.length > 7) temp[7] = ''; // accountNumber
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
    blank: r[5] as string,
    bankCode: r[6] as string,
    accountNumber: r[7] as string,
  }));
}
