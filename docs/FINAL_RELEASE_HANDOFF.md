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
