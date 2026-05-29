import React, { useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, FinancialStatement, AccountClassification } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  companyName: string;
}

const CashFlowStatement: React.FC<Props> = ({ transactions = [], accounts = [], companyName }) => {
  const sortedPeriods = useMemo(() => {
    const periods = new Set<string>();
    transactions.forEach(tx => {
      const dateParts = tx.date.split('-');
      if (dateParts.length >= 2) {
        periods.add(`${dateParts[0]}-${dateParts[1]}`);
      }
    });
    return Array.from(periods).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const cashAccountIds = useMemo(() => 
    accounts.filter(a => a.classification === AccountClassification.CURRENT_ASSET && 
      (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
    ).map(a => a.id), 
  [accounts]);

  const getMonthlyCashActivity = (accountId: string, period: string, excludeClosing: boolean = false) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    
    const [year, month] = period.split('-').map(Number);
    let activity = 0;
    
    transactions.forEach(tx => {
      if (excludeClosing && tx.isClosingEntry) return;

      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === year && (txDate.getMonth() + 1) === month) {
        tx.lines.forEach(l => {
          if (l.accountId === accountId) {
            if (acc.naturalBalance === NaturalBalance.DEBIT) activity += (l.debit - l.credit);
            else activity += (l.credit - l.debit);
          }
        });
      }
    });
    return activity;
  };

  const getCumulativeCashPriorTo = (period: string) => {
    let total = accounts
      .filter(a => cashAccountIds.includes(a.id))
      .reduce((sum, a) => sum + (Number(a.startingBalance) || 0), 0);

    const [targetYear, targetMonth] = period.split('-').map(Number);
    const cutoffDate = new Date(targetYear, targetMonth - 1, 1);

    transactions.forEach(tx => {
      if (new Date(tx.date) < cutoffDate) {
        tx.lines.forEach(l => {
          if (cashAccountIds.includes(l.accountId)) {
            total += (l.debit - l.credit);
          }
        });
      }
    });
    return total;
  };

  const calculateMonthlyItems = (period: string) => {
    const isAccounts = accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT);
    let netIncome = 0;
    isAccounts.forEach(acc => {
      const act = getMonthlyCashActivity(acc.id, period, true); 
      if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) {
        netIncome += act;
      } else {
        netIncome -= act;
      }
    });

    const depExp = accounts.find(a => a.name.toLowerCase().includes('depreciation') && a.financialStatement === FinancialStatement.INCOME_STATEMENT);
    const depreciation = depExp ? getMonthlyCashActivity(depExp.id, period, true) : 0;

    const workingCapAssets = accounts.filter(a => a.classification === AccountClassification.CURRENT_ASSET && !cashAccountIds.includes(a.id));
    const workingCapLiabs = accounts.filter(a => a.classification === AccountClassification.CURRENT_LIABILITY);

    const assetChange = workingCapAssets.reduce((sum, a) => sum - getMonthlyCashActivity(a.id, period, true), 0);
    const liabChange = workingCapLiabs.reduce((sum, a) => sum + getMonthlyCashActivity(a.id, period, true), 0);

    const opsFlow = netIncome + depreciation + assetChange + liabChange;

    const ltAssets = accounts.filter(a => a.classification === AccountClassification.LONG_TERM_ASSET);
    const investFlow = ltAssets.reduce((sum, a) => sum - getMonthlyCashActivity(a.id, period, true), 0);

    // FINANCING ACTIVITY LOGIC: Strictly Cash-Based, Exclude Non-Cash Closing Entries
    const [year, month] = period.split('-').map(Number);
    let cashContributions = 0;
    let cashDistributions = 0;
    let debtChange = 0;

    const equityAccountIds = accounts.filter(a => a.classification === AccountClassification.EQUITY).map(a => a.id);
    const debtAccountIds = accounts.filter(a => a.classification === AccountClassification.LONG_TERM_LIABILITY).map(a => a.id);

    transactions.forEach(tx => {
      // Exclude closing entries (profit/loss moves to equity) as they are non-cash.
      if (tx.isClosingEntry) return;

      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === year && (txDate.getMonth() + 1) === month) {
        const touchesCash = tx.lines.some(l => cashAccountIds.includes(l.accountId));
        if (touchesCash) {
          tx.lines.forEach(l => {
            if (equityAccountIds.includes(l.accountId)) {
              // Net credit to equity = contribution (increase cash), net debit = distribution (decrease cash)
              const netChange = l.credit - l.debit;
              if (netChange > 0) cashContributions += netChange;
              else if (netChange < 0) cashDistributions += Math.abs(netChange);
            }
            if (debtAccountIds.includes(l.accountId)) {
              debtChange += (l.credit - l.debit);
            }
          });
        }
      }
    });

    const financeFlow = cashContributions - cashDistributions + debtChange;

    return { netIncome, depreciation, assetChange, liabChange, opsFlow, investFlow, financeFlow, cashContributions, cashDistributions, debtChange };
  };

  const periodData = useMemo(() => {
    const data: Record<string, any> = {};
    sortedPeriods.forEach((p, idx) => {
      const items = calculateMonthlyItems(p);
      const startCash = idx === 0 ? getCumulativeCashPriorTo(p) : data[sortedPeriods[idx-1]].endCash;
      const netChange = items.opsFlow + items.investFlow + items.financeFlow;
      data[p] = { ...items, startCash, netChange, endCash: startCash + netChange };
    });
    return data;
  }, [sortedPeriods, transactions, accounts]);

  if (sortedPeriods.length === 0) {
    return (
      <div className="p-20 text-center text-slate-400 italic bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <p className="text-lg font-bold mb-2 text-slate-700 tracking-tight">Statement Ready</p>
        <p className="text-sm">Record monthly activity to generate the columnar Cash Flow Statement.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{companyName}</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Statement of Cash Flows (Indirect Method)</p>
      </div>

      <div className="overflow-x-auto border rounded-2xl shadow-xl bg-white">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 text-left w-64 border-r border-slate-800 text-[10px] font-black uppercase tracking-widest">Activity Group</th>
              {sortedPeriods.map(p => (
                <th key={p} className="p-4 text-right text-[10px] uppercase font-black tracking-widest border-r border-slate-800">
                  {new Date(p + "-02").toLocaleString('default', { month: 'short', year: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50 border-t border-slate-100">
              <td className="p-3 font-black text-slate-900 text-[9px] tracking-widest uppercase">Operating Activities</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 border-r border-slate-100"></td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Net Income / (Loss)</td>
              {sortedPeriods.map(p => <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">{periodData[p].netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Depreciation Adjustment</td>
              {sortedPeriods.map(p => <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">{periodData[p].depreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Changes in Current Assets</td>
              {sortedPeriods.map(p => <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 ${periodData[p].assetChange < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{periodData[p].assetChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Changes in Current Liabilities</td>
              {sortedPeriods.map(p => <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 ${periodData[p].liabChange < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{periodData[p].liabChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="bg-slate-50 font-black">
              <td className="p-3 pl-4 text-[10px] uppercase tracking-widest text-slate-900 border-r border-slate-100">Net Operating Flow</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 text-right font-mono text-sm border-r border-slate-100">${periodData[p].opsFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>

            <tr className="bg-slate-50 border-t border-slate-100">
              <td className="p-3 font-black text-slate-900 text-[9px] tracking-widest uppercase">Investing Activities</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 border-r border-slate-100"></td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Asset Purchases / Capex</td>
              {sortedPeriods.map(p => <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 ${periodData[p].investFlow < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{periodData[p].investFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="bg-slate-50 font-black">
              <td className="p-3 pl-4 text-[10px] uppercase tracking-widest text-slate-900 border-r border-slate-100">Net Investing Flow</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 text-right font-mono text-sm border-r border-slate-100">${periodData[p].investFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>

            <tr className="bg-slate-50 border-t border-slate-100">
              <td className="p-3 font-black text-slate-900 text-[9px] tracking-widest uppercase">Financing Activities</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 border-r border-slate-100"></td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Cash Contributions</td>
              {sortedPeriods.map(p => <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 text-emerald-500`}>{periodData[p].cashContributions > 0 ? periodData[p].cashContributions.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Cash Distributions</td>
              {sortedPeriods.map(p => <td key={p} className={`p-2.5 text-right font-mono text-xs border-r border-slate-100 text-red-500`}>{periodData[p].cashDistributions > 0 ? `(${periodData[p].cashDistributions.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : '-'}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-2.5 pl-8 text-xs font-medium text-slate-600 border-r border-slate-100">Net Change in Debt</td>
              {sortedPeriods.map(p => <td key={p} className="p-2.5 text-right font-mono text-xs border-r border-slate-100">{periodData[p].debtChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="bg-slate-50 font-black">
              <td className="p-3 pl-4 text-[10px] uppercase tracking-widest text-slate-900 border-r border-slate-100">Net Financing Flow</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 text-right font-mono text-sm border-r border-slate-100">${periodData[p].financeFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>

            <tr className="h-6"></tr>
            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
              <td className="p-4 text-xs uppercase tracking-[0.2em] border-r border-slate-700">PERIOD CASH CHANGE</td>
              {sortedPeriods.map(p => <td key={p} className={`p-4 text-right font-mono text-sm border-r border-slate-700 ${periodData[p].netChange < 0 ? 'text-red-400' : 'text-emerald-400'}`}>${periodData[p].netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
              <td className="p-3 pl-6 text-[10px] uppercase tracking-widest border-r border-slate-700">Opening Balance</td>
              {sortedPeriods.map(p => <td key={p} className="p-3 text-right font-mono text-xs border-r border-slate-700">${periodData[p].startCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
            <tr className="bg-emerald-900 text-white font-black border-b-2 border-slate-800">
              <td className="p-4 text-xs uppercase tracking-[0.3em] border-r border-slate-700 italic">CLOSING CASH POSITION</td>
              {sortedPeriods.map(p => <td key={p} className="p-4 text-right font-mono text-base border-r border-slate-700 shadow-inner">${periodData[p].endCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashFlowStatement;