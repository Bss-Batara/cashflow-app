# Cashflow Project Context

Dokumen ini adalah ringkasan teknis seluruh pekerjaan proyek Cashflow untuk dibaca oleh model AI atau developer lain.

> **Catatan status (26 Nov 2026):** isi di bawah adalah arsip fase *foundation* dari sesi Codex. Sebagian aturan sudah digantikan oleh pekerjaan setelahnya — lihat bagian **Status terkini** di bawah. Bagian historis sengaja tidak dihapus agar jejak keputusan tetap terbaca.

## Status terkini (26 Nov 2026)

Arsitektur yang berjalan sekarang:

- Frontend statis di GitHub Pages: `https://bss-batara.github.io/cashflow-app/`.
- Backend: Google Apps Script web app, deployment aktif `AKfycbwNDh1yP1ErkKPjEkGcN28YO2AnUA8Mso_FyENR7MPEiHfxcY8fNydDe-fN8KA48w85`.
- Database: Google Spreadsheet private (sheet `Transactions`, `Investments`, `Categories`, `Budgets`, `Settings`, `AuditLog`, `Schema`).
- Alur: browser -> JSONP/form POST ke GAS -> Spreadsheet.

Perubahan penting dibanding fase foundation:

1. Manifest memakai `executeAs: USER_DEPLOYING` dan `access: ANYONE_ANONYMOUS`, bukan `USER_ACCESSING`/`ANYONE`. Alasan: JSONP dari GitHub Pages tidak membawa cookie Google pihak ketiga, sehingga deployment `USER_ACCESSING` selalu me-redirect ke halaman login dan sinkronisasi gagal.
2. Autentikasi memakai username/password di backend dengan hash SHA-256 + salt di Script Properties, lalu menerbitkan token 64 hex berlaku 8 jam. Identitas request diambil dari token (`resolveApiIdentity_`), dengan fallback akun Google yang ada di allowlist.
3. Router `Api.gs` sudah memiliki `doGet`/`doPost` dan CRUD. Aksi publik: `health`, `login`, `register`. Aksi ber-token: `me`, `logout`, `changePassword`, `listTransactions`, `createTransaction`, `updateTransaction`, `voidTransaction`, `listCategories`, `listInvestments`, dan lainnya.
4. Frontend: overlay login, sesi di `sessionStorage`, sinkronisasi otomatis tiap 30 detik dan saat tab aktif, penulisan transaksi lokal-dulu lalu dikirim ke GAS, data contoh dihapus.
5. Pendaftaran publik dapat dibuka/ditutup lewat konstanta `REGISTRATION_OPEN` di `js/auth.js` dan case `register` di `Api.gs`. Status terakhir: dibuka atas permintaan pemilik proyek.

Konsekuensi keamanan yang harus disadari:

- Akses deployment bersifat anonim; data tetap butuh token, dan password disimpan sebagai hash.
- Login/register dikirim lewat GET (konsekuensi JSONP), sehingga password muncul di query string dan log eksekusi Apps Script. Jika ini tidak dapat diterima, perlu proxy backend sendiri.
- Belum ada pembatasan percobaan login per IP (baru per username: 5 gagal / 10 menit).
- Backup otomatis ke Drive belum diimplementasikan.

Status verifikasi: seluruh endpoint diuji langsung ke deployment (health, register, login, listTransactions, createTransaction, changePassword) dan UI diuji di Chrome headless terhadap halaman GitHub Pages. Semua laporan menyebut mana yang live dan mana yang statis.


## Repository dan arsitektur

Repository: `D:\2026\24_CLOUDE\7_Cashflow-app`.

- Frontend: Vanilla HTML, CSS, JavaScript, PWA, dan offline-first.
- Penyimpanan saat ini: `localStorage`.
- Server lokal: Node.js murni melalui `server.js`.
- Backend target: Google Apps Script.
- Database target: Google Spreadsheet private.
- Backup target: Google Drive dengan permission terbatas.

File frontend yang tidak boleh diubah dalam foundation task: `index.html`, `css/style.css`, `js/app.js`, `js/store.js`, dan `js/charts.js`.

Perintah server lokal: `node server.js`. Percobaan eksekusi melalui terminal Codex gagal sebelum proses dibuat karena `helper_unknown_error: setup refresh had errors`; ini bukan error yang berasal dari `server.js`.

## Tujuan migrasi

Rancangan target adalah `Cashflow frontend -> Google Apps Script -> private Google Spreadsheet`, dengan backup ke Google Drive. Migrasi `localStorage` belum dilakukan. Data lokal tidak boleh dihapus, diubah, atau dipindahkan tanpa task migrasi yang disetujui.

## Security requirements

1. Spreadsheet tidak boleh public.
2. Anonymous access ke data finansial harus ditolak.
3. Secret, credential, dan privileged token tidak boleh berada di frontend.
4. Apps Script endpoint tidak boleh dianggap aman hanya karena URL deployment.
5. Identity harus diperoleh dari server-side Apps Script `Session`, bukan dari payload frontend.
6. Authentication harus fail closed untuk identity kosong, allowlist hilang, JSON invalid, array kosong, atau email tidak terdaftar.
7. Validasi data harus dilakukan di backend.
8. Setup tidak boleh menghapus sheet, baris, record, atau data existing.
9. Backup/recovery harus siap sebelum produksi.
10. Production write endpoint belum boleh diaktifkan.

## Apps Script foundation

Folder backend: `backend/apps-script/`.

File foundation yang diaudit: `Auth.gs`, `Config.gs`, `DatabaseSetup.gs`, `Protection.gs`, `Schema.gs`, `appsscript.json`, `README.md`, dan `BackupPlan.md`.

Schema tujuh sheet yang harus dipertahankan:

1. `Transactions`
2. `Investments`
3. `Categories`
4. `Budgets`
5. `Settings`
6. `AuditLog`
7. `Schema`

Fungsi yang harus tetap tersedia: `setupCashflowDatabase`, `verifyCashflowSchema`, `verifyCashflowInitializationSafety`, `verifyAuthenticationConfiguration`, `configureAllowedUsers`, dan `configureSpreadsheetId`.

Initialization hanya boleh membuat sheet yang hilang dan memverifikasi struktur. Tidak boleh menghapus, mengosongkan, atau menimpa data. Foundation tidak boleh berisi CRUD, migration, `doGet`, atau `doPost`.

## Global declaration architecture

Masalah awal adalah global initializer lintas file. `Auth.gs` pernah membaca `CASHFLOW_CONFIG.allowlistProperty` pada global scope sebelum konfigurasi tersedia. Setelah itu muncul deklarasi ganda `CASHFLOW_AUTH` dan `CASHFLOW_CONFIG`, yang umum terjadi ketika file lama seperti `Kode.gs` masih dicampur dengan source baru di Apps Script.

Solusi yang dipilih adalah accessor function, bukan top-level `const`/`let`:

- `getCashflowConfig_()` untuk konfigurasi.
- `getCashflowSchema_()` untuk schema.
- `getCashflowAuthConfig_()` untuk konfigurasi authentication.

Jangan mengembalikan global `CASHFLOW_CONFIG`, `CASHFLOW_SCHEMA`, atau `CASHFLOW_AUTH`. Accessor dipanggil di dalam function body sehingga tidak ada dependency pada urutan evaluasi file.

Canonical Script Properties:

- Allowlist: `CASHFLOW_ALLOWED_USERS_V1`.
- Spreadsheet ID: `CASHFLOW_SPREADSHEET_ID_V1`.

Setup, allowlist reader, dan authentication verifier harus mengambil key yang sama dari accessor. Jangan membuat key alternatif.

## Authentication design

Manifest menggunakan V8 dan konfigurasi web app `executeAs: USER_ACCESSING`, `access: ANYONE`. `USER_ACCESSING` berarti script menggunakan identity user yang mengakses. Konfigurasi ini bukan pengganti authorization logic. Spreadsheet tetap private dan identity harus diverifikasi server-side. Tidak boleh mengubah deployment setting tanpa menjelaskan dampaknya.

Test account yang disepakati: `bssbatara@gmail.com`.

Authentication fail closed jika active identity kosong, allowlist tidak ada, JSON tidak valid, array kosong, email invalid, atau email aktif tidak terdaftar. Frontend tidak boleh mengirim identity yang dipercaya backend.

`diagnoseCashflowAllowlist()` melaporkan property key, property existence, parsing status, jumlah entry, status active/effective identity, dan status membership. Fungsi tersebut tidak boleh mengekspos seluruh daftar email.

## Root cause allowlist issue

Live diagnostic sebelumnya menunjukkan active email `bssbatara@gmail.com`, identity tersedia, tetapi `activeIdentityAllowlisted: false` dan `failClosed: true`.

Root cause adalah perbedaan email, bukan perbedaan property key. Helper lama mengonfigurasi `bssbara@gmail.com`, sedangkan akun aktif adalah `bssbatara@gmail.com`. `Auth.gs` telah diperbaiki agar `setupCashflowTestAllowlist()` mengonfigurasi `bssbatara@gmail.com` menggunakan key `CASHFLOW_ALLOWED_USERS_V1` yang sama dengan reader dan verifier.

## Manual runtime test yang wajib dilakukan

Codex belum melakukan live Google Apps Script testing. Pada Apps Script project yang benar:

