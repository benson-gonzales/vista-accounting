import React, { useState, useMemo } from 'react';
import { JournalEntry, Account, JournalEntryLine, PaymentMethod } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  onDelete: (id: number) => void;
  onUpdate: (entry: JournalEntry) => void;
  closedPeriods: string[];
  paymentMethods: PaymentMethod[];
}

const getStandardKey = (dateStr: string) => {
  if (!dateStr) return "INVALID";
  
  const match = dateStr.match(/([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})/);
  if (match) {
    const month = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase().substring(0, 3);
    const year = match[2].slice(-2);
    return `${month}${year}`;
  }
  
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1].slice(-2);
    const monthIdx = parseInt(isoMatch[2]) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[monthIdx]}${year}`;
  }
  
  return "INVALID";
};

type SortField = 'id' | 'date';
type SortDirection = 'asc' | 'desc';

const GeneralJournal: React.FC<Props> = ({ transactions, accounts, onDelete, onUpdate, closedPeriods, paymentMethods }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<JournalEntry | null>(null);
  
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const accountMap = new Map<string, Account>(accounts.map(a => [a.id, a]));
  const activeAccounts = accounts.filter(a => !a.isArchived).sort((a,b) => a.name.localeCompare(b.name));

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'id') {
        comparison = a.id - b.id;
      } else {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortField, sortDirection]);

  const startEditing = (entry: JournalEntry) => {
    if (entry.isClosingEntry) {
      alert("Closing entries cannot be manually edited. You must delete and recreate them via the Closing Manager.");
      return;
    }
    if (closedPeriods.includes(getStandardKey(entry.date))) {
      alert("Cannot edit transactions in a closed period. Reopen the period by deleting its Closing Entry first.");
      return;
    }
    setEditingId(entry.id);
    setEditDraft({
      ...entry,
      lines: entry.lines.map(line => ({ ...line }))
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const updateDraftLine = (lineId: string, field: keyof JournalEntryLine, value: any) => {
    if (!editDraft) return;
    const updatedLines = editDraft.lines.map(l => l.id === lineId ? { ...l, [field]: value } : l);
    setEditDraft({ ...editDraft, lines: updatedLines });
  };

  const handleSave = () => {
    if (!editDraft) return;
    
    const totalDr = editDraft.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCr = editDraft.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    
    if (Math.abs(totalDr - totalCr) > 0.01) {
      alert(`Entry must be balanced! Difference: $${Math.abs(totalDr - totalCr).toFixed(2)}`);
      return;
    }

    onUpdate(editDraft);
    cancelEditing();
  };

  const availableMethods = useMemo(() => {
    const methods = paymentMethods.some(m => m.name === 'JE') 
      ? paymentMethods 
      : [{ name: 'JE', accountId: '' }, ...paymentMethods];
    return [...methods].sort((a, b) => {
      if (a.name === 'JE') return -1;
      if (b.name === 'JE') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [paymentMethods]);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">General Journal</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {transactions.length} Total Chronological Entries
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 px-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort:</span>
            <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setSortField('id')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all ${sortField === 'id' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
              >
                ID
              </button>
              <button 
                onClick={() => setSortField('date')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase transition-all ${sortField === 'date' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
              >
                Date
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-[9px] w-16">ID</th>
              <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-[9px] w-32">Date</th>
              <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Account</th>
              <th className="p-4 text-right font-black text-slate-400 uppercase tracking-widest text-[9px] w-32">Debit</th>
              <th className="p-4 text-right font-black text-slate-400 uppercase tracking-widest text-[9px] w-32">Credit</th>
              <th className="p-4 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Memo / Ref</th>
              <th className="p-4 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-20 text-center text-slate-400 italic font-medium">No recorded journal entries found.</td>
              </tr>
            )}
            {sortedTransactions.map((entry) => {
              const isEditing = editingId === entry.id;
              const displayEntry = isEditing && editDraft ? editDraft : entry;
              const periodKey = getStandardKey(entry.date);
              const isPeriodClosed = closedPeriods.includes(periodKey);
              // Only block edit if period is closed or is a closing entry
              const canEdit = !isPeriodClosed && !entry.isClosingEntry;

              return (
                <React.Fragment key={entry.id}>
                  {displayEntry.lines.map((line, idx) => {
                    const account = accountMap.get(line.accountId);
                    return (
                      <tr key={line.id} className={`group ${idx === 0 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-emerald-50/10 transition-colors`}>
                        <td className="p-4 align-top font-mono text-xs text-slate-400 font-bold">
                          {idx === 0 ? entry.id : ''}
                        </td>
                        <td className="p-4 align-top text-slate-600 font-bold text-xs">
                          {idx === 0 ? (
                            isEditing ? (
                              <input 
                                type="date" 
                                value={displayEntry.date} 
                                onChange={(e) => setEditDraft({...editDraft!, date: e.target.value})}
                                className="border rounded-lg px-2 py-1 text-xs w-full outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                            ) : entry.date
                          ) : ''}
                        </td>
                        <td className={`p-4 font-black text-xs ${line.credit > 0 ? 'pl-12 text-slate-500' : 'text-slate-900'}`}>
                          {isEditing ? (
                            <select
                              value={line.accountId}
                              onChange={(e) => updateDraftLine(line.id, 'accountId', e.target.value)}
                              className="w-full border rounded-lg px-2 py-1 text-xs outline-none"
                            >
                              <option value="">Select Account...</option>
                              {activeAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                              ))}
                            </select>
                          ) : (
                            account?.name || 'Unknown Account'
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-xs text-emerald-700">
                          {isEditing ? (
                            <input 
                              type="number" 
                              step="0.01"
                              value={line.debit || ''} 
                              onChange={(e) => updateDraftLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                              className="border rounded-lg px-2 py-1 text-xs w-full text-right"
                            />
                          ) : (
                            line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-xs text-amber-700">
                          {isEditing ? (
                            <input 
                              type="number" 
                              step="0.01"
                              value={line.credit || ''} 
                              onChange={(e) => updateDraftLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                              className="border rounded-lg px-2 py-1 text-xs w-full text-right"
                            />
                          ) : (
                            line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
                          )}
                        </td>
                        <td className="p-4 text-slate-500 italic text-xs truncate max-w-xs">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              {idx === 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase text-slate-400">Method:</span>
                                  <select 
                                    value={editDraft!.method}
                                    onChange={(e) => setEditDraft({...editDraft!, method: e.target.value})}
                                    className="border rounded-lg px-2 py-1 text-xs outline-none"
                                  >
                                    {availableMethods.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                  </select>
                                </div>
                              )}
                              <input 
                                type="text" 
                                value={line.description} 
                                onChange={(e) => updateDraftLine(line.id, 'description', e.target.value)}
                                className="border rounded-lg px-2 py-1 text-xs w-full"
                                placeholder="Description..."
                              />
                            </div>
                          ) : (
                            <>
                              {line.description}
                              {idx === 0 && entry.method && (
                                <span className={`not-italic text-[8px] ml-2 px-1.5 py-0.5 rounded font-black uppercase border ${entry.isClosingEntry ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                  {entry.isClosingEntry ? 'CLOSE' : entry.method}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {idx === 0 && (
                            <div className="flex justify-end items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button onClick={handleSave} className="text-emerald-600 font-black text-[9px] uppercase px-2 py-1 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors">Save</button>
                                  <button onClick={cancelEditing} className="text-slate-400 font-black text-[9px] uppercase px-2 py-1">X</button>
                                </>
                              ) : (
                                <>
                                  {isPeriodClosed && !entry.isClosingEntry && (
                                    <span className="text-[9px] font-black text-slate-300 uppercase italic mr-2">Locked</span>
                                  )}
                                  {canEdit && (
                                    <button 
                                      onClick={() => startEditing(entry)}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 opacity-40 hover:opacity-100 transition-all"
                                      title="Edit Transaction"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => onDelete(entry.id)}
                                    className="p-1.5 text-red-300 hover:text-red-500 opacity-40 hover:opacity-100 transition-all"
                                    title={entry.isClosingEntry ? "Delete Closing Entry & Reopen Period" : "Delete Transaction"}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GeneralJournal;