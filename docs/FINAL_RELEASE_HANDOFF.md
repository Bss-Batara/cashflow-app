# FINAL RELEASE HANDOFF — Cashflow

Dibuat: 2026-11-28 (Mission 3). Status: **GO — aplikasi live dan dapat digunakan.**

## 1. Production

| Item | Nilai |
|---|---|
| Frontend URL | **https://bss-batara.github.io/cashflow-app/** |
| Deploy waktu | 2026-11-28 ~19:50 WIB (push `d9779eb..6be1224`) |
| Frontend commit | **`6be1224`** (UI revisi `1367c17` + integrasi `refMatch` + CI fix) |
| Backend commit | **`6be1224`** (idempotensi `client_ref` dari `e985469`) |
| Backend deployment | GitHub Action *Deploy Apps Script backend* → **success** (push source + update deployment) |
| Backend API | `https://script.google.com/macros/s/…/exec` (hardcoded di `js/api.js`, deployment existing di-update) |
| Health API | `POST {"action":"health"}` → `{ok:true, service:"cashflow-api", schemaVersion:"1.0.0", authenticated:false}` |

## 2. Bukti deployment (terverifikasi)

- **Pages**: `index.html` live 53.885 byte memuat `js/export-xlsx.js` + token cache `?v=20261128d`;
  `GET /js/export-xlsx.js` → **200** (14.031 byte); `sw.js` live memuat `export-xlsx.js`;
  `js/auth.js` live memuat `pw-toggle`.
- **Actions** pada commit `6be1224`:
  - *Validate CashFlow* → **success** (termasuk step *Validate Apps Script syntax* yang baru).
    Push sebelumnya (`d9779eb`) job ini **failure** → membuktikan perbaikan CI menyelesaikan false-fail nyata.
  - *Deploy Apps Script backend* → **success**: langkah *Push Apps Script source* dan
    *Update web app deployment* dijalankan (langkah "skip" **tidak** aktif → secret lengkap).
  - *pages build and deployment* → **success**.
- **API live**: health merespons HTTP 200 tanpa data finansial/kredensial.

## 3. Database & migrasi

- Perubahan **additive**: kolom `client_ref` ditambahkan ke skema `Transactions` (kolom 17)
  dan `Investments` (kolom 19).
- `setupCashflowDatabase` (editor Apps Script) **belum dijalankan** — tidak dapat dipanggil
  dari luar editor. Namun migrasi **tidak wajib** dijalankan manual: `ensureClientRefHeader_()`
  menambah header saat `clientRef` pertama kali ditulis, dan `migrateAdditiveHeaders_()`
  menjalankannya saat setup/verifikasi DB.
- **Tidak ada** kolom/baris yang dihapus, tidak ada reset, tidak ada perubahan massal.
  Migrasi idempoten (dijalankan berulang tidak menambah header ganda) — teruji.

## 4. Backup & rollback (status: READY)

Lokasi: `_backup/deploy-20261128-194724/` (di dalam repo, untracked):

| Artefak | Isi | Verifikasi |
|---|---|---|
| `cashflow-repo-20261128-194724.bundle` | seluruh riwayat git (383 KB) | `git bundle verify` → *records a complete history* / *is okay* |
| `commit-history.txt` | 8 commit terakhir | — |
| `apps-script-20261128-194724/` | salinan sumber backend | — |
| `frontend-live-sebelum-deploy/` | 10 berkas frontend live **sebelum** deploy (205 KB) + hash SHA-256 | untuk rollback frontend byte-exact |

**Cara rollback:**
1. *Frontend*: `git revert 6be1224 && git push` (atau restore berkas dari
   `frontend-live-sebelum-deploy/`) → Pages membangun ulang.
2. *Backend*: `Manage deployments` → pilih versi sebelumnya, atau jalankan ulang workflow
   pada commit sebelumnya (`workflow_dispatch`).
3. *Data*: tidak diperlukan — tidak ada operasi destruktif pada data. Kolom `client_ref`
   boleh dibiarkan (kode lama mengabaikannya).

## 5. CI

| Workflow | Status pada `6be1224` |
|---|---|
| Validate CashFlow | **success** (`.js` → `node --check`; `.gs` → `vm.Script`, 9/9 lolos parse) |
| Deploy Apps Script backend | **success** |
| pages build and deployment | **success** |

## 6. Ringkasan test (sebelum deploy, pada commit yang di-deploy)

| Suite | Hasil |
|---|---|
| `test/client-ref.test.mjs` (kode `.gs` asli di VM Apps Script) | **11/11** |
| `test/core.test.mjs` | **15/15** |
| `test/e2e-smoke.mjs` | **8/8** |
| `test/e2e-edit.mjs` | **9/9** |
| Verifikasi UI browser (revisi BOS, desktop 1280 + mobile 390) | **43/43** |
| Ekspor `.xlsx` (openpyxl: sheet, 8 kolom, filter bulan, nominal angka) | valid |

