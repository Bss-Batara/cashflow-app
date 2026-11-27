# Backup & Restore — CashFlow

Panduan singkat untuk mencadangkan dan memulihkan data tanpa menyentuh data pengguna lain.

## Format backup

Menu **Pengaturan → Download Backup JSON** menghasilkan file:

```json
{
  "app": "cashflow",
  "version": 2,
  "exportDate": "2026-11-28T00:00:00.000Z",
  "counts": { "transactions": 12, "investments": 3 },
  "settings": { "dailyBudget": 200000, "monthlyBudget": 5000000 },
  "transactions": [ ... ],
  "investments": [ ... ]
}
```

Yang **tidak** masuk backup: akun/login, token sesi, antrean sinkronisasi, dan kategori
(kategori berasal dari Spreadsheet dan otomatis dibuat saat login).

## Cara backup

1. Login, buka **Pengaturan**.
2. Klik **Download Backup JSON**.
3. Simpan file di tempat aman (mis. Google Drive pribadi), beri nama bertanggal.
4. Disarankan juga **Ekspor Transaksi ke CSV** untuk dibuka di Excel.

## Cara restore

1. **Backup dulu** data yang sekarang (langkah di atas). Restore akan mengganti data lokal.
2. Buka **Pengaturan → Restore Backup JSON**.
3. Pilih file `.json` hasil export.
4. Aplikasi memvalidasi file. Jika tidak valid, muncul pesan alasan (mis. "Bagian
   transactions harus berupa array", "Transaksi ke-3 tidak valid").
5. Setelah valid, muncul ringkasan jumlah transaksi/investasi dan tanggal export.
   Klik **OK** untuk melanjutkan, **Batal** untuk membatalkan.
6. Data lokal diganti, lalu item yang belum ada di perangkat **diantrekan** dan dikirim
   ke Spreadsheet saat online.

## Aturan aman

- Restore tidak menghapus data di Spreadsheet; ia menambah data yang belum ada.
- Antrean sinkronisasi yang sedang menunggu **tidak dihapus** oleh restore.
- Jangan restore backup lama ke akun yang datanya sudah lengkap: item lama yang tidak
  ada di server akan dikirim ulang. Untuk pemulihan bencana, gunakan akun/perangkat
  yang kosong.
- File backup berisi data keuangan pribadi — jangan dibagikan.

## Uji restore tanpa menyentuh data asli

1. Buat file uji: export data saat ini.
2. Kosongkan data lokal di perangkat uji (browser lain / mode incognito).
3. Restore file uji, lalu periksa jumlah transaksi/investasi dan saldo di Dasbor.
4. Hapus data uji dari perangkat uji setelah selesai (jangan di perangkat produksi).
