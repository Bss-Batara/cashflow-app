/**
 * FinFlow - State & Data Store
 * Persistent storage via LocalStorage with initial Indonesian financial seed data
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'finflow_transactions_v1',
  INVESTMENTS: 'finflow_investments_v1',
  SETTINGS: 'finflow_settings_v1'
};

// Initial Mock Data
const DEFAULT_SETTINGS = {
  dailyBudget: 200000,
  monthlyBudget: 5000000,
  currency: 'IDR',
  theme: 'dark'
};

const getRelativeDate = (dayOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
};

const DEFAULT_TRANSACTIONS = [
  // Income
  {
    id: 'tx-1',
    type: 'income',
    title: 'Gaji Pokok Bulanan',
    amount: 12500000,
    category: 'Gaji',
    date: getRelativeDate(-4),
    wallet: 'BCA Utama',
    note: 'Gaji bulanan kantor'
  },
  {
    id: 'tx-2',
    type: 'income',
    title: 'Proyek Freelance UI/UX',
    amount: 3800000,
    category: 'Freelance',
    date: getRelativeDate(-2),
    wallet: 'Mandiri',
    note: 'Pembayaran termin 1 klien web app'
  },
  {
    id: 'tx-3',
    type: 'income',
    title: 'Dividen Saham BBCA',
    amount: 450000,
    category: 'Investasi',
    date: getRelativeDate(-6),
    wallet: 'RDN Sekuritas',
    note: 'Dividen interim'
  },

  // Daily Expenses
  {
    id: 'tx-4',
    type: 'expense',
    title: 'Makan Siang & Es Kopi Susu',
    amount: 48000,
    category: 'Makanan & Minuman',
    date: getRelativeDate(0),
    wallet: 'GoPay',
    note: 'Ayam Geprek + Kopi Kenangan'
  },
  {
    id: 'tx-5',
    type: 'expense',
    title: 'Bensin & Parkir Kantor',
    amount: 35000,
    category: 'Transportasi',
    date: getRelativeDate(0),
    wallet: 'Cash',
    note: 'Pertalite + parkir seharian'
  },
  {
    id: 'tx-6',
    type: 'expense',
    title: 'Makan Malam Seafood',
    amount: 85000,
    category: 'Makanan & Minuman',
    date: getRelativeDate(-1),
    wallet: 'BCA Utama',
    note: 'Makan malam sama kawan'
  },
  {
    id: 'tx-7',
    type: 'expense',
    title: 'Belanja Kebutuhan Mingguan',
    amount: 340000,
    category: 'Kebutuhan Harian',
    date: getRelativeDate(-2),
    wallet: 'BCA Utama',
    note: 'Superindo bahan masak & buah'
  },
  {
    id: 'tx-8',
    type: 'expense',
    title: 'Tagihan Internet WiFi Rumah',
    amount: 385000,
    category: 'Tagihan & Utilitas',
    date: getRelativeDate(-3),
    wallet: 'Mandiri',
    note: 'Indihome 50 Mbps'
  },
  {
    id: 'tx-9',
    type: 'expense',
    title: 'Topup Pulsa & Kuota Darurat',
    amount: 75000,
    category: 'Tagihan & Utilitas',
    date: getRelativeDate(-4),
    wallet: 'GoPay',
    note: 'Telkomsel kuota data 25GB'
  },
  {
    id: 'tx-10',
    type: 'expense',
    title: 'Langganan Netflix & Spotify',
    amount: 110000,
    category: 'Hiburan',
    date: getRelativeDate(-5),
    wallet: 'BCA Utama',
    note: 'Autodebet bulanan'
  },
  {
    id: 'tx-11',
    type: 'expense',
    title: 'Beli Buku Pemrograman',
    amount: 165000,
    category: 'Edukasi & Belajar',
    date: getRelativeDate(-6),
    wallet: 'ShopeePay',
    note: 'Gramedia Online'
  }
];

const DEFAULT_INVESTMENTS = [
  {
    id: 'inv-1',
    name: 'Bank Central Asia Tbk',
    code: 'BBCA',
    category: 'Saham',
    buyPrice: 9800,
    currentPrice: 10450,
    units: 10, // 10 lot = 1000 lembar
    unitName: 'lot',
    unitMultiplier: 100, // 1 lot = 100 lembar
    dateBought: '2024-03-15',
    notes: 'Saham core portfolio dividen & growth'
  },
  {
    id: 'inv-2',
    name: 'Bank Rakyat Indonesia Tbk',
    code: 'BBRI',
    category: 'Saham',
    buyPrice: 4700,
    currentPrice: 5100,
    units: 15,
    unitName: 'lot',
    unitMultiplier: 100,
    dateBought: '2024-04-10',
    notes: 'Saham perbankan BUMN'
  },
  {
    id: 'inv-3',
    name: 'Sucorinvest Sharia Money Market Fund',
    code: 'SSMMF',
    category: 'Reksadana',
    buyPrice: 1520,
    currentPrice: 1610,
    units: 5000,
    unitName: 'unit',
    unitMultiplier: 1,
    dateBought: '2024-01-20',
    notes: 'Dana darurat likuid yield stabil'
  },
  {
    id: 'inv-4',
    name: 'Emas Fisik Antam Certicard',
    code: 'GOLD-ANTAM',
    category: 'Emas',
    buyPrice: 1250000,
    currentPrice: 1490000,
    units: 10,
    unitName: 'gram',
    unitMultiplier: 1,
    dateBought: '2023-11-05',
    notes: 'Hedging inflasi jangka panjang'
  },
  {
    id: 'inv-5',
    name: 'Bitcoin (BTC)',
    code: 'BTC',
    category: 'Kripto',
    buyPrice: 920000000,
    currentPrice: 1450000000,
    units: 0.0065,
    unitName: 'BTC',
    unitMultiplier: 1,
    dateBought: '2024-02-12',
    notes: 'DCA aset kripto via exchange teregulasi'
  },
  {
    id: 'inv-6',
    name: 'Sukuk Ritel SR020',
    code: 'SR020',
    category: 'Obligasi',
    buyPrice: 1000000,
    currentPrice: 1000000,
    units: 10,
    unitName: 'unit',
    unitMultiplier: 1,
    dateBought: '2024-03-01',
    notes: 'Kupon 6.3% per tahun dibayar tiap bulan'
  }
];

class FinanceStore {
  constructor() {
    this.listeners = [];
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      this.saveTransactions(DEFAULT_TRANSACTIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.INVESTMENTS)) {
      this.saveInvestments(DEFAULT_INVESTMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }

    if (window.CashflowApi?.enabled()) {
      this.syncFromApi().catch(error => {
        console.error('Failed to sync with Cashflow API:', error);
      });
    }
  }

  async syncFromApi() {
    const [response, categoryResponse] = await Promise.all([
      window.CashflowApi.get('listTransactions'),
      window.CashflowApi.get('listCategories')
    ]);
    const categoryNames = new Map();
    categoryResponse.items.forEach(category => {
      categoryNames.set(category.categoryId, category.displayName || category.name);
    });
    const transactions = response.items.map(tx => ({
      id: tx.transactionId,
      type: tx.type,
      title: tx.title,
      amount: Number(tx.amountMinor) || 0,
      category: categoryNames.get(tx.categoryId) || tx.categoryId,
      date: tx.transactionDate,
      wallet: tx.wallet,
      note: tx.note,
      status: tx.status,
      version: tx.version,
      categoryId: tx.categoryId
    }));
    this.saveTransactions(transactions);
    return transactions;
  }

  // --- Transactions ---
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : DEFAULT_TRANSACTIONS;
    } catch (e) {
      console.error('Failed to load transactions:', e);
      return [];
    }
  }

  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    this.notifyChange('transactions');
  }

  addTransaction(tx) {
    if (window.CashflowApi?.enabled()) {
      return this.addRemoteTransaction_(tx);
    }

    const transactions = this.getTransactions();
    const newTx = {
      id: 'tx-' + Date.now(),
      date: tx.date || new Date().toISOString().split('T')[0],
      ...tx,
      amount: parseFloat(tx.amount) || 0
    };
    transactions.unshift(newTx);
    this.saveTransactions(transactions);
    return newTx;
  }

  deleteTransaction(id) {
    if (window.CashflowApi?.enabled()) {
      return this.voidRemoteTransaction_(id);
    }

    let transactions = this.getTransactions();
    transactions = transactions.filter(t => t.id !== id);
    this.saveTransactions(transactions);
  }

  async addRemoteTransaction_(tx) {
    const categoryId = await window.CashflowApi.resolveCategoryId(tx.category, tx.type);
    const result = await window.CashflowApi.post('createTransaction', {
      type: tx.type,
      title: tx.title,
      amountMinor: Math.round(Number(tx.amount) || 0),
      currency: 'IDR',
      categoryId: categoryId,
      transactionDate: tx.date || new Date().toISOString().split('T')[0],
      wallet: tx.wallet || '',
      note: tx.note || ''
    });
    await this.syncFromApi();
    return result;
  }

  async voidRemoteTransaction_(id) {
    const current = this.getTransactions().find(item => item.id === id);
    if (!current) return null;

    const result = await window.CashflowApi.post('voidTransaction', {
      transactionId: id,
      expectedVersion: current.version
    });
    await this.syncFromApi();
    return result;
  }

  // --- Investments ---
  getInvestments() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVESTMENTS);
      return data ? JSON.parse(data) : DEFAULT_INVESTMENTS;
    } catch (e) {
      console.error('Failed to load investments:', e);
      return [];
    }
  }

  saveInvestments(investments) {
    localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
    this.notifyChange('investments');
  }

  addInvestment(inv) {
    const investments = this.getInvestments();
    const multiplier = inv.category === 'Saham' ? 100 : 1;
    const newInv = {
      id: 'inv-' + Date.now(),
      name: inv.name,
      code: (inv.code || inv.name.substring(0, 4)).toUpperCase(),
      category: inv.category,
      buyPrice: parseFloat(inv.buyPrice) || 0,
      currentPrice: parseFloat(inv.currentPrice) || parseFloat(inv.buyPrice) || 0,
      units: parseFloat(inv.units) || 0,
      unitName: inv.unitName || (inv.category === 'Saham' ? 'lot' : 'unit'),
      unitMultiplier: multiplier,
      dateBought: inv.dateBought || new Date().toISOString().split('T')[0],
      notes: inv.notes || ''
    };
    investments.unshift(newInv);
    this.saveInvestments(investments);
    return newInv;
  }

  updateInvestment(id, updateData) {
    const investments = this.getInvestments();
    const index = investments.findIndex(item => item.id === id);
    if (index !== -1) {
      investments[index] = {
        ...investments[index],
        ...updateData,
        buyPrice: parseFloat(updateData.buyPrice ?? investments[index].buyPrice),
        currentPrice: parseFloat(updateData.currentPrice ?? investments[index].currentPrice),
        units: parseFloat(updateData.units ?? investments[index].units)
      };
      this.saveInvestments(investments);
      return investments[index];
    }
    return null;
  }

  deleteInvestment(id) {
    let investments = this.getInvestments();
    investments = investments.filter(item => item.id !== id);
    this.saveInvestments(investments);
  }

  // --- Settings ---
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.notifyChange('settings');
  }

  // --- Calculations ---
  getCashFlowMetrics() {
    const transactions = this.getTransactions();
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalIncome += amt;
      } else if (tx.type === 'expense') {
        totalExpense += amt;
      }
    });

    const netCashFlow = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpense,
      netCashFlow,
      savingsRate: Math.max(0, savingsRate)
    };
  }

  getDailyMetrics(targetDate = null) {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];
    const transactions = this.getTransactions();
    const settings = this.getSettings();

    const todayExpenses = transactions.filter(tx => tx.type === 'expense' && tx.date === dateStr);
    const totalToday = todayExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const dailyLimit = settings.dailyBudget || 200000;
    const remaining = dailyLimit - totalToday;
    const usagePercent = dailyLimit > 0 ? Math.min(100, (totalToday / dailyLimit) * 100) : 0;

    return {
      date: dateStr,
      totalToday,
      dailyLimit,
      remaining,
      usagePercent,
      isExceeded: totalToday > dailyLimit,
      items: todayExpenses
    };
  }

  getPortfolioMetrics() {
    const investments = this.getInvestments();
    let totalInvested = 0;
    let totalCurrentValue = 0;

    const items = investments.map(inv => {
      const mult = inv.unitMultiplier || 1;
      const totalUnits = (Number(inv.units) || 0) * mult;
      const capital = totalUnits * (Number(inv.buyPrice) || 0);
      const currentValue = totalUnits * (Number(inv.currentPrice) || 0);
      const profitLoss = currentValue - capital;
      const profitLossPercent = capital > 0 ? ((profitLoss / capital) * 100) : 0;

      totalInvested += capital;
      totalCurrentValue += currentValue;

      return {
        ...inv,
        capital,
        currentValue,
        profitLoss,
        profitLossPercent
      };
    });

    const totalProfitLoss = totalCurrentValue - totalInvested;
    const totalProfitLossPercent = totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100) : 0;

    // Grouping by category
    const categoryAllocation = {};
    items.forEach(item => {
      const cat = item.category || 'Lainnya';
      if (!categoryAllocation[cat]) categoryAllocation[cat] = 0;
      categoryAllocation[cat] += item.currentValue;
    });

    return {
      totalInvested,
      totalCurrentValue,
      totalProfitLoss,
      totalProfitLossPercent,
      items,
      categoryAllocation
    };
  }

  getNetWorth() {
    const cashFlow = this.getCashFlowMetrics();
    const portfolio = this.getPortfolioMetrics();
    // Net worth = Net cash in wallet + Total current investment value
    return cashFlow.netCashFlow + portfolio.totalCurrentValue;
  }

  // --- Reset & Backup ---
  clearAllData() {
    this.saveTransactions([]);
    this.saveInvestments([]);
  }

  resetData() {
    this.saveTransactions(DEFAULT_TRANSACTIONS);
    this.saveInvestments(DEFAULT_INVESTMENTS);
    this.saveSettings(DEFAULT_SETTINGS);
  }

  exportJSON() {
    return JSON.stringify({
      version: 1,
      exportDate: new Date().toISOString(),
      settings: this.getSettings(),
      transactions: this.getTransactions(),
      investments: this.getInvestments()
    }, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.transactions && Array.isArray(parsed.transactions)) {
        this.saveTransactions(parsed.transactions);
      }
      if (parsed.investments && Array.isArray(parsed.investments)) {
        this.saveInvestments(parsed.investments);
      }
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  exportCSV() {
    const transactions = this.getTransactions();
    const headers = ['ID', 'Tipe', 'Judul', 'Nominal (Rp)', 'Kategori', 'Tanggal', 'Dompet/Akun', 'Catatan'];
    const rows = transactions.map(t => [
      t.id,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${t.category || ''}"`,
      t.date,
      `"${t.wallet || ''}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Event dispatching for reactive UI updates
  listeners = [];
  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notifyChange(type) {
    this.listeners.forEach(fn => fn(type));
  }
}

// Global Formatter Helpers
window.formatIDR = function(value, withSymbol = true) {
  const num = Number(value) || 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0
  }).format(num);
  return withSymbol ? `Rp ${formatted}` : formatted;
};

window.formatPercent = function(value) {
  const num = Number(value) || 0;
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(2)}%`;
};

window.financeStore = new FinanceStore();
// Remote investment persistence extension.
(() => {
  const localAddInvestment = FinanceStore.prototype.addInvestment;
  const localSyncFromApi = FinanceStore.prototype.syncFromApi;

  FinanceStore.prototype.syncInvestmentsFromApi_ = async function () {
    const response = await window.CashflowApi.get('listInvestments');
    const investments = response.items.map(item => {
      const name = String(item.name || '');
      const category = name.startsWith('Tabungan ') ? name.substring(9) : (item.categoryId || 'Lainnya');
      return {
        id: item.investmentId,
        name: name,
        code: item.code,
        category: category,
        buyPrice: Number(item.buyPriceMinor) || 0,
        currentPrice: Number(item.currentPriceMinor) || 0,
        units: Number(item.units) || 0,
        unitName: item.unitName || 'unit',
        unitMultiplier: Number(item.unitMultiplier) || 1,
        dateBought: item.dateBought,
        notes: item.notes || '',
        version: item.version,
        status: item.status
      };
    });
    this.saveInvestments(investments);
    return investments;
  };

  FinanceStore.prototype.addInvestment = function (inv) {
    if (window.CashflowApi?.enabled()) {
      return (async () => {
        const category = inv.category || 'Lainnya';
        const result = await window.CashflowApi.post('createInvestment', {
          name: inv.name,
          code: (inv.code || inv.name.substring(0, 4)).toUpperCase(),
          categoryId: 'investment-general',
          buyPriceMinor: Math.round(Number(inv.buyPrice) || 0),
          currentPriceMinor: Math.round(Number(inv.currentPrice ?? inv.buyPrice) || 0),
          units: Number(inv.units) || 0,
          unitName: inv.unitName || 'unit',
          unitMultiplier: category === 'Saham' ? 100 : 1,
          dateBought: inv.dateBought || new Date().toISOString().split('T')[0],
          notes: inv.notes || ''
        });
        await this.syncInvestmentsFromApi_();
        return result;
      })();
    }
    return localAddInvestment.call(this, inv);
  };

  if (window.CashflowApi?.enabled()) {
    setTimeout(() => this.syncInvestmentsFromApi_().catch(error => {
      console.error('Failed to sync investments with Cashflow API:', error);
    }), 0);
  }
})();
