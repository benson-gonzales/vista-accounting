import React, { useState } from 'react';
import { Account, JournalEntry, JournalEntryLine, PaymentMethod } from '../types';

interface Props {
  accounts: Account[];
  onRecord: (entry: JournalEntry) => void;
  lastId: number;
  paymentMethods: PaymentMethod[];
  closedPeriods: string[];
}

const getStandardKey = (dateStr: string) => {
  if (!dateStr) return "INVALID";
  const match = dateStr.match(/([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})/);
  if (match) {
    const month = match[1];
    const year = match[2].slice(-2);
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase().substring(0, 3);
    return `${formattedMonth}${year}`;
  }
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(dateStr);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = String(d.getFullYear()).slice(-2);
    return `${month}${year}`;
  }
  return "INVALID";
};

const TransactionRecorder: React.FC<Props> = ({ accounts, onRecord, lastId, paymentMethods, closedPeriods }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [methodName, setMethodName] = useState('');
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { id: '1', accountId: '', debit: 0, credit: 0, description: '' },
    { id: '2', accountId: '', debit: 0, credit: 0, description: '' }
  ]);

  const activeAccounts = accounts
    .filter(acc => !acc.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;
  const canRecord = isBalanced && methodName !== '';

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(), accountId: '', debit: 0, credit: 0, description: '' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 2) {
      setLines(lines.filter(l => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof JournalEntryLine, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert("Debits must equal credits!");
      return;
    }

    if (methodName === '') {
      alert("Please select a Method / Reference Tag.");
      return;
    }

    if (closedPeriods.includes(getStandardKey(date))) {
      alert("This period is closed. Cannot record new transactions.");
      return;
    }

    const entry: JournalEntry = {
      id: lastId + 1,
      date,
      method: methodName,
      lines: lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0))
    };

    onRecord(entry);
    setMethodName('');
    setLines([
      { id: '1', accountId: '', debit: 0, credit: 0, description: '' },
      { id: '2', accountId: '', debit: 0, credit: 0, description: '' }
    ]);
    alert("Transaction recorded successfully!");
  };

  const allMethods = paymentMethods.some(m => m.name === 'JE') 
    ? paymentMethods 
    : [{ name: 'JE', accountId: '' }, ...paymentMethods];

  const sortedMethods = [...allMethods].sort((a, b) => {
    if (a.name === 'JE') return -1;
    if (b.name === 'JE') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Record Journal Entry</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-4 rounded-lg border">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction ID</label>
            <input type="text" disabled value={lastId + 1} className="w-full bg-gray-100 border rounded px-3 py-2 text-gray-600 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Method / Reference Tag</label>
            <select 
              value={methodName} 
              onChange={(e) => setMethodName(e.target.value)} 
              className={`w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-semibold ${methodName === '' ? 'text-slate-400' : 'text-slate-900'}`}
              required
            >
              <option value="" disabled>Select Method...</option>
              {sortedMethods.map(m => (
                <option key={m.name} value={m.name} className="text-slate-900">{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b">
                <th className="p-3 text-left font-semibold text-gray-600">Account</th>
                <th className="p-3 text-left font-semibold text-gray-600 w-32">Debit</th>
                <th className="p-3 text-left font-semibold text-gray-600 w-32">Credit</th>
                <th className="p-3 text-left font-semibold text-gray-600">Description</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="p-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(line.id, 'accountId', e.target.value)}
                      className="w-full border rounded px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                    >
                      <option value="">Select Account...</option>
                      {activeAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.debit || ''}
                      onChange={(e) => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                      className="w-full border rounded px-2 py-1.5 text-right font-mono"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      value={line.credit || ''}
                      onChange={(e) => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                      className="w-full border rounded px-2 py-1.5 text-right font-mono"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      className="w-full border rounded px-2 py-1.5"
                      placeholder="Notes..."
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button 
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="text-red-300 hover:text-red-500 p-1"
                      title="Remove Row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                <td className="p-3 text-right text-slate-500 uppercase text-[10px] tracking-widest">Totals:</td>
                <td className={`p-3 text-right font-mono ${totalDebits !== totalCredits ? 'text-red-500' : 'text-emerald-600'}`}>
                  {totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className={`p-3 text-right font-mono ${totalDebits !== totalCredits ? 'text-red-500' : 'text-emerald-600'}`}>
                  {totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2} className="p-3">
                  {!isBalanced && totalDebits + totalCredits > 0 && (
                    <span className="text-xs text-red-500 font-bold uppercase tracking-tighter">Out of balance: {(Math.abs(totalDebits - totalCredits)).toFixed(2)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <button 
            type="button" 
            onClick={addLine}
            className="text-emerald-600 font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-2"
          >
            <span className="text-lg">+</span> Add Entry Row
          </button>
          
          <button 
            type="submit"
            disabled={!canRecord}
            className={`px-10 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all ${
              canRecord 
                ? 'bg-slate-900 text-white hover:bg-slate-800 transform hover:-translate-y-0.5 active:scale-95' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
            }`}
          >
            Record Entry
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionRecorder;