
export type CreditData = {
  transactionDate: string;
  postingDate: string;
  description: string;
  amount: number;
};

export function parseCreditCard(text: string): CreditData[] {
  const lines = text.split('\n');
  const results: CreditData[] = [];
  for (const line of lines) {
    const clean = line.replace(/\u3000/g, ' ').trim();
    if (!/^\d{2}\/\d{2}/.test(clean)) {
      continue;
    }
    const parts = clean.split(/\s{2,}|\t+/);
    if (parts.length >= 2) {
      const transactionDate = parts[0].trim();
      const postingDate = /^\d{2}\/\d{2}/.test(parts[1]) ? parts[1].trim() : '';
      
      const amountMatch = clean.match(/(-?[\d,]+(\.\d+)?)$/);
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
      
      let description = clean;
      if (amountMatch) {
          description = description.substring(0, description.lastIndexOf(amountMatch[0])).trim();
      }
      description = description.replace(transactionDate, '').trim();
      if(postingDate) {
          description = description.replace(postingDate, '').trim();
      }
      
      if(description) { 
          results.push({
            transactionDate,
            postingDate,
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

export function parseDepositAccount(text: string): DepositData[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const results: (string|number)[][] = [];
  let currentDate = '';
  let temp: (string|number)[] | null = null;

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
      const time = parts[0]?.trim() ?? '';
      const desc = parts[1]?.trim() ?? '';
      const withdraw = parts[2]?.replace(/,/g, '').trim() ?? '';
      const deposit = parts[3]?.replace(/,/g, '').trim() ?? '';
      let remark = parts.length > 5 ? (parts[5]?.trim() ?? '') : '';
      const amount = withdraw ? parseFloat(withdraw) : (deposit ? -parseFloat(deposit) : 0);
      
      if (remark === '行銀非約跨優') {
        remark = '';
      }

      const rule = special_rules[desc] || { merge_remark: true, remark_col: null };
      
      temp = [currentDate, time, '', amount, '', '', ''];

      if (rule.merge_remark) {
        temp[2] = `${desc} ${remark}`.trim();
      } else {
        temp[2] = desc;
        if (rule.remark_col !== null && temp.length > rule.remark_col) {
          temp[rule.remark_col] = remark;
        }
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