## 7. Sinkronisasi & keandalan

- **Idempotensi**: `client_ref` disimpan pada transaksi & investasi; retry/duplikat →
  satu baris; referensi berbeda dengan isi identik → dua baris (tidak ada penghapusan data
  diam-diam seperti dedup lama berbasis isi).
- **Lock atomicity**: lookup+append berada di dalam `LockService` (tidak ada celah balapan).
- **Offline queue**: item hanya dihapus setelah server membalas sukses; retry aman.
- **Pull/push**: penyegaran otomatis saat online/visibility/interval 30 detik + tombol
  "Muat Ulang dari Server"; merge mempertahankan item antrean.
- **Edit**: mempertahankan server ID dan `client_ref`; tidak menciptakan duplikat.
- **Backward compatibility**: baris lama tanpa `client_ref` tetap terbaca (`clientRef: ''`)
  dan tidak dianggap duplikat.

## 8. Temuan keamanan

- `health` hanya mengembalikan `service`, `schemaVersion`, `authenticated` (boolean) —
  tidak ada data finansial/kredensial; tidak melemahkan autentikasi endpoint lain.
- Token dikirim lewat **body POST**, tidak pernah di URL.
- Tidak ada perubahan credential, permission, atau akses spreadsheet (tidak dibuka ke publik).
- Perbaikan CI menghapus false-fail tanpa menghilangkan validasi sintaks.

## 9. Batasan yang diketahui (jujur)

1. **Uji tulis di production tidak dijalankan** — memerlukan kredensial login BOS; menulis
   ke database finansial live tanpa backup yang dapat saya verifikasi dianggap terlalu
   berisiko. Verifikasi live = read-only (situs, aset, service worker, health API).
2. **`setupCashflowDatabase` belum dijalankan manual** (fungsi editor). Header `client_ref`
   akan ditambahkan otomatis saat penulisan pertama; opsional dijalankan lebih awal.
3. **Backup spreadsheet (Drive) belum dibuat** — token saya hanya punya akses metadata
   Drive (isi berkas ditolak). Migrasi additive sehingga risiko rendah; BOS dapat melakukan
   `File → Make a copy` kapan saja untuk ketenangan tambahan.
4. **UAT dua perangkat fisik (HP + laptop) belum dilakukan manusia** — semua yang dapat
   disimulasikan (viewport 390/1280, offline→online, retry, duplikat) sudah lulus otomatis.
5. `schemaVersion` pada health masih `1.0.0` (nilai konfigurasi tidak diubah pada rilis ini;
   kode backend tetap ter-deploy sesuai langkah workflow yang sukses).

## 10. Cara menggunakan (BOS)

1. Buka **https://bss-batara.github.io/cashflow-app/** di laptop atau HP (tambahkan ke
   Home Screen untuk pemakaian seperti aplikasi).
2. Login dengan akun BOS yang sudah ada.
3. Catat pemasukan/pengeluaran lewat tombol utama; tabungan/investasi lewat menu Portofolio.
4. **Muat Ulang dari Server** untuk menarik data terbaru; data juga tersinkron otomatis
   (±30 detik / saat aplikasi kembali aktif).
5. **Ekspor Data**: pilih Bulan/Tahun/rentang tanggal → *Ekspor ke Excel (.xlsx)*.
6. **Ganti Password**: Pengaturan → tombol *Ganti Password* → isi 3 kolom (ikon mata untuk
   melihat) → *Simpan Password*.

**Jika sinkron gagal:** pastikan internet, tekan *Muat Ulang dari Server*; indikator akan
menampilkan status; data tetap aman di antrean lokal dan akan terkirim otomatis. Jangan
menghapus data browser kecuali sudah dipastikan tersinkron.

**Backup mandiri:** Pengaturan → *Download Backup JSON* (cadangan penuh) dan
*Ekspor ke Excel* untuk arsip bulanan.

**Status akhir: GO.**

---

## Rilis 2026-11-28b — Rentang Data & pembersihan UI ekspor

| Item | Nilai |
|---|---|
| Frontend commit | **384a062** (production) |
| Waktu deploy | 2026-11-28 (push 4fcfa95..384a062) |
| URL produksi | https://bss-batara.github.io/cashflow-app/ |
| Backend | tidak berubah pada rilis ini (tanpa perubahan backend/apps-script) |

