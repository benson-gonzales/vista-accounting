import React, { useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, AccountClassification, FinancialStatement } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  companyName: string;
}

const BalanceSheet: React.FC<Props> = ({ transactions = [], accounts = [], companyName }) => {
  const sortedPeriods = useMemo(() => {
    const periods = new Set<string>();
    transactions.forEach(tx => {
      const dateParts = tx.date.split('-');
      if (dateParts.length >= 2) {
        periods.add(`${dateParts[0]}-${dateParts[1]}`);
      }
    });
    return ["Opening", ...Array.from(periods).sort((a, b) => a.localeCompare(b))];
  }, [transactions]);

  const getCumulativeBalance = (accountId: string, upToPeriod: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    
    let balance = Number(account.startingBalance) || 0;
    if (upToPeriod === "Opening") return balance;

    const [year, month] = upToPeriod.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const cutoffStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    transactions.forEach(tx => {
      if (tx.date <= cutoffStr) {
        tx.lines.forEach(l => {
          if (l.accountId === accountId) {
            if (account.naturalBalance === NaturalBalance.DEBIT) balance += (l.debit - l.credit);
            else balance += (l.credit - l.debit);
          }
        });
      }
    });
    return balance;
  };

  /**
   * Strictly calculates Net Income for unclosed periods.
   * Net Income = (Sum of Credits to IS accounts) - (Sum of Debits to IS accounts)
   * This ignores Assets, Liabilities, and Equity (Distributions/Contributions).
   */
  const getUnclosedEarningsForSnapshot = (period: string) => {
    if (period === "Opening") return 0;
    
    const isAccounts = accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT);
    let totalCredits = 0;
    let totalDebits = 0;

    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const cutoffStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const isAccountIds = new Set(isAccounts.map(a => a.id));

    transactions.forEach(tx => {
      if (tx.date <= cutoffStr) {
        tx.lines.forEach(l => {
          if (isAccountIds.has(l.accountId)) {
            totalDebits += l.debit;
            totalCredits += l.credit;
          }
        });
      }
    });

    // Net Income for a snapshot is the accumulated balance of all Income Statement accounts.
    // Credits (Revenue) - Debits (Expenses).
    return totalCredits - totalDebits;
  };

  const bsAccounts = accounts.filter(a => 
    a.financialStatement === FinancialStatement.BALANCE_SHEET && 
    !a.name.toLowerCase().includes('retained earnings')
  );

  const calculateClassTotal = (classification: AccountClassification, upToPeriod: string) => {
    return bsAccounts
      .filter(a => a.classification === classification)
      .reduce((sum, a) => {
        const bal = getCumulativeBalance(a.id, upToPeriod);
        if (classification === AccountClassification.EQUITY || 
            classification === AccountClassification.CURRENT_LIABILITY || 
            classification === AccountClassification.LONG_TERM_LIABILITY) {
          return sum + (a.naturalBalance === NaturalBalance.CREDIT ? bal : -bal);
        }
        return sum + bal;
      }, 0);
  };

  const partnerGroups = useMemo(() => {
    const equityAccounts = bsAccounts.filter(a => a.classification === AccountClassification.EQUITY);
    const groups: Record<string, Account[]> = {};
    const ungrouped: Account[] = [];

    equityAccounts.forEach(acc => {
      const parts = acc.name.split(/ - |,/);
      if (parts.length > 1) {
        const partnerName = parts[0].trim();
        if (!groups[partnerName]) groups[partnerName] = [];
        groups[partnerName].push(acc);
      } else {
        ungrouped.push(acc);
      }
    });
    return { groups, ungrouped };
  }, [bsAccounts]);

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{companyName}</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Balance Sheet (Financial Position)</p>
      </div>

      <div className="overflow-x-auto border rounded-2xl shadow-xl bg-white">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 text-left w-64 border-r border-slate-800 text-[10px] font-black uppercase tracking-widest">Account Classification</th>
              {sortedPeriods.map(p => (
                <th key={p} className={`p-4 text-right text-[10px] uppercase font-black tracking-widest border-r border-slate-800 ${p === 'Opening' ? 'bg-slate-800' : ''}`}>
                  {p === 'Opening' ? 'Opening' : new Date(p + "-02").toLocaleString('default', { month: 'short', year: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50"><td colSpan={sortedPeriods.length + 1} className="p-3 font-black text-slate-900 text-[10px] tracking-widest uppercase border-b">1. ASSETS</td></tr>
            {[AccountClassification.CURRENT_ASSET, AccountClassification.LONG_TERM_ASSET].map(cls => (
              <React.Fragment key={cls}>
                <tr className="bg-white"><td className="p-2 pl-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest border-r">{cls}s</td>{sortedPeriods.map(p => <td key={p} className="border-r border-slate-100"></td>)}</tr>
                {bsAccounts.filter(a => a.classification === cls).map(acc => (
                  <tr key={acc.id} className="border-b hover:bg-slate-50/50">
                    <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">{acc.name}</td>
                    {sortedPeriods.map(p => (
                      <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 ${p === 'Opening' ? 'text-slate-400 italic' : ''}`}>
                        {getCumulativeBalance(acc.id, p).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="bg-slate-900 text-white font-bold border-y-2 border-slate-900">
              <td className="p-4 text-xs uppercase tracking-[0.2em] border-r border-slate-700">TOTAL ASSETS</td>
              {sortedPeriods.map(p => {
                const total = calculateClassTotal(AccountClassification.CURRENT_ASSET, p) + calculateClassTotal(AccountClassification.LONG_TERM_ASSET, p);
                return <td key={p} className="p-4 text-right font-mono text-sm border-r border-slate-700">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              })}
            </tr>

            <tr className="h-10"></tr>
            
            <tr className="bg-slate-50"><td colSpan={sortedPeriods.length + 1} className="p-3 font-black text-slate-900 text-[10px] tracking-widest uppercase border-b">2. LIABILITIES & EQUITY</td></tr>
            <tr className="bg-white"><td className="p-2 pl-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest border-r">Liabilities</td>{sortedPeriods.map(p => <td key={p} className="border-r border-slate-100"></td>)}</tr>
            {[AccountClassification.CURRENT_LIABILITY, AccountClassification.LONG_TERM_LIABILITY].map(cls => (
              bsAccounts.filter(a => a.classification === cls).map(acc => (
                <tr key={acc.id} className="border-b hover:bg-slate-50/50">
                  <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">{acc.name}</td>
                  {sortedPeriods.map(p => (
                    <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">
                      {getCumulativeBalance(acc.id, p).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
              ))
            ))}

            <tr className="bg-white border-t border-slate-100"><td className="p-2 pl-4 font-bold text-slate-400 uppercase text-[9px] tracking-widest border-r">Partnership Equity</td>{sortedPeriods.map(p => <td key={p} className="border-r border-slate-100"></td>)}</tr>
            
            {(Object.entries(partnerGroups.groups) as [string, Account[]][]).map(([partner, accs]) => (
              <React.Fragment key={partner}>
                {accs.map(acc => (
                  <tr key={acc.id} className="border-b hover:bg-slate-50/50">
                    <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">{acc.name}</td>
                    {sortedPeriods.map(p => (
                      <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">
                        {getCumulativeBalance(acc.id, p).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-slate-50/50 font-black border-b border-slate-200">
                  <td className="p-2.5 pl-6 text-[10px] uppercase text-slate-900 border-r border-slate-100">Total {partner} Capital</td>
                  {sortedPeriods.map(p => {
                    const groupSum = accs.reduce((sum, a) => {
                      const bal = getCumulativeBalance(a.id, p);
                      return sum + (a.naturalBalance === NaturalBalance.CREDIT ? bal : -bal);
                    }, 0);
                    return <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100 text-blue-700 bg-blue-50/20">${groupSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  })}
                </tr>
              </React.Fragment>
            ))}

            {partnerGroups.ungrouped.map(acc => (
              <tr key={acc.id} className="border-b hover:bg-slate-50/50">
                <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">{acc.name}</td>
                {sortedPeriods.map(p => (
                  <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">
                    {getCumulativeBalance(acc.id, p).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b bg-emerald-50/10">
              <td className="p-2.5 pl-8 text-xs font-black text-emerald-800 italic border-r border-slate-100">Current period earnings</td>
              {sortedPeriods.map(p => {
                const snapshotEarnings = getUnclosedEarningsForSnapshot(p);
                return (
                  <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 font-black ${p === 'Opening' ? 'text-slate-300' : (snapshotEarnings === 0 ? 'text-slate-400' : 'text-emerald-600')}`}>
                    {snapshotEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                );
              })}
            </tr>

            <tr className="bg-slate-900 text-white font-bold border-y-2 border-slate-900">
              <td className="p-4 text-xs uppercase tracking-[0.2em] border-r border-slate-700">TOTAL LIABILITIES & EQUITY</td>
              {sortedPeriods.map(p => {
                const totalL = calculateClassTotal(AccountClassification.CURRENT_LIABILITY, p) + calculateClassTotal(AccountClassification.LONG_TERM_LIABILITY, p);
                const totalE = calculateClassTotal(AccountClassification.EQUITY, p);
                const snapshotEarnings = getUnclosedEarningsForSnapshot(p);
                return <td key={p} className="p-4 text-right font-mono text-sm border-r border-slate-700">${(totalL + totalE + snapshotEarnings).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BalanceSheet;