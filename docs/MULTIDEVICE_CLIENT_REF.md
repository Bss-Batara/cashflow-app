# Multi-Device Identity (client_ref) — Desain & Rencana Migrasi

Status: **desain + kesiapan frontend**, backend belum diubah/di-deploy.

## Masalah

Deduplikasi lama memakai `judul + nominal + tanggal`. Dua transaksi identik yang dibuat
dari perangkat berbeda bisa dianggap sama sehingga salah satunya tidak pernah dikirim
(data hilang diam-diam).

## Perbaikan frontend (sudah diterapkan, Batch 4)

1. Setiap item antrean mendapat `clientRef` acak (`cr-...`) yang **stabil**: dibuat sekali
   saat transaksi dibuat, tidak berubah saat retry, reload, atau edit.
2. `clientRef` dan `clientId` dikirim bersama `createTransaction`/`createInvestment`.
3. Setiap percobaan kirim menaikkan `attempts` (dipersistenkan sebelum POST).
4. Aturan kirim baru:
   - `attempts = 0` → **selalu kirim** (dua perangkat dengan transaksi identik tetap menghasilkan dua baris).
   - `attempts > 0` dan server sudah punya baris yang cocok (clientRef sama, atau fallback
     judul+nominal+tanggal untuk data legacy) → lewati (retry aman, tidak ganda).
5. Signature tidak lagi menjadi satu-satunya penentu "sudah terkirim".

## Backend yang diperlukan (belum diterapkan)

Agar idempoten lintas restart/perangkat:

1. Tambah kolom **`client_ref`** di sheet `Transactions` (kolom ke-17, setelah `version`),
   diisi otomatis oleh setup bila belum ada — tanpa mengubah baris lama.
2. `createTransaction` / `createInvestment`:
   - validasi `clientRef` opsional (maks. 64 karakter, `[A-Za-z0-9._:-]`);
   - cari baris dengan `client_ref` yang sama **milik user yang sama**;
   - jika ada → kembalikan baris itu (idempotent), jangan append;
   - jika tidak → append dengan `client_ref` terisi.
3. Data lama tanpa `client_ref` tetap kompatibel: tidak dianggap duplikat, tidak diubah.
4. `updateTransaction` / `voidTransaction` tidak mengubah `client_ref`.

## Rencana uji backend (staging)

- Dua request identik dengan `client_ref` sama → satu baris.
- Dua request dengan `client_ref` berbeda tetapi isi identik → dua baris.
- Request tanpa `client_ref` → perilaku lama (tetap didukung).
- Retry setelah timeout → satu baris.
- Baris legacy tanpa `client_ref` → tetap terbaca dan bisa diedit.

## Catatan

Karena backend production belum diubah, `clientRef` saat ini diabaikan server. Mitigasi
frontend (attempts) sudah mencegah duplikasi retry dan mencegah penghapusan transaksi
identik lintas perangkat pada percobaan pertama.