**Fitur baru / revisi:**
- **Rentang Data**: tombol membuka modal kalender (Date Range) dengan input From/To, kalender 7 kolom SUN–SAT, navigasi bulan, highlight awal/akhir/rentang, serta Reset / Close / Confirm. Rentang lintas bulan & input manual didukung; aman timezone (tanggal diperlakukan sebagai string lokal, tanpa UTC).
- **Default rentang**: tanggal 1 bulan berjalan → hari ini (inklusif); label tombol langsung menampilkan rentang (tidak pernah "Belum dipilih"); Reset kembali ke default.
- **Filter tanggal** berlaku pada tampilan daftar pengeluaran & pemasukan dan pada ekspor.
- **UI ekspor**: hanya **Ekspor ke Excel (.xlsx)**; tombol CSV, Download Backup JSON, dan Restore Backup JSON dihapus dari UI (fungsi internal tetap ada). Deskripsi: "Pilih rentang data lalu ekspor ke Excel. Jika tidak ada filter yang dipilih, yang diekspor adalah **bulan berjalan**."
- **Akun & Sesi**: "Masuk sebagai <nama>" dipertahankan; teks motivasi baru "**Keuangan yang Sehat di Mulai dari Kesadaran !**" + kalimat dengan bold pada **Kebebasan** dan **Finansial di Masa Depan**.
- Service worker: js/date-range.js terdaftar pada cache shell; token cache aset di-bump ke `?v=20261128e` agar klien tidak menyajikan UI lama.

**Bukti verifikasi (rilis ini):**
- Verifikasi browser fitur Rentang Data: **37/37 lulus** (default, modal, kalender 7 kolom SUN–SAT, navigasi bulan, klik rentang lintas bulan, input manual, validasi terbalik, Reset, Close, Confirm, filter tampilan, ekspor sesuai rentang, CSV/JSON terhapus, teks akun + bold, responsif 1280 & 390, tanpa exception JavaScript).
- XLSX hasil ekspor (divalidasi openpyxl): sheet Transaksi, **hanya 2 baris dalam rentang** (baris di luar rentang tidak ikut), nominal bertipe angka, jumlah 33.300.
- Regression: unit **15/15**, client-ref **11/11**, e2e-smoke **8/8**, e2e-edit **9/9**.
- CI pada 384a062: *Validate CashFlow* **success**; *pages build and deployment* **success**.
- Produksi live: index.html 54.074 byte memuat tombol Rentang Data + modal Date Range; js/date-range.js **HTTP 200** (memuat cashflowDateRange); css/style.css 200 (memuat .range-modal); sw.js 200 (memuat date-range.js); token `?v=20261128e`.
- API live: health **HTTP 200** `{service:"cashflow-api", schemaVersion:"1.0.0", authenticated:false}`; listTransactions tanpa token → `AUTHORIZATION_FAILED` (autentikasi tetap ditegakkan).

**Rollback rilis ini:** `git revert 384a062 && git push` (atau pulihkan berkas dari `_backup/deploy-20261128-194724/frontend-live-sebelum-deploy/`). Tidak ada perubahan backend/database pada rilis ini, sehingga tidak diperlukan rollback data.

---

## Rilis 2026-11-28c — Revisi UI/UX terkoordinasi (menu, Ringkasan, Tabungan, XLSX)

| Item | Nilai |
|---|---|
| Frontend commit | **9bf6137** (production) |
| Waktu deploy | 2026-11-28 (push 6a7623a..9bf6137) |
| URL produksi | https://bss-batara.github.io/cashflow-app/ |
| Backend | tidak berubah (tanpa perubahan backend/apps-script) |

**Revisi:** menu (Pengeluaran / Pemasukan / Tabungan) · Ringkasan memakai **satu kontrol Rentang Data** (default 1 bulan berjalan → hari ini) yang benar-benar memfilter metrik · kartu **TOTAL TABUNGAN** + teks "Tingkatkan Terus Tabungan" + ikon celengan · subtitle & teks kartu Ringkasan diperbarui · judul/subtitle halaman Pengeluaran, Pemasukan, Tabungan · Tabungan: **satu kartu** (Total Tabungan Sekarang) + **grafik histori** dari data nyata (empty state bila kosong) · tabel Tabungan **4 kolom** (Aset/Kode · Kategori · Nominal Date · Aksi) · Pengaturan: subtitle & label "Batas Anggaran" diperbarui, label range di samping tombol dihapus, deskripsi ekspor 2 baris dengan bold **Excel** & **Bulan Berjalan** · **XLSX kini memuat Tabungan** · form Rp Nabung tanpa spinner (`inputmode="numeric"`).

