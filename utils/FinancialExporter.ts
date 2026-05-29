import * as XLSX from 'xlsx';
import { JournalEntry, Account, NaturalBalance, AccountClassification, FinancialStatement, AmazonAnalysisRecord, SkuDataMap, AmazonCategory } from '../types';

const getStandardKey = (dateStr: string) => {
  if (!dateStr) return "INVALID";
  const match = dateStr.match(/([a-zA-Z]+)\s+\d{1,2},\s+(\d{4})/);
  if (match) {
    const month = match[1];
    const year = match[2].slice(-2);
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase().substring(0, 3);
    return `${formattedMonth}${year}`;
  }
  return "INVALID";
};

/**
 * Helper to get cumulative balance of an account up to a specific YYYY-MM period end.
 */
const getCumulativeBalance = (accountId: string, period: string, transactions: JournalEntry[], accounts: Account[]) => {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return 0;
  
  let balance = Number(account.startingBalance) || 0;
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const cutoffStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  transactions.forEach(tx => {
    if (tx.date <= cutoffStr) {
      tx.lines.forEach(l => {
        if (l.accountId === accountId) {
          if (account.naturalBalance === NaturalBalance.DEBIT) balance += (l.debit - l.credit);
          else balance += (l.credit - l.debit);
        }
      });
    }
  });
  return balance;
};

/**
 * Helper to get monthly activity (Net) for Income Statement accounts.
 */
const getMonthlyActivity = (accountId: string, period: string, transactions: JournalEntry[], accounts: Account[]) => {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return 0;
  
  let activity = 0;
  const [year, month] = period.split('-').map(Number);

  transactions.filter(tx => !tx.isClosingEntry).forEach(tx => {
    const date = new Date(tx.date);
    if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
      tx.lines.forEach(l => {
        if (l.accountId === accountId) {
          if (account.naturalBalance === NaturalBalance.DEBIT) activity += (l.debit - l.credit);
          else activity += (l.credit - l.debit);
        }
      });
    }
  });
  return activity;
};

