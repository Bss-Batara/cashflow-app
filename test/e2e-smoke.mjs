/**
 * E2E smoke test tanpa dependency (Chrome/Edge headless via CDP).
 * Jalankan server lokal lebih dulu:  node server.js
 * Lalu:                                node test/e2e-smoke.mjs
 *
 * Semua panggilan API dimock di browser — tidak menyentuh Spreadsheet.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_URL = process.env.CF_URL || 'http://127.0.0.1:3000/';
const PORT = Number(process.env.CF_CDP_PORT || 9601);
const CHROME = process.env.CF_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const profile = mkdtempSync(join(tmpdir(), 'cf-e2e-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--window-size=1280,900', 'about:blank'
], { stdio: 'ignore' });

async function findPage() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((entry) => entry.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* chrome belum siap */ }
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
  const page = await findPage();
  ws = new WebSocket(page.webSocketDebuggerUrl);
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
  await send('Page.navigate', { url: APP_URL });
  await sleep(2500);

  check('aplikasi termuat', await evaluate('!!window.app && !!window.financeStore'));
  check('dasbor menampilkan kartu metrik', await evaluate("document.querySelectorAll('#view-dashboard .metric-card').length === 4"));

  // Mock API: satu kegagalan, lalu sukses.
  await evaluate(`
    (() => {
      window.__mock = { rows: [], fail: 0 };
      window.CashflowApi.getToken = () => 'mock-token';
      window.CashflowApi.setToken = () => {};
      window.CashflowApi.resolveCategoryId = async () => 'expense-food';
      window.CashflowApi.get = async (action) => {
        if (action === 'listTransactions') return { items: window.__mock.rows };
        if (action === 'listCategories') return { items: [] };
        if (action === 'listInvestments') return { items: [] };
        return { items: [] };
      };
      window.CashflowApi.post = async (action, payload) => {
        if (window.__mock.fail > 0) { window.__mock.fail -= 1; throw new Error('server menolak (uji)'); }
        if (action === 'createTransaction') window.__mock.rows.push({ ...payload });
        return { ok: true };
      };
      return true;
    })()
  `);

  // Indikator hijau saat bersih.
  await evaluate("window.app.lastSyncError = ''; window.app.updateSyncStatus();");
  await sleep(200);
  const okState = await evaluate("document.querySelector('[data-sync-dot]').classList.contains('is-ok')");
  check('indikator hijau saat tersinkron', okState === true);

  // Kegagalan server -> indikator merah + pesan.
  await evaluate(`
    (() => {
      window.__mock.fail = 1;
      window.financeStore.enqueueSync('transaction', 'create', {
        id: 'uji-gagal', type: 'expense', title: 'Uji Gagal', amount: 1000,
        category: 'Makanan', date: '2026-11-27'
      });
      return true;
    })()
  `);
  await evaluate('window.app.processSyncQueue()');
  await sleep(400);
  const errorState = await evaluate(`(() => {
    const dot = document.querySelector('[data-sync-dot]');
    return { error: dot.classList.contains('is-error'), title: dot.title, queue: window.financeStore.getSyncQueue().length };
  })()`);
  check('kegagalan sinkron terlihat (merah + pesan)', errorState.error === true && /Gagal sinkron/.test(errorState.title), JSON.stringify(errorState));
  check('antrean tidak hilang saat gagal', errorState.queue >= 1, String(errorState.queue));

  // Retry sukses -> antrean bersih, indikator kembali hijau.
  await evaluate('window.app.processSyncQueue()');
  await sleep(400);
  const recovered = await evaluate(`(() => {
    const dot = document.querySelector('[data-sync-dot]');
    return { error: dot.classList.contains('is-error'), queue: window.financeStore.getSyncQueue().length, rows: window.__mock.rows.length };
  })()`);
  check('retry berhasil dan indikator pulih', recovered.error === false && recovered.queue === 0 && recovered.rows === 1, JSON.stringify(recovered));

  const mobile = await evaluate('window.innerWidth >= 320');
  check('layout dapat dirender', mobile === true);
  check('tidak ada exception', errors.length === 0, errors.join(' | '));
} catch (error) {
  check('e2e berjalan', false, error.message);
} finally {
  try { ws?.close(); } catch { /* abaikan */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* abaikan */ }
}

const failed = results.filter((value) => !value).length;
console.log(`\nRingkasan: ${results.length - failed}/${results.length} lulus`);
process.exit(failed === 0 ? 0 : 1);
