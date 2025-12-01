'use server';

/**
 * @fileOverview This file defines a Genkit flow to categorize a bank transaction based on its description.
 *
 * It exports:
 * - `categorizeTransaction`: An async function that takes a description and returns a category.
 * - `CategorizeTransactionInput`: The input type for the categorizeTransaction function.
 * - `CategorizeTransactionOutput`: The output type for the categorizeTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeTransactionInputSchema = z.object({
  description: z.string().describe('The transaction description from the bank statement.'),
});
export type CategorizeTransactionInput = z.infer<typeof CategorizeTransactionInputSchema>;

const CategorizeTransactionOutputSchema = z.object({
  category: z
    .enum(['餐飲', '交通', '購物', '居家', '娛樂', '固定支出', '醫療', '雜項', '其他'])
    .describe('The determined category of the transaction.'),
});
export type CategorizeTransactionOutput = z.infer<typeof CategorizeTransactionOutputSchema>;

export async function categorizeTransaction(input: CategorizeTransactionInput): Promise<CategorizeTransactionOutput> {
  return categorizeTransactionFlow(input);
}

const categorizeTransactionPrompt = ai.definePrompt({
  name: 'categorizeTransactionPrompt',
  input: {schema: CategorizeTransactionInputSchema},
  output: {schema: CategorizeTransactionOutputSchema},
  prompt: `You are an expert personal finance assistant. Your task is to categorize a transaction based on its description.
  Use one of the following categories: 餐飲, 交通, 購物, 居家, 娛樂, 固定支出, 醫療, 雜項, 其他.

  Analyze the following transaction description:
  "{{{description}}}"

  Based on the description, determine the most appropriate category. For example:
  - "新東陽忠孝一門市" or "元心燃麻辣堂" should be "餐飲".
  - "陽光市民加油站" or "悠遊卡自動加值" should be "交通".
  - "全支付﹘全聯" or "ＩＫＥＡ" should be "居家".
  - "麗冠有線電視" or "台灣電力公司" should be "固定支出".
  - "國外交易服務費" or "REPLIT" should be "雜項".
  - If you cannot determine a specific category, use "其他".

  Return only the "category" field.
  `,
});

const categorizeTransactionFlow = ai.defineFlow(
  {
    name: 'categorizeTransactionFlow',
    inputSchema: CategorizeTransactionInputSchema,
    outputSchema: CategorizeTransactionOutputSchema,
  },
  async input => {
    // If the description is very short or generic, return a default category to save AI calls
    if (input.description.trim().length < 2 || input.description.includes('國外交易服務費')) {
      return { category: '雜項' };
    }
    const {output} = await categorizeTransactionPrompt(input);
    return output!;
  }
);
