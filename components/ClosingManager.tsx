import React, { useState, useMemo } from 'react';
import { JournalEntry, Account, NaturalBalance, FinancialStatement, AccountClassification, JournalEntryLine } from '../types';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  closedPeriods: string[];
  onClosePeriod: (periodKey: string, closingEntry: JournalEntry) => void;
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

const ClosingManager: React.FC<Props> = ({ transactions, accounts, closedPeriods, onClosePeriod }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [equityAllocations, setEquityAllocations] = useState<Record<string, number>>({});

  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    transactions.forEach(t => {
      const key = getStandardKey(t.date);
      if (key !== "INVALID" && !closedPeriods.includes(key)) periods.add(key);
    });
    return Array.from(periods).sort();
  }, [transactions, closedPeriods]);

  const periodSummary = useMemo<{ netIncome: number; accountBalances: Record<string, number> } | null>(() => {
    if (!selectedPeriod) return null;
    let netIncome = 0;
    const accountBalances: Record<string, number> = {};

    transactions.forEach(t => {
      if (getStandardKey(t.date) === selectedPeriod && !t.isClosingEntry) {
        t.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
            const amount = acc.naturalBalance === NaturalBalance.DEBIT ? (l.debit - l.credit) : (l.credit - l.debit);
            accountBalances[acc.id] = (accountBalances[acc.id] || 0) + amount;
            if (acc.financialStatement === FinancialStatement.INCOME_STATEMENT) {
               if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) {
                  netIncome += amount;
               } else {
                  netIncome -= amount;
               }
            }
          }
        });
      }
    });

    return { netIncome, accountBalances };
  }, [selectedPeriod, transactions, accounts]);

  const equityAccounts = accounts.filter(a => a.classification === AccountClassification.EQUITY && !a.isArchived);

  const handleClose = () => {
    // 1. Debug Start
    console.log("Attempting to close period:", selectedPeriod);

    if (!selectedPeriod || !periodSummary) return;

    const totalAllocated = (Object.values(equityAllocations) as number[]).reduce((s: number, v: number) => s + v, 0);
    
    // 2. Validation Log
    console.log(`Net Income: ${periodSummary.netIncome}, Allocated: ${totalAllocated}`);

    if (Math.abs(totalAllocated - periodSummary.netIncome) > 0.01) {
      alert(`Equity allocations ($${totalAllocated.toFixed(2)}) must equal Net Income ($${periodSummary.netIncome.toFixed(2)})!`);
      return;
    }

    // 3. REMOVED BLOCKING CONFIRMATION
    console.log("Validation passed. Generating entry...");

    const closingLines: JournalEntryLine[] = [];
    
    // Zero out Income Statement accounts
    accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT).forEach(acc => {
      const balance = (periodSummary.accountBalances[acc.id] || 0) as number;
      if (Math.abs(balance) < 0.01) return;

      if (acc.naturalBalance === NaturalBalance.DEBIT) {
        // To zero a debit balance, credit it
        closingLines.push({ id: Math.random().toString(), accountId: acc.id, debit: 0, credit: balance, description: `Closing ${selectedPeriod}` });
      } else {
        // To zero a credit balance, debit it
        closingLines.push({ id: Math.random().toString(), accountId: acc.id, debit: balance, credit: 0, description: `Closing ${selectedPeriod}` });
      }
    });

    // Allocate to Equity
    Object.entries(equityAllocations).forEach(([accId, amount]) => {
      const amt = amount as number;
      if (Math.abs(amt) < 0.01) return;
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return;

      if (acc.naturalBalance === NaturalBalance.CREDIT) {
        if (amt > 0) closingLines.push({ id: Math.random().toString(), accountId: accId, debit: 0, credit: amt, description: `Profit Allocation ${selectedPeriod}` });
        else closingLines.push({ id: Math.random().toString(), accountId: accId, debit: Math.abs(amt), credit: 0, description: `Loss Allocation ${selectedPeriod}` });
      } else {
        if (amt > 0) closingLines.push({ id: Math.random().toString(), accountId: accId, debit: amt, credit: 0, description: `Profit Allocation ${selectedPeriod}` });
        else closingLines.push({ id: Math.random().toString(), accountId: accId, debit: 0, credit: Math.abs(amt), description: `Loss Allocation ${selectedPeriod}` });
      }
    });

    const maxId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) : 0;
    
    // DATE CALCULATION: Set to last day of selectedPeriod (e.g. "Oct25" -> Oct 31, 2025)
    const monthStr = selectedPeriod.substring(0, 3);
    const yearStr = "20" + selectedPeriod.substring(3);
    const monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = monthsArr.indexOf(monthStr);
    
    // new Date(year, monthIdx + 1, 0) gives the last day of monthIdx
    const closingDateObj = new Date(parseInt(yearStr), monthIdx + 1, 0);
    const closingDate = closingDateObj.toISOString().split('T')[0];

    const closingEntry: JournalEntry = {
      id: maxId + 1,
      date: closingDate,
      method: 'CLOSE',
      isClosingEntry: true,
      lines: closingLines
    };

    // 4. Final Execution Log
    console.log("Sending Closing Entry to App:", closingEntry);
    
    onClosePeriod(selectedPeriod, closingEntry);
    
    // 5. Reset UI
    setSelectedPeriod('');
    setEquityAllocations({});
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div className="border-b-2 border-slate-900 pb-6">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Close the Books</h2>
        <p className="text-sm font-bold text-slate-400 mt-2 italic uppercase">Zero out performance accounts and lock historical periods.</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Period to Close</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-slate-50"
          >
            <option value="">Choose Period...</option>
            {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {selectedPeriod && periodSummary && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Income for {selectedPeriod}</p>
                <p className="text-3xl font-black font-mono mt-1">${periodSummary.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${periodSummary.netIncome >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {periodSummary.netIncome >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Equity Allocation</h3>
              <div className="grid grid-cols-1 gap-4">
                {equityAccounts.map(acc => (
                  <div key={acc.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="flex-1 font-bold text-slate-700">{acc.name}</span>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={equityAllocations[acc.id] || ''}
                      onChange={(e) => setEquityAllocations({...equityAllocations, [acc.id]: parseFloat(e.target.value) || 0})}
                      className="w-32 border rounded-lg px-3 py-2 text-right font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t flex justify-between items-center">
              <div className="text-xs font-bold">
                <span className="text-slate-400 uppercase tracking-widest mr-2">Total Allocated:</span>
                <span className={`font-mono ${Math.abs(((Object.values(equityAllocations) as number[]).reduce((s, v) => s + v, 0)) - periodSummary.netIncome) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ${(Object.values(equityAllocations) as number[]).reduce((s, v) => s + v, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button 
                onClick={handleClose}
                className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-500 transition-all"
              >
                Execute Closing Entry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClosingManager;