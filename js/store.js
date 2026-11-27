/**
 * FinFlow - State & Data Store
 * Persistent storage via LocalStorage (tanpa data contoh)
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'finflow_transactions_v1',
  INVESTMENTS: 'finflow_investments_v1',
  SETTINGS: 'finflow_settings_v1',
  INVESTMENT_DELETED: 'finflow_investment_deleted_v1',
  SYNC_QUEUE: 'cashflow_sync_queue_v1'
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



class FinanceStore {
  constructor() {
    this.listeners = [];
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      this.saveTransactions([]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.INVESTMENTS)) {
      this.saveInvestments([]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }

    if (window.CashflowApi?.enabled() && window.CashflowApi.getToken()) {
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
      date: this.toIsoDate_(tx.transactionDate),
      wallet: tx.wallet,
      note: tx.note,
      status: tx.status,
      version: tx.version,
      categoryId: tx.categoryId
    }));
    const merged = this.mergeTransactionsWithQueue_(transactions);
    this.saveTransactions(merged);
    return merged;
  }

  // --- Antrean sinkronisasi (offline-first) ---
  getSyncQueue() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  saveSyncQueue(queue) {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    this.notifyChange('queue');
  }

  enqueueSync(kind, op, data) {
    const queue = this.getSyncQueue();
    const item = {
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      kind: kind,
      op: op,
      data: data,
      createdAt: new Date().toISOString()
    };
    queue.push(item);
    this.saveSyncQueue(queue);
    return item;
  }

  removeSyncItem(id) {
    this.saveSyncQueue(this.getSyncQueue().filter(item => item.id !== id));
  }

  pendingQueueCount() {
    return this.getSyncQueue().length;
  }

  /** Gabungkan hasil server dengan antrean agar data lokal yang belum terkirim tidak hilang. */
  /** Normalisasi tanggal server (ISO/UTC) menjadi YYYY-MM-DD WIB. */
  toIsoDate_(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text.slice(0, 10);
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(parsed);
    } catch (error) {
      return text.slice(0, 10);
    }
  }

  mergeTransactionsWithQueue_(serverTransactions) {
    const queue = this.getSyncQueue();
    const pendingVoid = new Set(
      queue.filter(item => item.kind === 'transaction' && item.op === 'void').map(item => item.data.id)
    );
    const pendingCreate = queue.filter(item => item.kind === 'transaction' && item.op === 'create');

    const base = (serverTransactions || []).filter(item => !pendingVoid.has(item.id));
    const signature = new Set(base.map(item =>
      [item.title, Number(item.amount) || 0, item.date].join('|')
    ));

    const extras = pendingCreate
      .filter(item => !signature.has([item.data.title, Number(item.data.amount) || 0, item.data.date].join('|')))
      .map(item => ({
        id: item.data.id || ('queue-' + item.id),
        type: item.data.type,
        title: item.data.title,
        amount: Number(item.data.amount) || 0,
        category: item.data.category,
        date: item.data.date,
        wallet: item.data.wallet,
        note: item.data.note,
        pending: true
      }));

    const pendingUpdate = new Map(
      queue
        .filter(item => item.kind === 'transaction' && item.op === 'update')
        .map(item => [String(item.data.id), item.data])
    );

    return [...extras, ...base].map(row => {
      const upd = pendingUpdate.get(String(row.id));
      if (!upd) return row;
      return {
        ...row,
        type: upd.type,
        title: upd.title,
        amount: Number(upd.amount) || 0,
        category: upd.category,
        date: upd.date,
        wallet: upd.wallet,
        note: upd.note,
        pending: true
      };
    });
  }

  mergeInvestmentsWithQueue_(serverInvestments) {
    const queue = this.getSyncQueue();
    const pendingVoid = new Set(
      queue.filter(item => item.kind === 'investment' && item.op === 'void').map(item => item.data.id)
    );
    const pendingCreate = queue.filter(item => item.kind === 'investment' && item.op === 'create');

    const base = (serverInvestments || []).filter(item => !pendingVoid.has(item.id));
    const signature = new Set(base.map(item =>
      [item.name, Number(item.buyPrice) || 0, item.dateBought].join('|')
    ));

    const extras = pendingCreate
      .filter(item => !signature.has([item.data.name, Number(item.data.buyPrice) || 0, item.data.dateBought].join('|')))
      .map(item => ({
        id: item.data.id || ('queue-' + item.id),
        name: item.data.name,
        code: item.data.code,
        category: item.data.category,
        buyPrice: Number(item.data.buyPrice) || 0,
        currentPrice: Number(item.data.currentPrice ?? item.data.buyPrice) || 0,
        units: 1,
        unitName: 'rupiah',
        unitMultiplier: 1,
        dateBought: item.data.dateBought,
        notes: item.data.notes || '',
        pending: true
      }));

    return [...extras, ...base];
  }

  // --- Transactions ---
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
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
      return data ? JSON.parse(data) : [];
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

  getDeletedInvestmentIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVESTMENT_DELETED) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  markInvestmentDeleted(id) {
    const ids = this.getDeletedInvestmentIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(STORAGE_KEYS.INVESTMENT_DELETED, JSON.stringify(ids));
    }
  }

  unmarkInvestmentDeleted(id) {
    const ids = this.getDeletedInvestmentIds().filter(item => item !== id);
    localStorage.setItem(STORAGE_KEYS.INVESTMENT_DELETED, JSON.stringify(ids));
  }

  /**
   * Hapus aset: lokal dulu, lalu void ke Spreadsheet. Selama penghapusan
   * belum terkonfirmasi, id dicatat sebagai tombstone agar sinkronisasi
   * berikutnya tidak memunculkan aset itu lagi.
   */
  async deleteInvestment(id) {
    const investments = this.getInvestments();
    this.saveInvestments(investments.filter(item => item.id !== id));
    return { deleted: true };
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
    // Tidak ada lagi data contoh: reset berarti mengosongkan data lokal.
    this.saveTransactions([]);
    this.saveInvestments([]);
    this.saveSettings(DEFAULT_SETTINGS);
  }

  exportJSON() {
    const transactions = this.getTransactions();
    const investments = this.getInvestments();
    return JSON.stringify({
      app: 'cashflow',
      version: 2,
      exportDate: new Date().toISOString(),
      counts: { transactions: transactions.length, investments: investments.length },
      settings: this.getSettings(),
      transactions: transactions,
      investments: investments
    }, null, 2);
  }

  validateBackup(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      return { valid: false, error: 'JSON tidak dapat dibaca (' + error.message + ')' };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Struktur backup tidak dikenali.' };
    }
    if (parsed.transactions !== undefined && !Array.isArray(parsed.transactions)) {
      return { valid: false, error: 'Bagian "transactions" harus berupa array.' };
    }
    if (parsed.investments !== undefined && !Array.isArray(parsed.investments)) {
      return { valid: false, error: 'Bagian "investments" harus berupa array.' };
    }

    const transactions = parsed.transactions || [];
    const investments = parsed.investments || [];

    const badTx = transactions.findIndex(tx => {
      const date = String(tx && tx.date || '');
      const amount = Number(tx && tx.amount);
      return !tx || typeof tx !== 'object' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date.slice(0, 10)) ||
        !Number.isFinite(amount) || amount < 0 ||
        !['income', 'expense'].includes(tx.type) ||
        typeof tx.title !== 'string' || tx.title.trim() === '';
    });
    if (badTx !== -1) {
      return { valid: false, error: 'Transaksi ke-' + (badTx + 1) + ' tidak valid (tanggal/jenis/judul/nominal).' };
    }

    const badInv = investments.findIndex(inv => {
      const price = Number(inv && inv.buyPrice);
      return !inv || typeof inv !== 'object' ||
        typeof inv.name !== 'string' || inv.name.trim() === '' ||
        !Number.isFinite(price) || price < 0;
    });
    if (badInv !== -1) {
      return { valid: false, error: 'Investasi ke-' + (badInv + 1) + ' tidak valid (nama/nilai).' };
    }

    return {
      valid: true,
      parsed: parsed,
      summary: {
        transactions: transactions.length,
        investments: investments.length,
        exportDate: parsed.exportDate || '',
        version: parsed.version || 1
      }
    };
  }

  /**
   * Pulihkan backup: ganti data lokal, lalu masukkan item baru ke antrean
   * agar ikut tersinkron (tanpa menghapus antrean yang sudah ada).
   */
  restoreBackup(jsonString) {
    const check = this.validateBackup(jsonString);
    if (!check.valid) return { success: false, error: check.error };

    const parsed = check.parsed;
    const existingTxIds = new Set(this.getTransactions().map(t => t.id));
    const existingInvIds = new Set(this.getInvestments().map(i => i.id));

    const transactions = (parsed.transactions || []).map(tx => ({
      id: String(tx.id || ('tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))),
      type: tx.type,
      title: String(tx.title),
      amount: Number(tx.amount) || 0,
      category: String(tx.category || 'Lainnya'),
      date: String(tx.date).slice(0, 10),
      wallet: String(tx.wallet || ''),
      note: String(tx.note || '')
    }));

    const investments = (parsed.investments || []).map(inv => ({
      id: String(inv.id || ('inv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))),
      name: String(inv.name),
      code: String(inv.code || ''),
      category: String(inv.category || 'Lainnya'),
      buyPrice: Number(inv.buyPrice) || 0,
      currentPrice: Number(inv.currentPrice ?? inv.buyPrice) || 0,
      units: 1,
      unitName: 'rupiah',
      unitMultiplier: 1,
      dateBought: String(inv.dateBought || '').slice(0, 10),
      notes: String(inv.notes || ''),
      status: 'active'
    }));

    this.saveTransactions(transactions);
    this.saveInvestments(investments);
    if (parsed.settings && typeof parsed.settings === 'object') {
      this.saveSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
    }

    let queued = 0;
    transactions.forEach(tx => {
      if (!existingTxIds.has(tx.id)) {
        this.enqueueSync('transaction', 'create', tx);
        queued += 1;
      }
    });
    investments.forEach(inv => {
      if (!existingInvIds.has(inv.id)) {
        this.enqueueSync('investment', 'create', inv);
        queued += 1;
      }
    });

    return {
      success: true,
      queued: queued,
      restored: { transactions: transactions.length, investments: investments.length }
    };
  }

  importJSON(jsonString) {
    const result = this.restoreBackup(jsonString);
    return result.success ? { success: true } : { success: false, error: result.error };
  }

  exportCSV() {
    const transactions = this.getTransactions();
    const headers = ['ID', 'Tipe', 'Judul', 'Nominal (Rp)', 'Kategori', 'Tanggal', 'Dompet/Akun', 'Catatan'];

    // Excel dengan regional Indonesia memakai ";" sebagai pemisah daftar.
    const escapeCell = (value) => {
      const raw = value === null || value === undefined ? '' : String(value);
      return /[";\r\n]/.test(raw) ? '"' + raw.replace(/"/g, '""') + '"' : raw;
    };

    const rows = transactions.map(t => [
      escapeCell(t.id),
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      escapeCell(t.title),
      Number(t.amount) || 0,
      escapeCell(t.category),
      escapeCell(t.date),
      escapeCell(t.wallet),
      escapeCell(t.note)
    ]);

    return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
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
    const deletedIds = new Set(this.getDeletedInvestmentIds ? this.getDeletedInvestmentIds() : []);
    const investments = response.items
      .filter(item => !deletedIds.has(item.investmentId))
      .map(item => {
        const name = String(item.name || '');
        const category = name.startsWith('Tabungan ') ? name.substring(9) : (item.categoryId || 'Lainnya');
        return {
          id: item.investmentId,
          name: name,
          code: item.code,
          category: category,
          buyPrice: Number(item.buyPriceMinor) || 0,
          currentPrice: Number(item.currentPriceMinor) || 0,
          units: Number(item.units) || 1,
          unitName: item.unitName || 'unit',
          unitMultiplier: Number(item.unitMultiplier) || 1,
          dateBought: item.dateBought,
          notes: item.notes || '',
          version: item.version,
          status: item.status
        };
      });
    const merged = this.mergeInvestmentsWithQueue_(investments);
    this.saveInvestments(merged);
    return merged;
  };;

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
          units: 1,
          unitName: 'rupiah',
          unitMultiplier: 1,
          dateBought: inv.dateBought || new Date().toISOString().split('T')[0],
          notes: inv.notes || ''
        });
        await this.syncInvestmentsFromApi_();
        return result;
      })();
    }
    return localAddInvestment.call(this, inv);
  };

  if (window.CashflowApi?.enabled() && window.CashflowApi.getToken()) {
    setTimeout(() => window.financeStore.syncInvestmentsFromApi_().catch(error => {
      console.error('Failed to sync investments with Cashflow API:', error);
    }), 0);
  }
})();
