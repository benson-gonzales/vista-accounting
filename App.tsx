import React, { useState, useEffect, useRef, useCallback } from 'react';
// Correctly separating named exports from type imports to resolve resolution issues
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { JournalEntry, Account, TabType, PaymentMethod, AmazonAnalysisRecord, SkuDataMap } from './types';
import { INITIAL_ACCOUNTS } from './constants';
import TransactionRecorder from './components/TransactionRecorder';
import GeneralJournal from './components/GeneralJournal';
import Ledgers from './components/Ledgers';
import BalanceSheet from './components/BalanceSheet';
import IncomeStatement from './components/IncomeStatement';
import CashFlowStatement from './components/CashFlowStatement';
import TrialBalance from './components/TrialBalance';
import AccountModal from './components/AccountModal';
import Dashboard from './components/Dashboard';
import DataManager from './components/DataManager';
import AmazonAnalysis from './components/AmazonAnalysis';
import CogsManager from './components/CogsManager';
import ClosingManager from './components/ClosingManager';
import Login from './components/Login';
import { exportFinancialPackage } from './utils/FinancialExporter';

const safeStringify = (obj: any) => {
  const cache = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return;
      cache.add(value);
    }
    return value;
  });
};

/**
 * Timezone-independent Period Key generator.
 * Converts "2025-01-31" or "Dec 1, 2025" to "Jan25".
 */