1. Pastikan tidak ada file manual lama yang mendeklarasikan ulang config, auth, atau schema.
2. Jalankan `setupCashflowTestAllowlist()`.
3. Jalankan `diagnoseCashflowAllowlist()`.
4. Jalankan `verifyAuthenticationConfiguration()`.
5. Uji user tidak terdaftar, identity kosong, property hilang, dan JSON invalid.

Expected diagnostic untuk `bssbatara@gmail.com`: `propertyKey` bernilai `CASHFLOW_ALLOWED_USERS_V1`, `propertyExists: true`, `parsesCorrectly: true`, `storedEntryCount: 1`, `activeEmail: bssbatara@gmail.com`, `activeIdentityPresent: true`, `effectiveIdentityPresent: true`, `activeIdentityAllowlisted: true`, dan `failClosed: true`.

Untuk `verifyAuthenticationConfiguration()`, `accessWouldBeGranted` harus true hanya untuk account test yang benar; kondisi invalid harus ditolak.

## Static validation yang sudah dilakukan

- Syntax seluruh `.gs` diperiksa.
- Duplicate global config/auth/schema diperiksa.
- Markdown code fence diperiksa dan tidak boleh ada.
- Canonical allowlist key diperiksa.
- Test helper diperiksa menggunakan `bssbatara@gmail.com`.
- Tujuh sheet schema dipertahankan.
- Tidak ada CRUD, migration, `doGet`, `doPost`, atau destructive spreadsheet operation.
- Manifest V8 dan deployment design tetap konsisten.

Static validation tidak boleh dilaporkan sebagai runtime verification.

## Backup dan recovery

Automated backup belum diimplementasikan. Rancangan: snapshot private di Google Drive dengan timestamp dan schema version; restore harus eksplisit dan direview; backup tidak boleh otomatis menimpa production; snapshot dibuat sebelum migrasi atau perubahan schema; operasi write nantinya dicatat pada `AuditLog`.

## Implementation plan

### Phase 0: foundation

Sinkronkan source repository dengan Apps Script editor, hapus konflik file duplikat secara manual, jalankan static checks, jalankan allowlist/identity test, dan pastikan spreadsheet private.

### Phase 1: local data inventory

Audit seluruh key dan object `localStorage` di `js/store.js` dan pemakainya. Dokumentasikan field, default, optionality, identifier, serta mapping transaksi, investasi, kategori, budget, settings, dan chart ke row spreadsheet.

### Phase 2: read-only backend

Implementasikan read-only setelah authentication runtime terbukti. Validasi identity, spreadsheet ID, sheet name, dan schema version di backend. Belum ada write endpoint.

### Phase 3: controlled migration

Buat tool migrasi satu kali dari export eksplisit, validasi seluruh record, gunakan stable ID dan idempotency, buat migration report, dan jangan menghapus `localStorage`.

### Phase 4: controlled writes

Tambahkan CRUD hanya setelah backup, validation, locking, audit logging, dan authorization selesai. Tolak overwrite tanpa revision check.

### Phase 5: frontend integration

Integrasikan frontend setelah backend stabil. Pertahankan `localStorage` sebagai fallback selama transisi. Tambahkan sync status, retry, conflict handling, dan recovery flow.

### Phase 6: production readiness

Uji backup/restore, unauthorized access, malformed payload, duplicate request, concurrent write, OAuth scopes, dan deployment access. Production endpoint hanya boleh diaktifkan setelah approval eksplisit.

## Remaining risks

- Global declaration collision dapat muncul kembali jika future code menambah top-level `const`/`let` lintas file.
- `USER_ACCESSING` dan identity context harus diuji pada deployment dan account nyata.
- Apps Script editor mungkin masih memiliki file lama atau duplikat yang tidak ada di repository.
- Schema foundation belum memiliki CRUD.
- `localStorage` belum dimigrasikan.
- Automated backup belum tersedia.
- Production endpoint belum tersedia.
- Server lokal belum berhasil dijalankan melalui terminal Codex karena masalah lingkungan terminal.

## Rules for next work

Audit seluruh `backend/apps-script/` sebelum mengedit. Gunakan accessor function. Pertahankan `CASHFLOW_ALLOWED_USERS_V1`, fail-closed behavior, tujuh nama sheet, dan private spreadsheet. Jangan menambahkan CRUD, migration, `doGet`, `doPost`, production endpoint, atau perubahan frontend tanpa task baru. Jangan menghapus atau menimpa data. Selalu bedakan static validation dari live Apps Script testing.

## Status terakhir

Foundation telah dirapikan, key allowlist telah disatukan, test account telah diperbaiki menjadi `bssbatara@gmail.com`, diagnostic telah ditambahkan, schema tujuh sheet tetap ada, dan tidak ada CRUD/migration/production endpoint/frontend change. Static validation telah dilaporkan berhasil. Live runtime verification masih harus dilakukan manual di Google Apps Script.
