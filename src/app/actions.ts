'use server';

import { detectReportType } from '@/ai/flows/detect-report-type';
import { parseCreditCard, parseDepositAccount, type CreditData, type DepositData, type RawCreditData } from '@/lib/parser';
import { randomUUID } from 'crypto';

export type ReplacementRule = {
    find: string;
    replace: string;
    deleteRow?: boolean;
};

export type CategoryRule = {
    keyword: string;
    category: string;
};

function applyReplacementRules(description: string, rules: ReplacementRule[]): { processedText: string, shouldDelete: boolean } {
    let processedText = description;
    let shouldDelete = false;

    for (const rule of rules) {
        if (rule.find && description.includes(rule.find)) {
            if (rule.deleteRow) {
                shouldDelete = true;
                break;
            }
            processedText = processedText.replace(new RegExp(rule.find, 'g'), rule.replace);
        }
    }
    return { processedText, shouldDelete };
}


function applyCategoryRules(description: string, postingDate: string, rules: CategoryRule[]): string {
    for (const rule of rules) {
        if (rule.keyword && description.includes(rule.keyword)) {
            return rule.category;
        }
    }
    // If no rules match, return a default or empty category
    return '未分類';
}

async function processSingleCreditEntry(entry: RawCreditData, replacementRules: ReplacementRule[], categoryRules: CategoryRule[]): Promise<CreditData | null> {
    const { processedText: description, shouldDelete } = applyReplacementRules(entry.description, replacementRules);
    
    if (shouldDelete || !description.trim()) {
        return null;
    }
    
    const category = applyCategoryRules(description, entry.postingDate, categoryRules);

    return {
        id: randomUUID(),
        transactionDate: entry.transactionDate,
        category: category,
        description: description,
        amount: entry.amount,
    };
}


export async function processBankStatement(
    text: string, 
    replacementRules: ReplacementRule[],
    categoryRules: CategoryRule[]
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
                const processedPromises = rawParsed.map(entry => processSingleCreditEntry(entry, replacementRules, categoryRules));
                const processedEntries = (await Promise.all(processedPromises)).filter((e): e is CreditData => e !== null);
                allCreditData.push(...processedEntries);

            } else if (reportType === 'deposit_account') {
                const parsed = parseDepositAccount(section, replacementRules, categoryRules);
                allDepositData.push(...parsed);
            } else { 
                // Fallback: try parsing as credit card first
                const rawParsed = parseCreditCard(section);
                if (rawParsed.length > 0) {
                    const processedPromises = rawParsed.map(entry => processSingleCreditEntry(entry, replacementRules, categoryRules));
                    const processedEntries = (await Promise.all(processedPromises)).filter((e): e is CreditData => e !== null);
                    allCreditData.push(...processedEntries);
                } else {
                    // Then try as deposit account if credit parsing yields nothing
                    const depositParsed = parseDepositAccount(section, replacementRules, categoryRules);
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
