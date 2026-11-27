# 💰 FinFlow - Web App Catat Keuangan & Portofolio Investasi

Aplikasi web modern, responsif, cepat, dan mandiri (*zero external dependencies*) untuk mencatat **Arus Kas (Cash Flow & Income)**, **Pengeluaran Harian**, serta melacak **Portofolio Investasi** secara real-time. Didesain secara khusus agar sangat nyaman digunakan di **Laptop/Desktop** maupun **Smartphone (HP Android/iPhone)**.

---

## 🌟 Fitur Utama

### 1. ⚡ Ringkasan Keuangan (Dashboard)
- **Kekayaan Bersih (Net Worth)**: Total akumulasi kas + nilai pasar seluruh aset investasi.
- **Kartu Metrik Utama**: Pemasukan bulan ini, pengeluaran harian/bulanan, arus kas bersih (net cash flow), dan nilai portofolio investasi.
- **Grafik Arus Kas Interaktif**: Visualisasi perbandingan pemasukan vs pengeluaran 7 hari terakhir.
- **Gauge Status Pengeluaran Hari Ini**: Indikator langsung apakah pengeluaran hari ini masih aman, mendekati limit, atau over-budget.
- **Aktivitas Transaksi Terbaru**: Riwayat cepat pemasukan & pengeluaran terakhir.

### 2. 💸 Pengeluaran Harian (Daily Expenses)
- **Pencatatan Cepat**: Nominal, judul, kategori, metode pembayaran/dompet, dan catatan.
- **Batas Harian (Daily Budget Alert)**: Tetapkan batas belanja harian (default Rp 200.000) dan pantau persentase pemakaian.
- **Filter Cepat**: Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini, dan Semua.
- **Pencarian Real-time & Filter Kategori**: Filter berdasarkan kategori (Makanan, Transportasi, Kebutuhan, Hiburan, Tagihan, Belanja, Edukasi, Kesehatan, dll).

### 3. 💵 Arus Kas & Income Stream
- **Lacak Sumber Pendapatan**: Gaji pokok, freelance/proyek sampingan, hasil usaha, dividen saham, bonus, dan lainnya.
- **Savings Rate Tracker**: Menghitung otomatis persentase penghasilan yang berhasil disimpan/diinvestasikan (target ideal > 20%).
- **Net Inflow Analysis**: Mengetahui selisih surplus kas setiap periode.

### 4. 📈 Portofolio Investasi Multi-Aset
- **Dukungan Berbagai Instrumen**:
  - **Saham (IHSG / Global)**: Menghitung otomatis berdasarkan satuan **Lot** (1 lot = 100 lembar).
  - **Reksa Dana**: Pasar Uang, Pendapatan Tetap, Campuran, Saham.
  - **Emas Logam Mulia**: Satuan gram fisik (Antam / UBS).
  - **Aset Kripto**: Bitcoin, Ethereum, dan koin lainnya.
  - **SBN / Obligasi / Sukuk**: Surat berharga negara (SR, ORI, PBS).
- **Perhitungan Real-time Otomatis**:
  - Modal awal (Capital invested).
  - Nilai pasar saat ini (Current value).
  - Keuntungan / Kerugian belum terealisasi (*Unrealized Profit/Loss*) dalam Rupiah (Rp) dan Persentase (%).
  - Aset dengan kontribusi terbesar (*Top Asset*).
- **Update Harga Cepat**: Tombol *quick-edit* untuk memperbarui harga pasar saat ini hanya dalam 1 klik.
- **Diagram Donut Alokasi Aset**: Memantau diversifikasi aset agar risiko seimbang.

### 5. 📊 Analisis & Laporan Finansial
- **Komposisi Pengeluaran Terbesar**: Donut chart kategori pengeluaran tertinggi.
- **Indikator Kesehatan Finansial**:
  - Rasio tabungan & investasi (Savings rate).
  - Rasio beban pengeluaran harian terhadap penghasilan.
  - Skor diversifikasi portofolio.

### 6. 📱 Desain Responsif & PWA-Ready (Laptop & HP)
- **Di Laptop**: Tampilan dashboard lebar dengan sidebar navigasi, tabel detail aset, dan multi-kolom widget.
- **Di HP**: Navigasi bawah (*bottom navigation bar* ala aplikasi mobile asli), tombol aksi cepat mengambang (*Floating Action Button / FAB* `+`), header lengkung yang ringkas, serta dukungan gesture sentuh.
- **PWA (Progressive Web App)**: Bisa di-*"Install"* atau ditambahkan ke Layar Utama (*Add to Home Screen*) di Android (Chrome) dan iPhone (Safari) tanpa perlu download dari Play Store / App Store.

### 7. 🔒 Penyimpanan Offline & Keamanan Data (Privacy-First)
- Data tersimpan langsung di browser perangkat Anda (`localStorage`). Privasi terjaga 100% tanpa kirim data ke server pihak ketiga.
- **Ekspor ke Excel / CSV**: Unduh riwayat transaksi untuk diolah di Microsoft Excel atau Google Sheets.
- **Backup & Restore JSON**: Simpan berkas cadangan data keuangan Anda kapan pun dan pulihkan di perangkat lain.

