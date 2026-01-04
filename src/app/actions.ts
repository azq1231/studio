'use server';

import { parseCreditCard, parseDepositAccount, type CreditData, type DepositData, type CashData, type RawCreditData, parseExcelData } from '@/lib/parser';

export type ReplacementRule = {
    find: string;
    replace: string;
    deleteRow?: boolean;
    notes?: string;
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


function applyCategoryRules(description: string, rules: CategoryRule[]): string {
    for (const rule of rules) {
        if (rule.keyword && description.includes(rule.keyword)) {
            return rule.category;
        }
    }
    // If no rules match, return a default or empty category
    return '未分類';
}

export async function processBankStatement(
    text: string, 
    replacementRules: ReplacementRule[],
    categoryRules: CategoryRule[],
    existingCreditData: CreditData[],
    isExcelUpload: boolean = false,
    excelData?: any[][]
): Promise<{
    success: boolean;
    creditData: CreditData[];
    depositData: DepositData[];
    cashData: CashData[];
    detectedCategories: string[];
    error?: string;
}> {
    if (!text && !isExcelUpload) {
        return { success: false, creditData: [], depositData: [], cashData: [], detectedCategories: [], error: "No text provided." };
    }

    try {
        const detectedCategories = new Set<string>();
        let allCreditData: CreditData[] = [];
        let allDepositData: DepositData[] = [];
        let allCashData: CashData[] = [];

        const existingCreditDataMap = new Map<string, CreditData>(existingCreditData.map(d => [d.id, d]));

        if (isExcelUpload && excelData) {
            const parsedDataFromExcel = await parseExcelData(excelData);
            // Excel data is assumed to be clean and categorized, so we pass it through.
            allCreditData = parsedDataFromExcel.creditData;
            allDepositData = parsedDataFromExcel.depositData;
            allCashData = parsedDataFromExcel.cashData;
            parsedDataFromExcel.detectedCategories.forEach(c => detectedCategories.add(c));
        } else {
             // 1. Parse raw text into structured data with stable IDs
            const rawCreditParsed: RawCreditData[] = await parseCreditCard(text);
            const rawDepositParsed = await parseDepositAccount(text);

            // 2. Process credit card entries
            const processedCreditPromises = rawCreditParsed.map(async (rawEntry): Promise<CreditData | null> => {
                const { processedText: processedDescription, shouldDelete } = applyReplacementRules(rawEntry.description, replacementRules);
                
                if (shouldDelete || !processedDescription.trim()) {
                    return null;
                }

                // Check if this entry already exists in the user's data
                const existingEntry = existingCreditDataMap.get(rawEntry.id);

                let finalCategory: string;
                if (existingEntry) {
                    // If it exists, KEEP the user's manually set category.
                    finalCategory = existingEntry.category;
                } else {
                    // If it's a new entry, try to apply rules or use the initial category from the statement.
                    const categoryFromRules = applyCategoryRules(processedDescription, categoryRules);
                    if (categoryFromRules !== '未分類') {
                        finalCategory = categoryFromRules;
                    } else if (rawEntry.initialCategory) {
                        finalCategory = rawEntry.initialCategory;
                    } else {
                        finalCategory = '未分類';
                    }
                }
                
                if (finalCategory) detectedCategories.add(finalCategory);

                return {
                    id: rawEntry.id,
                    transactionDate: rawEntry.transactionDate,
                    category: finalCategory,
                    description: processedDescription,
                    amount: rawEntry.amount,
                    bankCode: rawEntry.bankCode
                };
            });

            const processedCreditData = (await Promise.all(processedCreditPromises)).filter((e): e is CreditData => e !== null);
            allCreditData = processedCreditData;

            // 3. Process deposit account entries by applying rules
            const processedDepositPromises = rawDepositParsed.map(async (entry) => {
                const { processedText, shouldDelete } = applyReplacementRules(entry.description, replacementRules);
                if (shouldDelete) return null;

                const category = applyCategoryRules(processedText, categoryRules);
                detectedCategories.add(category);
                
                return {
                    ...entry,
                    description: processedText,
                    category: category
                };
            });
            allDepositData = (await Promise.all(processedDepositPromises)).filter((e): e is DepositData => e !== null);
        }
        
        return { 
            success: true, 
            creditData: allCreditData, 
            depositData: allDepositData, 
            cashData: allCashData,
            detectedCategories: Array.from(detectedCategories) 
        };

    } catch (e) {
        console.error("Error processing bank statement:", e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
        return { success: false, creditData: [], depositData: [], cashData: [], detectedCategories: [], error };
    }
}
