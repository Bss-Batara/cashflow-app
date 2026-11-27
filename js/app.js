/**
 * FinFlow - Application Controller & User Interface Logic
 */

const EXPENSE_CATEGORIES = [
  'Makanan & Minuman',
  'Transportasi & Bensin',
  'Kebutuhan Harian & Dapur',
  'Tagihan, Listrik & WiFi',
  'Belanja Pribadi & Fashion',
  'Hiburan, Hobi & Liburan',
  'Kesehatan & Medis',
  'Pendidikan & Kursus',
  'Keluarga, Anak & Orang Tua',
  'Sedekah, Zakat & Sosial',
  'Cicilan & Finansial',
  'Lain-lain'
];

const INCOME_CATEGORIES = [
  'Gaji Pokok',
  'Freelance & Side Job',
  'Hasil Usaha / Bisnis',
  'Dividen & Return Investasi',
  'Bonus, Komisi & THR',
  'Penjualan Aset / Barang',
  'Hadiah & Uang Masuk Lain'
];

const CATEGORY_COLORS = {
  'Makanan & Minuman': '#e11d48',
  'Transportasi & Bensin': '#0284c7',
  'Kebutuhan Harian & Dapur': '#be123c',
  'Tagihan, Listrik & WiFi': '#9f1239',
  'Belanja Pribadi & Fashion': '#d97706',
  'Hiburan, Hobi & Liburan': '#f43f5e',
  'Kesehatan & Medis': '#0d9488',
  'Pendidikan & Kursus': '#059669',
  'Keluarga, Anak & Orang Tua': '#7e22ce',
  'Sedekah, Zakat & Sosial': '#10b981',
  'Cicilan & Finansial': '#ea580c',
  'Lain-lain': '#64748b',

  // Income
  'Gaji Pokok': '#059669',
  'Freelance & Side Job': '#0284c7',
  'Hasil Usaha / Bisnis': '#be123c',
  'Dividen & Return Investasi': '#d97706',
  'Bonus, Komisi & THR': '#f43f5e',
  'Penjualan Aset / Barang': '#7e22ce',
  'Hadiah & Uang Masuk Lain': '#10b981',

  // Investments (Rp 100.000 Red & Banknote Accents)
  'Dana Darurat': '#0284c7',
  'Saham': '#be123c',
  'Reksadana': '#e11d48',
  'Emas': '#d97706',
  'Kripto': '#7e22ce',
  'Obligasi': '#059669'
};

const CATEGORY_ICONS = {
  'Dana Darurat': '🛡️',
  'Makanan & Minuman': '🍔',
  'Transportasi & Bensin': '🛵',
  'Kebutuhan Harian & Dapur': '🛒',
  'Tagihan, Listrik & WiFi': '⚡',
  'Belanja Pribadi & Fashion': '🛍️',
  'Hiburan, Hobi & Liburan': '🎬',
  'Kesehatan & Medis': '💊',
  'Pendidikan & Kursus': '📚',
  'Keluarga, Anak & Orang Tua': '👨‍👩‍👧',
  'Sedekah, Zakat & Sosial': '🤲',
  'Cicilan & Finansial': '💳',
  'Lain-lain': '📦',

  // Income Icons
  'Gaji Pokok': '💼',
  'Freelance & Side Job': '💻',
  'Hasil Usaha / Bisnis': '🏢',
  'Dividen & Return Investasi': '📈',
  'Bonus, Komisi & THR': '🎁',
  'Penjualan Aset / Barang': '🏷️',
  'Hadiah & Uang Masuk Lain': '✨'
};

