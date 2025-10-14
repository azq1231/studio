'use server';

/**
 * @fileOverview This file defines a Genkit flow to detect the type of bank report (credit card or deposit account).
 *
 * It exports:
 * - `detectReportType`: An async function that takes text as input and returns the detected report type.
 * - `DetectReportTypeInput`: The input type for the detectReportType function.
 * - `DetectReportTypeOutput`: The output type for the detectReportType function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectReportTypeInputSchema = z.object({
  text: z.string().describe('The bank statement text to analyze.'),
});
export type DetectReportTypeInput = z.infer<typeof DetectReportTypeInputSchema>;

const DetectReportTypeOutputSchema = z.object({
  reportType: z
    .enum(['credit_card', 'deposit_account', 'unknown'])
    .describe('The detected type of bank report.'),
});
export type DetectReportTypeOutput = z.infer<typeof DetectReportTypeOutputSchema>;

export async function detectReportType(input: DetectReportTypeInput): Promise<DetectReportTypeOutput> {
  return detectReportTypeFlow(input);
}

const detectReportTypePrompt = ai.definePrompt({
  name: 'detectReportTypePrompt',
  input: {schema: DetectReportTypeInputSchema},
  output: {schema: DetectReportTypeOutputSchema},
  prompt: `You are an expert in financial document analysis.
  Your task is to determine whether the provided text is a credit card statement or a deposit account statement.
  If you cannot determine the type of statement, return \"unknown\".

  Analyze the following text:
  {{text}}

  Return the \"reportType\" field as either \"credit_card\" or \"deposit_account\" or \"unknown\". Do not return any other fields.
  Ensure that the reportType is one of the enum values.
  `,
});

const detectReportTypeFlow = ai.defineFlow(
  {
    name: 'detectReportTypeFlow',
    inputSchema: DetectReportTypeInputSchema,
    outputSchema: DetectReportTypeOutputSchema,
  },
  async input => {
    const {output} = await detectReportTypePrompt(input);
    return output!;
  }
);
