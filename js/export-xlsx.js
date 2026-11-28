/**
 * export-xlsx.js — Ekspor transaksi ke berkas Excel (.xlsx) TANPA dependensi.
 *
 * Membuat berkas .xlsx asli (format OOXML di dalam arsip ZIP) yang dapat dibuka
 * Microsoft Excel / LibreOffice / Google Sheets. Arsip memakai metode "stored"
 * (tanpa kompresi) sehingga tidak memerlukan pustaka deflate.
 *
 * Filter: bulan (YYYY-MM), rentang dari/sampai (YYYY-MM-DD), atau tahun (YYYY).
 * Bila tidak ada filter yang diisi, default = BULAN BERJALAN (perilaku aman & jelas).
 *
 * Tidak ada panggilan jaringan; data dibaca dari penyimpanan lokal aplikasi.
 */
(function () {
  'use strict';

  const COLUMNS = [
    { key: 'id', header: 'ID', type: 'text' },
    { key: 'typeLabel', header: 'Tipe', type: 'text' },
    { key: 'title', header: 'Judul', type: 'text' },
    { key: 'amount', header: 'Nominal (Rp)', type: 'number' },
    { key: 'category', header: 'Kategori', type: 'text' },
    { key: 'date', header: 'Tanggal', type: 'text' },
    { key: 'wallet', header: 'Dompet/Akun', type: 'text' },
    { key: 'note', header: 'Catatan', type: 'text' }
  ];

  /* ------------------------------- util ---------------------------------- */

  const encoder = new TextEncoder();
  const bytes = (text) => encoder.encode(text);

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[i] = value >>> 0;
    }
    return table;
  })();

  function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i += 1) {
      crc = CRC_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function xmlEscape(value) {
    return String(value === null || value === undefined ? '' : value)
      // buang karakter kontrol yang tidak sah di XML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  const pad = (n) => String(n).padStart(2, '0');
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const monthOf = (iso) => String(iso || '').slice(0, 7);

  /* ------------------------- ZIP (stored) penulis ------------------------- */

  function zipStore(files) {
    // files: [{ name, data: Uint8Array }]
    const chunks = [];
    const central = [];
    let offset = 0;

    const u16 = (value) => [value & 0xFF, (value >>> 8) & 0xFF];
    const u32 = (value) => [value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF];

    for (const file of files) {
      const nameBytes = bytes(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;

      const local = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04,       // signature lokal
        ...u16(20), ...u16(0),        // versi, flag
        ...u16(0),                    // metode: stored
        ...u16(0), ...u16(0),         // waktu, tanggal (0 = tidak dipakai)
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nameBytes.length), ...u16(0)
      ]);

      chunks.push(local, nameBytes, file.data);
      central.push({ nameBytes, crc, size, offset });
      offset += local.length + nameBytes.length + size;
    }

    const centralStart = offset;
    let centralSize = 0;

    for (const entry of central) {
      const header = new Uint8Array([
        0x50, 0x4B, 0x01, 0x02,
        ...u16(20), ...u16(20), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(entry.crc), ...u32(entry.size), ...u32(entry.size),
        ...u16(entry.nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(entry.offset)
      ]);
      chunks.push(header, entry.nameBytes);
      centralSize += header.length + entry.nameBytes.length;
    }

    const eocd = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06,
      ...u16(0), ...u16(0),
      ...u16(central.length), ...u16(central.length),
      ...u32(centralSize), ...u32(centralStart),
      ...u16(0)
    ]);
    chunks.push(eocd);

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of chunks) { out.set(chunk, cursor); cursor += chunk.length; }
    return out;
  }

  /* ------------------------------- XLSX --------------------------------- */

  function columnName(index) {
    let name = '';
    let value = index + 1;
    while (value > 0) {
      const rem = (value - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }

  function sheetXml(rows) {
    const body = rows.map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => {
        const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
        if (cell === null || cell === undefined || cell === '') return '';
        if (typeof cell === 'number' && Number.isFinite(cell)) {
          return `<c r="${ref}" s="0"><v>${cell}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr" s="0"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');

    const lastColumn = columnName(Math.max(0, rows[0].length - 1));
    const lastRow = Math.max(1, rows.length);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="${rows[0].length}" width="18" customWidth="1"/></cols><sheetData>${body}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
  }

  function buildXlsx(rows) {
    const files = [
      {
        name: '[Content_Types].xml',
        data: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`)
      },
      {
        name: '_rels/.rels',
        data: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
      },
      {
        name: 'xl/workbook.xml',
        data: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Transaksi" sheetId="1" r:id="rId1"/></sheets></workbook>`)
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
      },
      {
        name: 'xl/styles.xml',
        data: bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
      },
      { name: 'xl/worksheets/sheet1.xml', data: bytes(sheetXml(rows)) }
    ];

    return zipStore(files);
  }

  /* ----------------------------- filter & UI ----------------------------- */

  function readFilters() {
    // Rentang Data aktif (js/date-range.js) — From & To inklusif.
    const range = globalThis.cashflowDateRange;
    if (range && typeof range.get === 'function') {
      const active = range.get();
      if (active.from && active.to) return { month: '', from: active.from, to: active.to, year: '' };
    }
    const val = (id) => {
      const node = document.getElementById(id);
      return node ? String(node.value || '').trim() : '';
    };
    return { month: val('export-month'), from: val('export-from'), to: val('export-to'), year: val('export-year') };
  }

  function filterTransactions(transactions, filters) {
    const nowMonth = monthOf(isoToday());
    const active = {
      month: filters.month,
      from: filters.from,
      to: filters.to,
      year: filters.year
    };

    let mode = 'default-month';
    if (active.month) mode = 'month';
    else if (active.from || active.to) mode = 'range';
    else if (active.year) mode = 'year';

    const inRange = (date) => {
      const value = String(date || '');
      if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
      if (mode === 'month') return value.slice(0, 7) === active.month;
      if (mode === 'year') return value.slice(0, 4) === active.year;
      if (mode === 'range') {
        if (active.from && value < active.from) return false;
        if (active.to && value > active.to) return false;
        return true;
      }
      return value.slice(0, 7) === nowMonth;
    };

    const rows = transactions.filter(t => inRange(t.date));
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    let filenameSuffix = nowMonth;
    if (mode === 'month') filenameSuffix = active.month;
    else if (mode === 'year') filenameSuffix = active.year;
    else if (mode === 'range') filenameSuffix = `${active.from || 'awal'}_${active.to || 'akhir'}`;

    return { mode, rows, filenameSuffix };
  }

  function download(name, data, mime) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const MONTH_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function describe(mode, suffix) {
    if (mode === 'month') {
      const [year, month] = suffix.split('-');
      return `bulan ${MONTH_LABEL[Number(month) - 1] || month} ${year}`;
    }
    if (mode === 'year') return `tahun ${suffix}`;
    if (mode === 'range') return `rentang ${suffix.replace('_', ' s/d ')}`;
    return `bulan berjalan (${suffix})`;
  }

  function exportTransactions(options = {}) {
    const store = window.financeStore;
    if (!store || typeof store.getTransactions !== 'function') {
      if (window.app && window.app.showToast) window.app.showToast('Data transaksi tidak tersedia');
      return null;
    }

    const filters = options.filters || readFilters();
    const transactions = store.getTransactions() || [];
    const { mode, rows, filenameSuffix } = filterTransactions(transactions, filters);

    if (rows.length === 0) {
      if (window.app && window.app.showToast) {
        window.app.showToast(`Tidak ada transaksi pada ${describe(mode, filenameSuffix)}`);
      }
      return { count: 0, mode, filename: null };
    }

    const table = [
      COLUMNS.map(column => column.header),
      ...rows.map(t => COLUMNS.map(column => {
        if (column.key === 'typeLabel') return t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        if (column.key === 'amount') return Number(t.amount) || 0;
        return t[column.key] === null || t[column.key] === undefined ? '' : String(t[column.key]);
      }))
    ];

    const data = buildXlsx(table);
    const filename = `Cashflow_Transaksi_${filenameSuffix}.xlsx`;
    download(filename, data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    if (window.app && window.app.showToast) {
      window.app.showToast(`Ekspor ${rows.length} transaksi (${describe(mode, filenameSuffix)}) berhasil`);
    }
    return { count: rows.length, mode, filename, bytes: data.length };
  }

  /** Isi pilihan Tahun dari data yang ada (memudahkan pemakaian di HP). */
  function populateYears() {
    const select = document.getElementById('export-year');
    if (!select || !window.financeStore) return;
    const years = [...new Set((window.financeStore.getTransactions() || [])
      .map(t => String(t.date || '').slice(0, 4))
      .filter(y => /^\d{4}$/.test(y)))].sort().reverse();
    const current = select.value;
    select.innerHTML = '<option value="">Semua tahun</option>'
      + years.map(y => `<option value="${y}">${y}</option>`).join('');
    if (years.includes(current)) select.value = current;
  }

  window.cashflowXlsx = { exportTransactions, buildXlsx, filterTransactions, populateYears, COLUMNS };

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof populateYears === 'function' && window.financeStore) populateYears();
  });
})();