**Bukti verifikasi:**
- Verifikasi browser: **47/47 lulus** (menu, Ringkasan + rentang + kartu + ikon, Pengeluaran, Pemasukan, Tabungan, Pengaturan, modal Date Range, form Rp Nabung, ekspor, responsif 1280/390, tanpa exception).
- XLSX (openpyxl): **4 baris** memuat Pengeluaran + Pemasukan + **2 Tabungan**; nominal numerik (jumlah 833.300); transaksi di luar rentang tidak ikut.
- Regression: unit **15/15**, client-ref **11/11**, e2e-smoke **8/8**, e2e-edit **9/9**.
- Struktur HTML seimbang: `<div>` 206/206, `<section>` 7/7.
- Produksi live: menu baru ADA; filter Bulan/Tahun lama terhapus; `dash-range-open` ADA; `savings-history-chart` + empty state ADA; `Nominal Date` ADA; `inputmode="numeric"` ADA; token `?v=20261128f`; `js/app.js` memuat `renderSavingsHistory` & `Tingkatkan Terus Tabungan`; `js/export-xlsx.js` memuat `'saving'`.
- CI: **Validate CashFlow success**; **pages build and deployment success**.

**Rollback:** `git revert 9bf6137 && git push` (atau pulihkan berkas dari `_backup/deploy-20261128-194724/frontend-live-sebelum-deploy/`). Tanpa perubahan backend/database.

**Catatan:** pada aplikasi ini tidak ada kartu berteks "Tingkatkan skill, tambah pemasukan" (item 2.6) — yang ada adalah kartu Ringkasan dengan teks serupa yang sudah diperbarui ke "Tingkatkan Skill dan Tambah Pemasukan"; tidak ada dummy data yang dibuat.

---

## Rilis 2026-11-29a — Batch 6 (13 temuan)

| Item | Nilai |
|---|---|
| Frontend commit | **7128410** (production) |
| URL produksi | https://bss-batara.github.io/cashflow-app/ |
| Backend | tidak berubah |

**Perbaikan & revisi:**
- **XLSX nominal Tabungan (A)**: akar masalah — objek investasi mentah tidak memuat `currentValue`; nilai dihitung `unit × unitMultiplier × currentPrice` (sama seperti `store.getPortfolioMetrics()`). Ekspor kini memakai rumus itu → nominal tabungan benar (bukan 0) dan tetap sesuai rentang.
- **Grafik Histori Tabungan (F)**: akar masalah — `renderSavingsHistory()` hanya didefinisikan, **tidak pernah dipanggil**. Kini dipanggil dari `render()`; render ke kanvas Tabungan **dan** Pemasukan; empty state jelas; teks helper dihapus.
- **Ringkasan (B)**: kartu Arus Kas Bersih → `! Besar Pasak Daripada Tiang` (penulis JS dihentikan); semua teks rentang berulang pada kartu dihapus.
- **Date Range (C/H)**: kalender grid, nama hari, dan navigasi bulan dihapus; From/To + label rata tengah; modal ringkas 340px; Reset/Close/Confirm & filter tetap.
- **Ikon (D)**: Arus Kas Bersih → ikon uang cash; TOTAL TABUNGAN → ikon celengan.
- **Pemasukan (E)**: aksen hijau; "Daftar Sumber Pemasukan" tetap; ditambah grafik Histori Menabung (data nyata).
- **Diversifikasi (G)**: `Tersebar di Berbagai Instrumen (Saham, Emas, Reksadana dll).`
- **Total Kekayaan Bersih (I)**: warna mengikuti nilai (≤ 0 merah, > 0 hijau); rumus tidak diubah.
- **Reload server (J)**: `Ambil Ulang Data Terbaru dari Server.` + indikator dot berwarna (style sama dengan dot di samping Rp Keluar).

**Bukti:**
- Verifikasi browser **23/23 lulus** (termasuk pemeriksaan piksel kanvas: grafik benar-benar tergambar; modal tanpa kalender; ikon; teks; warna net worth; dot reload).
- XLSX (openpyxl): **4 baris** = Pengeluaran + Pemasukan + **2 Tabungan**; nominal tabungan **1.200.000 & 800.000** (non-nol); total 9.050.000; semua numerik; sesuai rentang.
- Regression: unit **15/15**, client-ref **11/11**, e2e-smoke **8/8**, e2e-edit **9/9**; struktur HTML seimbang (div 201/201, section 7/7).
- Produksi live: semua penanda Batch 6 ADA / terhapus sesuai revisi; `js/app.js` memuat `savingValue_` & `renderSavingsHistory()`; `js/export-xlsx.js` memuat `savingValue`; token `?v=20261129a`.
- CI: *Validate CashFlow* **success**; *pages build and deployment* **success**.

**Rollback:** `git revert 7128410 && git push`. Tanpa perubahan backend/database.
