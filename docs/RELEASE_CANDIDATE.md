# Release Candidate — Cashflow

Status: **RC siap diuji/di-deploy**, belum di-deploy (Mission 1 dilarang menyentuh PROD).

## Isi release candidate

| Bagian | Isi | Bukti |
|---|---|---|
| Frontend UI (revisi BOS) | commit `1367c17` — ganti password collapsible + ikon mata, ekspor `.xlsx` berfilter, label "Muat Ulang dari Server", judul "Pengaturan & Ekspor Data", label bulan tanpa kurung, tombol duplikat disembunyikan, pesan motivasi | verifikasi browser 43/43 |
| Backend idempotensi `client_ref` | `Schema.gs` (kolom `client_ref` di Transactions & Investments), `Transactions.gs` (helper bersama + `clientRef` pada objek), `Investments.gs` (idempotensi + `clientRef`), `DatabaseSetup.gs` (migrasi header **additive**, tidak menyentuh data lama) | `node --test test/client-ref.test.mjs` → 11/11 |
| Regression proyek | unit `test/core.test.mjs` 15/15 · `test/e2e-smoke.mjs` 8/8 · `test/e2e-edit.mjs` 9/9 | dijalankan pada HEAD RC |

## Perilaku yang dijamin (teruji pada kode backend asli via VM Apps Script)

1. `create` menyimpan baris + `client_ref`.
2. Retry dengan `client_ref` sama → **idempotent**, ID sama, tanpa baris ganda.
3. `client_ref` berbeda dengan isi identik → **dua baris** (tidak ada dedup berbasis isi).
4. Tanpa `client_ref` → perilaku lama tetap didukung (baris lama aman).
5. `client_ref` tidak valid → ditolak.
6. Setelah `void`, referensi sama boleh membuat baris baru.
7. `update` mempertahankan **server ID** dan `client_ref`.
8. `list` mengembalikan `clientRef` (klien bisa mencocokkan item antrean, bukan isi).
9. `createInvestment` juga idempotent.
10. Migrasi header **additive** pada sheet lama (16 → 17 kolom) tanpa kehilangan data.
11. Retry beruntun → tepat satu baris (integritas transaksi).

## Deployment

Jalur resmi (dari `docs/AUTOMATED_DEPLOYMENT.md`):

- **Frontend**: GitHub Pages otomatis setelah **push ke `main`**.
- **Backend**: `.github/workflows/deploy-apps-script.yml` (push source + update deployment)
  memakai secret `CLASP_SCRIPT_ID`, `CLASP_DEPLOYMENT_ID`, `CLASP_CREDENTIALS`.

Artinya deployment **terjadi saat push** — karena Mission 1 melarang menyentuh PROD,
push/deploy ditunda ke Mission berikutnya (butuh persetujuan BOS/release window).

## Catatan penting sebelum deploy

1. **Belum ada environment staging terpisah** untuk aplikasi ini: endpoint di
   `js/api.js` menunjuk langsung ke backend live, dan `.clasp.json` hanya berisi satu
   project. Karena itu uji tulis terhadap backend live **tidak dilakukan** (akan
   menyentuh data PROD). Verifikasi backend dilakukan dengan menjalankan **kode `.gs`
   asli** di VM Apps Script (`test/client-ref.test.mjs`).
   → Bila BOS ingin uji staging nyata, perlu project Apps Script + deployment kedua
   (staging) dan endpoint terpisah di frontend.
2. **Kerja BOS yang belum di-commit**: `js/app.js` (logika `refMatch` pada antrean) dan
   `docs/CLIENT_REF_MIGRATION.md`. Backend `Transactions.gs` milik BOS **sudah
   diintegrasikan** dan ikut di-commit (lihat pesan commit) karena merupakan fitur yang sama.
   Frontend `js/app.js` sengaja **belum** di-commit; agar pasangan backend+frontend
   lengkap saat deploy, hunk tersebut perlu ikut di-commit pada Mission 2.
3. Setelah deploy backend, jalankan `setupCashflowDatabase`/verifikasi DB agar kolom
   `client_ref` ditambahkan pada sheet yang sudah ada (migrasi additive; data lama aman).
4. Service worker: `js/export-xlsx.js` sudah didaftarkan di cache shell dan token cache
   di-bump (`?v=20261128d`), sehingga pengguna menerima UI baru setelah reload.
