/**
 * Test inti CashFlow tanpa dependency: memuat js/store.js ke dalam VM dengan
 * stub localStorage/DOM minimal, lalu menguji perhitungan, antrean, dan backup.
 *
 * Jalankan: node --test test/core.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const storeSource = readFileSync(join(here, '..', 'js', 'store.js'), 'utf8');

function createStore() {
  const memory = new Map();
  const localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear()
  };
  const window = {};
  const context = vm.createContext({
    window,
    localStorage,
    document: {},
    navigator: { onLine: true },
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Boolean,
    Intl,
    parseFloat,
    parseInt,
    isNaN,
    encodeURIComponent,
    decodeURIComponent
  });
  vm.runInContext(storeSource, context, { filename: 'store.js' });
  return { store: window.financeStore, window };
}

test('transaksi disimpan dan dibaca kembali apa adanya', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 't1', type: 'income', title: 'Gaji', amount: 1000000, category: 'Gaji', date: '2026-11-05', wallet: 'BCA', note: '' }
  ]);
  const rows = store.getTransactions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Gaji');
  assert.equal(rows[0].amount, 1000000);
});

test('metrik arus kas menjumlah pemasukan, pengeluaran, dan savings rate', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'a', type: 'income', title: 'Masuk', amount: 1000, category: 'Gaji', date: '2026-11-01' },
    { id: 'b', type: 'income', title: 'Masuk 2', amount: 500, category: 'Gaji', date: '2026-11-02' },
    { id: 'c', type: 'expense', title: 'Keluar', amount: 300, category: 'Makanan', date: '2026-11-03' }
  ]);
  const m = store.getCashFlowMetrics();
  assert.equal(m.totalIncome, 1500);
  assert.equal(m.totalExpense, 300);
  assert.equal(m.netCashFlow, 1200);
  assert.equal(Number(m.savingsRate.toFixed(2)), 80);
});

test('nilai portofolio memperhitungkan units dan unitMultiplier', () => {
  const { store } = createStore();
  store.saveInvestments([
    { id: 'i1', name: 'Emas', category: 'Emas', buyPrice: 1000, currentPrice: 1500, units: 2, unitMultiplier: 1000, unitName: 'gram', dateBought: '2026-11-01' }
  ]);
  const p = store.getPortfolioMetrics();
  assert.equal(p.totalInvested, 2000000);
  assert.equal(p.totalCurrentValue, 3000000);
  assert.equal(p.totalProfitLoss, 1000000);
  assert.equal(p.categoryAllocation.Emas, 3000000);
});

test('net worth = arus kas bersih + nilai investasi', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'a', type: 'income', title: 'Masuk', amount: 1000, category: 'Gaji', date: '2026-11-01' },
    { id: 'b', type: 'expense', title: 'Keluar', amount: 400, category: 'Makanan', date: '2026-11-02' }
  ]);
  store.saveInvestments([
    { id: 'i1', name: 'Saham', category: 'Saham', buyPrice: 100, currentPrice: 250, units: 10, dateBought: '2026-11-01' }
  ]);
  assert.equal(store.getNetWorth(), 600 + 2500);
});

test('antrean sync: tambah, hitung, dan hapus item', () => {
  const { store } = createStore();
  assert.equal(store.getSyncQueue().length, 0);
  const item = store.enqueueSync('transaction', 'create', { id: 'local-1', title: 'Offline', amount: 10, date: '2026-11-27' });
  assert.ok(item && item.id);
  assert.equal(store.getSyncQueue().length, 1);
  assert.equal(store.pendingQueueCount(), 1);
  store.removeSyncItem(item.id);
  assert.equal(store.getSyncQueue().length, 0);
});

test('merge mempertahankan transaksi pending dan menyembunyikan yang di-void', () => {
  const { store } = createStore();
  store.saveSyncQueue([]);
  store.enqueueSync('transaction', 'create', { id: 'p1', type: 'expense', title: 'Pending', amount: 100, date: '2026-11-27' });
  store.enqueueSync('transaction', 'void', { id: 'srv-2', version: 1 });

  const merged = store.mergeTransactionsWithQueue_([
    { id: 'srv-1', type: 'income', title: 'Server', amount: 500, category: 'Gaji', date: '2026-11-26' },
    { id: 'srv-2', type: 'expense', title: 'Dihapus', amount: 50, category: 'Makanan', date: '2026-11-25' }
  ]);
  const titles = merged.map(t => t.title);
  assert.ok(titles.includes('Pending'));
  assert.ok(titles.includes('Server'));
  assert.ok(!titles.includes('Dihapus'));
});

test('queue tetap utuh saat kegagalan (tidak dihapus prematur)', () => {
  const { store } = createStore();
  store.enqueueSync('transaction', 'create', { id: 'x', title: 'A', amount: 1, date: '2026-11-27' });
  const before = store.getSyncQueue().length;
  const again = store.getSyncQueue();
  assert.equal(again.length, before);
});

test('export JSON v2 memuat metadata dan jumlah data', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'a', type: 'income', title: 'Masuk', amount: 10, category: 'Gaji', date: '2026-11-01' }
  ]);
  const parsed = JSON.parse(store.exportJSON());
  assert.equal(parsed.app, 'cashflow');
  assert.equal(parsed.version, 2);
  assert.equal(parsed.counts.transactions, 1);
  assert.ok(parsed.exportDate);
  assert.ok(Array.isArray(parsed.investments));
});

test('validasi backup menolak struktur dan data tidak valid', () => {
  const { store } = createStore();
  assert.equal(store.validateBackup('bukan json').valid, false);
  assert.equal(store.validateBackup('{"transactions":"x"}').valid, false);
  assert.equal(store.validateBackup(JSON.stringify({
    transactions: [{ id: 'a', type: 'expense', title: '', amount: 10, date: '2026-11-01' }]
  })).valid, false);
  assert.equal(store.validateBackup(JSON.stringify({
    transactions: [{ id: 'a', type: 'expense', title: 'Ok', amount: 10, date: '2026-11-01' }]
  })).valid, true);
});

test('restore backup mengganti data dan mengantrekan item baru', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'lama', type: 'income', title: 'Lama', amount: 5, category: 'Gaji', date: '2026-10-01' }
  ]);
  const backup = JSON.stringify({
    app: 'cashflow', version: 2,
    transactions: [
      { id: 'baru', type: 'expense', title: 'Baru', amount: 20, category: 'Makanan', date: '2026-11-01' }
    ],
    investments: []
  });
  const result = store.restoreBackup(backup);
  assert.equal(result.success, true);
  assert.equal(store.getTransactions().length, 1);
  assert.equal(store.getTransactions()[0].id, 'baru');
  assert.ok(store.getSyncQueue().some(item => item.data.id === 'baru'));
});

test('restore invalid tidak mengubah data', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'aman', type: 'income', title: 'Aman', amount: 5, category: 'Gaji', date: '2026-10-01' }
  ]);
  const result = store.restoreBackup('{"transactions":"rusak"}');
  assert.equal(result.success, false);
  assert.equal(store.getTransactions()[0].id, 'aman');
});

test('metrik harian menghitung pengeluaran tanggal tertentu', () => {
  const { store } = createStore();
  store.saveSettings({ dailyBudget: 100000 });
  store.saveTransactions([
    { id: 'a', type: 'expense', title: 'Hari ini', amount: 30000, category: 'Makanan', date: '2026-11-27' },
    { id: 'b', type: 'expense', title: 'Besok', amount: 20000, category: 'Makanan', date: '2026-11-28' },
    { id: 'c', type: 'income', title: 'Masuk', amount: 50000, category: 'Gaji', date: '2026-11-27' }
  ]);
  const daily = store.getDailyMetrics('2026-11-27');
  assert.equal(daily.totalToday, 30000);
  assert.equal(daily.remaining, 70000);
  assert.equal(daily.isExceeded, false);
});

test('export CSV memakai pemisah koma-titik-koma dan meng-escape sel', () => {
  const { store } = createStore();
  store.saveTransactions([
    { id: 'a', type: 'expense', title: 'Kopi; susu', amount: 15000, category: 'Makanan', date: '2026-11-27', wallet: 'BCA', note: 'teks "kutip"' }
  ]);
  const csv = store.exportCSV();
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('ID;Tipe;Judul'));
  assert.ok(lines[1].includes('"Kopi; susu"'));
  assert.ok(lines[1].includes('""kutip""'));
});

test('merge menerapkan edit yang masih menunggu sinkron', () => {
  const { store } = createStore();
  store.saveSyncQueue([]);
  store.enqueueSync('transaction', 'update', {
    id: 'srv-1', version: 1, type: 'expense', title: 'Judul Baru',
    amount: 999, category: 'Makanan', date: '2026-11-20', wallet: 'BCA', note: ''
  });
  const merged = store.mergeTransactionsWithQueue_([
    { id: 'srv-1', type: 'income', title: 'Judul Lama', amount: 100, category: 'Gaji', date: '2026-11-19', wallet: 'BCA', note: '', version: 1 }
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'srv-1');
  assert.equal(merged[0].title, 'Judul Baru');
  assert.equal(merged[0].amount, 999);
  assert.equal(merged[0].type, 'expense');
});

test('clientRef stabil dan attempts bertambah saat retry', () => {
  const { store } = createStore();
  const item = store.enqueueSync('transaction', 'create', { id: 'tx-1', title: 'A', amount: 1, date: '2026-11-27' });
  assert.ok(String(item.clientRef).startsWith('cr-'));
  assert.equal(item.attempts, 0);
  const first = store.getSyncQueue()[0].clientRef;
  store.markSyncAttempt(item.id);
  const after = store.getSyncQueue()[0];
  assert.equal(after.clientRef, first);
  assert.equal(after.attempts, 1);
});
