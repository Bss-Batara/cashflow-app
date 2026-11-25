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

class FinApp {
  constructor() {
    window.app = this;
    this.currentView = 'dashboard';
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
    window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
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
    const cat = document.getElementById('invest-input-category')?.value;
    const units = cat === 'Dana Darurat' ? 1 : (parseFloat(document.getElementById('invest-input-units')?.value) || 1);
    const buyPrice = parseFloat(document.getElementById('invest-input-buyprice')?.value) || 0;
    const mult = cat === 'Saham' ? 100 : 1;
    const total = units * mult * buyPrice;
    const preview = document.getElementById('invest-capital-preview');
    if (preview) {
      if (total > 0 && cat !== 'Dana Darurat' && (units > 1 || mult > 1)) {
        preview.style.display = 'block';
        preview.textContent = `Estimasi Total Modal: ${window.formatIDR(total)}`;
      } else {
        preview.style.display = 'none';
      }
    }
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
  renderDashboard() {
    const cf = window.financeStore.getCashFlowMetrics();
    const port = window.financeStore.getPortfolioMetrics();
    const daily = window.financeStore.getDailyMetrics();

    // Top metrics
    const incomeEl = document.getElementById('dash-total-income');
    const expenseEl = document.getElementById('dash-total-expense');
    const netCashflowEl = document.getElementById('dash-net-cashflow');
    const savingsRateEl = document.getElementById('dash-savings-rate');
    const portValEl = document.getElementById('dash-portfolio-val');
    const portGainEl = document.getElementById('dash-portfolio-gain');

    if (incomeEl) incomeEl.textContent = window.formatIDR(cf.totalIncome);
    if (expenseEl) expenseEl.textContent = window.formatIDR(cf.totalExpense);
    if (netCashflowEl) {
      netCashflowEl.textContent = window.formatIDR(cf.netCashFlow);
      netCashflowEl.className = 'metric-value ' + (cf.netCashFlow >= 0 ? 'text-income' : 'text-expense');
    }
    if (savingsRateEl) {
      savingsRateEl.textContent = `Tingkat Tabungan: ${cf.savingsRate.toFixed(1)}%`;
    }
    if (portValEl) portValEl.textContent = window.formatIDR(port.totalCurrentValue);
    if (portGainEl) {
      const isPos = port.totalProfitLoss >= 0;
      portGainEl.textContent = `Return: ${window.formatIDR(port.totalProfitLoss)} (${window.formatPercent(port.totalProfitLossPercent)})`;
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
                <div class="font-bold">${inv.category || inv.name}</div>
                <div class="text-xs text-muted">${inv.notes ? inv.notes : (inv.name && inv.name !== inv.category ? inv.name : inv.code)}</div>
              </td>
              <td>
                <span class="badge" style="background: ${CATEGORY_COLORS[inv.category] || '#6366f1'}25; color: ${CATEGORY_COLORS[inv.category] || '#6366f1'}">
                  ${inv.category}
                </span>
              </td>
              <td>${inv.category === 'Dana Darurat' ? '-' : `${inv.units} ${inv.unitName}`}</td>
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
                <button class="btn btn-secondary btn-sm" onclick="app.quickEditPrice('${inv.id}', ${inv.currentPrice})" title="Update Harga Pasar">
                  ✏️ Update
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--expense-color); margin-left: 4px;" onclick="app.deleteInvestment('${inv.id}')" title="Hapus Aset">
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

  deleteInvestment(id) {
    if (confirm('Yakin ingin menghapus aset investasi ini dari portofolio?')) {
      window.financeStore.deleteInvestment(id);
      this.showToast('Aset berhasil dihapus');
    }
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
    const transactions = window.financeStore.getTransactions();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });

      let inc = 0;
      let exp = 0;
      transactions.forEach(t => {
        if (t.date === dateStr) {
          if (t.type === 'income') inc += t.amount;
          if (t.type === 'expense') exp += t.amount;
        }
      });

      last7Days.push({
        label: dayName,
        income: inc,
        expense: exp
      });
    }

