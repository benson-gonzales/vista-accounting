
import React from 'react';
import { JournalEntry, Account, NaturalBalance, FinancialStatement, AccountClassification, TabType, PaymentMethod } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  onNavigate: (tab: TabType) => void;
  paymentMethods: PaymentMethod[];
  companyName: string;
}

const Dashboard: React.FC<Props> = ({ transactions, accounts, onNavigate, paymentMethods, companyName }) => {
  const getBalance = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    let balance = Number(account.startingBalance) || 0;
    transactions.forEach(tx => {
      tx.lines.forEach(l => {
        if (l.accountId === accountId) {
          if (account.naturalBalance === NaturalBalance.DEBIT) balance += (l.debit - l.credit);
          else balance += (l.credit - l.debit);
        }
      });
    });
    return balance;
  };

  const cashAccounts = accounts.filter(a => 
    !a.isArchived &&
    a.classification === AccountClassification.CURRENT_ASSET && 
    (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))
  );

  const liabilityAccounts = accounts.filter(a => 
    !a.isArchived &&
    (a.classification === AccountClassification.CURRENT_LIABILITY || 
     a.classification === AccountClassification.LONG_TERM_LIABILITY)
  );

  const totalCash = cashAccounts.reduce((sum, a) => sum + getBalance(a.id), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + getBalance(a.id), 0);
  
  const isAccounts = accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT);
  let netIncome = 0;
  isAccounts.forEach(acc => {
    const b = getBalance(acc.id);
    const start = Number(acc.startingBalance) || 0;
    const activity = b - start;
    if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) {
       netIncome += activity; 
    } else {
       netIncome -= activity;
    }
  });

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h2>
        </div>
        <div className="bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Cloud Sync Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-center mb-6">
            <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">💰</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Liquid Assets</span>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">Total Cash Position</p>
          <p className="text-3xl font-black font-mono text-emerald-600 tracking-tighter">
            ${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-center mb-6">
            <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">💳</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Debt</span>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">Current Liabilities</p>
          <p className="text-3xl font-black font-mono text-amber-600 tracking-tighter">
            ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-center mb-6">
            <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">📈</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Performance</span>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">Net Income (Current Cycle)</p>
          <p className={`text-3xl font-black font-mono tracking-tighter ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 p-6 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
              Credit & Liability Watchlist
            </h3>
          </div>
          <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
            {liabilityAccounts.length === 0 ? (
              <p className="text-center py-10 text-slate-400 italic text-sm font-medium">No active cards found.</p>
            ) : (
              liabilityAccounts.map(acc => {
                const bal = getBalance(acc.id);
                return (
                  <div key={acc.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${bal > 0 ? 'bg-amber-50/30 border-amber-100 hover:border-amber-300' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800">{acc.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.classification}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-mono font-black ${bal > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                        ${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 p-6 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
              Bank & Cash Breakdown
            </h3>
          </div>
          <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
            {cashAccounts.length === 0 ? (
              <p className="text-center py-10 text-slate-400 italic text-sm font-medium">No cash accounts configured.</p>
            ) : (
              cashAccounts.map(acc => {
                const bal = getBalance(acc.id);
                return (
                  <div key={acc.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${bal > 0 ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-300' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}>
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800">{acc.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.classification}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-mono font-black ${bal > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        ${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-slate-900 p-8 rounded-3xl text-white space-y-6">
          <h3 className="text-xl font-black tracking-tight">System Controls</h3>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => onNavigate('Transaction Recorder')} className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/40 text-left flex items-center justify-between">
              Record Entry
              <span>→</span>
            </button>
            <button onClick={() => onNavigate('BS')} className="w-full bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl font-bold text-sm transition-all text-left flex items-center justify-between">
              Balance Sheet
              <span>→</span>
            </button>
            <button onClick={() => onNavigate('IS')} className="w-full bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl font-bold text-sm transition-all text-left flex items-center justify-between">
              Income Statement
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-black text-slate-800 tracking-tight mb-6 flex items-center gap-3">
            <span className="text-blue-500">📄</span>
            Recent Transactions
          </h3>
          <div className="space-y-3">
            {transactions.slice(-5).reverse().map(t => (
              <div key={t.id} className="group bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center transition-all hover:border-blue-200">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-400 text-xs border border-slate-100 group-hover:border-blue-100">#{t.id}</span>
                  <div className="flex flex-col">
                    <span className="font-black text-slate-700 text-sm">{t.date}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.method}</span>
                  </div>
                </div>
                <div className="font-mono font-black text-slate-900 text-lg">
                  ${t.lines.filter(l => l.debit > 0).reduce((s,l) => s + l.debit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-300 italic font-black uppercase tracking-widest text-xs">No ledger activity found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
