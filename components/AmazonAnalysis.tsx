import React, { useMemo, useState } from 'react';
import { AmazonAnalysisRecord, AmazonCategory, SkuDataMap } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  skuData: SkuDataMap;
  records: AmazonAnalysisRecord[];
  onUpdateRecords: (recs: AmazonAnalysisRecord[]) => void;
  onRemovePeriod: (period: string) => void;
  companyName: string;
  isSyncing?: boolean;
}

// SHARED SOURCE OF TRUTH HELPER
// Replaces timezone-sensitive Date() parsing with specific text extraction
const getStandardKey = (dateStr: string) => {
  if (!dateStr) return "INVALID";
  
  // Regex to capture "Dec" and "2025" from "Dec 1, 2025 1:11:10 AM PST"
  // It matches the first word (Month) and the year following a comma
  const match = dateStr.match(/([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})/);
  
  if (match) {
    const month = match[1]; // e.g. "Dec"
    const year = match[2].slice(-2); // e.g. "25"
    // Normalize month to Title Case just in case (Dec, dec, DEC -> Dec)
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase().substring(0, 3);
    return `${formattedMonth}${year}`;
  }
  
  return "INVALID";
};

const AmazonAnalysis: React.FC<Props> = ({ skuData, records, onUpdateRecords, onRemovePeriod, companyName, isSyncing }) => {
  const [sortMonth, setSortMonth] = useState<string | null>(null);
  const [feeSortMonth, setFeeSortMonth] = useState<string | null>(null);

  const handleClearPeriod = (p: string) => {
    onRemovePeriod(p);
  };

  const processAmazonCSV = (csv: string) => {
    const lines = csv.split('\n');
    const summaryMap = new Map<string, AmazonAnalysisRecord>();
    
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('date/time') && lines[i].toLowerCase().includes('type')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      alert("Format Error: Ensure this is a raw Amazon Settlement report.");
      return;
    }

    const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim());
    const dataLines = lines.slice(headerIdx + 1);

    dataLines.forEach((line) => {
      if (!line.trim()) return;
      const values = line.match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/"/g, '').trim()) || [];
      if (values.length < 5) return;

      const getVal = (name: string) => {
        const i = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        return i !== -1 ? values[i] : '';
      };

      const dateStr = getVal('date/time');
      const type = getVal('type');
      const sku = getVal('sku') || 'NON-SKU';
      const description = getVal('description') || '';
      const qty = parseInt(getVal('quantity')) || 0;

      const periodKey = getStandardKey(dateStr);
      if (periodKey === "INVALID") return;

      const parseNum = (val: string) => {
        const cleaned = val.replace(/[(),]/g, (match) => match === '(' || match === ')' ? '' : '').replace(/\$/g, '').trim();
        const num = parseFloat(cleaned) || 0;
        return val.includes('(') ? -Math.abs(num) : num;
      };

      const productSales = parseNum(getVal('product sales'));
      const productSalesTax = parseNum(getVal('product sales tax'));
      const shippingCreditsTax = parseNum(getVal('shipping credits tax'));
      const marketplaceTax = parseNum(getVal('marketplace withheld tax'));
      const sellingFees = parseNum(getVal('selling fees'));
      const fbaFees = parseNum(getVal('fba fees'));
      const otherTrans = parseNum(getVal('other transaction fees'));
      const total = parseNum(getVal('total'));

      const addToSummary = (cat: AmazonCategory, amt: number, q: number = 0, specificType?: string) => {
        if (Math.abs(amt) < 0.001 && q === 0) return;
        const key = `${periodKey}|${sku}|${cat}|${specificType || type}`;
        const existing = summaryMap.get(key);
        if (existing) {
          existing.amount += amt;
          existing.quantity += q;
        } else {
          summaryMap.set(key, {
            id: `agg-${key}-${Math.random().toString(36).substr(2, 9)}`,
            date: dateStr,
            sku,
            orderId: 'SUMMARY',
            type: specificType || type,
            description: 'Summary Entry',
            category: cat,
            amount: amt,
            quantity: q
          });
        }
      };

      const lType = type.toLowerCase();
      const lDesc = description.toLowerCase();

      // CATEGORIZATION DIGGING LOGIC
      if (lType === 'order') {
        addToSummary('Revenue', productSales, qty);
        addToSummary('Selling fees', sellingFees);
        addToSummary('FBA fees', fbaFees);
        if (lDesc.includes('shipping')) addToSummary('FBM shipping fees', otherTrans);
        else addToSummary('Other fees', otherTrans);
        
        const netTax = productSalesTax + marketplaceTax + shippingCreditsTax;
        if (Math.abs(netTax) > 0.01) addToSummary('Other', netTax);
      } 
      else if (lType === 'refund') {
        addToSummary('Revenue', productSales, qty);
        addToSummary('Selling fees', sellingFees);
        addToSummary('FBA fees', fbaFees);
        addToSummary('Return fees', otherTrans);
      }
      else if (lType === 'adjustment') {
        if (lDesc.includes('reimbursement')) addToSummary('FBA reimbursement', total, qty);
        else if (lDesc.includes('storage')) addToSummary('FBA storage fees', total, qty);
        else addToSummary('Other', total, qty);
      }
      else if (lType === 'service fee') {
        if (lDesc.includes('subscription')) addToSummary('Account subscription', total);
        else if (lDesc.includes('advertising') || lDesc.includes('cost per click')) addToSummary('Advertising fees', total);
        else if (lDesc.includes('storage')) addToSummary('FBA storage fees', total);
        else if (lDesc.includes('inbound') || lDesc.includes('placement')) addToSummary('Inbound shipping fees', total);
        else addToSummary('Other', total);
      }
      else if (lType === 'fba transaction fees' || lType === 'fba inventory fee') {
        if (lDesc.includes('storage')) addToSummary('FBA storage fees', total);
        else if (lDesc.includes('awd')) addToSummary('AWD fees', total);
        else if (lDesc.includes('disposal')) addToSummary('FBA disposal fees', total);
        else if (lDesc.includes('return')) addToSummary('Return fees', total);
        else if (lDesc.includes('inbound') || lDesc.includes('transportation')) addToSummary('Inbound shipping fees', total);
        else addToSummary('FBA fees other', total);
      }
      else if (lType === 'transfer') addToSummary('Transfer', total);
      else if (lType === 'shipping services') addToSummary('FBM shipping fees', total);
      else {
        // Deep diving into anything else falling through
        if (lDesc.includes('storage')) addToSummary('FBA storage fees', total);
        else if (lDesc.includes('advertising')) addToSummary('Advertising fees', total);
        else if (lDesc.includes('referral') || lDesc.includes('selling fee')) addToSummary('Selling fees', total);
        else if (lDesc.includes('fulfillment')) addToSummary('FBA fees', total);
        else addToSummary('Other', total);
      }
    });

    const currentMap = new Map<string, AmazonAnalysisRecord>();
    records.forEach(r => {
      const pk = getStandardKey(r.date);
      const key = `${pk}|${r.sku}|${r.category}|${r.type}`;
      currentMap.set(key, { ...r });
    });

    summaryMap.forEach((val, key) => {
      const existing = currentMap.get(key);
      if (existing) {
        existing.amount += val.amount;
        existing.quantity += val.quantity;
      } else {
        currentMap.set(key, val);
      }
    });

    onUpdateRecords(Array.from(currentMap.values()));
  };

  const pivotData = useMemo(() => {
    const periodSet = new Set<string>();
    const skuSet = new Set<string>();
    const amountMap: any = {};
    const cogsMap: Record<string, { orderCogs: number, refundCogs: number, adjustmentCogs: number }> = {};
    
    const normalize = (s: string) => s?.trim().toUpperCase() || '';
    const normalizedSkuData: SkuDataMap = {};
    Object.keys(skuData).forEach(k => { normalizedSkuData[normalize(k)] = skuData[k]; });

    records.forEach(r => {
      const pk = getStandardKey(r.date);
      if (pk === "INVALID") return;
      periodSet.add(pk);
      if (r.sku && r.sku !== 'NON-SKU') skuSet.add(r.sku);

      if (!amountMap[pk]) amountMap[pk] = {};
      if (!amountMap[pk][r.category]) amountMap[pk][r.category] = { _total: 0 };
      if (!amountMap[pk][r.category][r.sku]) amountMap[pk][r.category][r.sku] = {};
      if (!amountMap[pk][r.category][r.sku][r.type]) amountMap[pk][r.category][r.sku][r.type] = 0;

      amountMap[pk][r.category][r.sku][r.type] += r.amount;
      amountMap[pk][r.category]._total += r.amount;

      if (!cogsMap[pk]) cogsMap[pk] = { orderCogs: 0, refundCogs: 0, adjustmentCogs: 0 };
      const normalizedSku = normalize(r.sku);
      const unitCost = normalizedSkuData[normalizedSku]?.cost || 0;

      if (r.type === 'Order') cogsMap[pk].orderCogs += (r.quantity * unitCost);
      else if (r.type === 'Refund') cogsMap[pk].refundCogs += (r.quantity * unitCost);
      else if (r.type === 'Adjustment' || r.category === 'FBA reimbursement') cogsMap[pk].adjustmentCogs += (r.quantity * unitCost);
    });

    const sortedPeriods = Array.from(periodSet).sort((a, b) => {
      const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const parse = (s: string) => new Date(2000 + parseInt(s.slice(3)), months[s.slice(0, 3)]).getTime();
      return parse(a) - parse(b);
    });

    return { periods: sortedPeriods, skus: Array.from(skuSet).sort(), amountMap, cogsMap };
  }, [records, skuData]);

  const getAmt = (period: string, cat: AmazonCategory, sku?: string, type?: string) => {
    const p = pivotData.amountMap[period];
    if (!p || !p[cat]) return 0;
    if (!sku) {
      if (!type) return p[cat]._total;
      let typeTotal = 0;
      Object.keys(p[cat]).forEach(sKey => {
        if (sKey === '_total') return;
        if (p[cat][sKey][type]) typeTotal += p[cat][sKey][type];
      });
      return typeTotal;
    }
    if (!p[cat][sku]) return 0;
    if (!type) return Object.values(p[cat][sku]).reduce((s: any, v: any) => s + v, 0);
    return p[cat][sku][type] || 0;
  };

  const sortedSkus = useMemo(() => {
    if (!sortMonth) return pivotData.skus;
    return [...pivotData.skus].sort((a, b) => {
      const valA = getAmt(sortMonth, 'Revenue', a);
      const valB = getAmt(sortMonth, 'Revenue', b);
      return valB - valA;
    });
  }, [pivotData.skus, sortMonth, pivotData.amountMap]);

  const FEE_LIST: AmazonCategory[] = [
    'Selling fees', 'FBA fees', 'FBA reimbursement', 'FBM shipping fees', 'Advertising fees',
    'FBA shipping fees', 'Inbound shipping fees', 'Account subscription', 'FBA fees other',
    'FBA storage fees', 'Return fees', 'Other fees', 'Other', 'AWD fees', 'FBA disposal fees',
    'Settlement expense'
  ];

  const sortedFeeList = useMemo(() => {
    if (!feeSortMonth) return FEE_LIST;
    return [...FEE_LIST].sort((a, b) => {
      const valA = Math.abs(getAmt(feeSortMonth, a));
      const valB = Math.abs(getAmt(feeSortMonth, b));
      return valB - valA;
    });
  }, [feeSortMonth, pivotData.amountMap]);

  return (
    <div className="space-y-12 pb-24">
      <div className="flex justify-between items-center border-b-2 border-slate-900 pb-6">
        <div className="flex flex-col">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{companyName}</h2>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Aggregated Amazon Reconciliation</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <input type="file" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => processAmazonCSV(ev.target?.result as string);
            reader.readAsText(file);
          }} accept=".csv" className="hidden" id="amz-upload" disabled={isSyncing} />
          <label htmlFor="amz-upload" className={`bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 cursor-pointer active:scale-95'}`}>
            Upload Settlement CSV
          </label>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-slate-100 rounded-3xl p-32 text-center border-2 border-dashed border-slate-200">
          <span className="text-5xl mb-6 block opacity-20">📦</span>
          <p className="text-slate-400 font-bold italic">Upload your Settlement Report CSV to populate the summaries.</p>
        </div>
      ) : (
        <div className="space-y-20 animate-in fade-in duration-500">
          
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-emerald-500 pl-3">Revenue by product</h3>
              {sortMonth && (
                <button onClick={() => setSortMonth(null)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Reset Sort</button>
              )}
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-4 font-black uppercase text-slate-400 w-96">Product Description</th>
                    {pivotData.periods.map(p => (
                      <th key={p} className="p-4 font-black text-slate-900 text-right group/th relative transition-opacity">
                        <div className="flex flex-col items-end">
                          <span className="mb-1">{p}</span>
                          <div className="flex gap-2 opacity-0 group-hover/th:opacity-100 transition-opacity">
                            <button onClick={() => setSortMonth(p)} className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:underline">Sort</button>
                            <button onClick={() => handleClearPeriod(p)} className="text-[8px] font-black uppercase tracking-widest text-red-500 hover:underline">Clear</button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSkus.map(sku => (
                    <tr key={sku} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-600 truncate max-w-sm" title={sku}>{skuData[sku]?.name || sku}</td>
                      {pivotData.periods.map(p => {
                        const val = getAmt(p, 'Revenue', sku);
                        return <td key={p} className="p-4 text-right font-mono text-slate-900">
                          {val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                      })}
                    </tr>
                  ))}
                  <tr className="bg-slate-900 text-white font-black">
                    <td className="p-4 uppercase tracking-widest text-[10px]">Total Revenue</td>
                    {pivotData.periods.map(p => <td key={p} className="p-4 text-right font-mono">
                      ${getAmt(p, 'Revenue').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-blue-500 pl-3">Gross to net revenue recon</h3>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-4 font-black uppercase text-slate-400 w-96">$</th>
                    {pivotData.periods.map(p => <th key={p} className="p-4 font-black text-slate-900 text-right">{p}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Revenue</td>
                    {pivotData.periods.map(p => <td key={p} className="p-4 text-right font-mono">{getAmt(p, 'Revenue', undefined, 'Order').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Refunds</td>
                    {pivotData.periods.map(p => {
                      const val = getAmt(p, 'Revenue', undefined, 'Refund');
                      return <td key={p} className="p-4 text-right font-mono text-red-500">{val !== 0 ? `(${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '-'}</td>
                    })}
                  </tr>
                  <tr className="bg-slate-900 text-emerald-400 font-black">
                    <td className="p-4 uppercase tracking-widest text-[10px]">Revenue, net</td>
                    {pivotData.periods.map(p => <td key={p} className="p-4 text-right font-mono">${getAmt(p, 'Revenue').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-amber-500 pl-3">Amazon fees</h3>
              {feeSortMonth && (
                <button onClick={() => setFeeSortMonth(null)} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Reset Sort</button>
              )}
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-4 font-black uppercase text-slate-400 w-96">$</th>
                    {pivotData.periods.map(p => (
                      <th key={p} className="p-4 font-black text-slate-900 text-right group/th relative transition-opacity">
                        <div className="flex flex-col items-end">
                          <span className="mb-1">{p}</span>
                          <div className="flex gap-2 opacity-0 group-hover/th:opacity-100 transition-opacity">
                            <button onClick={() => setFeeSortMonth(p)} className="text-[8px] font-black uppercase tracking-widest text-amber-600 hover:underline">Sort</button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedFeeList.map(fee => (
                    <tr key={fee} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-700">{fee}</td>
                      {pivotData.periods.map(p => {
                        const val = getAmt(p, fee as AmazonCategory);
                        const isReimbursement = fee === 'FBA reimbursement';
                        return <td key={p} className={`p-4 text-right font-mono ${isReimbursement && val > 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                          {val === 0 ? '-' : (val > 0 && isReimbursement ? `(${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                        </td>
                      })}
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-200">
                    <td className="p-4 uppercase tracking-widest text-[10px]">Total</td>
                    {pivotData.periods.map(p => {
                      const feeSum = FEE_LIST.reduce((s, f) => s + getAmt(p, f as AmazonCategory), 0);
                      return <td key={p} className="p-4 text-right font-mono">${Math.abs(feeSum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 border-l-4 border-indigo-600 pl-3">Profitability & Margin Analysis</h3>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] w-96">Performance Metric</th>
                    {pivotData.periods.map(p => <th key={p} className="p-4 text-right font-black uppercase text-[10px] tracking-widest">{p}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Total Revenue (Net)</td>
                    {pivotData.periods.map(p => (
                      <td key={p} className="p-4 text-right font-mono text-emerald-600 font-bold">
                        ${getAmt(p, 'Revenue').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-700">Total Amazon Fees</td>
                    {pivotData.periods.map(p => {
                      const feeSum = FEE_LIST.reduce((s, f) => s + getAmt(p, f as AmazonCategory), 0);
                      return (
                        <td key={p} className="p-4 text-right font-mono text-red-500">
                          (${Math.abs(feeSum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="p-4 font-bold text-slate-700 italic">Transfers, Calculated</td>
                    {pivotData.periods.map(p => {
                      const rev = getAmt(p, 'Revenue');
                      const fees = FEE_LIST.reduce((s, f) => s + getAmt(p, f as AmazonCategory), 0);
                      const calculated = rev + fees;
                      return (
                        <td key={p} className="p-4 text-right font-mono text-emerald-600 font-bold">
                          ${calculated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-slate-500">Reconciling factor</td>
                    {pivotData.periods.map(p => {
                      const rev = getAmt(p, 'Revenue');
                      const fees = FEE_LIST.reduce((s, f) => s + getAmt(p, f as AmazonCategory), 0);
                      const calculated = rev + fees;
                      const reported = Math.abs(getAmt(p, 'Transfer'));
                      const factor = calculated - reported;
                      return (
                        <td key={p} className={`p-4 text-right font-mono ${Math.abs(factor) > 0.01 ? 'text-amber-600' : 'text-slate-400'}`}>
                          ${factor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-4 font-black text-slate-900 italic">Net Amazon Transfer (Reported)</td>
                    {pivotData.periods.map(p => {
                      const transfer = Math.abs(getAmt(p, 'Transfer'));
                      return (
                        <td key={p} className="p-4 text-right font-mono font-black text-emerald-700">
                          ${transfer.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="h-4"></tr>
                  <tr>
                    <td className="p-4 font-medium text-slate-600">Est. Cost of Goods (Orders)</td>
                    {pivotData.periods.map(p => {
                      const val = (pivotData.cogsMap[p]?.orderCogs || 0);
                      return <td key={p} className="p-4 text-right font-mono text-red-600 font-bold">{val !== 0 ? `(${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '-'}</td>
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-slate-600 italic">COGS Adjustment (Lost inventory)</td>
                    {pivotData.periods.map(p => {
                      const val = pivotData.cogsMap[p]?.adjustmentCogs || 0;
                      return <td key={p} className={`p-4 text-right font-mono ${val > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {val !== 0 ? (val > 0 ? `(${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-'}
                      </td>
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-slate-600">COGS Reversal (Returns)</td>
                    {pivotData.periods.map(p => {
                      const val = Math.abs(pivotData.cogsMap[p]?.refundCogs || 0);
                      return <td key={p} className="p-4 text-right font-mono text-emerald-600 font-bold">{val !== 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    })}
                  </tr>
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700">
                    <td className="p-4 text-xs uppercase tracking-[0.2em]">Gross Profit</td>
                    {pivotData.periods.map(p => {
                      const transfer = Math.abs(getAmt(p, 'Transfer'));
                      const orderCogs = pivotData.cogsMap[p]?.orderCogs || 0;
                      const adjCogs = pivotData.cogsMap[p]?.adjustmentCogs || 0;
                      const returnCogs = Math.abs(pivotData.cogsMap[p]?.refundCogs || 0);
                      const profit = transfer - orderCogs - adjCogs + returnCogs;
                      return <td key={p} className={`p-4 text-right font-mono text-base ${profit < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    })}
                  </tr>
                  <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                    <td className="p-4 font-black text-indigo-900 uppercase tracking-widest text-[10px]">Gross Margin</td>
                    {pivotData.periods.map(p => {
                      const revenue = getAmt(p, 'Revenue');
                      const transfer = Math.abs(getAmt(p, 'Transfer'));
                      const orderCogs = pivotData.cogsMap[p]?.orderCogs || 0;
                      const adjCogs = pivotData.cogsMap[p]?.adjustmentCogs || 0;
                      const returnCogs = Math.abs(pivotData.cogsMap[p]?.refundCogs || 0);
                      const profit = transfer - orderCogs - adjCogs + returnCogs;
                      const margin = revenue !== 0 ? (profit / revenue) * 100 : 0;
                      return <td key={p} className="p-4 text-right font-mono font-black text-indigo-800 text-base">{margin.toFixed(1)}%</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] font-bold text-slate-400 italic px-4">Note: Gross Profit = Reported Amazon Transfer - (Order COGS + Adjustment COGS) + Returned Inventory Value.</p>
          </section>
        </div>
      )}
    </div>
  );
};

export default AmazonAnalysis;