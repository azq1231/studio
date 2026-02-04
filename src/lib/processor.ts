
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

function applyReplacementRules(text: string | undefined, rules: ReplacementRule[]): { processedText: string, shouldDelete: boolean, capturedText?: string } {
    if (text === undefined) {
        return { processedText: '', shouldDelete: false };
    }

    let processedText = text;
    let shouldDelete = false;
    let capturedText: string | undefined = undefined;

    for (const rule of rules) {
        if (!rule.find) continue;

        try {
            // 嘗試作為正則表達式匹配
            const regex = new RegExp(rule.find, 'g');
            const match = regex.exec(processedText);

            if (match) {
                if (rule.deleteRow) {
                    shouldDelete = true;
                    break;
                }

                // 如果匹配中包含捕獲組 (Capturing Groups)，提取第一組
                // 注意：match[0] 是完整匹配，match[1] 是第一組捕獲
                if (match.length > 1 && match[1]) {
                    capturedText = match[1];
                }

                // 執行取代
                processedText = processedText.replace(regex, rule.replace);
            }
        } catch (e) {
            // 如果不是有效的正則表達式，回退到字串包含檢查
            if (processedText.includes(rule.find)) {
                if (rule.deleteRow) {
                    shouldDelete = true;
                    break;
                }
                processedText = processedText.replace(new RegExp(rule.find, 'g'), rule.replace);
            }
        }
    }
    return { processedText: processedText.trim(), shouldDelete, capturedText };
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

// Helper to deduplicate IDs within a single batch
function deduplicateBatchIds<T extends { id: string }>(items: T[]): T[] {
    const idCounts = new Map<string, number>();
    return items.map(item => {
        const count = idCounts.get(item.id) || 0;
        idCounts.set(item.id, count + 1);

        if (count > 0) {
            // If duplicate in batch, append suffix to make it unique
            // e.g., "id123" -> "id123-dup-1"
            return {
                ...item,
                id: `${item.id}-dup-${count}`
            };
        }
        return item;
    });
}

export async function processBankStatement(
    text: string,
    replacementRules: ReplacementRule[],
    categoryRules: CategoryRule[],
    existingCreditData: CreditData[],
    existingDepositData: DepositData[],
    existingCashData: CashData[],
    isExcelUpload: boolean = false,
    excelData?: any[][]
): Promise<{
    success: boolean;
    creditData: CreditData[];
    depositData: DepositData[];
    cashData: CashData[];
    detectedCategories: string[];
    skippedDuplicates: { credit: number; deposit: number; cash: number };
    error?: string;
}> {
    if (!text && !isExcelUpload) {
        return { success: false, creditData: [], depositData: [], cashData: [], detectedCategories: [], skippedDuplicates: { credit: 0, deposit: 0, cash: 0 }, error: "No text provided." };
    }

    try {
        const detectedCategories = new Set<string>();
        let allCreditData: CreditData[] = [];
        let allDepositData: DepositData[] = [];
        let allCashData: CashData[] = [];
        const skippedDuplicates = { credit: 0, deposit: 0, cash: 0 };

        // 建立現有資料的 ID 快速查找表
        const existingCreditIds = new Set(existingCreditData.map(d => d.id));
        const existingDepositIds = new Set(existingDepositData.map(d => d.id));
        const existingCashIds = new Set(existingCashData.map(d => d.id));
        const existingCreditDataMap = new Map<string, CreditData>(existingCreditData.map(d => [d.id, d]));

        if (isExcelUpload && excelData) {
            const parsedDataFromExcel = await parseExcelData(excelData);

            // 1. Batch Deduplication (Fix for duplicate rows in same file)
            const uniqueBatchCredit = deduplicateBatchIds(parsedDataFromExcel.creditData);
            const uniqueBatchDeposit = deduplicateBatchIds(parsedDataFromExcel.depositData);
            const uniqueBatchCash = deduplicateBatchIds(parsedDataFromExcel.cashData);

            // 過濾掉已存在的資料
            const newCreditData = uniqueBatchCredit.filter(d => {
                if (existingCreditIds.has(d.id)) {
                    skippedDuplicates.credit++;
                    return false;
                }
                return true;
            });
            const newDepositData = uniqueBatchDeposit.filter(d => {
                if (existingDepositIds.has(d.id)) {
                    skippedDuplicates.deposit++;
                    return false;
                }
                return true;
            });
            const newCashData = uniqueBatchCash.filter(d => {
                if (existingCashIds.has(d.id)) {
                    skippedDuplicates.cash++;
                    return false;
                }
                return true;
            });

            allCreditData = newCreditData;
            allDepositData = newDepositData;
            allCashData = newCashData;
            parsedDataFromExcel.detectedCategories.forEach(c => detectedCategories.add(c));
        } else {
            // 1. Parse raw text into structured data with stable IDs
            const rawCreditParsed: RawCreditData[] = await parseCreditCard(text);
            const rawDepositParsed = await parseDepositAccount(text);

            // 2. Batch Deduplication (Fix for duplicate rows in same paste)
            // Even locally identical rows will now get unique IDs (id, id-dup-1, id-dup-2...)
            // BEFORE we check against the database.
            const uniqueBatchCreditRaw = deduplicateBatchIds(rawCreditParsed);
            const uniqueBatchDepositRaw = deduplicateBatchIds(rawDepositParsed);

            // 3. Process credit card entries
            const processedCreditPromises = uniqueBatchCreditRaw.map(async (rawEntry): Promise<CreditData | null> => {
                // 檢查是否已存在
                if (existingCreditIds.has(rawEntry.id)) {
                    skippedDuplicates.credit++;
                    return null;
                }

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

            // 4. Process deposit account entries by applying rules
            const processedDepositPromises = uniqueBatchDepositRaw.map(async (entry): Promise<DepositData | null> => {
                // 檢查是否已存在
                if (existingDepositIds.has(entry.id)) {
                    skippedDuplicates.deposit++;
                    return null;
                }

                // Apply rules to both description and bankCode
                const { processedText: processedDescription, shouldDelete, capturedText: capturedFromDesc } = applyReplacementRules(entry.description, replacementRules);
                if (shouldDelete) return null;

                const { processedText: processedBankCode, capturedText: capturedFromBankCode } = applyReplacementRules(entry.bankCode, replacementRules);

                const category = applyCategoryRules(processedDescription, categoryRules);
                detectedCategories.add(category);

                // 整合捕獲到的文字到 bankCode
                let finalBankCode = processedBankCode;
                const captured = capturedFromDesc || capturedFromBankCode;
                if (captured) {
                    finalBankCode = finalBankCode ? `${finalBankCode} (${captured})` : captured;
                }

                return {
                    ...entry,
                    description: processedDescription,
                    bankCode: finalBankCode,
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
            detectedCategories: Array.from(detectedCategories),
            skippedDuplicates
        };

    } catch (e) {
        console.error("Error processing bank statement:", e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
        return { success: false, creditData: [], depositData: [], cashData: [], detectedCategories: [], skippedDuplicates: { credit: 0, deposit: 0, cash: 0 }, error };
    }
}