export const exportFinancialPackage = (
  transactions: JournalEntry[], 
  accounts: Account[], 
  companyName: string,
  amazonRecords: AmazonAnalysisRecord[] = [],
  skuData: SkuDataMap = {}
) => {
  const wb = XLSX.utils.book_new();
  const periods = Array.from(new Set(transactions.map(t => t.date.slice(0, 7)))).sort();
  const indent = (s: string) => "  " + s;

  // --- 1. INCOME STATEMENT ---
  const isRows: any[] = [
    [`${companyName} - INCOME STATEMENT`],
    [`Exported: ${new Date().toLocaleDateString()}`],
    [],
    ["Account / Line Item", ...periods]
  ];

  const buildISSection = (title: string, classification: AccountClassification) => {
    isRows.push([title.toUpperCase()]);
    const filtered = accounts.filter(a => a.classification === classification);
    filtered.forEach(acc => {
      const row: (string | number)[] = [indent(acc.name)];
      periods.forEach(p => row.push(getMonthlyActivity(acc.id, p, transactions, accounts)));
      isRows.push(row);
    });
    const totalRow: (string | number)[] = [`TOTAL ${title.toUpperCase()}`];
    periods.forEach(p => {
      const total = filtered.reduce((sum, a) => sum + getMonthlyActivity(a.id, p, transactions, accounts), 0);
      totalRow.push(total);
    });
    isRows.push(totalRow);
    isRows.push([]);
  };

  buildISSection("Revenue", AccountClassification.REVENUE);
  buildISSection("Cost of Goods Sold", AccountClassification.COGS);
  
  const gpRow: (string | number)[] = ["GROSS PROFIT"];
  periods.forEach(p => {
    const rev = accounts.filter(a => a.classification === AccountClassification.REVENUE).reduce((sum, a) => sum + getMonthlyActivity(a.id, p, transactions, accounts), 0);
    const cogs = accounts.filter(a => a.classification === AccountClassification.COGS).reduce((sum, a) => sum + getMonthlyActivity(a.id, p, transactions, accounts), 0);
    gpRow.push(rev - cogs);
  });
  isRows.push(gpRow);
  isRows.push([]);

  buildISSection("Operating Expenses", AccountClassification.OPERATING_EXPENSE);
  buildISSection("Other Income (Expenses)", AccountClassification.OTHER_INCOME_EXPENSE);

  const netIncRow: (string | number)[] = ["NET INCOME"];
  periods.forEach(p => {
    let income = 0;
    accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT).forEach(acc => {
      const act = getMonthlyActivity(acc.id, p, transactions, accounts);
      if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) income += act;
      else income -= act;
    });
    netIncRow.push(income);
  });
  isRows.push(netIncRow);

  const isSheet = XLSX.utils.aoa_to_sheet(isRows);
  XLSX.utils.book_append_sheet(wb, isSheet, "Income Statement");

  // --- 2. BALANCE SHEET ---
  const bsRows: any[] = [
    [`${companyName} - BALANCE SHEET`],
    [`Exported: ${new Date().toLocaleDateString()}`],
    [],
    ["Account / Line Item", ...periods]
  ];

  const buildBSSection = (title: string, classifications: AccountClassification[]) => {
    bsRows.push([title.toUpperCase()]);
    classifications.forEach(cls => {
      const filtered = accounts.filter(a => a.classification === cls && a.financialStatement === FinancialStatement.BALANCE_SHEET);
      filtered.forEach(acc => {
        const row: (string | number)[] = [indent(acc.name)];
        periods.forEach(p => row.push(getCumulativeBalance(acc.id, p, transactions, accounts)));
        bsRows.push(row);
      });
    });
    const totalRow: (string | number)[] = [`TOTAL ${title.toUpperCase()}`];
    periods.forEach(p => {
      let total = 0;
      classifications.forEach(cls => {
        accounts.filter(a => a.classification === cls && a.financialStatement === FinancialStatement.BALANCE_SHEET).forEach(a => {
          const bal = getCumulativeBalance(a.id, p, transactions, accounts);
          if (cls === AccountClassification.EQUITY || cls === AccountClassification.CURRENT_LIABILITY || cls === AccountClassification.LONG_TERM_LIABILITY) {
            total += (a.naturalBalance === NaturalBalance.CREDIT ? bal : -bal);
          } else {
            total += bal;
          }
        });
      });
      totalRow.push(total);
    });
    bsRows.push(totalRow);
    bsRows.push([]);
    return totalRow;
  };

  buildBSSection("Assets", [AccountClassification.CURRENT_ASSET, AccountClassification.LONG_TERM_ASSET]);
  buildBSSection("Liabilities", [AccountClassification.CURRENT_LIABILITY, AccountClassification.LONG_TERM_LIABILITY]);
  
  bsRows.push(["EQUITY"]);
  const equityAccs = accounts.filter(a => a.classification === AccountClassification.EQUITY);
  equityAccs.forEach(acc => {
    const row: (string | number)[] = [indent(acc.name)];
    periods.forEach(p => row.push(getCumulativeBalance(acc.id, p, transactions, accounts)));
    bsRows.push(row);
  });

  const earningsRow: (string | number)[] = [indent("Current Period Earnings")];
  periods.forEach(p => {
    let totalCredits = 0;
    let totalDebits = 0;
    const isIds = new Set(accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT).map(a => a.id));
    const [year, month] = p.split('-').map(Number);
    const cutoffStr = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
    transactions.forEach(tx => {
      if (tx.date <= cutoffStr) {
        tx.lines.forEach(l => {
          if (isIds.has(l.accountId)) {
            totalDebits += l.debit;
            totalCredits += l.credit;
          }
        });
      }
    });
    earningsRow.push(totalCredits - totalDebits);
  });
  bsRows.push(earningsRow);

  const totalEquityRow: (string | number)[] = ["TOTAL LIABILITIES & EQUITY"];
  periods.forEach((p, idx) => {
    let lTotal = 0;
    [AccountClassification.CURRENT_LIABILITY, AccountClassification.LONG_TERM_LIABILITY].forEach(cls => {
      accounts.filter(a => a.classification === cls).forEach(a => {
        const bal = getCumulativeBalance(a.id, p, transactions, accounts);
        lTotal += (a.naturalBalance === NaturalBalance.CREDIT ? bal : -bal);
      });
    });
    let eTotal = equityAccs.reduce((sum, a) => {
      const bal = getCumulativeBalance(a.id, p, transactions, accounts);
      return sum + (a.naturalBalance === NaturalBalance.CREDIT ? bal : -bal);
    }, 0);
    const earnings = Number(earningsRow[idx + 1]) || 0;
    totalEquityRow.push(lTotal + eTotal + earnings);
  });
  bsRows.push(totalEquityRow);

  const bsSheet = XLSX.utils.aoa_to_sheet(bsRows);
  XLSX.utils.book_append_sheet(wb, bsSheet, "Balance Sheet");

  // --- 3. CASH FLOW STATEMENT ---
  const cfRows: any[] = [
    [`${companyName} - STATEMENT OF CASH FLOWS`],
    [`Exported: ${new Date().toLocaleDateString()}`],
    [],
    ["Activity Group", ...periods]
  ];

  const cashAccountIds = accounts.filter(a => a.classification === AccountClassification.CURRENT_ASSET && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))).map(a => a.id);

  cfRows.push(["OPERATING ACTIVITIES"]);
  const niRow: (string | number)[] = [indent("Net Income")];
  const depRow: (string | number)[] = [indent("Depreciation Adjustment")];
  const wcRow: (string | number)[] = [indent("Changes in Working Capital")];
  const opsTotalRow: (string | number)[] = ["Net Operating Flow"];

  periods.forEach(p => {
    let ni = 0;
    accounts.filter(a => a.financialStatement === FinancialStatement.INCOME_STATEMENT).forEach(acc => {
      const act = getMonthlyActivity(acc.id, p, transactions, accounts);
      if (acc.classification === AccountClassification.REVENUE || acc.classification === AccountClassification.OTHER_INCOME_EXPENSE) ni += act;
      else ni -= act;
    });
    niRow.push(ni);

    const depExp = accounts.find(a => a.name.toLowerCase().includes('depreciation') && a.financialStatement === FinancialStatement.INCOME_STATEMENT);
    const dep = depExp ? getMonthlyActivity(depExp.id, p, transactions, accounts) : 0;
    depRow.push(dep);

    const assets = accounts.filter(a => a.classification === AccountClassification.CURRENT_ASSET && !cashAccountIds.includes(a.id));
    const liabs = accounts.filter(a => a.classification === AccountClassification.CURRENT_LIABILITY);
    const assetChg = assets.reduce((sum, a) => sum - getMonthlyActivity(a.id, p, transactions, accounts), 0);
    const liabChg = liabs.reduce((sum, a) => sum + getMonthlyActivity(a.id, p, transactions, accounts), 0);
    wcRow.push(assetChg + liabChg);
    opsTotalRow.push(ni + dep + assetChg + liabChg);
  });
  cfRows.push(niRow, depRow, wcRow, opsTotalRow, []);

  cfRows.push(["INVESTING ACTIVITIES"]);
  const invRow: (string | number)[] = [indent("Asset Purchases / Capex")];
  periods.forEach(p => {
    const ltAssets = accounts.filter(a => a.classification === AccountClassification.LONG_TERM_ASSET);
    invRow.push(ltAssets.reduce((sum, a) => sum - getMonthlyActivity(a.id, p, transactions, accounts), 0));
  });
  cfRows.push(invRow, ["Net Investing Flow", ...invRow.slice(1)], []);

  cfRows.push(["FINANCING ACTIVITIES"]);
  const contRow: (string | number)[] = [indent("Cash Contributions")];
  const distRow: (string | number)[] = [indent("Cash Distributions")];
  const debtRow: (string | number)[] = [indent("Net Change in Debt")];
  const finTotalRow: (string | number)[] = ["Net Financing Flow"];

  periods.forEach(p => {
    const [year, month] = p.split('-').map(Number);
    let cont = 0; let dist = 0; let debt = 0;
    const eqIds = accounts.filter(a => a.classification === AccountClassification.EQUITY).map(a => a.id);
    const dIds = accounts.filter(a => a.classification === AccountClassification.LONG_TERM_LIABILITY).map(a => a.id);

    transactions.forEach(tx => {
      if (tx.isClosingEntry) return;
      const d = new Date(tx.date);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        if (tx.lines.some(l => cashAccountIds.includes(l.accountId))) {
          tx.lines.forEach(l => {
            if (eqIds.includes(l.accountId)) {
              const net = l.credit - l.debit;
              if (net > 0) cont += net; else if (net < 0) dist += Math.abs(net);
            }
            if (dIds.includes(l.accountId)) debt += (l.credit - l.debit);
          });
        }
      }
    });
    contRow.push(cont);
    distRow.push(dist > 0 ? -dist : 0);
    debtRow.push(debt);
    finTotalRow.push(cont - dist + debt);
  });
  cfRows.push(contRow, distRow, debtRow, finTotalRow, []);

  const changeRow: (string | number)[] = ["PERIOD CASH CHANGE"];
  const startRow: (string | number)[] = ["Opening Balance"];
  const endRow: (string | number)[] = ["CLOSING CASH POSITION"];

  periods.forEach((p, idx) => {
    const change = Number(opsTotalRow[idx + 1]) + Number(invRow[idx + 1]) + Number(finTotalRow[idx + 1]);
    changeRow.push(change);
    
    let startBal = 0;
    if (idx === 0) {
      startBal = accounts.filter(a => cashAccountIds.includes(a.id)).reduce((sum, a) => sum + (Number(a.startingBalance) || 0), 0);
      const [y, m] = p.split('-').map(Number);
      const cutoff = new Date(y, m - 1, 1);
      transactions.forEach(tx => {
        if (new Date(tx.date) < cutoff) {
          tx.lines.forEach(l => { if (cashAccountIds.includes(l.accountId)) startBal += (l.debit - l.credit); });
        }
      });
    } else {
      startBal = Number(endRow[idx]);
    }
    startRow.push(startBal);
    endRow.push(startBal + change);
  });
  cfRows.push(changeRow, startRow, endRow);

  const cfSheet = XLSX.utils.aoa_to_sheet(cfRows);
  XLSX.utils.book_append_sheet(wb, cfSheet, "Cash Flow");

  // --- 4. AMAZON ANALYSIS DATA ---
  if (amazonRecords.length > 0) {
    const amzPeriodSet = new Set<string>();
    const amzSkuSet = new Set<string>();
    const amzAmountMap: any = {};
    const amzCogsMap: Record<string, any> = {};

    amazonRecords.forEach(r => {
      const pk = getStandardKey(r.date);
      if (pk === "INVALID") return;
      amzPeriodSet.add(pk);
      if (r.sku && r.sku !== 'NON-SKU') amzSkuSet.add(r.sku);

      if (!amzAmountMap[pk]) amzAmountMap[pk] = {};
      if (!amzAmountMap[pk][r.category]) amzAmountMap[pk][r.category] = { _total: 0 };
      if (!amzAmountMap[pk][r.category][r.sku]) amzAmountMap[pk][r.category][r.sku] = {};
      if (!amzAmountMap[pk][r.category][r.sku][r.type]) amzAmountMap[pk][r.category][r.sku][r.type] = 0;

      amzAmountMap[pk][r.category][r.sku][r.type] += r.amount;
      amzAmountMap[pk][r.category]._total += r.amount;

      if (!amzCogsMap[pk]) amzCogsMap[pk] = { orderCogs: 0, refundCogs: 0, adjustmentCogs: 0 };
      const normalizedSku = r.sku.trim().toUpperCase();
      const unitCost = skuData[normalizedSku]?.cost || 0;

      if (r.type === 'Order') amzCogsMap[pk].orderCogs += (r.quantity * unitCost);
      else if (r.type === 'Refund') amzCogsMap[pk].refundCogs += (r.quantity * unitCost);
      else if (r.type === 'Adjustment' || r.category === 'FBA reimbursement') amzCogsMap[pk].adjustmentCogs += (r.quantity * unitCost);
    });

    const amzPeriodsSorted = Array.from(amzPeriodSet).sort((a, b) => {
      const monthsMap: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const parse = (s: string) => new Date(2000 + parseInt(s.slice(3)), monthsMap[s.slice(0, 3)]).getTime();
      return parse(a) - parse(b);
    });

    const getAmzAmt = (period: string, cat: string, sku?: string) => {
      const p = amzAmountMap[period];
      if (!p || !p[cat]) return 0;
      if (!sku) return p[cat]._total;
      return Object.values(p[cat][sku] || {}).reduce((s: any, v: any) => s + v, 0);
    };

    // SHEET 4.1: AMAZON REVENUE
    const amzRevRows: any[] = [
      [`${companyName} - AMAZON PRODUCT SALES`],
      ["Product / SKU", ...amzPeriodsSorted]
    ];
    Array.from(amzSkuSet).sort().forEach(sku => {
      const row: (string | number)[] = [skuData[sku]?.name || sku];
      amzPeriodsSorted.forEach(p => row.push(getAmzAmt(p, 'Revenue', sku)));
      amzRevRows.push(row);
    });
    const amzSheetRev = XLSX.utils.aoa_to_sheet(amzRevRows);
    XLSX.utils.book_append_sheet(wb, amzSheetRev, "Amazon Revenue");

    // SHEET 4.2: AMAZON FEES
    const FEE_CATEGORIES = [
      'Selling fees', 'FBA fees', 'FBA reimbursement', 'FBM shipping fees', 'Advertising fees',
      'FBA shipping fees', 'Inbound shipping fees', 'Account subscription', 'FBA fees other',
      'FBA storage fees', 'Return fees', 'Other fees', 'Other', 'AWD fees', 'FBA disposal fees'
    ];
    const amzFeeRows: any[] = [
      [`${companyName} - AMAZON FEE BREAKDOWN`],
      ["Category", ...amzPeriodsSorted]
    ];
    FEE_CATEGORIES.forEach(fee => {
      const row: (string | number)[] = [fee];
      amzPeriodsSorted.forEach(p => {
        const val = getAmzAmt(p, fee);
        row.push(fee === 'FBA reimbursement' && val > 0 ? -val : Math.abs(val));
      });
      amzFeeRows.push(row);
    });
    const amzSheetFees = XLSX.utils.aoa_to_sheet(amzFeeRows);
    XLSX.utils.book_append_sheet(wb, amzSheetFees, "Amazon Fees");

    // SHEET 4.3: AMAZON PROFITABILITY
    const amzProfRows: any[] = [
      [`${companyName} - AMAZON RECONCILIATION & COGS`],
      ["Metric", ...amzPeriodsSorted]
    ];
    const metrics = [
      { name: "Total Revenue (Net)", calc: (p: string) => getAmzAmt(p, 'Revenue') },
      { name: "Reported Transfers", calc: (p: string) => Math.abs(getAmzAmt(p, 'Transfer')) },
      { name: "Est. Order COGS", calc: (p: string) => amzCogsMap[p]?.orderCogs || 0 },
      { name: "Adjustment COGS", calc: (p: string) => amzCogsMap[p]?.adjustmentCogs || 0 },
      { name: "Gross Profit (Amazon)", calc: (p: string) => {
          const trans = Math.abs(getAmzAmt(p, 'Transfer'));
          const cogs = (amzCogsMap[p]?.orderCogs || 0) + (amzCogsMap[p]?.adjustmentCogs || 0) - (amzCogsMap[p]?.refundCogs || 0);
          return trans - cogs;
      }}
    ];
    metrics.forEach(m => {
      const row: (string | number)[] = [m.name];
      amzPeriodsSorted.forEach(p => row.push(m.calc(p)));
      amzProfRows.push(row);
    });
    const amzSheetProf = XLSX.utils.aoa_to_sheet(amzProfRows);
    XLSX.utils.book_append_sheet(wb, amzSheetProf, "Amazon Profitability");
  }

  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Financials_${new Date().toISOString().slice(0, 10)}.xlsx`);
};