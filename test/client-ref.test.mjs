/**
 * test/client-ref.test.mjs — uji IDEMPOTENSI client_ref pada backend Apps Script ASLI.
 *
 * Kode `.gs` dari `backend/apps-script/` dimuat apa adanya ke dalam VM Node dengan
 * tiruan (stub) layanan Apps Script (SpreadsheetApp, LockService, Utilities, Session,
 * Logger). Hanya "seam" autentikasi/konfigurasi/resolusi spreadsheet yang diganti,
 * sehingga logika idempotensi yang diuji adalah kode produksi.
 *
 * Yang dibuktikan:
 *   1. create dengan clientRef  → baris tersimpan + client_ref tersimpan
 *   2. clientRef sama lagi       → idempotent (ID sama, TIDAK menambah baris)
 *   3. clientRef beda, isi sama  → dua baris (tidak ada dedup berbasis isi)
 *   4. tanpa clientRef           → perilaku lama (tetap didukung)
 *   5. clientRef tidak valid     → ditolak
 *   6. retry setelah void        → boleh membuat baris baru
 *   7. update mempertahankan client_ref
 *   8. list mengembalikan clientRef
 *   9. budget/investment parity  → createInvestment idempotent juga
 *  10. migrasi header additive   → sheet lama (16 kolom) mendapat client_ref tanpa data hilang
 *  11. dua permintaan berurutan (retry) → tepat satu baris (integritas)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const BACKEND = path.join(ROOT, 'backend', 'apps-script');
const EMAIL = 'bos@example.com';

/* ------------------------- tiruan Apps Script --------------------------- */

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.frozen = 0;
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  setFrozenRows(count) { this.frozen = count; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(row) { this.rows.push(row.slice()); }
  getRange(row, column, numRows = 1, numColumns = 1) {
    const sheet = this;
    return {
      getValues() {
        const out = [];
        for (let r = 0; r < numRows; r += 1) {
          const source = sheet.rows[row - 1 + r] || [];
          const line = [];
          for (let c = 0; c < numColumns; c += 1) line.push(source[column - 1 + c] === undefined ? '' : source[column - 1 + c]);
          out.push(line);
        }
        return out;
      },
      setValues(values) {
        values.forEach((line, r) => {
          const target = sheet.rows[row - 1 + r] || (sheet.rows[row - 1 + r] = []);
          line.forEach((value, c) => { target[column - 1 + c] = value; });
        });
      },
      setValue(value) {
        const target = sheet.rows[row - 1] || (sheet.rows[row - 1] = []);
        target[column - 1] = value;
      }
    };
  }
}

class FakeSpreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheetByName(name) { return this.sheets.find((sheet) => sheet.getName() === name) || null; }
  insertSheet(name) { const sheet = new FakeSheet(name, [[]]); this.sheets.push(sheet); return sheet; }
}

/** Muat seluruh kode backend ke VM dan kembalikan context-nya. */
function loadBackend(sheets) {
  const files = readdirSync(BACKEND).filter((name) => name.endsWith('.gs'));
  const source = files.map((name) => readFileSync(path.join(BACKEND, name), 'utf8')).join('\n;\n');

  const spreadsheet = new FakeSpreadsheet(sheets);
  let uuid = 0;

  const context = createContext({
    console,
    Logger: { log() {} },
    Session: { getActiveUser: () => ({ getEmail: () => EMAIL }) },
    Utilities: {
      getUuid: () => `uuid-${(uuid += 1)}`,
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm, value) => {
        const bytes = [];
        const text = String(value);
        for (let i = 0; i < 32; i += 1) bytes.push((text.charCodeAt(i % text.length) + i) % 256);
        return bytes;
      },
      formatDate: (date, _tz, _format) => new Date(date).toISOString()
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      flush() {}
    },
    PropertiesService: {
      getScriptProperties: () => {
        const store = new Map();
        return { getProperty: (k) => (store.has(k) ? store.get(k) : null), setProperty: (k, v) => store.set(k, v), deleteProperty: (k) => store.delete(k) };
      }
    }
  });

  runInContext(source, context, { filename: 'backend.gs' });

  // Seam: autentikasi, konfigurasi, dan resolusi spreadsheet.
  context.requireAuthorizedUser = () => ({ email: EMAIL });
  context.getConfiguredSpreadsheet_ = () => spreadsheet;
  context.getCashflowConfig_ = () => ({
    schemaVersion: '1.1.0',
    setupLockTimeoutMs: 20000,
    requiredSheets: ['Transactions', 'Investments', 'Categories', 'Budgets', 'Settings', 'AuditLog', 'Schema']
  });

  return { context, spreadsheet };
}

