/**
 * E2E edit transaksi: form terisi, ID tetap, tidak ada baris baru, edit offline
 * tersinkron saat online. API dimock — tidak menyentuh Spreadsheet.
 * Jalankan setelah `node server.js`:  node test/e2e-edit.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9602;
const profile = mkdtempSync(join(tmpdir(), 'cf-edit-'));
const chrome = spawn(process.env.CF_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1280,900', 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function page() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const found = list.find((entry) => entry.type === 'page');
      if (found?.webSocketDebuggerUrl) return found;
    } catch { /* belum siap */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools tidak tersedia');
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

let ws;
try {
  const target = await page();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let id = 1;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails?.exception?.description || 'exception');
    }
  });
  const send = (method, params = {}) => {
    const requestId = id++;
    ws.send(JSON.stringify({ id: requestId, method, params }));
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
  };
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || 'eval gagal');
    return response.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.navigate', { url: process.env.CF_URL || 'http://127.0.0.1:3000/' });
  await sleep(2500);

  await evaluate(`
    (() => {
      window.__mock = {
        rows: [{ transactionId: 'srv-edit-1', type: 'expense', title: 'Nama Lama', amountMinor: 10000,
          categoryId: 'expense-food', transactionDate: '2026-11-20', wallet: 'BCA', note: '', status: 'active', version: 1 }]
      };
      window.CashflowApi.getToken = () => 'mock-token';
      window.CashflowApi.setToken = () => {};
      window.CashflowApi.resolveCategoryId = async () => 'expense-food';
      window.CashflowApi.get = async (action) => {
        if (action === 'list' || action === 'listTransactions') return { items: window.__mock.rows };
        if (action === 'listCategories') return { items: [{ categoryId: 'expense-food', displayName: 'Makanan & Minuman' }, { categoryId: 'income-salary', displayName: 'Gaji' }] };
        if (action === 'listInvestments') return { items: [] };
        return { items: [] };
      };
      window.CashflowApi.post = async (action, payload) => {
        if (action === 'updateTransaction') {
          const row = window.__mock.rows.find(r => r.transactionId === payload.transactionId);
          if (!row) throw new Error('Transaction not found.');
          if (Number(row.version) !== Number(payload.expectedVersion)) throw new Error('version conflict');
          Object.assign(row, {
            type: payload.type, title: payload.title, amountMinor: payload.amountMinor,
            categoryId: payload.categoryId, transactionDate: payload.transactionDate,
            wallet: payload.wallet, note: payload.note, version: row.version + 1
          });
        }
        return { ok: true };
      };
      return true;
    })()
  `);
  await evaluate(`window.financeStore.saveSyncQueue([]); window.financeStore.saveTransactions([{ id: "srv-edit-1", type: "expense", title: "Nama Lama", amount: 10000, category: "Makanan & Minuman", date: "2026-11-20", wallet: "BCA", note: "", version: 1 }])`);
  await sleep(400);

  await evaluate("window.app.editTransaction('srv-edit-1')");
  await sleep(200);
  const prefilled = await evaluate("({ title: document.getElementById('tx-input-title').value, amount: Number(document.getElementById('tx-input-amount').value) })");
  check('form edit terisi otomatis', prefilled.title === 'Nama Lama' && prefilled.amount === 10000, JSON.stringify(prefilled));

  await evaluate(`
    (() => {
      document.getElementById('tx-input-title').value = 'Nama Baru';
      document.getElementById('tx-input-amount').value = '25000';
      document.getElementById('tx-form').requestSubmit();
      return true;
    })()
  `);
  await sleep(900);
  const afterEdit = await evaluate(`(() => {
    const row = window.__mock.rows[0];
    const local = window.financeStore.getTransactions().find(t => t.id === 'srv-edit-1');
    return { rows: window.__mock.rows.length, id: row.transactionId, title: row.title, amount: row.amountMinor,
      localTitle: local && local.title, queue: window.financeStore.getSyncQueue().length };
  })()`);
  check('edit mengubah server tanpa baris baru', afterEdit.rows === 1 && afterEdit.title === 'Nama Baru' && afterEdit.amount === 25000, JSON.stringify(afterEdit));
  check('ID transaksi dipertahankan', afterEdit.id === 'srv-edit-1', afterEdit.id);
  check('data lokal ikut berubah', afterEdit.localTitle === 'Nama Baru', String(afterEdit.localTitle));
  check('antrean bersih setelah edit sukses', afterEdit.queue === 0, String(afterEdit.queue));

  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await sleep(600);
  await evaluate("window.app.editTransaction('srv-edit-1')");
  await sleep(200);
  await evaluate(`
    (() => {
      document.getElementById('tx-input-title').value = 'Edit Offline';
      document.getElementById('tx-input-amount').value = '31000';
      document.getElementById('tx-form').requestSubmit();
      return true;
    })()
  `);
  await sleep(500);
  const offline = await evaluate(`(() => ({
    local: window.financeStore.getTransactions().find(t => t.id === 'srv-edit-1')?.title,
    updateQueue: window.financeStore.getSyncQueue().filter(i => i.op === 'update').length,
    server: window.__mock.rows[0].title
  }))()`);
  check('edit offline tersimpan lokal & antre', offline.local === 'Edit Offline' && offline.updateQueue === 1, JSON.stringify(offline));
  check('server belum berubah saat offline', offline.server === 'Nama Baru', offline.server);

  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await sleep(700);
  await evaluate('window.app.processSyncQueue()');
  await sleep(600);
  const online = await evaluate("({ server: window.__mock.rows[0].title, queue: window.financeStore.getSyncQueue().length, rows: window.__mock.rows.length })");
  check('edit offline tersinkron saat online', online.server === 'Edit Offline' && online.queue === 0 && online.rows === 1, JSON.stringify(online));

  check('tanpa exception', errors.length === 0, errors.join(' | '));
} catch (error) {
  check('e2e edit berjalan', false, error.message);
} finally {
  try { ws?.close(); } catch { /* abaikan */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* abaikan */ }
}

const failed = results.filter((value) => !value).length;
console.log(`\nRingkasan: ${results.length - failed}/${results.length} lulus`);
process.exit(failed === 0 ? 0 : 1);
