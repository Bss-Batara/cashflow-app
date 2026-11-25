# Project Instructions (AGENTS.md)

## 1. Stack & Arsitektur
- **Frontend**: Vanilla HTML, CSS, dan JavaScript murni (tanpa framework seperti React/Vue).
- **Data**: Disimpan secara lokal di browser menggunakan `localStorage` (offline-first).
- **Server**: Menggunakan Node.js murni tanpa dependensi eksternal (`server.js`).
- **PWA**: Proyek ini mendukung PWA (Progressive Web App) untuk diinstal di HP.

## 2. Aturan Koding (Hard Rules)
- JANGAN menambahkan library atau framework baru (seperti jQuery, Bootstrap, dll) ke dalam file HTML. Semua kode harus *zero-dependency* kecuali memang diizinkan.
- JANGAN mengubah logika keamanan di `DatabaseSetup.gs`. File tersebut dirancang untuk tidak pernah menghapus atau menimpa data (hanya membuat sheet baru jika belum ada).
- JANGAN menghapus atau menimpa file `manifest.json` dan `server.js` tanpa alasan yang jelas.
- Pastikan UI tetap responsif di Desktop dan Mobile. Gunakan CSS yang sudah ada di `css/style.css`.

## 3. Gaya Penulisan Kode
- Gunakan JavaScript gaya ES6+ (const/let, arrow functions) yang modern.
- Gunakan format Penulisan Rupiah yang konsisten (contoh: `Rp 1.000.000`).
- Semua teks antarmuka pengguna (UI) harus menggunakan Bahasa Indonesia.

## 4. Cara Menjalankan & Test
- Untuk menjalankan server lokal: `node server.js`
- Akses di browser melalui `http://localhost:3000`.
- Tidak ada framework testing otomatis (seperti Jest/Vitest). Pengujian dilakukan secara manual dengan membuka aplikasi di browser dan mengecek *Console* untuk melihat error.x