const TX_HEADERS = [
  'transactionId', 'ownerId', 'type', 'title', 'amountMinor', 'currency',
  'categoryId', 'transactionDate', 'wallet', 'note', 'status', 'createdAt',
  'createdBy', 'updatedAt', 'updatedBy', 'version', 'client_ref'
];
const INV_HEADERS = [
  'investmentId', 'ownerId', 'name', 'code', 'categoryId', 'buyPriceMinor',
  'currentPriceMinor', 'units', 'unitName', 'unitMultiplier', 'dateBought',
  'notes', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
  'version', 'client_ref'
];
const CATEGORY_ROW = ['expense-food', EMAIL, 'expense', 'Makanan', 'Makanan', '#000', 'x', 1, true, new Date(), new Date()];

function freshBackend({ headerRow = TX_HEADERS, legacy = false } = {}) {
  const sheets = [
    new FakeSheet('Transactions', [headerRow.slice()]),
    new FakeSheet('Investments', [INV_HEADERS.slice()]),
    new FakeSheet('Categories', [
      ['categoryId', 'ownerId', 'categoryType', 'name', 'displayName', 'color', 'icon', 'sortOrder', 'isActive', 'createdAt', 'updatedAt'],
      CATEGORY_ROW
    ]),
    new FakeSheet('AuditLog', [['auditId', 'ownerId', 'actorId', 'actorEmail', 'action', 'entityType', 'entityId', 'requestId', 'beforeHash', 'afterHash', 'metadataJson', 'createdAt', 'result', 'errorCode']])
  ];
  if (legacy) sheets[0].rows.push(['old-1', EMAIL, 'expense', 'Legacy', 500, 'IDR', 'expense-food', '2026-01-01', '', '', 'active', new Date(), EMAIL, new Date(), EMAIL, 1]);
  return loadBackend(sheets);
}

const baseTx = (clientRef) => ({
  type: 'expense',
  title: 'Uji client_ref',
  amountMinor: 10000,
  currency: 'IDR',
  categoryId: 'expense-food',
  transactionDate: '2026-11-28',
  wallet: 'Tunai',
  note: '',
  ...(clientRef ? { clientRef } : {})
});

const txRows = (spreadsheet) => spreadsheet.getSheetByName('Transactions').rows.slice(1).filter((row) => row.length && row[0]);

/* --------------------------------- uji ---------------------------------- */

test('client_ref 1: create menyimpan baris + client_ref', () => {
  const { context, spreadsheet } = freshBackend();
  const created = context.createTransaction(baseTx('cr-abc-1'));
  assert.equal(txRows(spreadsheet).length, 1);
  assert.equal(created.clientRef, 'cr-abc-1');
  assert.equal(spreadsheet.getSheetByName('Transactions').rows[1][16], 'cr-abc-1');
});

test('client_ref 2: retry dengan referensi sama = idempotent (tidak menambah baris)', () => {
  const { context, spreadsheet } = freshBackend();
  const first = context.createTransaction(baseTx('cr-retry-1'));
  const second = context.createTransaction(baseTx('cr-retry-1'));
  assert.equal(second.transactionId, first.transactionId, 'ID harus sama');
  assert.equal(txRows(spreadsheet).length, 1, 'tidak boleh ada baris ganda');
});

test('client_ref 3: referensi BERBEDA dengan isi identik = dua baris (tanpa dedup isi)', () => {
  const { context, spreadsheet } = freshBackend();
  const a = context.createTransaction(baseTx('cr-one-0001'));
  const b = context.createTransaction(baseTx('cr-two-0002'));
  assert.notEqual(a.transactionId, b.transactionId);
  assert.equal(txRows(spreadsheet).length, 2);
});

test('client_ref 4: tanpa clientRef tetap berperilaku lama (kompatibel)', () => {
  const { context, spreadsheet } = freshBackend();
  const created = context.createTransaction(baseTx());
  assert.equal(txRows(spreadsheet).length, 1);
  assert.equal(created.clientRef, '');
});

