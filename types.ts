
export enum NaturalBalance {
  DEBIT = 'DR',
  CREDIT = 'CR'
}

export enum FinancialStatement {
  BALANCE_SHEET = 'Balance Sheet',
  INCOME_STATEMENT = 'Income Statement',
  OFF_STATEMENT = 'Off-Statement (Internal/Clearing)'
}

export enum AccountClassification {
  CURRENT_ASSET = 'Current Asset',
  LONG_TERM_ASSET = 'Long-Term Asset',
  CURRENT_LIABILITY = 'Current Liability',
  LONG_TERM_LIABILITY = 'Long-Term Liability',
  EQUITY = 'Equity',
  REVENUE = 'Revenue',
  COGS = 'Cost of Goods Sold',
  OPERATING_EXPENSE = 'Operating Expenses',
  OTHER_INCOME_EXPENSE = 'Other Income (Expenses)',
  CLEARING_ACCOUNT = 'Clearing Account',
  TEMPORARY_ACCOUNT = 'Temporary Account'
}

export interface Account {
  id: string;
  name: string;
  naturalBalance: NaturalBalance;
  financialStatement: FinancialStatement;
  classification: AccountClassification;
  startingBalance: number; // Balance forward anchor
  isArchived?: boolean;
}

export interface PaymentMethod {
  name: string;
  accountId: string;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

export interface JournalEntry {
  id: number;
  date: string;
  method: string;
  lines: JournalEntryLine[];
  isClosingEntry?: boolean;
}

export type AmazonCategory = 
  | 'Settlement expense'
  | 'COGS'
  | 'Revenue'
  | 'Selling fees'
  | 'Account subscription'
  | 'FBM shipping fees'
  | 'Other'
  | 'Other fees'
  | 'FBA fees other'
  | 'FBA shipping fees'
  | 'FBA storage fees'
  | 'FBA fees'
  | 'COGS reversal'
  | 'Inbound shipping fees'
  | 'Transfer'
  | 'FBA reimbursement'
  | 'Return fees'
  | 'Advertising fees'
  | 'FBA disposal fees'
  | 'AWD fees';

export interface AmazonAnalysisRecord {
  id: string;
  date: string; // ISO or human readable used for period grouping
  sku: string;
  orderId: string;
  type: string;
  description: string;
  category: AmazonCategory;
  amount: number;
  quantity: number;
}

export interface SkuInfo {
  name: string;
  cost: number;
}

export interface SkuDataMap {
  [sku: string]: SkuInfo;
}

export type TabType = 
  | 'Dashboard'
  | 'Transaction Recorder' 
  | 'General Journal' 
  | 'Ledgers' 
  | 'BS' 
  | 'IS' 
  | 'CF' 
  | 'Trial Balance'
  | 'Amazon Analysis'
  | 'COGS Manager'
  | 'Closing Manager'
  | 'Data Manager';
