import React, { useRef, useState } from 'react';
import { SkuDataMap } from '../types';

interface Props {
  skuData: SkuDataMap;
  onUpdateSkuData: (data: SkuDataMap) => void;
}

const CogsManager: React.FC<Props> = ({ skuData, onUpdateSkuData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States for manual entry
  const [manualSku, setManualSku] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCost, setManualCost] = useState('');

  const downloadTemplate = () => {
    const csv = "sku,item_name,unit_cogs\nSKU-123,Product Example,5.50\n";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "cogs_template.csv";
    a.click();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const lines = csv.split('\n');
      const newData: SkuDataMap = { ...skuData };
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [sku, name, cost] = line.split(',').map(v => v.replace(/"/g, '').trim());
        if (sku) {
          const parsedCost = parseFloat(cost) || 0;
          newData[sku] = { name: name || sku, cost: Math.round(parsedCost * 100) / 100 };
        }
      }
      onUpdateSkuData(newData);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert("SKU data updated successfully!");
    };
    reader.readAsText(file);
  };

  const handleAddManual = () => {
    if (!manualSku.trim()) {
      alert("Please enter a SKU code.");
      return;
    }
    
    const cost = parseFloat(manualCost) || 0;
    const newData: SkuDataMap = {
      ...skuData,
      [manualSku.trim()]: {
        name: manualName.trim() || manualSku.trim(),
        cost: Math.round(cost * 100) / 100
      }
    };
    
    onUpdateSkuData(newData);
    setManualSku('');
    setManualName('');
    setManualCost('');
    alert(`Successfully added ${manualSku.trim()}!`);
  };

  const sortedSkus = Object.keys(skuData).sort();

  return (
    <div className="space-y-12">
      {/* SECTION: Weighted Average Costs */}
      <section className="space-y-8">
        <div className="flex justify-between items-end border-b pb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">COGS Manager</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Weighted Average Product Costs</p>
          </div>
          <div className="flex gap-3">
            <button onClick={downloadTemplate} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200">
              Get Template
            </button>
            <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".csv" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-95">
              Upload SKU Costs
            </button>
          </div>
        </div>

        {/* Manual Addition Form */}
        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px] space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">SKU Code</label>
            <input 
              type="text" 
              placeholder="e.g. ABC-123"
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-emerald-200"
            />
          </div>
          <div className="flex-[2] min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Item Name</label>
            <input 
              type="text" 
              placeholder="Full Product Description"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-emerald-200"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">Unit Cost ($)</label>
            <input 
              type="text" 
              placeholder="0.00"
              value={manualCost}
              onChange={(e) => setManualCost(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm font-mono font-bold text-right focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-emerald-200"
            />
          </div>
          <button 
            onClick={handleAddManual}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-95 self-end h-[42px]"
          >
            Add Item
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 text-left font-black uppercase text-[10px] text-slate-400 w-1/4">SKU Code</th>
                <th className="p-4 text-left font-black uppercase text-[10px] text-slate-400">Item Name</th>
                <th className="p-4 text-right font-black uppercase text-[10px] text-slate-400 w-32">Unit Cost</th>
                <th className="p-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSkus.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 italic">No SKU data configured. Upload a CSV to get started.</td>
                </tr>
              )}
              {sortedSkus.map(sku => (
                <tr key={sku} className="group hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-slate-900">{sku}</td>
                  <td className="p-4">
                    <input 
                      type="text" value={skuData[sku].name} 
                      onChange={(e) => onUpdateSkuData({ ...skuData, [sku]: { ...skuData[sku], name: e.target.value } })}
                      className="w-full bg-transparent border-b border-transparent group-hover:border-slate-200 focus:border-emerald-500 focus:ring-0 outline-none font-medium"
                    />
                  </td>
                  <td className="p-4 text-right">
                    <div className="relative inline-block">
                      <span className="absolute left-2 top-2 text-xs text-slate-400">$</span>
                      <input 
                        type="text" 
                        value={Number(skuData[sku].cost || 0).toFixed(2)} 
                        onChange={(e) => {
                          const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                          const val = rawVal === '' ? 0 : parseFloat(rawVal);
                          onUpdateSkuData({ ...skuData, [sku]: { ...skuData[sku], cost: isNaN(val) ? 0 : val } });
                        }}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const rounded = Math.round(val * 100) / 100;
                          onUpdateSkuData({ ...skuData, [sku]: { ...skuData[sku], cost: rounded } });
                        }}
                        className="w-24 bg-transparent border-b border-transparent group-hover:border-slate-200 focus:border-emerald-500 focus:ring-0 outline-none text-right font-mono font-bold"
                      />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => {
                        const next = { ...skuData };
                        delete next[sku];
                        onUpdateSkuData(next);
                      }}
                      className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all font-bold"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CogsManager;