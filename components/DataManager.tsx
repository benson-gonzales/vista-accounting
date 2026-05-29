import React, { useRef, useState, useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, FinancialStatement, AccountClassification, PaymentMethod } from '../types';

interface Props {
  accounts: Account[];
  transactions: JournalEntry[];
  onImport: (transactions: JournalEntry[], accounts: Account[]) => void;
  onReset: (full: boolean) => void;
  paymentMethods: PaymentMethod[];
  onAddMethod: (method: string, accountId: string) => void;
  onRemoveMethod: (method: string) => void;
  companyName: string;
  onUpdateCompanyName: (name: string) => void;
}

const DataManager: React.FC<Props> = ({ accounts, transactions, onImport, onReset, paymentMethods, onAddMethod, onRemoveMethod, companyName, onUpdateCompanyName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMethodName, setNewMethodName] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');

  const eligibleAccounts = accounts.filter(a => {
    const name = a.name.toLowerCase();
    const isActive = !a.isArchived;
    const isLiquidAsset = a.classification === AccountClassification.CURRENT_ASSET && 
                         (name.includes('cash') || name.includes('bank'));
    const isCreditLiability = a.classification === AccountClassification.CURRENT_LIABILITY && 
                             (name.includes('credit card') || name.includes('card') || name.includes('amex') || name.includes('visa'));
    
    return isActive && (isLiquidAsset || isCreditLiability);
  }).sort((a, b) => a.name.localeCompare(b.name));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => parseCSV(event.target?.result as string);
    reader.readAsText(file);
  };

  const parseCSV = (csv: string) => {
    const lines = csv.split('\n');
    const txMap: Record<number, JournalEntry> = {};
    const newAccounts: Account[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim());
      const [date, method, accName, debitVal, creditVal, desc, txIdVal] = values;
      const debit = parseFloat(debitVal) || 0;
      const credit = parseFloat(creditVal) || 0;
      const txId = parseInt(txIdVal) || Math.floor(Math.random() * 10000);

      let account = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase()) || newAccounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
      if (!account) {
        account = {
          id: Math.random().toString(),
          name: accName,
          naturalBalance: NaturalBalance.DEBIT,
          financialStatement: FinancialStatement.BALANCE_SHEET,
          classification: AccountClassification.CURRENT_ASSET,
          startingBalance: 0
        };
        newAccounts.push(account);
      }

      if (!txMap[txId]) txMap[txId] = { id: txId, date, method, lines: [] };
      txMap[txId].lines.push({ id: Math.random().toString(), accountId: account.id, debit, credit, description: desc });
    }
    onImport(Object.values(txMap), newAccounts);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmReset = (full: boolean) => {
    const msg = full 
      ? "PERMANENT DESTRUCTION: This will delete ALL accounts, transactions, and settings. Are you absolutely sure?" 
      : "TRANSACTION WIPE: This will delete ALL journal entries and history, but KEEP your current Chart of Accounts. Use this for starting a new fiscal year. Proceed?";
    
    if (window.confirm(msg)) {
      if (window.confirm("FINAL WARNING: This action is irreversible. Proceed?")) {
        onReset(full);
      }
    }
  };

  const handleAddMethod = () => {
    if (newMethodName.trim() && targetAccountId) {
      onAddMethod(newMethodName.trim(), targetAccountId);
      setNewMethodName('');
      setTargetAccountId('');
    } else {
      alert("Please enter a method name and select an associated ledger account.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="bg-white border-2 border-slate-200 p-10 rounded-3xl space-y-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <span className="text-emerald-500">🏢</span> Company Settings
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Configure your official company identity for financial reports.</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Official Entity Name</label>
          <input 
            type="text" 
            value={companyName} 
            onChange={(e) => onUpdateCompanyName(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
            placeholder="e.g. Acme Corp..."
          />
        </div>
      </section>

      <section className="bg-slate-50 border-2 border-slate-200 p-10 rounded-3xl space-y-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <span className="text-blue-500">💳</span> Cards & Reference Accounts
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Stipulate which accounts correspond to specific credit cards or cash sources.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Method Alias (e.g. AmEx 1001)</label>
            <input 
              type="text" 
              value={newMethodName} 
              onChange={(e) => setNewMethodName(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
              placeholder="Display Name..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Maps to Ledger Account</label>
            <div className="flex gap-2">
              <select 
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold bg-white"
              >
                <option value="">Select Account...</option>
                {eligibleAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.naturalBalance})</option>
                ))}
              </select>
              <button 
                onClick={handleAddMethod}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95"
              >
                Link
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {paymentMethods.map(m => {
            const acc = accounts.find(a => a.id === m.accountId);
            return (
              <div key={m.name} className="bg-white border border-slate-200 pl-4 pr-2 py-3 rounded-2xl flex items-center gap-6 group shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tighter">{m.name}</span>
                  <span className="text-[9px] font-bold text-slate-400">{acc ? `${acc.name} (${acc.classification})` : 'Journal Only'}</span>
                </div>
                {m.name !== 'JE' && (
                  <button 
                    onClick={() => onRemoveMethod(m.name)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border-2 border-red-50 p-10 rounded-3xl space-y-8">
        <div className="border-b-2 border-red-50 pb-4">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <span className="text-red-500">⚠</span> Maintenance & System Reset
          </h2>
          <p className="text-slate-500 text-sm mt-1">Tools for system migration and data cleanup.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Transactional Wipe</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deletes all General Journal entries and Ledger history. Keeps Chart of Accounts.
            </p>
            <button 
              onClick={() => confirmReset(false)}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors shadow-sm"
            >
              Clear Transactions Only
            </button>
          </div>

          <div className="space-y-4 p-6 bg-red-50 rounded-2xl border border-red-100">
            <h3 className="font-black text-red-800 uppercase tracking-widest text-xs">Factory Reset</h3>
            <p className="text-xs text-red-600/70 leading-relaxed">
              Wipes the entire database clean. Returns to defaults.
            </p>
            <button 
              onClick={() => confirmReset(true)}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
            >
              Destroy All Data
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DataManager;