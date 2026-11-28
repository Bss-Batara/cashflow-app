# Handoff Mission 2 — Final UAT, Release Gate, Deployment Readiness

Checkpoint Mission 1 (HEAD `e985469`). Semua langkah di bawah **belum dijalankan**
kecuali disebut lain.

## Status ringkas

| Area | Status | Bukti |
|---|---|---|
| Backend `client_ref` (idempotensi) | **SELESAI di kode**, belum di-deploy | `test/client-ref.test.mjs` 11/11 |
| Frontend UI revisi BOS | **SELESAI**, commit `1367c17` | verifikasi browser 43/43 |
| Regression | LULUS | unit 15/15 · smoke 8/8 · edit 9/9 |
| Deployment | **BELUM** (dilarang pada Mission 1) | — |

## Langkah Mission 2 (urutan yang disarankan)

1. **Satukan pekerjaan BOS yang tersisa** (hunk frontend `js/app.js`: logika
   `refMatch` antrean, dan `docs/CLIENT_REF_MIGRATION.md`). Backend dan frontend harus
   naik bersama, jika tidak pasangan idempotensi tidak lengkap.
   → keputusan BOS: commit hunk tersebut (disarankan) sebelum push.
2. **Deploy** (memicu GitHub Actions + GitHub Pages):
   - backend: workflow `deploy-apps-script.yml` (butuh secret `CLASP_SCRIPT_ID`,
     `CLASP_DEPLOYMENT_ID`, `CLASP_CREDENTIALS`),
   - frontend: GitHub Pages setelah push ke `main`.
3. **Aktivasi kolom `client_ref` pada database yang sudah berjalan**: jalankan
   `setupCashflowDatabase` (atau verifikasi DB) dari editor Apps Script. Migrasi
   bersifat **additive** — hanya menambah header `client_ref`, data lama tidak berubah.
4. **UAT final** (setelah deploy): create/retry/duplikat/offline-reconnect/edit/refresh
   berulang dari **dua perangkat** (HP + laptop), lalu pastikan tidak ada baris ganda.
   Gunakan pengeluaran/penghasilan **nyata milik BOS** atau data uji yang diberi penanda,
   dan bersihkan hanya data ber-penanda.
5. **Release gate**: jalankan `node --test test/client-ref.test.mjs`, `test/core.test.mjs`,
   `test/e2e-smoke.mjs`, `test/e2e-edit.mjs` pada commit yang akan di-deploy.
6. **Rollback plan**: karena hanya frontend + Apps Script (tanpa migrasi destruktif),
   rollback = deploy ulang versi sebelumnya (`Manage deployments`) + halaman frontend
   versi sebelumnya. Kolom `client_ref` boleh dibiarkan (tidak mengganggu kode lama).

## Blocker/risiko yang harus diputuskan BOS

1. **Tidak ada environment staging terpisah.** `js/api.js` menunjuk langsung ke backend
   live dan `.clasp.json` hanya berisi satu project, sehingga "staging test" terhadap
   runtime nyata = menyentuh PROD. Verifikasi backend saat ini memakai VM Apps Script
   atas kode `.gs` asli. Bila diinginkan, buat project/deployment staging kedua.
2. **Push = deploy.** Kedua jalur deployment berjalan otomatis dari `main`, jadi
   Mission 2 harus dimulai hanya saat BOS siap merilis.
3. Uji sentuh pada **HP fisik** tetap perlu dilakukan manusia (semua yang dapat
   disimulasikan sudah lulus pada viewport 390px).
