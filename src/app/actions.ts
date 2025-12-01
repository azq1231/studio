'use server';

import { detectReportType } from '@/ai/flows/detect-report-type';
import { categorizeTransaction } from '@/ai/flows/categorize-transaction';
import { parseCreditCard, parseDepositAccount, type CreditData, type DepositData, type RawCreditData } from '@/lib/parser';

export type ReplacementRule = {
    find: string;
    replace: string;
    deleteRow?: boolean;
};

async function processSingleCreditEntry(entry: RawCreditData, rules: ReplacementRule[]): Promise<CreditData | null> {
    let description = entry.description;
    let shouldDelete = false;

    for (const rule of rules) {
        if (rule.find && description.includes(rule.find)) {
            if (rule.deleteRow) {
                shouldDelete = true;
                break;
            }
            description = description.replace(new RegExp(rule.find, 'g'), rule.replace);
        }
    }

    if (shouldDelete || !description.trim()) {
        return null;
    }

    try {
        const { category } = await categorizeTransaction({ description });
        return {
            transactionDate: entry.transactionDate,
            category: category,
            description: description,
            amount: entry.amount,
        };
    } catch (e) {
        console.error(`Failed to categorize description "${description}":`, e);
        // Fallback to a default category if AI fails
        return {
            transactionDate: entry.transactionDate,
            category: '其他',
            description: description,
            amount: entry.amount,
        };
    }
}


export async function processBankStatement(
    text: string, 
    replacementRules: ReplacementRule[]
): Promise<{
    success: boolean;
    creditData: CreditData[];
    depositData: DepositData[];
    error?: string;
}> {
    if (!text || text.trim().length < 10) {
        return { success: false, creditData: [], depositData: [], error: "No text provided or text is too short." };
    }

    try {
        const sections = text.split(/(?=交易日期)/).filter(s => s.trim() !== '');
        let allCreditData: CreditData[] = [];
        let allDepositData: DepositData[] = [];

        for (const section of sections) {
            const { reportType } = await detectReportType({ text: section });

            if (reportType === 'credit_card') {
                const rawParsed = parseCreditCard(section);
                const processedPromises = rawParsed.map(entry => processSingleCreditEntry(entry, replacementRules));
                const processedEntries = (await Promise.all(processedPromises)).filter((e): e is CreditData => e !== null);
                allCreditData.push(...processedEntries);

            } else if (reportType === 'deposit_account') {
                const parsed = parseDepositAccount(section, replacementRules);
                allDepositData.push(...parsed);
            } else { 
                // Fallback: try parsing as credit card first
                const rawParsed = parseCreditCard(section);
                if (rawParsed.length > 0) {
                    const processedPromises = rawParsed.map(entry => processSingleCreditEntry(entry, replacementRules));
                    const processedEntries = (await Promise.all(processedPromises)).filter((e): e is CreditData => e !== null);
                    allCreditData.push(...processedEntries);
                } else {
                    // Then try as deposit account if credit parsing yields nothing
                    const depositParsed = parseDepositAccount(section, replacementRules);
                    if (depositParsed.length > 0) allDepositData.push(...depositParsed);
                }
            }
        }
        
        return { success: true, creditData: allCreditData, depositData: allDepositData };
    } catch (e) {
        console.error("Error processing bank statement:", e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
        return { success: false, creditData: [], depositData: [], error };
    }
}