/** Escape teks sebelum masuk ke innerHTML (anti DOM XSS). */
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class FinApp {
  constructor() {
    window.app = this;
    this.currentView = 'dashboard';
    const today = new Date();
    this.dashYear = today.getFullYear();
    this.dashMonth = today.getMonth();
    this.expenseFilter = 'today';
    this.expenseCategory = 'all';
    this.expenseSearchQuery = '';
    this.portfolioCategory = 'all';

    try {
      this.init();
    } catch (err) {
      console.error('FinApp initialization error:', err);
    }
  }

  init() {
    this.setupEventListeners();
    this.populateCategoryOptions('expense');
    this.populateSettingsForm();
    this.render();
    this.checkNetworkInfo();
    this.updateFab(this.currentView || 'dashboard');
    this.initDashboardPeriod();

    // Subscribe to data changes
    window.financeStore.subscribe(() => {
      this.render();
    });

    // Selaraskan antar perangkat: tarik data Spreadsheet berkala dan saat tab aktif.
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (!window.cashflowAuth || !window.cashflowAuth.isAuthenticated()) return;
      this.syncFromSpreadsheet({ silent: true });
    };
    window.addEventListener('online', () => {
      this.updateSyncStatus();
      this.processSyncQueue();
    });
    window.addEventListener('offline', () => this.updateSyncStatus());

    window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);

    // Kirim antrean yang tertinggal saat aplikasi dibuka.
    this.updateSyncStatus();
    if (navigator.onLine) this.processSyncQueue();
    window.addEventListener('focus', refresh);

    // Resize event for charts
    window.addEventListener('resize', () => {
      this.renderCharts();
    });
  }

  checkNetworkInfo() {
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data && data.localIPs && data.localIPs.length > 0) {
          const banner = document.getElementById('mobile-sync-banner');
          const linkEl = document.getElementById('mobile-sync-link');
          if (banner && linkEl) {
            const url = `http://${data.localIPs[0]}:${data.port || 3000}`;
            linkEl.textContent = url;
            linkEl.href = url;
            banner.style.display = 'flex';
          }
        }
      })
      .catch(() => {
        // running offline via file://, silently ignore
      });
  }

  copyMobileLink() {
    const linkEl = document.getElementById('mobile-sync-link');
    if (linkEl && linkEl.textContent) {
      navigator.clipboard.writeText(linkEl.textContent).then(() => {
        this.showToast('Alamat URL HP disalin!');
      }).catch(() => {
        prompt('Salin alamat URL ini untuk dibuka di HP:', linkEl.textContent);
      });
    }
  }

  updateAmountPreview(val) {
    const preview = document.getElementById('tx-amount-preview');
    if (!preview) return;
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      preview.style.display = 'block';
      preview.textContent = `Terbaca: ${window.formatIDR(num)}`;
    } else {
      preview.style.display = 'none';
    }
  }

  updateInvestPreview() {
    // Satu input Rp Nabung = satu nilai aset, jadi tidak ada lagi
    // perhitungan unit/lot/gram.
    const preview = document.getElementById('invest-capital-preview');
    if (preview) preview.style.display = 'none';
  }

  setupEventListeners() {
    // Navigation Desktop
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Navigation Mobile
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.navigateTo(view);
      });
    });
  }

  navigateTo(viewName) {
    this.currentView = viewName;

    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    // Update panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Update Header Titles
    const titles = {
      dashboard: { title: 'Ringkasan Keuangan', desc: 'Pantau cash flow, pengeluaran harian, dan pertumbuhan portofolio investasi' },
      expenses: { title: 'Pengeluaran Harian', desc: 'Pantau dan kendalikan pengeluaran harian Anda agar tidak boros' },
      income: { title: 'Arus Kas & Income', desc: 'Lacak sumber pendapatan, cash inflow, dan tingkat tabungan (savings rate)' },
      portfolio: { title: 'Portofolio Investasi', desc: 'Kawal pertumbuhan aset saham, reksadana, emas, kripto, dan obligasi' },
      reports: { title: 'Analisis & Laporan', desc: 'Evaluasi kebiasaan finansial dan diversifikasi kekayaan Anda' },
      settings: { title: 'Pengaturan & Cadangan Data', desc: 'Kelola batas anggaran belanja harian, ekspor ke Excel, dan backup data' }
    };

    if (titles[viewName]) {
      const desktopTitle = document.getElementById('desktop-page-title');
      const desktopDesc = document.getElementById('desktop-page-desc');
      const mobileSub = document.getElementById('mobile-header-subtitle');
      if (desktopTitle) desktopTitle.textContent = titles[viewName].title;
      if (desktopDesc) desktopDesc.textContent = titles[viewName].desc;
      if (mobileSub) mobileSub.textContent = titles[viewName].title;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.updateFab(viewName);
    this.render();
    setTimeout(() => {
      this.renderCharts();
    }, 60);
  }

  render() {
    this.renderNetWorth();
    this.renderDashboard();
    this.renderExpenses();
    this.renderIncome();
    this.renderPortfolio();
    this.renderReports();
    this.renderCharts();
  }

  // --- Net Worth ---
  renderNetWorth() {
    const netWorth = window.financeStore.getNetWorth();
    const el = document.getElementById('sidebar-networth');
    if (el) el.textContent = window.formatIDR(netWorth);
  }

  // --- Dashboard View ---
  handleFabClick() {
    const view = this.currentView || 'dashboard';
    if (view === 'expenses') return this.openTxModal('expense');
    if (view === 'income') return this.openTxModal('income');
    if (view === 'portfolio') return this.openInvestModal();
    return null;
  }

  updateFab(view) {
    const button = document.getElementById('fab-btn');
    const icon = document.getElementById('fab-icon');
    if (!button) return;

    const arrowUp = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    const arrowDown = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
    const plus = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

    button.classList.remove('is-expense', 'is-income', 'is-invest');

    if (view === 'expenses') {
      button.hidden = false;
      button.classList.add('is-expense');
      button.title = 'Catat pengeluaran (Rp Keluar)';
      button.setAttribute('aria-label', 'Catat pengeluaran');
      if (icon) icon.innerHTML = arrowUp;
      return;
    }
    if (view === 'income') {
      button.hidden = false;
      button.classList.add('is-income');
      button.title = 'Catat pemasukan (Rp Masuk)';
      button.setAttribute('aria-label', 'Catat pemasukan');
      if (icon) icon.innerHTML = arrowDown;
      return;
    }
    if (view === 'portfolio') {
      button.hidden = false;
      button.classList.add('is-invest');
      button.title = 'Tambah aset (Rp Nabung)';
      button.setAttribute('aria-label', 'Tambah aset investasi');
      if (icon) icon.innerHTML = plus;
      return;
    }

    button.hidden = true;
  }

  updateMonthLabels() {
    const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const label = '(' + (names[this.dashMonth] || '') + ')';

    ['dash-month-income', 'dash-month-expense', 'dash-month-net', 'dash-month-portfolio']
      .forEach(id => {
        const node = document.getElementById(id);
        if (node) node.textContent = label;
      });
  }

  dashboardPeriodKey() {
    return this.dashYear + '-' + String(this.dashMonth + 1).padStart(2, '0');
  }

  getDashboardTransactions() {
    const key = this.dashboardPeriodKey();
    return window.financeStore.getTransactions()
      .filter(tx => this.toIsoDate_(tx.date).slice(0, 7) === key);
  }

  computeDashboardMetrics() {
    const rows = this.getDashboardTransactions();
    let income = 0;
    let expense = 0;

    rows.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') income += amount;
      else if (tx.type === 'expense') expense += amount;
    });

    const net = income - expense;
    return {
      income: income,
      expense: expense,
      net: net,
      savingsRate: income > 0 ? (net / income) * 100 : 0,
      count: rows.length
    };
  }

  refreshDashboardYears() {
    const yearSelect = document.getElementById('dash-year-select');
    if (!yearSelect) return;

    const years = new Set([new Date().getFullYear()]);
    window.financeStore.getTransactions().forEach(tx => {
      const year = parseInt(String(tx.date || '').slice(0, 4), 10);
      if (Number.isFinite(year) && year > 2000) years.add(year);
    });
    if (!years.has(this.dashYear)) years.add(this.dashYear);

    const sorted = Array.from(years).sort((a, b) => b - a);
    yearSelect.innerHTML = sorted.map(year => '<option value="' + year + '">' + year + '</option>').join('');
    yearSelect.value = String(this.dashYear);
  }

  initDashboardPeriod() {
    const monthSelect = document.getElementById('dash-month-select');
    const yearSelect = document.getElementById('dash-year-select');
    if (!monthSelect || !yearSelect) return;

    const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    monthSelect.innerHTML = names
      .map((name, index) => '<option value="' + index + '">' + name + '</option>')
      .join('');
    monthSelect.value = String(this.dashMonth);

    this.refreshDashboardYears();
    yearSelect.value = String(this.dashYear);

    monthSelect.addEventListener('change', () => {
      this.dashMonth = Number(monthSelect.value);
      this.refreshDashboardData();
    });

    yearSelect.addEventListener('change', () => {
      this.dashYear = Number(yearSelect.value);
      this.refreshDashboardData();
    });
  }

  renderDashboard() {
    const cf = this.computeDashboardMetrics();
    const port = window.financeStore.getPortfolioMetrics();
    const daily = window.financeStore.getDailyMetrics();
    this.refreshDashboardYears();
    this.updateMonthLabels();

    // Top metrics
    const incomeEl = document.getElementById('dash-total-income');
    const expenseEl = document.getElementById('dash-total-expense');
    const netCashflowEl = document.getElementById('dash-net-cashflow');
    const savingsRateEl = document.getElementById('dash-savings-rate');
    const portValEl = document.getElementById('dash-portfolio-val');
    const portGainEl = document.getElementById('dash-portfolio-gain');

    if (incomeEl) incomeEl.textContent = window.formatIDR(cf.income);
    if (expenseEl) expenseEl.textContent = window.formatIDR(cf.expense);
    if (netCashflowEl) {
      netCashflowEl.textContent = window.formatIDR(cf.net);
      netCashflowEl.className = 'metric-value ' + (cf.net >= 0 ? 'text-income' : 'text-expense');
    }
    if (savingsRateEl) {
      savingsRateEl.textContent = 'Tingkat Tabungan: ' + cf.savingsRate.toFixed(1) + '%';
    }
    if (portValEl) portValEl.textContent = window.formatIDR(port.totalCurrentValue);
    if (portGainEl) {
      const isPos = port.totalProfitLoss >= 0;
      portGainEl.textContent = 'Return: ' + window.formatIDR(port.totalProfitLoss) + ' (' + window.formatPercent(port.totalProfitLossPercent) + ')';
      portGainEl.style.color = isPos ? 'var(--income-color)' : 'var(--expense-color)';
    }

    // Daily gauge status
    const dailyStatusText = document.getElementById('dash-daily-status-text');
    const dailyBadge = document.getElementById('dash-daily-badge');
    const dailyGauge = document.getElementById('dash-daily-gauge');
    const dailyRemaining = document.getElementById('dash-daily-remaining');
    const dailyPercent = document.getElementById('dash-daily-percent');

    if (dailyStatusText) {
      dailyStatusText.textContent = `${window.formatIDR(daily.totalToday)} terpakai dari batas ${window.formatIDR(daily.dailyLimit)}`;
    }
    if (dailyGauge) {
      dailyGauge.style.width = `${Math.min(100, daily.usagePercent)}%`;
      dailyGauge.style.backgroundColor = daily.isExceeded ? 'var(--expense-color)' : (daily.usagePercent > 75 ? 'var(--warning-color)' : 'var(--income-color)');
    }
    if (dailyBadge) {
      dailyBadge.textContent = daily.isExceeded ? 'Melebihi Batas' : (daily.usagePercent > 75 ? 'Hati-hati' : 'Aman');
      dailyBadge.className = 'badge ' + (daily.isExceeded ? 'badge-expense' : (daily.usagePercent > 75 ? 'badge-warning' : 'badge-income'));
    }
    if (dailyRemaining) {
      dailyRemaining.textContent = daily.remaining >= 0 ? `Sisa kuota: ${window.formatIDR(daily.remaining)}` : `Boros: ${window.formatIDR(Math.abs(daily.remaining))}`;
    }
    if (dailyPercent) {
      dailyPercent.textContent = `${daily.usagePercent.toFixed(0)}% terpakai`;
    }

    // Recent Transactions
    const recentTx = window.financeStore.getTransactions().slice(0, 5);
    const container = document.getElementById('dash-recent-tx-list');
    if (container) {
      if (recentTx.length === 0) {
        container.innerHTML = '<div class="text-sm text-muted" style="text-align: center; padding: 20px;">Belum ada riwayat transaksi.</div>';
      } else {
        container.innerHTML = recentTx.map(tx => this.renderTransactionItem(tx)).join('');
      }
    }
  }

  // --- Expenses View ---
  renderExpenses() {
    const daily = window.financeStore.getDailyMetrics();
    const sumEl = document.getElementById('expense-today-sum');
    const gaugeEl = document.getElementById('expense-daily-gauge');
    const infoEl = document.getElementById('expense-daily-info');
    const pillEl = document.getElementById('expense-daily-status-pill');

    if (sumEl) sumEl.textContent = window.formatIDR(daily.totalToday);
    if (infoEl) infoEl.textContent = `Batas Harian: ${window.formatIDR(daily.dailyLimit)} (Sisa: ${window.formatIDR(Math.max(0, daily.remaining))})`;
    if (gaugeEl) {
      gaugeEl.style.width = `${Math.min(100, daily.usagePercent)}%`;
      gaugeEl.style.backgroundColor = daily.isExceeded ? 'var(--expense-color)' : (daily.usagePercent > 75 ? 'var(--warning-color)' : 'var(--income-color)');
    }
    if (pillEl) {
      pillEl.textContent = daily.isExceeded ? 'Over Budget' : (daily.usagePercent > 75 ? 'Mendekati Limit' : 'Terkendali');
      pillEl.className = 'badge ' + (daily.isExceeded ? 'badge-expense' : (daily.usagePercent > 75 ? 'badge-warning' : 'badge-income'));
    }

    // Filter transactions
    const allTx = window.financeStore.getTransactions().filter(t => t.type === 'expense');
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
    const monthPrefix = todayStr.substring(0, 7);

    let filtered = allTx.filter(t => {
      // Date filter
      if (this.expenseFilter === 'today' && t.date !== todayStr) return false;
      if (this.expenseFilter === 'yesterday' && t.date !== yesterdayStr) return false;
      if (this.expenseFilter === 'week' && t.date < sevenDaysStr) return false;
      if (this.expenseFilter === 'month' && !t.date.startsWith(monthPrefix)) return false;

      // Category filter
      if (this.expenseCategory !== 'all' && t.category !== this.expenseCategory) return false;

      // Search query
      if (this.expenseSearchQuery) {
        const q = this.expenseSearchQuery.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchNote = (t.note || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchCat) return false;
      }

      return true;
    });

    const container = document.getElementById('expense-list-container');
    if (container) {
      if (filtered.length === 0) {
        container.innerHTML = '<div class="text-sm text-muted" style="text-align: center; padding: 30px;">Tidak ada pengeluaran pada filter ini.</div>';
      } else {
        container.innerHTML = filtered.map(tx => this.renderTransactionItem(tx, true)).join('');
      }
    }
  }

  setExpenseFilter(filterName, btn) {
    this.expenseFilter = filterName;
    if (btn) {
      btn.parentElement.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    this.renderExpenses();
  }

  filterExpenseCategory(cat) {
    this.expenseCategory = cat;
    this.renderExpenses();
  }

  searchExpenses(query) {
    this.expenseSearchQuery = query;
    this.renderExpenses();
  }

  // --- Income View ---
  renderIncome() {
    const cf = window.financeStore.getCashFlowMetrics();
    const totalValEl = document.getElementById('income-total-val');
    const netValEl = document.getElementById('income-net-val');
    const savingsEl = document.getElementById('income-savings-percent');

    if (totalValEl) totalValEl.textContent = window.formatIDR(cf.totalIncome);
    if (netValEl) {
      netValEl.textContent = window.formatIDR(cf.netCashFlow);
      netValEl.style.color = cf.netCashFlow >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
    }
    if (savingsEl) savingsEl.textContent = `${cf.savingsRate.toFixed(1)}%`;

    const incomeTx = window.financeStore.getTransactions().filter(t => t.type === 'income');
    const container = document.getElementById('income-list-container');
    if (container) {
      if (incomeTx.length === 0) {
        container.innerHTML = '<div class="text-sm text-muted" style="text-align: center; padding: 30px;">Belum ada data pemasukan tercatat.</div>';
      } else {
        container.innerHTML = incomeTx.map(tx => this.renderTransactionItem(tx, true)).join('');
      }
    }
  }

  // --- Portfolio View ---
  renderPortfolio() {
    const port = window.financeStore.getPortfolioMetrics();

    const valEl = document.getElementById('port-total-value');
    const capEl = document.getElementById('port-total-capital');
    const profitEl = document.getElementById('port-total-profit');
    const profitPercentEl = document.getElementById('port-profit-percent');
    const topAssetEl = document.getElementById('port-top-asset');
    const topValEl = document.getElementById('port-top-val');

    if (valEl) valEl.textContent = window.formatIDR(port.totalCurrentValue);
    if (capEl) capEl.textContent = window.formatIDR(port.totalInvested);
    if (profitEl) {
      profitEl.textContent = window.formatIDR(port.totalProfitLoss);
      profitEl.style.color = port.totalProfitLoss >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
    }
    if (profitPercentEl) {
      profitPercentEl.textContent = window.formatPercent(port.totalProfitLossPercent);
      profitPercentEl.style.color = port.totalProfitLoss >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
    }

    // Find top asset by value
    if (port.items && port.items.length > 0) {
      const sorted = [...port.items].sort((a, b) => b.currentValue - a.currentValue);
      const top = sorted[0];
      if (topAssetEl) topAssetEl.textContent = `${top.code} - ${top.name}`;
      if (topValEl) topValEl.textContent = `${window.formatIDR(top.currentValue)} (${((top.currentValue / port.totalCurrentValue) * 100).toFixed(1)}%)`;
    } else {
      if (topAssetEl) topAssetEl.textContent = '-';
      if (topValEl) topValEl.textContent = '-';
    }

    // Render table
    let items = port.items;
    if (this.portfolioCategory !== 'all') {
      items = items.filter(item => item.category === this.portfolioCategory);
    }

    const tbody = document.getElementById('portfolio-table-body');
    if (tbody) {
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">Tidak ada aset dalam kategori ini.</td></tr>';
      } else {
        tbody.innerHTML = items.map(inv => {
          const isPos = inv.profitLoss >= 0;
          return `
            <tr>
              <td>
                <div class="font-bold">${escapeHtml(inv.category || inv.name)}</div>
                <div class="text-xs text-muted">${escapeHtml(inv.notes ? inv.notes : (inv.name && inv.name !== inv.category ? inv.name : inv.code))}</div>
              </td>
              <td>
                <span class="badge" style="background: ${CATEGORY_COLORS[inv.category] || '#6366f1'}25; color: ${CATEGORY_COLORS[inv.category] || '#6366f1'}">
                  ${inv.category}
                </span>
              </td>
              <td>${inv.category === 'Dana Darurat' ? '-' : escapeHtml(inv.units + ' ' + inv.unitName)}</td>
              <td>${window.formatIDR(inv.buyPrice)}</td>
              <td>
                <span class="font-semibold">${window.formatIDR(inv.currentPrice)}</span>
              </td>
              <td class="font-bold">${window.formatIDR(inv.currentValue)}</td>
              <td>
                <div class="font-semibold" style="color: ${isPos ? 'var(--income-color)' : 'var(--expense-color)'}">
                  ${window.formatIDR(inv.profitLoss)}
                </div>
                <div class="text-xs" style="color: ${isPos ? 'var(--income-color)' : 'var(--expense-color)'}">
                  ${window.formatPercent(inv.profitLossPercent)}
                </div>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-secondary btn-sm" onclick="app.quickEditPrice('${escapeHtml(inv.id)}', ${Number(inv.currentPrice) || 0})" title="Update Harga Pasar">
                  ✏️ Update
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--expense-color); margin-left: 4px;" onclick="app.deleteInvestment('${escapeHtml(inv.id)}')" title="Hapus Aset">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  setPortfolioCategory(cat, btn) {
    this.portfolioCategory = cat;
    if (btn) {
      btn.parentElement.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    this.renderPortfolio();
  }

  quickEditPrice(id, currentPrice) {
    const input = prompt('Masukkan harga pasar terkini (Rp):', currentPrice);
    if (input !== null) {
      const price = parseFloat(input);
      if (!isNaN(price) && price > 0) {
        window.financeStore.updateInvestment(id, { currentPrice: price });
        this.showToast('Harga aset berhasil diperbarui');
      }
    }
  }

  async deleteInvestment(id) {
    if (!confirm('Yakin ingin menghapus aset investasi ini dari portofolio?')) return;

    const current = window.financeStore.getInvestments().find(item => item.id === id);
    await window.financeStore.deleteInvestment(id);

    if (current && !String(id).startsWith('inv-') && !String(id).startsWith('queue-')) {
      window.financeStore.enqueueSync('investment', 'void', { id: id, version: current.version });
      this.updateSyncStatus();
      await this.processSyncQueue();
    }

    this.showToast(navigator.onLine ? 'Aset berhasil dihapus' : 'Aset dihapus lokal, menunggu sinkron');
  }

  // --- Reports View ---
  renderReports() {
    const cf = window.financeStore.getCashFlowMetrics();
    const port = window.financeStore.getPortfolioMetrics();

    const savingsRate = cf.savingsRate;
    const expenseRate = cf.totalIncome > 0 ? (cf.totalExpense / cf.totalIncome) * 100 : 0;

    const sEl = document.getElementById('health-savings-rate');
    const eEl = document.getElementById('health-expense-rate');
    const aEl = document.getElementById('health-asset-count');

    if (sEl) {
      sEl.textContent = `${savingsRate.toFixed(1)}%`;
      sEl.className = 'font-bold ' + (savingsRate >= 20 ? 'text-income' : 'text-warning');
    }
    if (eEl) {
      eEl.textContent = `${expenseRate.toFixed(1)}%`;
      eEl.className = 'font-bold ' + (expenseRate <= 60 ? 'text-income' : 'text-expense');
    }
    if (aEl) {
      aEl.textContent = `${port.items.length} Aset (${Object.keys(port.categoryAllocation).length} Kategori)`;
    }
  }

  // --- Charts Rendering ---
  renderCharts() {
    // 1. Cash Flow Bar Chart
    const transactions = this.getDashboardTransactions();
    const today = new Date();
    const isCurrentMonth = this.dashYear === today.getFullYear() && this.dashMonth === today.getMonth();
    const series = [];

    if (isCurrentMonth) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });

        let inc = 0;
        let exp = 0;
        transactions.forEach(t => {
          if (String(t.date || '').slice(0, 10) === dateStr) {
            if (t.type === 'income') inc += t.amount;
            if (t.type === 'expense') exp += t.amount;
          }
        });
        series.push({ label: dayName, income: inc, expense: exp });
      }
    } else {
      const daysInMonth = new Date(this.dashYear, this.dashMonth + 1, 0).getDate();
      const weeks = Math.ceil(daysInMonth / 7);
      for (let w = 0; w < weeks; w += 1) {
        const from = w * 7 + 1;
        const to = Math.min(daysInMonth, from + 6);
        let inc = 0;
        let exp = 0;
        transactions.forEach(t => {
          const day = parseInt(String(t.date || '').slice(8, 10), 10);
          if (Number.isFinite(day) && day >= from && day <= to) {
            if (t.type === 'income') inc += t.amount;
            if (t.type === 'expense') exp += t.amount;
          }
        });
        series.push({ label: 'Mgg ' + (w + 1), income: inc, expense: exp });
      }
    }

    window.FinCharts.renderCashFlowChart('cashflow-bar-chart', series);

    // 2. Portfolio Allocation Donut
    const port = window.financeStore.getPortfolioMetrics();
    const portSlices = [];
    Object.entries(port.categoryAllocation).forEach(([cat, val]) => {
      portSlices.push({
        label: cat,
        value: val,
        color: CATEGORY_COLORS[cat] || '#6366f1'
      });
    });

    window.FinCharts.renderDonutChart('portfolio-donut-chart', portSlices, {
      centerTitle: 'Total Aset',
      centerValue: (port.totalCurrentValue / 1000000).toFixed(1) + ' Jt'
    });

    // Portfolio Legend
    const legendEl = document.getElementById('portfolio-chart-legend');
    if (legendEl) {
      const total = port.totalCurrentValue || 1;
      legendEl.innerHTML = portSlices.map(s => {
        const pct = ((s.value / total) * 100).toFixed(1);
        return `<span style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 8px; height: 8px; border-radius: 2px; background: ${s.color};"></span>
          ${escapeHtml(s.label)} (${pct}%)
        </span>`;
      }).join('');
    }

    // 3. Expense Category Donut for Reports
    const expenseTx = transactions.filter(t => t.type === 'expense');
    const catMap = {};
    expenseTx.forEach(t => {
      const c = t.category || 'Lain-lain';
      catMap[c] = (catMap[c] || 0) + t.amount;
    });

    const expSlices = Object.entries(catMap).map(([cat, val]) => ({
      label: cat,
      value: val,
      color: CATEGORY_COLORS[cat] || '#64748b'
    })).sort((a, b) => b.value - a.value);

    const totalExp = expenseTx.reduce((sum, t) => sum + t.amount, 0);

    window.FinCharts.renderDonutChart('expense-category-donut', expSlices, {
      centerTitle: 'Total Belanja',
      centerValue: (totalExp / 1000000).toFixed(1) + ' Jt'
    });

    const expLegend = document.getElementById('expense-category-legend');
    if (expLegend) {
      expLegend.innerHTML = expSlices.slice(0, 5).map(s => {
        const pct = totalExp > 0 ? ((s.value / totalExp) * 100).toFixed(1) : 0;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; border-radius: 3px; background: ${s.color};"></span>
              <span>${escapeHtml(s.label)}</span>
            </div>
            <div class="font-bold">${window.formatIDR(s.value)} (${pct}%)</div>
          </div>
        `;
      }).join('');
    }
  }

  // --- Transaction Item Template ---
  renderTransactionItem(tx, showDelete = false) {
    const isInc = tx.type === 'income';
    const icon = CATEGORY_ICONS[tx.category] || (isInc ? '💰' : '💸');
    const amountColor = isInc ? 'text-income' : 'text-expense';
    const sign = isInc ? '+' : '-';

    return `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon-circle" style="background: ${isInc ? 'var(--income-subtle)' : 'var(--expense-subtle)'}">
            ${icon}
          </div>
          <div class="tx-details">
            <div class="tx-title">${escapeHtml(tx.title)}</div>
            <div class="tx-meta">
              <span class="badge ${isInc ? 'badge-income' : 'badge-expense'}">${escapeHtml(tx.category)}</span>
              <span>${escapeHtml(tx.date)}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${amountColor}">
            ${sign} ${window.formatIDR(tx.amount)}
          </div>
          ${showDelete ? `
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; color: var(--text-muted);" onclick="app.deleteTransaction('${escapeHtml(tx.id)}')">
              Hapus
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // --- Sinkronisasi Spreadsheet ---
  /** Tanggal dari Spreadsheet bisa berupa ISO UTC; kembalikan YYYY-MM-DD WIB. */
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

  // --- Status & antrean sinkronisasi ---
  updateSyncStatus(state) {
    const dots = document.querySelectorAll('[data-sync-dot]');
    if (!dots.length) return;

    const queueCount = window.financeStore.getSyncQueue().length;
    const syncing = state === 'syncing' || this.queueRunning === true;
    const offline = !navigator.onLine;

    let mode = 'ok';
    let label = 'Tersinkron';
    if (syncing) {
      mode = 'syncing';
      label = 'Menyinkronkan…';
    } else if (offline) {
      mode = 'offline';
      label = queueCount > 0 ? 'Offline — ' + queueCount + ' data menunggu' : 'Offline — data tersimpan di perangkat';
    } else if (queueCount > 0) {
      mode = 'offline';
      label = queueCount + ' data menunggu sinkron';
    }

    dots.forEach(dot => {
      dot.classList.remove('is-offline', 'is-syncing', 'is-ok');
      dot.classList.add('is-' + mode);
      dot.title = label;
      dot.setAttribute('aria-label', 'Status sinkronisasi: ' + label);
    });
  }

  async processSyncQueue() {
    const store = window.financeStore;
    const api = window.CashflowApi;

    if (!api || !api.getToken || !api.getToken()) {
      this.updateSyncStatus();
      return { processed: 0 };
    }
    if (!navigator.onLine) {
      this.updateSyncStatus();
      return { processed: 0, offline: true };
    }
    if (this.queueRunning) return { processed: 0, busy: true };

    const queue = store.getSyncQueue();
    if (!queue.length) {
      this.updateSyncStatus();
      return { processed: 0 };
    }

    this.queueRunning = true;
    this.updateSyncStatus('syncing');
    let processed = 0;

    for (const item of queue) {
      try {
        if (item.kind === 'transaction' && item.op === 'create') {
          // Cek dulu agar pengiriman ulang tidak membuat baris ganda.
          const existing = await api.get('listTransactions');
          const duplicate = (existing.items || []).some(tx =>
            String(tx.title || '') === String(item.data.title || '') &&
            Number(tx.amountMinor) === Number(item.data.amount) &&
            this.toIsoDate_(tx.transactionDate) === String(item.data.date || '').slice(0, 10)
          );
          if (!duplicate) {
            const categoryId = await api.resolveCategoryId(item.data.category, item.data.type);
            await api.post('createTransaction', {
              type: item.data.type,
              title: item.data.title,
              amountMinor: Math.round(Number(item.data.amount) || 0),
              currency: 'IDR',
              categoryId: categoryId,
              transactionDate: item.data.date,
              wallet: item.data.wallet || '',
              note: item.data.note || ''
            });
          }
        } else if (item.kind === 'transaction' && item.op === 'void') {
          const current = await api.get('listTransactions', { includeVoided: 'true' });
          const row = (current.items || []).find(tx => tx.transactionId === item.data.id);
          if (row && row.status !== 'void') {
            await api.post('voidTransaction', {
              transactionId: item.data.id,
              expectedVersion: row.version
            });
          }
        } else if (item.kind === 'investment' && item.op === 'create') {
          const existing = await api.get('listInvestments');
          const duplicate = (existing.items || []).some(inv =>
            String(inv.name || '') === String(item.data.name || '') &&
            Number(inv.buyPriceMinor) === Math.round(Number(item.data.buyPrice) || 0)
          );
          if (!duplicate) {
            await api.post('createInvestment', {
              name: item.data.name,
              code: item.data.code,
              categoryId: 'investment-general',
              buyPriceMinor: Math.round(Number(item.data.buyPrice) || 0),
              currentPriceMinor: Math.round(Number(item.data.currentPrice ?? item.data.buyPrice) || 0),
              units: 1,
              unitName: 'rupiah',
              unitMultiplier: 1,
              dateBought: item.data.dateBought,
              notes: item.data.notes || ''
            });
          }
        } else if (item.kind === 'investment' && item.op === 'void') {
          const current = await api.get('listInvestments', { includeVoided: 'true' });
          const row = (current.items || []).find(inv => inv.investmentId === item.data.id);
          if (row && row.status !== 'void') {
            await api.post('voidInvestment', {
              investmentId: item.data.id,
              expectedVersion: row.version
            });
          }
        }

        // Berhasil (atau sudah ada di server) -> keluarkan dari antrean.
        store.removeSyncItem(item.id);
        processed += 1;
      } catch (error) {
        console.warn('[CashFlow] Antrean tertahan:', error && error.message);
        break;
      }
    }

    this.queueRunning = false;

    if (processed > 0) {
      try {
        await this.syncFromSpreadsheet({ silent: true });
        await store.syncInvestmentsFromApi_();
      } catch (error) {
        /* refresh gagal tidak masalah, data lokal tetap */
      }
    }

    this.updateSyncStatus();
    return { processed: processed };
  }

  /** Bentuk record Spreadsheet (amountMinor, categoryId) -> bentuk localStorage. */
  mapSpreadsheetTransactions_(items, categoryNames) {
    return (items || []).map(tx => ({
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
  }

  /**
   * Ambil data transaksi terbaru dari Google Spreadsheet, timpa isi
   * localStorage, lalu render ulang dashboard.
   * Bila server tidak terjangkau, data lokal dibiarkan apa adanya.
   */
  async syncFromSpreadsheet(options = {}) {
    const api = window.CashflowApi;
    if (!api || typeof api.get !== 'function' || !api.enabled()) return null;
    if (!api.getToken()) return null;

    try {
      const [list, categories] = await Promise.all([
        api.get('list'),
        api.get('listCategories').catch(() => ({ items: [] }))
      ]);
      const categoryNames = new Map(
        (categories && categories.items ? categories.items : [])
          .map(category => [category.categoryId, category.displayName || category.name])
      );

      const fromServer = this.mapSpreadsheetTransactions_(list && list.items, categoryNames);
      // Data yang masih di antrean tidak boleh terhapus oleh hasil server.
      const merged = window.financeStore.mergeTransactionsWithQueue_(fromServer);
      window.financeStore.saveTransactions(merged);
      this.render();
      return merged;
    } catch (error) {
      console.warn('[CashFlow] Sinkronisasi Spreadsheet gagal, memakai data lokal:', error.message);
      if (!options.silent) {
        const notDeployed = /Unsupported action|not found|tidak dikenal/i.test(String(error.message || ''));
        this.showToast(notDeployed
          ? 'Backend GAS belum diperbarui — deploy versi baru dulu'
          : 'Gagal memuat data dari Spreadsheet');
      }
      return null;
    }
  }

  /**
   * Simpan transaksi: tulis ke localStorage lebih dulu, lalu kirim ke
   * Spreadsheet. Bila pengiriman gagal, data lokal tetap tersimpan.
   */
  async saveTransactionWithSync(tx) {
    const localTx = {
      id: 'tx-' + Date.now(),
      type: tx.type,
      title: tx.title,
      amount: parseFloat(tx.amount) || 0,
      category: tx.category,
      date: tx.date || new Date().toISOString().split('T')[0],
      wallet: tx.wallet || 'Utama',
      note: tx.note || ''
    };

    window.financeStore.saveTransactions([localTx, ...window.financeStore.getTransactions()]);
    window.financeStore.enqueueSync('transaction', 'create', localTx);
    this.updateSyncStatus();

    const result = await this.processSyncQueue();
    const stillPending = window.financeStore.getSyncQueue().some(item =>
      item.kind === 'transaction' && item.op === 'create' && item.data.id === localTx.id
    );

    if (stillPending) {
      return { synced: false, offline: !navigator.onLine, processed: result.processed };
    }
    return { synced: true, processed: result.processed };
  }

  async deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;

    const current = window.financeStore.getTransactions().find(item => item.id === id);
    window.financeStore.saveTransactions(
      window.financeStore.getTransactions().filter(item => item.id !== id)
    );

    if (current && !String(id).startsWith('tx-') && !String(id).startsWith('queue-')) {
      window.financeStore.enqueueSync('transaction', 'void', { id: id, version: current.version });
      this.updateSyncStatus();
      await this.processSyncQueue();
    }

    this.showToast(navigator.onLine ? 'Transaksi dihapus' : 'Dihapus lokal, menunggu sinkron');
  }

  // --- Transaction Modal & Form ---
  openTxModal(type = 'expense') {
    this.setTxModalType(type);
    const dateInput = document.getElementById('tx-input-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const amountInput = document.getElementById('tx-input-amount');
    if (amountInput) amountInput.value = '';

    const preview = document.getElementById('tx-amount-preview');
    if (preview) preview.style.display = 'none';

    document.getElementById('tx-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('tx-input-amount')?.focus();
    }, 100);
  }

  closeTxModal() {
    document.getElementById('tx-modal').classList.remove('active');
    document.getElementById('tx-form').reset();
    const preview = document.getElementById('tx-amount-preview');
    if (preview) preview.style.display = 'none';
  }

  setTxModalType(type) {
    const typeInput = document.getElementById('tx-input-type');
    const submitBtn = document.getElementById('tx-submit-btn');
    const titleEl = document.getElementById('tx-modal-title');
    const titleInput = document.getElementById('tx-input-title');

    if (typeInput) typeInput.value = type;
    if (type === 'expense') {
      if (submitBtn) {
        submitBtn.className = 'btn btn-rp-keluar';
        submitBtn.textContent = 'Simpan Rp Keluar';
      }
      if (titleEl) titleEl.textContent = 'Catat Rp Keluar';
      if (titleInput) titleInput.placeholder = 'Contoh: Makan Siang Nasi Padang';
      this.populateCategoryOptions('expense');
    } else {
      if (submitBtn) {
        submitBtn.className = 'btn btn-rp-masuk';
        submitBtn.textContent = 'Simpan Rp Masuk';
      }
      if (titleEl) titleEl.textContent = 'Catat Rp Masuk';
      if (titleInput) titleInput.placeholder = 'Contoh: Gaji Bulanan / Freelance';
      this.populateCategoryOptions('income');
    }
  }

  appendZeros(zeros = '000') {
    const input = document.getElementById('tx-input-amount');
    if (!input) return;
    let val = String(input.value || '').trim();
    if (!val || val === '0') {
      val = '1' + zeros;
    } else {
      val = val + zeros;
    }
    input.value = val;
    this.updateAmountPreview(val);
    input.focus?.();
  }

  addAmount(amount) {
    const input = document.getElementById('tx-input-amount');
    if (!input) return;
    const current = parseFloat(input.value) || 0;
    const newVal = current + amount;
    input.value = newVal;
    this.updateAmountPreview(newVal);
    input.focus?.();
  }

  clearAmount() {
    const input = document.getElementById('tx-input-amount');
    if (!input) return;
    input.value = '';
    this.updateAmountPreview('');
    input.focus?.();
  }

  populateCategoryOptions(type) {
    const select = document.getElementById('tx-input-category');
    if (!select) return;
    const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  handleSaveTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('tx-input-type')?.value || 'expense';
    const amount = parseFloat(document.getElementById('tx-input-amount')?.value);
    const title = document.getElementById('tx-input-title')?.value.trim();
    const category = document.getElementById('tx-input-category')?.value || 'Lain-lain';
    const date = document.getElementById('tx-input-date')?.value || new Date().toISOString().split('T')[0];

    if (!amount || amount <= 0 || !title) {
      alert('Mohon isi nominal dan keterangan transaksi dengan benar.');
      return;
    }

    const successMessage = type === 'expense'
      ? 'Rp Keluar berhasil dicatat!'
      : 'Rp Masuk berhasil ditambahkan!';

    this.saveTransactionWithSync({
      type,
      amount,
      title,
      category,
      wallet: 'Utama',
      date,
      note: ''
    }).then(result => {
      this.showToast(result && result.synced === false
        ? `${successMessage} (lokal, belum sinkron)`
        : successMessage);
    });

    this.closeTxModal();
  }

  // --- Investment Modal & Form (Rp Nabung) ---
  openInvestModal() {
    const dateInput = document.getElementById('invest-input-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    const buyPriceInput = document.getElementById('invest-input-buyprice');
    if (buyPriceInput) buyPriceInput.value = '';
    
    const preview = document.getElementById('invest-buyprice-preview');
    if (preview) preview.style.display = 'none';

    const capPreview = document.getElementById('invest-capital-preview');
    if (capPreview) capPreview.style.display = 'none';

    const categorySelect = document.getElementById('invest-input-category');
    if (categorySelect) categorySelect.value = 'Dana Darurat';

    this.handleInvestCategoryChange('Dana Darurat');
    document.getElementById('invest-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('invest-input-buyprice')?.focus();
    }, 100);
  }

  closeInvestModal() {
    document.getElementById('invest-modal').classList.remove('active');
    document.getElementById('invest-form').reset();
    const preview = document.getElementById('invest-buyprice-preview');
    if (preview) preview.style.display = 'none';
    const capPreview = document.getElementById('invest-capital-preview');
    if (capPreview) capPreview.style.display = 'none';
  }

  handleInvestCategoryChange(cat) {
    const buyPriceLabel = document.getElementById('invest-label-buyprice');
    if (!buyPriceLabel) return;

    const labels = {
      'Dana Darurat': 'Nominal Dana Darurat (Rp) *',
      'Saham': 'Nilai Investasi Saham (Rp) *',
      'Reksadana': 'Nilai Reksa Dana (Rp) *',
      'Emas': 'Nilai Emas (Rp) *',
      'Kripto': 'Nilai Aset Kripto (Rp) *',
      'Obligasi': 'Nilai Obligasi / SBN (Rp) *'
    };
    buyPriceLabel.textContent = labels[cat] || 'Nominal Aset (Rp) *';
    this.updateInvestPreview();
  }

  updateInvestAmountPreview(val) {
    const preview = document.getElementById('invest-buyprice-preview');
    const num = parseFloat(val);
    if (preview) {
      if (!isNaN(num) && num > 0) {
        preview.style.display = 'block';
        preview.textContent = `Terbaca: ${window.formatIDR(num)}`;
      } else {
        preview.style.display = 'none';
      }
    }
    this.updateInvestPreview();
  }

  appendInvestZeros(zeros = '000') {
    const input = document.getElementById('invest-input-buyprice');
    if (!input) return;
    let val = String(input.value || '').trim();
    if (!val || val === '0') {
      val = '1' + zeros;
    } else {
      val = val + zeros;
    }
    input.value = val;
    this.updateInvestAmountPreview(val);
    input.focus?.();
  }

  addInvestAmount(amount) {
    const input = document.getElementById('invest-input-buyprice');
    if (!input) return;
    const current = parseFloat(input.value) || 0;
    const newVal = current + amount;
    input.value = newVal;
    this.updateInvestAmountPreview(newVal);
    input.focus?.();
  }

  clearInvestAmount() {
    const input = document.getElementById('invest-input-buyprice');
    if (!input) return;
    input.value = '';
    this.updateInvestAmountPreview('');
    input.focus?.();
  }

  handleSaveInvestment(e) {
    e.preventDefault();
    const category = document.getElementById('invest-input-category')?.value || 'Dana Darurat';
    const buyPrice = parseFloat(document.getElementById('invest-input-buyprice')?.value);
    const dateBought = document.getElementById('invest-input-date')?.value || new Date().toISOString().split('T')[0];
    const notes = document.getElementById('invest-input-notes')?.value.trim() || '';

    if (!buyPrice || buyPrice <= 0) {
      alert('Mohon masukkan Harga Beli yang valid.');
      return;
    }

    const defaultCodes = {
      'Dana Darurat': 'DARURAT',
      'Saham': 'SAHAM',
      'Reksadana': 'REKSA',
      'Emas': 'EMAS',
      'Kripto': 'KRIPTO',
      'Obligasi': 'SBN'
    };

    const code = defaultCodes[category] || category.substring(0, 4).toUpperCase();
    const name = notes ? category + ' (' + notes + ')' : 'Tabungan ' + category;
    const localId = 'inv-' + Date.now();

    const investment = {
      id: localId,
      category: category,
      name: name,
      code: code,
      units: 1,
      unitName: 'rupiah',
      buyPrice: buyPrice,
      currentPrice: buyPrice,
      dateBought: dateBought,
      notes: notes
    };

    // 1) localStorage dulu (data utama di layar)
    window.financeStore.saveInvestments([
      { ...investment, status: 'active' },
      ...window.financeStore.getInvestments()
    ]);

    // 2) masukkan ke antrean sinkronisasi
    window.financeStore.enqueueSync('investment', 'create', investment);
    this.closeInvestModal();
    this.updateSyncStatus();

    // 3) kirim sekarang bila memungkinkan
    this.processSyncQueue().then(result => {
      if (result && result.processed > 0) {
        this.showToast('Rp Nabung berhasil dicatat!');
      } else if (!navigator.onLine) {
        this.showToast('Rp Nabung tersimpan di perangkat, akan dikirim saat online');
      } else {
        this.showToast('Rp Nabung tersimpan lokal, menunggu sinkron');
      }
    });
  }

  // --- Settings & Backup ---
  populateSettingsForm() {
    const s = window.financeStore.getSettings();
    const dailyInput = document.getElementById('setting-daily-budget');
    const monthlyInput = document.getElementById('setting-monthly-budget');
    if (dailyInput) dailyInput.value = s.dailyBudget || 200000;
    if (monthlyInput) monthlyInput.value = s.monthlyBudget || 5000000;
  }

  saveBudgetSettings() {
    const daily = parseFloat(document.getElementById('setting-daily-budget').value) || 200000;
    const monthly = parseFloat(document.getElementById('setting-monthly-budget').value) || 5000000;
    const current = window.financeStore.getSettings();

    window.financeStore.saveSettings({
      ...current,
      dailyBudget: daily,
      monthlyBudget: monthly
    });

    this.showToast('Pengaturan batas anggaran disimpan');
  }

  exportCSV() {
    const csv = window.financeStore.exportCSV();
    // BOM agar Excel membaca UTF-8 dengan benar.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    let username = 'Pengguna';
    try {
      const session = JSON.parse(sessionStorage.getItem('cashflow_session_v1') || 'null');
      if (session && session.username) username = String(session.username);
    } catch (error) {
      /* biarkan nama default */
    }

    const safeName = username.replace(/[^\w.-]+/g, '') || 'Pengguna';
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    a.href = url;
    a.download = 'Cashflow_' + safeName + '-Transaksi_' + stamp + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('File CSV berhasil diunduh');
  }

  exportJSON() {
    const jsonStr = window.financeStore.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    this.showToast('File Backup JSON berhasil diunduh');
  }

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = window.financeStore.importJSON(e.target.result);
      if (res.success) {
        this.showToast('Data berhasil dipulihkan dari backup!');
        this.render();
      } else {
        alert('Gagal membaca file backup: ' + res.error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  clearRealData() {
    if (confirm('Kosongkan semua data transaksi dan investasi contoh agar Anda bisa mulai mencatat data keuangan pribadi dari nol?')) {
      window.financeStore.clearAllData();
      this.render();
      this.showToast('Data berhasil dikosongkan. Siap digunakan!');
    }
  }

  async resetDemoData() {
    if (!window.CashflowApi || !window.CashflowApi.getToken()) {
      this.showToast('Silakan masuk terlebih dahulu untuk memuat data dari Spreadsheet');
      return;
    }
    const data = await this.syncFromSpreadsheet();
    if (data) {
      this.populateSettingsForm();
      this.showToast('Data terbaru dari Spreadsheet berhasil dimuat');
    } else {
      this.showToast('Gagal memuat data dari Spreadsheet');
    }
  }

  // --- Toast Notification ---
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    const toastIcon = document.createElement('span');
    toastIcon.textContent = '✓';
    const toastText = document.createElement('span');
    toastText.textContent = String(message === null || message === undefined ? '' : message);
    toast.appendChild(toastIcon);
    toast.appendChild(toastText);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }
}

// Global App Instance
try {
  window.app = new FinApp();
} catch (e) {
  console.error('Failed to create FinApp instance:', e);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.app) {
      window.app = new FinApp();
    }
  });
}
// Keep delete available in the dashboard's recent transaction activity.
// The existing renderer remains reusable for views that explicitly hide it.
(() => {
  const renderTransactionItem = FinApp.prototype.renderTransactionItem;
  FinApp.prototype.renderTransactionItem = function (tx, showDelete) {
    return renderTransactionItem.call(this, tx, showDelete === undefined ? true : showDelete);
  };
  if (window.app) window.app.renderDashboard();
})();