---

## 🚀 Cara Menjalankan Aplikasi

### Opsi A: Cara Paling Mudah (Langsung Buka di Browser)
Cukup buka folder proyek ini dan **klik dua kali** file `index.html`. Aplikasi langsung terbuka di Google Chrome, Microsoft Edge, atau browser favorit Anda!

### Opsi B: Menggunakan Local Server (Sangat Disarankan agar Bisa Dibuka di HP)
1. Buka terminal PowerShell / Command Prompt di folder ini, lalu jalankan:
   ```bash
   node server.js
   ```
   *Atau cukup klik 2x file `start.bat` di Windows!*

2. Terminal akan menampilkan alamat IP lokal Anda, contoh:
   ```text
   =============================================================
      🚀 FinFlow Web App Berhasil Berjalan!
   =============================================================
      💻 Buka di Laptop / Desktop : http://localhost:3000
      📱 Buka di HP (Wi-Fi sama)  : http://192.168.1.15:3000
   =============================================================
   ```

3. **Membuka di Laptop**: Kunjungi `http://localhost:3000`.
4. **Membuka di Smartphone (HP)**:
   - Pastikan laptop dan HP Anda terhubung ke jaringan **Wi-Fi yang sama**.
   - Buka browser di HP (Chrome / Safari), lalu ketikkan alamat IP yang muncul di terminal (misal: `http://192.168.1.15:3000`).

---

## 📲 Cara Menjadikan Aplikasi di Layar Utama HP (Add to Home Screen)
1. Buka alamat web FinFlow di browser HP Anda.
2. **Android (Google Chrome)**:
   - Tekan titik tiga (⋮) di pojok kanan atas.
   - Pilih **"Tambahkan ke Layar Utama"** atau **"Instal Aplikasi"** (*Add to Home Screen*).
3. **iPhone (Safari)**:
   - Tekan tombol **Share** (ikon kotak dengan panah ke atas) di menu bawah.
   - Gulir ke bawah dan pilih **"Tambah ke Layar Utama"** (*Add to Home Screen*).
4. Sekarang FinFlow akan muncul di menu aplikasi HP Anda seperti aplikasi native tanpa bilah URL browser!

---

## ☁️ Ingin Dipublikasikan Online 24/7 (Gratis)?
Jika ingin web ini bisa diakses kapan saja dari mana saja (bahkan saat laptop mati atau di luar rumah):
1. **GitHub Pages (Gratis)**: Upload folder ini ke repository GitHub, lalu aktifkan *GitHub Pages* di pengaturan repository.
2. **Vercel / Netlify (Gratis)**: Cukup drag-and-drop folder `finflow-app` ke dashboard Netlify atau import repository ke Vercel. Karena tidak butuh build step rumit, web akan langsung aktif dalam hitungan detik!

---

## Testing

```bash
node server.js                 # server lokal (terminal 1)
node --test test/core.test.mjs # unit test logika data (tanpa browser)
node test/e2e-smoke.mjs        # uji browser headless (butuh server lokal)
```

Test memakai data dummy dan API tiruan; tidak mengirim apa pun ke Spreadsheet.
Jika Chrome tidak ada di lokasi default, set `CF_CHROME` ke path Chrome Anda.

## Perilaku sinkronisasi

- Data ditulis ke perangkat lebih dulu, lalu masuk antrean (`sync_queue`).
- Antrean dikirim otomatis saat online, saat aplikasi dibuka, dan setiap tab aktif kembali.
- Item hanya dihapus dari antrean setelah server membalas sukses.
- Titik status di header: hijau (tersinkron), biru berdenyut (mengirim), kuning (offline/menunggu),
  merah (gagal — arahkan kursor untuk melihat pesan).
- Tarik data dari Spreadsheet tidak menghapus data yang masih menunggu di antrean.

## Troubleshooting

| Gejala | Tindakan |
|---|---|
| Titik merah "Gagal sinkron" | Periksa koneksi; buka menu Pengaturan → muat ulang halaman. Data tetap aman di perangkat dan akan dicoba lagi otomatis. |
| Angka beda antar perangkat | Pastikan bulan/tahun di filter sama; tarik data dengan memuat ulang halaman. |
| Login gagal setelah pembaruan | Lakukan hard refresh (Ctrl+Shift+R) agar aset baru terpakai. |
| Data hilang dari tampilan | Cek antrean belum terkirim; jangan hapus data situs. Unduh backup terlebih dahulu. |
| File backup ditolak | Pesan menyebut bagian yang gagal (mis. transaksi ke-3). Perbaiki file atau gunakan backup lain. |

## Release & rollback

1. `git push origin main` setelah perubahan frontend.
2. Backend: `clasp push -f` lalu `clasp deploy -i <DEPLOYMENT_ID> -V <versi> -d "<catatan>"`.
3. Rollback frontend: `git revert <commit>`.
4. Rollback backend: `clasp deploy -i <DEPLOYMENT_ID> -V <versi-sebelumnya>`.

## Batasan yang diketahui

Lihat [docs/SECURITY_AND_RELIABILITY.md](docs/SECURITY_AND_RELIABILITY.md).