    window.FinCharts.renderCashFlowChart('cashflow-bar-chart', last7Days);

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
          ${s.label} (${pct}%)
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
              <span>${s.label}</span>
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
            <div class="tx-title">${tx.title}</div>
            <div class="tx-meta">
              <span class="badge ${isInc ? 'badge-income' : 'badge-expense'}">${tx.category}</span>
              <span>${tx.date}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${amountColor}">
            ${sign} ${window.formatIDR(tx.amount)}
          </div>
          ${showDelete ? `
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; color: var(--text-muted);" onclick="app.deleteTransaction('${tx.id}')">
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

      const transactions = this.mapSpreadsheetTransactions_(list && list.items, categoryNames);
      window.financeStore.saveTransactions(transactions);
      this.render();
      return transactions;
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

    if (!window.CashflowApi || !window.CashflowApi.enabled() || !window.CashflowApi.getToken()) {
      return { synced: false, error: new Error('Belum login') };
    }

    try {
      // addRemoteTransaction_ juga menyegarkan localStorage dari Spreadsheet.
      await window.financeStore.addRemoteTransaction_(tx);

      const found = window.financeStore.getTransactions().some(item =>
        String(item.title || '') === String(tx.title || '') &&
        Number(item.amount) === Number(localTx.amount)
      );

      if (!found) {
        // Server menolak diam-diam: kembalikan catatan lokal agar tidak hilang.
        window.financeStore.saveTransactions([localTx, ...window.financeStore.getTransactions()]);
        return { synced: false, error: new Error('Server tidak menyimpan transaksi') };
      }
      return { synced: true };
    } catch (error) {
      console.warn('[CashFlow] Transaksi tersimpan lokal, gagal sinkron ke Spreadsheet:', error.message);
      return { synced: false, error };
    }
  }

  async deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;

    const current = window.financeStore.getTransactions().find(item => item.id === id);
    // localStorage dulu supaya tampilan langsung konsisten.
    window.financeStore.saveTransactions(
      window.financeStore.getTransactions().filter(item => item.id !== id)
    );

    const isRemote = Boolean(current) && !String(id).startsWith('tx-') &&
      window.CashflowApi && window.CashflowApi.enabled();

    if (!isRemote) {
      this.showToast('Transaksi dihapus');
      return;
    }

    try {
      await window.CashflowApi.post('voidTransaction', {
        transactionId: id,
        expectedVersion: current.version
      });
      await this.syncFromSpreadsheet();
      this.showToast('Transaksi dihapus');
    } catch (error) {
      console.warn('[CashFlow] Dihapus lokal, gagal sinkron ke Spreadsheet:', error.message);
      this.showToast('Dihapus lokal, gagal sinkron ke Spreadsheet');
    }
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
    
    const unitsInput = document.getElementById('invest-input-units');
    if (unitsInput) unitsInput.value = '1';

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
    const unitsGroup = document.getElementById('invest-units-group');
    const unitNameInput = document.getElementById('invest-input-unitname');
    const unitsLabel = document.getElementById('invest-label-units');
    const unitsInput = document.getElementById('invest-input-units');
    const buyPriceLabel = document.getElementById('invest-label-buyprice');

    if (cat === 'Dana Darurat') {
      if (unitsGroup) unitsGroup.style.display = 'none';
      if (unitsInput) unitsInput.value = '1';
      if (unitNameInput) unitNameInput.value = 'rupiah';
      if (buyPriceLabel) buyPriceLabel.textContent = 'Nominal Dana Darurat (Rp) *';
    } else {
      if (unitsGroup) unitsGroup.style.display = 'grid';
      if (buyPriceLabel) buyPriceLabel.textContent = 'Harga Beli (per unit/lot/gram) *';

      if (cat === 'Saham') {
        if (unitNameInput) unitNameInput.value = 'lot';
        if (unitsLabel) unitsLabel.textContent = 'Jumlah Lot (1 lot = 100 lembar) *';
        if (unitsInput && !unitsInput.value) unitsInput.value = '1';
      } else if (cat === 'Emas') {
        if (unitNameInput) unitNameInput.value = 'gram';
        if (unitsLabel) unitsLabel.textContent = 'Jumlah Gram *';
        if (unitsInput && !unitsInput.value) unitsInput.value = '1';
      } else if (cat === 'Kripto') {
        if (unitNameInput) unitNameInput.value = 'koin/token';
        if (unitsLabel) unitsLabel.textContent = 'Jumlah Koin (BTC/ETH) *';
        if (unitsInput && !unitsInput.value) unitsInput.value = '1';
      } else {
        if (unitNameInput) unitNameInput.value = 'unit';
        if (unitsLabel) unitsLabel.textContent = 'Jumlah Unit *';
        if (unitsInput && !unitsInput.value) unitsInput.value = '1';
      }
    }
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
    const units = category === 'Dana Darurat' ? 1 : (parseFloat(document.getElementById('invest-input-units')?.value) || 1);
    const unitName = category === 'Dana Darurat' ? 'rupiah' : (document.getElementById('invest-input-unitname')?.value || 'unit');
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
    const name = notes ? `${category} (${notes})` : `Tabungan ${category}`;

    const investment = {
      category, name, code, units, unitName,
      buyPrice, currentPrice: buyPrice, dateBought, notes
    };

    // 1) localStorage lebih dulu agar data tidak hilang bila jaringan gagal.
    window.financeStore.saveInvestments([
      { id: 'inv-' + Date.now(), ...investment, status: 'active' },
      ...window.financeStore.getInvestments()
    ]);

    this.closeInvestModal();

    const hasToken = window.CashflowApi && window.CashflowApi.getToken();
    if (!hasToken) {
      this.showToast('Rp Nabung tersimpan lokal (belum sinkron)');
      return;
    }

    // 2) Kirim ke Spreadsheet; addInvestment menyegarkan data dari server.
    window.financeStore.addInvestment(investment)
      .then(() => this.showToast('Rp Nabung berhasil dicatat!'))
      .catch(error => {
        console.warn('[CashFlow] Investasi tersimpan lokal, gagal sinkron:', error.message);
        this.showToast('Rp Nabung tersimpan lokal, gagal sinkron');
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
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-transaksi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
    toast.innerHTML = `<span>✓</span> <span>${message}</span>`;
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
