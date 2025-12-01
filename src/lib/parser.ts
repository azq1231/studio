import type { ReplacementRule } from '@/app/actions';

// This is the final, categorized data structure
export type CreditData = {
  transactionDate: string;
  category: string;
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
    
    const transactionDate = parts[0];
    let postingDate = '';
    let descriptionStartIndex = 1;

    // Check if the second part is a posting date
    if (/^\d{1h,2}\/\d{1,2}/.test(parts[1])) {
      postingDate = parts[1];
      descriptionStartIndex = 2;
    }

    // The rest of the line is the description and amount
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
  date: string;
  time: string;
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

export function parseDepositAccount(text: string, rules: ReplacementRule[]): DepositData[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const results: (string|number)[][] = [];
  let currentDate = '';
  let temp: (string|number)[] | null = null;

  const applyRules = (text: string) => {
    let processedText = text;
    let shouldDelete = false;
    for (const rule of rules) {
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
      let time = parts[0]?.trim() ?? '';
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


      temp = [currentDate, time, finalDescription, amount, '', '', ''];
      
      if (!rule.merge_remark && rule.remark_col !== null && temp.length > rule.remark_col) {
        temp[rule.remark_col] = remark;
      }

      continue;
    }

    if (temp && line) {
      const match = line.match(/^([\d/]+)/);
      if (match) {
        if(temp.length > 5) temp[5] = match[1];
        if(temp.length > 6) temp[6] = '';
      }
    }
  }

  if (temp) {
    results.push(temp);
  }

  return results.map(r => ({
    date: r[0] as string,
    time: r[1] as string,
    description: r[2] as string,
    amount: r[3] as number,
    blank: r[4] as string,
    bankCode: r[5] as string,
    accountNumber: r[6] as string,
  }));
}
