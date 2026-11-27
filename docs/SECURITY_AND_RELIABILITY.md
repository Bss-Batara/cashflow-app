# Security & Reliability — Catatan Teknis

Dokumen ini merangkum kondisi keamanan dan keandalan data CashFlow setelah
Security Batch 1 dan Reliability Batch 2, termasuk batasan yang diketahui.

## Keamanan

| Item | Status |
|---|---|
| Kredensial & token di URL | Tidak ada — login/register/reset/me dan semua request ber-token memakai POST (body JSON) |
| XSS pada render data pengguna | Di-escape (`escapeHtml`) untuk transaksi, investasi, legenda grafik, toast memakai `textContent` |
| Path traversal server lokal | Ditolak: decode aman, tolak null byte, `path.resolve` + `path.relative`, cek realpath, blokir file/folder sensitif |
| Penyimpanan token | Hanya di memori (`CashflowApi.token_`), tidak di localStorage |
| Password | Hash SHA-256 + salt di Script Properties; reset token 15 menit, sesi 8 jam |
| Endpoint admin sementara | Tidak ada di deployment final (v43) |

## Keandalan data

- Sumber kebenaran: Google Spreadsheet. Lokal (localStorage) dipakai untuk tampilan cepat
  dan input offline.
- Setiap perubahan masuk `sync_queue`; item dihapus hanya setelah server membalas sukses.
- Pengiriman idempoten berbasis selisih jumlah: `kirim = max(0, jumlah antrean − jumlah di server)`
  per tanda tangan `judul + nominal + tanggal`.
- Tarik data server selalu digabung dengan antrean (pending create ditampilkan, pending void
  menyembunyikan baris).
- Tanggal dari server dinormalisasi ke `YYYY-MM-DD` zona Asia/Jakarta.

## Backup

- Export JSON v2: `app`, `version`, `exportDate`, `counts`, `settings`, `transactions`, `investments`.
- Restore divalidasi (struktur + isi), meminta konfirmasi, tidak menghapus antrean, dan
  mengantrekan item baru agar tersinkron.
- Panduan lengkap: [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## Batasan yang diketahui

1. **Belum ada edit transaksi** — hanya tambah dan hapus (void).
2. **Belum ada transfer antar-dompet**.
3. **Konflik multi-perangkat** belum diuji menyeluruh; deduplikasi berbasis tanda tangan bisa
   melewatkan entri identik yang dibuat bersamaan dari perangkat berbeda.
4. Restore backup lama ke akun yang sudah penuh dapat mengirim ulang item yang telah dihapus.
5. `server.js` adalah alat pengembangan; jangan dijadikan server produksi publik.