test('client_ref 5: referensi tidak valid ditolak', () => {
  const { context } = freshBackend();
  assert.throws(() => context.createTransaction(baseTx('ref dengan spasi!')), /clientRef tidak valid/);
});

test('client_ref 6: setelah void, referensi sama boleh membuat baris baru', () => {
  const { context, spreadsheet } = freshBackend();
  const created = context.createTransaction(baseTx('cr-void-001'));
  context.voidTransaction(created.transactionId, created.version);
  const again = context.createTransaction(baseTx('cr-void-001'));
  assert.notEqual(again.transactionId, created.transactionId);
  assert.equal(txRows(spreadsheet).length, 2, 'baris void + baris baru = 2');
});

test('client_ref 7: update mempertahankan client_ref dan server ID', () => {
  const { context, spreadsheet } = freshBackend();
  const created = context.createTransaction(baseTx('cr-edit-001'));
  const updated = context.updateTransaction({
    transactionId: created.transactionId,
    ...baseTx('cr-edit-001'),
    title: 'Judul diubah',
    expectedVersion: created.version
  });
  assert.equal(updated.transactionId, created.transactionId, 'server ID tidak berubah');
  assert.equal(updated.clientRef, 'cr-edit-001', 'client_ref tidak berubah');
  assert.equal(spreadsheet.getSheetByName('Transactions').rows[1][16], 'cr-edit-001');
  assert.equal(txRows(spreadsheet).length, 1);
});

test('client_ref 8: list mengembalikan clientRef (untuk pencocokan antrean klien)', () => {
  const { context } = freshBackend({ legacy: true });
  context.createTransaction(baseTx('cr-list-001'));
  const listed = context.listTransactions();
  const withRef = listed.items.filter((item) => item.clientRef === 'cr-list-001');
  const legacy = listed.items.find((item) => item.transactionId === 'old-1');
  assert.equal(withRef.length, 1);
  assert.equal(legacy.clientRef, '', 'baris lama tanpa client_ref tetap terbaca');
});

test('client_ref 9: createInvestment juga idempotent', () => {
  const { context, spreadsheet } = freshBackend();
  const input = {
    name: 'Reksa Dana Uji', code: 'RDUJI', categoryId: 'inv-reksadana',
    buyPriceMinor: 100000, currentPriceMinor: 110000, units: 1,
    unitName: 'unit', unitMultiplier: 1, dateBought: '2026-11-28', notes: '', clientRef: 'cr-inv-0001'
  };
  const first = context.createInvestment(input);
  const second = context.createInvestment(input);
  const rows = spreadsheet.getSheetByName('Investments').rows.slice(1).filter((row) => row.length && row[0]);
  assert.equal(rows.length, 1, 'investasi tidak boleh ganda');
  assert.equal(second.investmentId, first.investmentId);
  assert.equal(second.clientRef, 'cr-inv-0001');
});

test('client_ref 10: migrasi header ADDITIVE pada sheet lama (16 kolom) tanpa kehilangan data', () => {
  const legacyHeaders = TX_HEADERS.slice(0, 16); // tanpa client_ref
  const { context, spreadsheet } = freshBackend({ headerRow: legacyHeaders, legacy: true });
  const sheet = spreadsheet.getSheetByName('Transactions');

  assert.equal(sheet.rows[0].length, 16, 'awal: 16 kolom');
  const added = context.migrateAdditiveHeaders_(sheet, TX_HEADERS);
  // Array berasal dari realm VM → bandingkan per elemen (bukan deepEqual lintas realm).
  assert.equal(added.length, 1);
  assert.equal(added[0], 'client_ref');
  assert.equal(sheet.rows[0][16], 'client_ref', 'header baru ada di kolom 17');
  assert.equal(sheet.rows[1][0], 'old-1', 'baris data lama TIDAK berubah');
  assert.equal(sheet.rows[1][3], 'Legacy');
});

test('client_ref 11: dua permintaan berurutan (retry nyata) menghasilkan tepat satu baris', () => {
  const { context, spreadsheet } = freshBackend();
  const results = [
    context.createTransaction(baseTx('cr-burst-01')),
    context.createTransaction(baseTx('cr-burst-01')),
    context.createTransaction(baseTx('cr-burst-01'))
  ];
  const ids = new Set(results.map((item) => item.transactionId));
  assert.equal(ids.size, 1, 'semua retry mengembalikan ID yang sama');
  assert.equal(txRows(spreadsheet).length, 1);
});
