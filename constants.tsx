
import { Account, NaturalBalance, FinancialStatement, AccountClassification } from './types';

export const INITIAL_ACCOUNTS: Account[] = [
  { id: '1', name: 'Cash', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.CURRENT_ASSET, startingBalance: 0 },
  { id: '2', name: 'Accounts Receivable', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.CURRENT_ASSET, startingBalance: 0 },
  { id: '3', name: 'Inventory', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.CURRENT_ASSET, startingBalance: 0 },
  { id: '4', name: 'Equipment', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.LONG_TERM_ASSET, startingBalance: 0 },
  { id: '5', name: 'Credit Cards', naturalBalance: NaturalBalance.CREDIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.CURRENT_LIABILITY, startingBalance: 0 },
  { id: '6', name: 'Benson, Contributions', naturalBalance: NaturalBalance.CREDIT, financialStatement: FinancialStatement.BALANCE_SHEET, classification: AccountClassification.EQUITY, startingBalance: 0 },
  { id: '7', name: 'Revenue', naturalBalance: NaturalBalance.CREDIT, financialStatement: FinancialStatement.INCOME_STATEMENT, classification: AccountClassification.REVENUE, startingBalance: 0 },
  { id: '8', name: 'Cost of Goods Sold', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.INCOME_STATEMENT, classification: AccountClassification.COGS, startingBalance: 0 },
  { id: '9', name: 'Supplies Expense', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.INCOME_STATEMENT, classification: AccountClassification.OPERATING_EXPENSE, startingBalance: 0 },
  { id: '10', name: 'Subscriptions Expense', naturalBalance: NaturalBalance.DEBIT, financialStatement: FinancialStatement.INCOME_STATEMENT, classification: AccountClassification.OPERATING_EXPENSE, startingBalance: 0 },
  { id: '11', name: 'Income Summary', naturalBalance: NaturalBalance.CREDIT, financialStatement: FinancialStatement.OFF_STATEMENT, classification: AccountClassification.TEMPORARY_ACCOUNT, startingBalance: 0 },
];

export const CLASSIFICATIONS = Object.values(AccountClassification);
export const STATEMENTS = Object.values(FinancialStatement);

export const STATEMENT_CLASSIFICATION_MAP: Record<FinancialStatement, AccountClassification[]> = {
  [FinancialStatement.BALANCE_SHEET]: [
    AccountClassification.CURRENT_ASSET,
    AccountClassification.LONG_TERM_ASSET,
    AccountClassification.CURRENT_LIABILITY,
    AccountClassification.LONG_TERM_LIABILITY,
    AccountClassification.EQUITY,
  ],
  [FinancialStatement.INCOME_STATEMENT]: [
    AccountClassification.REVENUE,
    AccountClassification.COGS,
    AccountClassification.OPERATING_EXPENSE,
    AccountClassification.OTHER_INCOME_EXPENSE,
  ],
  [FinancialStatement.OFF_STATEMENT]: [
    AccountClassification.CLEARING_ACCOUNT,
    AccountClassification.TEMPORARY_ACCOUNT,
  ],
};
