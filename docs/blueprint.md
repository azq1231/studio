# **App Name**: FinanceFlow

## Core Features:

- Report Parsing: Parse the pasted bank statement text to extract relevant financial data such as transaction date, description, and amount.
- Credit Card Data Extraction: Extract data from credit card statements, identifying transaction date, posting date, transaction details, and amounts.
- Deposit Account Data Extraction: Extract data from deposit account statements, distinguishing between withdrawals and deposits, and handling special cases based on predefined rules.
- Data Formatting and Structuring: Format extracted data into a structured format suitable for further processing and analysis, mimicking the structure used in the provided Python example (Pandas DataFrames).
- Intelligent Report Type Detection: Use an AI tool to intelligently detect whether the pasted text is a credit card statement or a deposit account statement, and route it to the appropriate parsing function. 
- Downloadable Report: Allow the user to download a .xlsx formatted file containing the parsed financial data.

## Style Guidelines:

- Primary color: Soft blue (#79B4B7) for a sense of trustworthiness and calm.
- Background color: Very light desaturated blue (#F0F8FF).
- Accent color: Muted purple (#9370DB) for highlighting key data and calls to action.
- Font: 'Inter' (sans-serif) for clear and modern readability in both headings and body text.
- Use simple, minimalist icons to represent different transaction types and categories.
- Use a clean, tabular layout to display the parsed financial data, with clear separation between columns and rows.