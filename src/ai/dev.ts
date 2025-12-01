'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/detect-report-type.ts';
import '@/ai/flows/categorize-transaction.ts';
