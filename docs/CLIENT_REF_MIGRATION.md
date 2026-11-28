# Migrasi client_ref & Idempotency Server — Rencana

Status: **kode backend sudah dipatch lokal, BELUM di-deploy**. Tidak ada perubahan data production.

## Schema (additive)

Sheet `Transactions` mendapat kolom ke-17: `client_ref` (teks ≤64, opsional).
- Header kolom 17 diisi otomatis saat create pertama yang membawa clientRef.
- Baris lama tetap 16 kolom; tidak diubah, tidak dimigrasi massal.
- `client_ref` bukan pengganti `transactionId`; ID lama tetap.

## Perilaku server (createTransaction)

1. Validasi payload seperti sebelumnya.
2. `clientRef` opsional; jika ada harus cocok `^[A-Za-z0-9._:-]+$` dan ≤64 karakter.
3. Di dalam `LockService.getScriptLock()` (lock yang sama dengan operasi tulis lain):
   - cari baris dengan `client_ref` sama, owner sama, status bukan void;
   - jika ditemukan → kembalikan baris itu (idempotent, tanpa append);
   - jika tidak → append baris baru dengan client_ref.
4. Retry dengan clientRef sama setelah sukses tidak membuat row baru.
5. Dua transaksi identik dengan clientRef berbeda tetap menjadi dua baris.

## Lock & concurrency

`LockService` bersifat global per script; dua request yang tiba bersamaan akan
diserialisasi, sehingga lookup+append tidak berjalan berselang. Batasan: lock timeout
dapat membuat request gagal (bukan duplikat); client akan retry dengan clientRef sama
dan server mengembalikan baris yang sudah ada.

## Backward compatibility

- Client lama tanpa clientRef: perilaku lama, tetap didukung.
- Baris legacy tanpa clientRef: tetap terbaca, dapat diedit/void.
- Backup/restore: tidak menyentuh client_ref server.
- API list: tidak berubah bentuk.

## Langkah deployment (butuh persetujuan manual)

1. Review diff `Transactions.gs`.
2. `clasp push -f`, `clasp version`, `clasp deploy` ke deployment yang sama.
3. Verifikasi: create dengan clientRef sama 2× → 1 baris; clientRef beda → 2 baris.
4. Frontend sudah mengirim clientRef; setelah backend live, fallback signature otomatis
   tidak terpakai (server mengembalikan `clientRef`).

## Rollback

Deploy ulang versi sebelumnya (`clasp deploy -V 43`). Kolom 17 yang sudah terisi tidak
merusak versi lama (dibaca sebagai kolom ekstra yang diabaikan).

## Risiko

- Kolom 17 ditambahkan tanpa migrasi header menyeluruh; hanya terisi saat create baru.
- Belum diuji pada Spreadsheet nyata (tidak boleh menyentuh production); perlu staging.
- Lock timeout dapat memperlambat retry, bukan menggandakan data.