const getStandardKey = (dateStr: string) => {
  if (!dateStr) return "INVALID";
  
  // Format: "Dec 1, 2025" (Amazon / Human readable)
  const match = dateStr.match(/([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})/);
  if (match) {
    const month = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase().substring(0, 3);
    const year = match[2].slice(-2);
    return `${month}${year}`;
  }
  
  // Format: "2025-01-31" (ISO / Input Date)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1].slice(-2);
    const monthIdx = parseInt(isoMatch[2]) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[monthIdx]}${year}`;
  }
  
  return "INVALID";
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] = useState<JournalEntry[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([{ name: 'JE', accountId: '' }]);
  const [companyName, setCompanyName] = useState('Vista Shore Products, LLC');
  const [amazonRecords, setAmazonRecords] = useState<AmazonAnalysisRecord[]>([]);
  const [skuData, setSkuData] = useState<SkuDataMap>({});
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // Correct modular syntax for onAuthStateChanged
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const localData = localStorage.getItem(`vista_data_${user.uid}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.accounts) setAccounts(parsed.accounts);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.closedPeriods) setClosedPeriods(parsed.closedPeriods);
        if (parsed.paymentMethods) setPaymentMethods(parsed.paymentMethods);
        if (parsed.companyName) setCompanyName(parsed.companyName);
        if (parsed.amazonRecords) setAmazonRecords(parsed.amazonRecords);
        if (parsed.skuData) setSkuData(parsed.skuData);
      } catch (e) {}
    }

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (isUpdatingRef.current) return;
      if (docSnap.metadata.hasPendingWrites) return;

      setCloudError(null);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          if (data.accounts) setAccounts(data.accounts);
          if (data.transactions) setTransactions(data.transactions);
          if (data.closedPeriods) setClosedPeriods(data.closedPeriods);
          if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
          if (data.companyName) setCompanyName(data.companyName);
          if (data.amazonRecords) setAmazonRecords(data.amazonRecords);
          if (data.skuData) setSkuData(data.skuData);
          
          localStorage.setItem(`vista_data_${user.uid}`, safeStringify(data));
        }
      }
    }, (error) => {
      setCloudError(`Cloud Sync Issue: ${error.message}`);
    });

    return () => unsubscribe();
  }, [user]);

  const saveToFirestore = useCallback(async (
    newAccs: Account[], 
    newTxs: JournalEntry[], 
    newPeriods: string[], 
    newMethods: PaymentMethod[], 
    newName: string,
    newAmazon: AmazonAnalysisRecord[],
    newSku: SkuDataMap,
    lockTime: number = 1500 
  ) => {
    if (!user) return;
    isUpdatingRef.current = true;
    setIsSyncing(true);
    
    const packet = {
      accounts: newAccs,
      transactions: newTxs,
      closedPeriods: newPeriods,
      paymentMethods: newMethods,
      companyName: newName,
      amazonRecords: newAmazon,
      skuData: newSku
    };
    
    localStorage.setItem(`vista_data_${user.uid}`, safeStringify(packet));

    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...packet,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      setCloudError("Failed to save to cloud.");
    } finally {
      setTimeout(() => { 
        isUpdatingRef.current = false; 
        setIsSyncing(false);
      }, lockTime);
    }
  }, [user]);

  const recordTransaction = (entry: JournalEntry) => {
    const updated = [...transactions, entry];
    setTransactions(updated);
    saveToFirestore(accounts, updated, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
  };

  const updateTransaction = (updatedEntry: JournalEntry) => {
    const updated = transactions.map(t => t.id === updatedEntry.id ? updatedEntry : t);
    setTransactions(updated);
    saveToFirestore(accounts, updated, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
  };

  const deleteTransaction = useCallback((id: number) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    const periodKey = getStandardKey(tx.date);
    
    // If it's a closing entry, allow deletion but also reopen the period
    if (tx.isClosingEntry) {
      if (window.confirm(`This is a CLOSING ENTRY for ${periodKey}. Deleting it will REOPEN the books for this period. Proceed?`)) {
        const updatedTxs = transactions.filter(t => t.id !== id);
        const updatedPeriods = closedPeriods.filter(p => p !== periodKey);
        setTransactions(updatedTxs);
        setClosedPeriods(updatedPeriods);
        saveToFirestore(accounts, updatedTxs, updatedPeriods, paymentMethods, companyName, amazonRecords, skuData);
      }
      return;
    }

    if (closedPeriods.includes(periodKey)) {
      alert(`Cannot delete Transaction #${id}. The period ${periodKey} is closed. You must delete the Closing Entry first to reopen the period.`);
      return;
    }

    if (window.confirm(`Permanently delete Transaction #${id}?`)) {
      const updated = transactions.filter(t => t.id !== id);
      setTransactions(updated);
      saveToFirestore(accounts, updated, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
    }
  }, [transactions, accounts, closedPeriods, paymentMethods, companyName, amazonRecords, skuData, saveToFirestore]);

  const onClosePeriod = (periodKey: string, closingEntry: JournalEntry) => {
    if (closedPeriods.includes(periodKey)) {
      alert(`Period ${periodKey} is already closed.`);
      return;
    }
    const newTxs = [...transactions, closingEntry];
    const newPeriods = [...closedPeriods, periodKey];
    setTransactions(newTxs);
    setClosedPeriods(newPeriods);
    saveToFirestore(accounts, newTxs, newPeriods, paymentMethods, companyName, amazonRecords, skuData);
    alert(`Success! The books for ${periodKey} have been closed.`);
  };

  const addAccount = (newAcc: Account) => {
    const updated = [...accounts, newAcc];
    setAccounts(updated);
    saveToFirestore(updated, transactions, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
  };

  const updateAccount = (id: string, updatedFields: Partial<Account>) => {
    const updated = accounts.map(acc => acc.id === id ? { ...acc, ...updatedFields } : acc);
    setAccounts(updated);
    saveToFirestore(updated, transactions, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
  };

  const deleteAccount = (id: string) => {
    const hasData = transactions.some(t => t.lines.some(l => l.accountId === id));
    if (hasData) {
      updateAccount(id, { isArchived: true });
    } else {
      const updated = accounts.filter(acc => acc.id !== id);
      setAccounts(updated);
      saveToFirestore(updated, transactions, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
    }
  };

  const updateAmazonRecords = (recs: AmazonAnalysisRecord[]) => {
    setAmazonRecords(recs);
    saveToFirestore(accounts, transactions, closedPeriods, paymentMethods, companyName, recs, skuData);
  };

  const removeAmazonPeriod = (periodKey: string) => {
    const updated = amazonRecords.filter(r => getStandardKey(r.date) !== periodKey);
    setAmazonRecords(updated);
    saveToFirestore(accounts, transactions, closedPeriods, paymentMethods, companyName, updated, skuData);
  };

  const updateSkuData = (data: SkuDataMap) => {
    setSkuData(data);
    saveToFirestore(accounts, transactions, closedPeriods, paymentMethods, companyName, amazonRecords, data);
  };

  const updateCompanyName = (name: string) => {
    setCompanyName(name);
    saveToFirestore(accounts, transactions, closedPeriods, paymentMethods, name, amazonRecords, skuData);
  };

  const handleImport = (newTxs: JournalEntry[], newAccs: Account[]) => {
    const updatedAccs = [...accounts];
    newAccs.forEach(na => {
      if (!updatedAccs.find(a => a.name.toLowerCase() === na.name.toLowerCase())) {
        updatedAccs.push(na);
      }
    });
    const updatedTxs = [...transactions, ...newTxs];
    setAccounts(updatedAccs);
    setTransactions(updatedTxs);
    saveToFirestore(updatedAccs, updatedTxs, closedPeriods, paymentMethods, companyName, amazonRecords, skuData);
  };

  const handleReset = (full: boolean) => {
    if (full) {
      setAccounts(INITIAL_ACCOUNTS);
      setTransactions([]);
      setClosedPeriods([]);
      setAmazonRecords([]);
      setSkuData({});
      saveToFirestore(INITIAL_ACCOUNTS, [], [], paymentMethods, companyName, [], {});
    } else {
      setTransactions([]);
      setClosedPeriods([]);
      saveToFirestore(accounts, [], [], paymentMethods, companyName, amazonRecords, skuData);
    }
  };

  const addPaymentMethod = (name: string, accountId: string) => {
    const updated = [...paymentMethods, { name, accountId }];
    setPaymentMethods(updated);
    saveToFirestore(accounts, transactions, closedPeriods, updated, companyName, amazonRecords, skuData);
  };

  const removePaymentMethod = (name: string) => {
    const updated = paymentMethods.filter(m => m.name !== name);
    setPaymentMethods(updated);
    saveToFirestore(accounts, transactions, closedPeriods, updated, companyName, amazonRecords, skuData);
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-pulse w-12 h-12 bg-emerald-500 rounded-lg"></div></div>;
  if (!user) return <Login />;

  const tabs: TabType[] = ['Dashboard', 'Transaction Recorder', 'Ledgers', 'General Journal', 'BS', 'IS', 'CF', 'Trial Balance', 'Amazon Analysis', 'COGS Manager', 'Closing Manager', 'Data Manager'];

  return (
    <div className="min-h-screen flex flex-col">
      {cloudError && <div className="bg-amber-600 text-white px-4 py-2 text-[10px] font-bold text-center">{cloudError}</div>}
      {isSyncing && (
        <div className="fixed bottom-6 right-6 z-[999] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-2 h-2 rounded-full animate-ping bg-emerald-500"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">Processing Data Update...</span>
        </div>
      )}
      
      <header className="bg-slate-900 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 p-2 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2"></path></svg></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tighter text-white uppercase">VISTA SHORE</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => exportFinancialPackage(transactions, accounts, companyName, amazonRecords, skuData)}
            className="bg-indigo-600 px-4 py-2 rounded text-sm font-bold shadow-md hover:bg-indigo-500 transition-colors text-white"
          >
            Download Package (.xlsx)
          </button>
          <button onClick={() => setShowAccountModal(true)} className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold shadow-md hover:bg-emerald-500 transition-colors text-white">+ New Account</button>
          <button onClick={() => signOut(auth)} className="bg-slate-800 px-4 py-2 rounded text-sm text-slate-300 hover:text-white transition-colors">Logout</button>
        </div>
      </header>

      <nav className="bg-white border-b flex overflow-x-auto no-scrollbar shadow-sm sticky top-[72px] z-40">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-xs font-bold whitespace-nowrap transition-all border-b-4 ${activeTab === tab ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{tab}</button>
        ))}
      </nav>

      <main className="flex-1 p-6 overflow-y-auto bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[600px]">
            {activeTab === 'Dashboard' && <Dashboard transactions={transactions} accounts={accounts} onNavigate={setActiveTab} paymentMethods={paymentMethods} companyName={companyName} />}
            {activeTab === 'Transaction Recorder' && <TransactionRecorder accounts={accounts} onRecord={recordTransaction} lastId={transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) : 0} paymentMethods={paymentMethods} closedPeriods={closedPeriods} />}
            {activeTab === 'General Journal' && <GeneralJournal transactions={transactions} accounts={accounts} onDelete={deleteTransaction} onUpdate={updateTransaction} closedPeriods={closedPeriods} paymentMethods={paymentMethods} />}
            {activeTab === 'Ledgers' && <Ledgers transactions={transactions} accounts={accounts} onUpdateAccount={updateAccount} onDeleteAccount={deleteAccount} onDeleteTransaction={deleteTransaction} />}
            {activeTab === 'BS' && <BalanceSheet transactions={transactions} accounts={accounts} companyName={companyName} />}
            {activeTab === 'IS' && <IncomeStatement transactions={transactions} accounts={accounts} companyName={companyName} />}
            {activeTab === 'CF' && <CashFlowStatement transactions={transactions} accounts={accounts} companyName={companyName} />}
            {activeTab === 'Trial Balance' && <TrialBalance transactions={transactions} accounts={accounts} />}
            {activeTab === 'Amazon Analysis' && <AmazonAnalysis skuData={skuData} records={amazonRecords} onUpdateRecords={updateAmazonRecords} onRemovePeriod={removeAmazonPeriod} companyName={companyName} isSyncing={isSyncing} />}
            {activeTab === 'COGS Manager' && <CogsManager skuData={skuData} onUpdateSkuData={updateSkuData} />}
            {activeTab === 'Closing Manager' && <ClosingManager transactions={transactions} accounts={accounts} closedPeriods={closedPeriods} onClosePeriod={onClosePeriod} />}
            {activeTab === 'Data Manager' && <DataManager accounts={accounts} transactions={transactions} onImport={handleImport} onReset={handleReset} paymentMethods={paymentMethods} onAddMethod={addPaymentMethod} onRemoveMethod={removePaymentMethod} companyName={companyName} onUpdateCompanyName={updateCompanyName} />}
          </div>
        </div>
      </main>
      {showAccountModal && <AccountModal onClose={() => setShowAccountModal(false)} onSave={addAccount} />}
    </div>
  );
};

export default App;