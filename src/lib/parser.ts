import type { ReplacementRule } from '@/app/actions';

export type CreditData = {
  transactionDate: string;
  category: string;
  description: string;
  amount: number;
};

export function parseCreditCard(text: string, rules: ReplacementRule[]): CreditData[] {
  const lines = text.split('\n');
  const results: CreditData[] = [];

  for (const line of lines) {
    let currentLine = line.replace(/\u3000/g, ' ').trim();
    if (!/^\d{1,2}\/\d{1,2}/.test(currentLine)) {
      continue;
    }

    let shouldDeleteRow = false;
    for (const rule of rules) {
      if (rule.find && currentLine.includes(rule.find)) {
        if (rule.deleteRow) {
          shouldDeleteRow = true;
          break;
        }
        currentLine = currentLine.replace(new RegExp(rule.find, 'g'), rule.replace);
      }
    }

    if (shouldDeleteRow) {
      continue;
    }

    const parts = currentLine.split(/\s+/);
    
    if (parts.length >= 2) {
      const transactionDate = parts[0];
      let category = '';
      let descriptionStartIndex = 1;

      // Check if the second part is a custom category or a posting date
      if (parts.length > 1 && !/^\d{1,2}\/\d{1,2}/.test(parts[1])) {
        // It's a custom category (like '吃', '家')
        category = parts[1];
        descriptionStartIndex = 2;
      } else if (parts.length > 1 && /^\d{1,2}\/\d{1,2}/.test(parts[1])) {
        // It's a posting date, so we skip it and category remains empty.
        descriptionStartIndex = 2;
      }

      const amountMatch = currentLine.match(/(-?[\d,]+(\.\d+)?)$/);
      let amount = 0;
      let description = '';

      if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/,/g, ''));
        // Get description by removing the amount from the end
        const amountEndIndex = currentLine.lastIndexOf(amountMatch[0]);
        description = currentLine.substring(0, amountEndIndex).trim();
      } else {
        // If no amount is found at the end, assume last part is amount if it's a number
        const lastPart = parts[parts.length - 1];
        const parsedAmount = parseFloat(lastPart.replace(/,/g, ''));
        if (!isNaN(parsedAmount)) {
          amount = parsedAmount;
          // Join all parts except the last one for the description
          description = parts.slice(0, -1).join(' ');
        } else {
          // No amount found, so the whole line is the description
          amount = 0;
          description = currentLine;
        }
      }
      
      // Clean up the start of the description
      let tempDesc = description;
      if (tempDesc.startsWith(transactionDate)) {
        tempDesc = tempDesc.substring(transactionDate.length).trim();
      }
      // If the second part was a posting date or a category, remove it as well.
      if (descriptionStartIndex === 2 && parts.length > 1) {
         if (tempDesc.startsWith(parts[1])) {
             tempDesc = tempDesc.substring(parts[1].length).trim();
         }
      }
      
      description = tempDesc;

      if (description) {
        results.push({
          transactionDate,
          category,
          description,
          amount,
        });
      }
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
