
import React, { useState, useEffect } from 'react';
import { NaturalBalance, FinancialStatement, AccountClassification, Account } from '../types';
import { STATEMENTS, STATEMENT_CLASSIFICATION_MAP } from '../constants';

interface Props {
  onClose: () => void;
  onSave: (acc: Account) => void;
}

const AccountModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [naturalBal, setNaturalBal] = useState<NaturalBalance>(NaturalBalance.DEBIT);
  const [statement, setStatement] = useState<FinancialStatement>(FinancialStatement.BALANCE_SHEET);
  const [classification, setClassification] = useState<AccountClassification>(AccountClassification.CURRENT_ASSET);
  const [startBalance, setStartBalance] = useState<string>('0');

  // Sync classification when statement changes
  useEffect(() => {
    const validClassifications = STATEMENT_CLASSIFICATION_MAP[statement];
    if (!validClassifications.includes(classification)) {
      setClassification(validClassifications[0]);
    }
  }, [statement]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    onSave({
      id: Math.random().toString(),
      name,
      naturalBalance: naturalBal,
      financialStatement: statement,
      classification,
      startingBalance: parseFloat(startBalance) || 0
    });
    onClose();
  };

  const currentClassifications = STATEMENT_CLASSIFICATION_MAP[statement];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">New Account Creation</h2>
          <button onClick={onClose} className="hover:text-gray-300">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Account Name</label>
            <input 
              autoFocus
              required
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="e.g. Sales Revenue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Natural Balance</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNaturalBal(NaturalBalance.DEBIT)}
                  className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${naturalBal === NaturalBalance.DEBIT ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  DEBIT
                </button>
                <button
                  type="button"
                  onClick={() => setNaturalBal(NaturalBalance.CREDIT)}
                  className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${naturalBal === NaturalBalance.CREDIT ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  CREDIT
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Statement Purpose</label>
              <select 
                value={statement}
                onChange={(e) => setStatement(e.target.value as FinancialStatement)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              >
                {STATEMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Classification</label>
              <select 
                value={classification}
                onChange={(e) => setClassification(e.target.value as AccountClassification)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              >
                {currentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Starting Balance</label>
              <input 
                type="number"
                step="0.01"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountModal;
