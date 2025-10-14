'use server';

import { detectReportType } from '@/ai/flows/detect-report-type';
import { parseCreditCard, parseDepositAccount, type CreditData, type DepositData } from '@/lib/parser';

type ReplacementRule = {
    find: string;
    replace: string;
};

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
        let processedText = text;
        for (const rule of replacementRules) {
            if (rule.find) {
                processedText = processedText.replace(new RegExp(rule.find, 'g'), rule.replace);
            }
        }
        
        const sections = processedText.split(/(?=交易日期)/).filter(s => s.trim() !== '');
        let allCreditData: CreditData[] = [];
        let allDepositData: DepositData[] = [];

        for (const section of sections) {
            const { reportType } = await detectReportType({ text: section });

            if (reportType === 'credit_card') {
                const parsed = parseCreditCard(section);
                allCreditData.push(...parsed);
            } else if (reportType === 'deposit_account') {
                const parsed = parseDepositAccount(section);
                allDepositData.push(...parsed);
            } else { // 'unknown' or if AI fails, try both as a fallback
                const creditParsed = parseCreditCard(section);
                if (creditParsed.length > 0) allCreditData.push(...creditParsed);
                
                const depositParsed = parseDepositAccount(section);
                if (depositParsed.length > 0) allDepositData.push(...depositParsed);
            }
        }
        
        return { success: true, creditData: allCreditData, depositData: allDepositData };
    } catch (e) {
        console.error("Error processing bank statement:", e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
        return { success: false, creditData: [], depositData: [], error };
    }
}
