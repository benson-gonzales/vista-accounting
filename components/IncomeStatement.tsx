
import React, { useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, AccountClassification, FinancialStatement } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  companyName: string;
}

const IncomeStatement: React.FC<Props> = ({ transactions = [], accounts = [], companyName }) => {
  const sortedPeriods = useMemo(() => {
    const periods = new Set<string>();
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      if (!isNaN(date.getTime())) {
        periods.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(periods).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const getMonthlyActivity = (accountId: string, period: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    
    let activity = 0;
    const [year, month] = period.split('-').map(Number);

    // EXCLUDE CLOSING ENTRIES
    transactions.filter(tx => !tx.isClosingEntry).forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === year && (txDate.getMonth() + 1) === month) {
        tx.lines.forEach(l => {
          if (l.accountId === accountId) {
            if (account.naturalBalance === NaturalBalance.DEBIT) activity += (l.debit - l.credit);
            else activity += (l.credit - l.debit);
          }
        });
      }
    });
    return activity;
  };

  const isAccounts = accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT);

  const calculateMonthlyNet = (period: string) => {
    let rev = 0;
    let exp = 0;
    isAccounts.forEach(acc => {
      const act = getMonthlyActivity(acc.id, period);
      if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) {
        rev += act;
      } else {
        exp += act;
      }
    });
    return rev - exp;
  };

  if (sortedPeriods.length === 0) {
    return (
      <div className="p-20 text-center text-slate-400 italic bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <p className="text-lg font-bold mb-2 text-slate-700 tracking-tight">Report Ready</p>
        <p className="text-sm">Record transactions to see monthly revenue and expense performance columns.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{companyName}</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Income Statement (Closed Entries Excluded)</p>
      </div>

      <div className="overflow-x-auto border rounded-2xl shadow-xl bg-white">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 text-left w-72 border-r border-slate-800 text-[10px] font-black uppercase tracking-widest">Income Category</th>
              {sortedPeriods.map(p => (
                <th key={p} className="p-4 text-right text-[10px] uppercase font-black tracking-widest border-r border-slate-800">
                  {new Date(p + "-02").toLocaleString('default', { month: 'short', year: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { title: "Revenue", type: AccountClassification.REVENUE, color: "text-emerald-700" },
              { title: "Cost of Goods Sold", type: AccountClassification.COGS, color: "text-amber-700" },
              { title: "Operating Expenses", type: AccountClassification.OPERATING_EXPENSE, color: "text-slate-700" },
              { title: "Other Income / (Exp)", type: AccountClassification.OTHER_INCOME_EXPENSE, color: "text-indigo-700" }
            ].map(section => (
              <React.Fragment key={section.title}>
                <tr className="bg-slate-50 border-t border-slate-100">
                  <td className="p-2.5 font-black text-slate-900 text-[9px] tracking-widest uppercase">{section.title}</td>
                  {sortedPeriods.map(p => <td key={p} className="p-2 border-r border-slate-100"></td>)}
                </tr>
                {isAccounts.filter(a => a.classification === section.type).map(acc => (
                  <tr key={acc.id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">{acc.name}</td>
                    {sortedPeriods.map(p => (
                      <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">
                        {getMonthlyActivity(acc.id, p).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            
            <tr className="h-10"></tr>
            <tr className="bg-slate-900 text-white font-bold border-y-2 border-slate-900 shadow-inner">
              <td className="p-4 text-xs uppercase tracking-[0.2em] border-r border-slate-700">NET PERIOD INCOME</td>
              {sortedPeriods.map(p => {
                const net = calculateMonthlyNet(p);
                return (
                  <td key={p} className={`p-4 text-right font-mono text-sm border-r border-slate-700 ${net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    ${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IncomeStatement;
