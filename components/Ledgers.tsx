
import React, { useState, useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, AccountClassification, FinancialStatement } from '../types';
import { STATEMENTS, STATEMENT_CLASSIFICATION_MAP } from '../constants';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  onUpdateAccount: (id: string, updatedFields: Partial<Account>) => void;
  onDeleteAccount: (id: string) => void;
  onDeleteTransaction: (id: number) => void;
}

type LedgerSubTab = FinancialStatement;

const Ledgers: React.FC<Props> = ({ transactions, accounts = [], onUpdateAccount, onDeleteAccount, onDeleteTransaction }) => {
  const [activeSubTab, setActiveSubTab] = useState<LedgerSubTab>(FinancialStatement.BALANCE_SHEET);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Account | null>(null);

  const categorizedAccounts = useMemo(() => {
    const filtered = accounts.filter(acc => acc.financialStatement === activeSubTab);
    
    const classificationOrder: Record<string, number> = {
      [AccountClassification.CURRENT_ASSET]: 1,
      [AccountClassification.LONG_TERM_ASSET]: 2,
      [AccountClassification.CURRENT_LIABILITY]: 3,
      [AccountClassification.LONG_TERM_LIABILITY]: 4,
      [AccountClassification.EQUITY]: 5,
      [AccountClassification.REVENUE]: 6,
      [AccountClassification.COGS]: 7,
      [AccountClassification.OPERATING_EXPENSE]: 8,
      [AccountClassification.OTHER_INCOME_EXPENSE]: 9,
      [AccountClassification.CLEARING_ACCOUNT]: 10,
      [AccountClassification.TEMPORARY_ACCOUNT]: 11,
    };

    const grouped: Record<string, Account[]> = {};
    filtered.forEach(acc => {
      if (!grouped[acc.classification]) grouped[acc.classification] = [];
      grouped[acc.classification].push(acc);
    });

    return Object.entries(grouped).sort((a, b) => 
      (classificationOrder[a[0]] || 99) - (classificationOrder[b[0]] || 99)
    );
  }, [accounts, activeSubTab]);

  const startEditing = (account: Account) => {
    setEditingId(account.id);
    setEditDraft({ ...account });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (editingId && editDraft) {
      onUpdateAccount(editingId, {
        name: editDraft.name.trim(),
        classification: editDraft.classification,
        naturalBalance: editDraft.naturalBalance,
        financialStatement: editDraft.financialStatement,
        startingBalance: Number(editDraft.startingBalance) || 0
      });
      cancelEditing();
    }
  };

  const updateDraft = (field: keyof Account, value: any) => {
    if (!editDraft) return;
    const newDraft = { ...editDraft, [field]: value };
    if (field === 'financialStatement') {
      const validClassifications = STATEMENT_CLASSIFICATION_MAP[value as FinancialStatement];
      if (!validClassifications.includes(newDraft.classification)) {
        newDraft.classification = validClassifications[0];
      }
    }
    setEditDraft(newDraft);
  };

  const handleDeleteAccount = (account: Account) => {
    const hasData = transactions.some(t => t.lines.some(l => l.accountId === account.id));
    const confirmMsg = hasData 
      ? `This account has transaction history. It will be "Archived" and hidden from new entry pickers, but preserved in ledgers. Proceed?`
      : `Are you sure you want to permanently delete the account "${account.name}"?`;
    
    if (window.confirm(confirmMsg)) {
      onDeleteAccount(account.id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Account Ledgers</h2>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
          {STATEMENTS.map(statement => (
            <button
              key={statement}
              onClick={() => {
                setActiveSubTab(statement);
                cancelEditing();
              }}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${
                activeSubTab === statement 
                  ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {statement}
            </button>
          ))}
        </div>
      </div>

      {categorizedAccounts.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-bold italic">No accounts configured for this category yet.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {categorizedAccounts.map(([classification, accs]) => (
            <div key={classification} className="space-y-6">
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 whitespace-nowrap">
                  {classification} Groups
                </h3>
                <div className="h-[1px] bg-slate-200 flex-1"></div>
              </div>

              <div className="space-y-6">
                {accs.sort((a,b) => a.name.localeCompare(b.name)).map(account => {
                  const startBal = Number(account.startingBalance) || 0;
                  // INCLUDES ALL TRANSACTIONS (CLOSING INCLUDED)
                  const accountLines = (transactions || []).flatMap(t => 
                    t.lines
                      .filter(l => l.accountId === account.id)
                      .map(l => ({ ...l, date: t.date, txId: t.id, method: t.method, isClosing: t.isClosingEntry }))
                  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  let runningBalance = startBal;
                  const isEditing = editingId === account.id;

                  return (
                    <div key={account.id} className={`border rounded-xl shadow-sm overflow-hidden transition-all ${account.isArchived ? 'opacity-40 grayscale' : 'hover:shadow-md'} ${account.financialStatement === FinancialStatement.OFF_STATEMENT ? 'border-amber-100' : 'border-slate-200'}`}>
                      <div className={`${isEditing ? 'bg-slate-900' : account.isArchived ? 'bg-slate-400' : account.financialStatement === FinancialStatement.OFF_STATEMENT ? 'bg-slate-700' : 'bg-slate-800'} text-white p-4 flex flex-wrap items-center justify-between gap-4 transition-colors`}>
                        <div className="flex items-center gap-4 group">
                          {isEditing && editDraft ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex flex-col">
                                <label className="text-[9px] text-emerald-400 font-black uppercase">Account Name</label>
                                <input type="text" value={editDraft.name} onChange={(e) => updateDraft('name', e.target.value)} className="bg-slate-800 text-white px-3 py-1.5 rounded border border-slate-600 text-sm font-bold w-48" />
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[9px] text-emerald-400 font-black uppercase">Natural Balance</label>
                                <div className="flex bg-slate-800 border border-slate-600 rounded overflow-hidden mt-[2px]">
                                  <button onClick={() => updateDraft('naturalBalance', NaturalBalance.DEBIT)} className={`px-3 py-1 text-[10px] font-bold ${editDraft.naturalBalance === NaturalBalance.DEBIT ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>DR</button>
                                  <button onClick={() => updateDraft('naturalBalance', NaturalBalance.CREDIT)} className={`px-3 py-1 text-[10px] font-bold ${editDraft.naturalBalance === NaturalBalance.CREDIT ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>CR</button>
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[9px] text-emerald-400 font-black uppercase">Report Type</label>
                                <select value={editDraft.financialStatement} onChange={(e) => updateDraft('financialStatement', e.target.value as FinancialStatement)} className="bg-slate-800 text-xs font-bold border border-slate-600 px-2 py-1.5 rounded h-[34px] mt-[2px]">
                                  {STATEMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[9px] text-emerald-400 font-black uppercase">Classification</label>
                                <select value={editDraft.classification} onChange={(e) => updateDraft('classification', e.target.value as AccountClassification)} className="bg-slate-800 text-xs font-bold border border-slate-600 px-2 py-1.5 rounded h-[34px] mt-[2px]">
                                  {STATEMENT_CLASSIFICATION_MAP[editDraft.financialStatement].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[9px] text-emerald-400 font-black uppercase">Dictate Start Bal</label>
                                <input type="number" step="0.01" value={editDraft.startingBalance} onChange={(e) => updateDraft('startingBalance', e.target.value)} className="bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-600 text-sm font-mono w-28" />
                              </div>
                              <div className="flex gap-2 ml-4 self-end pb-1">
                                <button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded text-xs font-bold shadow-lg transition-all">Save</button>
                                <button onClick={cancelEditing} className="bg-slate-700 hover:bg-slate-600 px-4 py-1.5 rounded text-xs font-bold transition-all">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                  {account.name}
                                  {account.isArchived && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded uppercase tracking-widest font-black">Archived</span>}
                                </h3>
                                <div className="flex gap-2 items-center mt-0.5">
                                  <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-400/10 px-1 rounded inline-block">ID: {account.id.slice(0, 4)}</span>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditing(account)} className="text-slate-400 hover:text-white transition-all bg-white/10 p-1.5 rounded-md" title="Edit Account">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2"></path></svg>
                                </button>
                                <button onClick={() => handleDeleteAccount(account)} className="text-red-400 hover:text-red-300 transition-all bg-red-500/10 p-1.5 rounded-md" title="Delete Account">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {!isEditing && (
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                            <div className="flex flex-col items-end">
                              <span className="opacity-50">Opening Position</span>
                              <span className="text-sm font-mono">${startBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className={`px-2 py-2 rounded border ${account.naturalBalance === NaturalBalance.DEBIT ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>{account.naturalBalance}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="p-3 border-r w-16 text-slate-500 font-black uppercase text-[9px]">TX ID</th>
                              <th className="p-3 border-r w-24 text-slate-500 font-black uppercase text-[9px]">Date</th>
                              <th className="p-3 border-r text-slate-500 font-black uppercase text-[9px]">Reference</th>
                              <th className="p-3 border-r text-right w-28 text-slate-500 font-black uppercase text-[9px]">Debit</th>
                              <th className="p-3 border-r text-right w-28 text-slate-500 font-black uppercase text-[9px]">Credit</th>
                              <th className="p-3 border-r text-right w-36 text-slate-500 font-black uppercase text-[9px]">Running Balance</th>
                              <th className="p-3 text-slate-500 font-black uppercase text-[9px]">Memo</th>
                              <th className="p-3 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="bg-slate-50/30 italic">
                              <td className="p-3 border-r text-slate-300 font-mono">-</td>
                              <td className="p-3 border-r text-slate-400">Opening</td>
                              <td className="p-3 border-r text-slate-400 uppercase text-[9px] font-bold tracking-widest italic opacity-60">Balance Brought Forward</td>
                              <td className="p-3 border-r text-right font-mono text-slate-300">-</td>
                              <td className="p-3 border-r text-right font-mono text-slate-300">-</td>
                              <td className="p-3 border-r text-right font-mono font-black text-slate-400 bg-slate-50">
                                {startBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td colSpan={2} className="p-3 text-slate-400">Initial recorded position</td>
                            </tr>

                            {accountLines.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">No ledger activity recorded for this account.</td>
                              </tr>
                            )}

                            {accountLines.map((line, idx) => {
                              const netChange = account.naturalBalance === NaturalBalance.DEBIT ? (line.debit - line.credit) : (line.credit - line.debit);
                              runningBalance += netChange;
                              return (
                                <tr key={`${line.txId}-${idx}`} className={`group transition-colors ${line.isClosing ? 'bg-indigo-50/40' : 'hover:bg-emerald-50/20'}`}>
                                  <td className="p-3 border-r font-mono text-slate-400">{line.txId}</td>
                                  <td className="p-3 border-r font-medium text-slate-700">{line.date}</td>
                                  <td className="p-3 border-r text-slate-600 truncate max-w-[120px]">
                                    {line.method || '-'}
                                    {line.isClosing && <span className="ml-2 text-[8px] font-black bg-indigo-600 text-white px-1 py-0.5 rounded uppercase">CLOSE</span>}
                                  </td>
                                  <td className="p-3 border-r text-right font-mono font-bold text-emerald-600">{line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                                  <td className="p-3 border-r text-right font-mono font-bold text-amber-600">{line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                                  <td className={`p-3 border-r text-right font-mono font-black bg-slate-50/30 ${runningBalance < 0 ? 'text-red-500' : 'text-slate-900'}`}>{runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="p-3 text-slate-500 italic truncate max-w-[200px]">{line.description}</td>
                                  <td className="p-3 text-center">
                                    <button onClick={() => onDeleteTransaction(line.txId)} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-600 transition-all font-bold">✕</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-slate-50 p-3 text-[10px] text-right text-slate-500 font-bold uppercase tracking-widest border-t flex justify-end gap-6">
                        <span className="opacity-60">Calculated Activity: {(runningBalance - startBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-slate-900 bg-white px-3 py-1 rounded shadow-sm border border-slate-200">Current Balance: {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Ledgers;
