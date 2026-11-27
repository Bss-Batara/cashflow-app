# AGENTS.md — CashFlow (FinFlow)

Panduan kerja untuk agen AI dan kontributor di repositori ini.

## Ringkasan

Aplikasi web statis (HTML + CSS + JS klasik, **tanpa build step**) untuk mencatat
pemasukan, pengeluaran, dan investasi keluarga. Data utama di Google Spreadsheet,
diakses via Google Apps Script Web App. Frontend menyimpan cache di localStorage
dan mengirim perubahan lewat `sync_queue` (offline-first).

## Struktur

```
index.html                 Shell aplikasi: login, header, sidebar, panel view
css/style.css              Stylesheet utama (token warna, komponen, responsif)
css/login.css              Gaya layar login/daftar/reset
js/config.js               Konstanta & endpoint GAS
js/api.js                  Klien fetch ke GAS (satu-satunya pintu network)
js/auth.js                 Login, register, reset, sesi
js/store.js                Data lokal, perhitungan, sync queue, backup/restore
js/app.js                  State, router view, render, modal, proses antrean
js/charts.js               Grafik canvas (tanpa dependency)
server.js                  Server statis lokal (alat pengembangan)
sw.js / manifest.json      Service worker & manifest PWA
backend/apps-script/*.gs   Backend Google Apps Script
test/*.mjs                 Test tanpa dependency (node:test + CDP)
docs/                      Backup, keamanan, panduan operasional
```

## Aturan penting

1. **Jangan ubah kontrak API GAS.** Semua request: POST ke `/exec` dengan
   `Content-Type: text/plain;charset=utf-8` dan body JSON `{action, ...}`.
   Respons selalu HTTP 200; status dibaca dari `ok` pada body.
2. **Satu pintu network:** semua panggilan jaringan lewat `js/api.js`.
3. **Token tidak boleh di URL.** Semua request ber-token memakai POST (body).
4. **Escape sebelum innerHTML** (`escapeHtml` di `js/app.js`); jangan menyisipkan
   data pengguna mentah ke HTML.
5. **Antrean dihapus hanya setelah server membalas sukses.**
6. **Tanggal server dinormalisasi** ke `YYYY-MM-DD` zona Asia/Jakarta.
7. **Tanpa dependency runtime.** Jangan menambah framework/CDN.
8. **Responsif wajib** (≥360px, 768px, 1280px).

## Perintah

```bash
node server.js                  # server lokal http://127.0.0.1:3000
node --test test/core.test.mjs  # unit test logika data
node test/e2e-smoke.mjs         # uji browser (butuh server lokal)
node test/e2e-edit.mjs          # uji edit transaksi (butuh server lokal)
```

## Alur data singkat

1. Input pengguna → localStorage → `sync_queue` (`create`/`update`/`void`).
2. `processSyncQueue()` mengirim satu per satu; item dihapus hanya setelah sukses.
3. Tarik data Spreadsheet → digabung dengan antrean (pending create/update tampil,
   pending void menyembunyikan baris).
4. Backup/restore JSON v2; lihat `docs/BACKUP_RESTORE.md`.

## Batasan yang diketahui

Lihat `docs/SECURITY_AND_RELIABILITY.md`.
