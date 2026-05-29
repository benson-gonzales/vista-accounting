
import React from 'react';
import { JournalEntry, Account, NaturalBalance } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
}

const TrialBalance: React.FC<Props> = ({ transactions, accounts }) => {
  const getTotals = (accountId: string) => {
    let debits = 0;
    let credits = 0;
    transactions.forEach(tx => {
      tx.lines.forEach(l => {
        if (l.accountId === accountId) {
          debits += l.debit;
          credits += l.credit;
        }
      });
    });
    return { debits, credits };
  };

  const accountBalances = accounts.map(acc => {
    const { debits, credits } = getTotals(acc.id);
    let dr = 0;
    let cr = 0;
    
    // Calculate net position for the trial balance
    const net = debits - credits;
    if (net > 0) dr = net;
    else if (net < 0) cr = Math.abs(net);

    return { ...acc, dr, cr };
  }).filter(acc => acc.dr > 0 || acc.cr > 0);

  const totalDr = accountBalances.reduce((sum, a) => sum + a.dr, 0);
  const totalCr = accountBalances.reduce((sum, a) => sum + a.cr, 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Unadjusted Trial Balance</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b">
            <th className="p-3 text-left font-semibold text-gray-600">Account</th>
            <th className="p-3 text-right font-semibold text-gray-600 w-40">Debit</th>
            <th className="p-3 text-right font-semibold text-gray-600 w-40">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {accountBalances.length === 0 && (
            <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">No account activity yet.</td></tr>
          )}
          {accountBalances.map(acc => (
            <tr key={acc.id} className="hover:bg-gray-50">
              <td className="p-3 font-medium text-gray-700">{acc.name}</td>
              <td className="p-3 text-right font-mono text-emerald-700">{acc.dr > 0 ? acc.dr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
              <td className="p-3 text-right font-mono text-amber-700">{acc.cr > 0 ? acc.cr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-800 text-white font-bold">
            <td className="p-3 text-right">TOTALS</td>
            <td className="p-3 text-right font-mono border-double border-b-4 border-white">{totalDr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td className="p-3 text-right font-mono border-double border-b-4 border-white">{totalCr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
      {Math.abs(totalDr - totalCr) > 0.01 && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded text-sm font-bold">
          WARNING: Trial Balance does not equal! Difference: {(totalDr - totalCr).toFixed(2)}
        </div>
      )}
    </div>
  );
};

export default TrialBalance;
