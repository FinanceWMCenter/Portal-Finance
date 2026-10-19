# Panduan Setup — Portal Pengajuan Finance WM Center

Ikuti langkah ini secara urut. Dibutuhkan akun Google yang akan menjadi "pemilik sistem"
(punya akses ke Sheet, Drive, dan Apps Script).

## 1. Buat Google Sheet

1. Buat Google Sheet baru, beri nama misalnya **"DB Pengajuan Finance WM Center"**.
2. Buat dua tab dengan nama **persis**: `Pengajuan` dan `Master`.
3. Ikuti `docs/SHEET-TEMPLATE.md` untuk mengisi header kolom, dropdown Status, dan
   pemformatan bersyarat di tab `Pengajuan`, serta isi referensi di tab `Master`.
4. Salin **ID Sheet** dari URL-nya:
   ```
   https://docs.google.com/spreadsheets/d/INI_ID_SHEET_NYA/edit
   ```

## 2. Siapkan folder Drive (opsional)

Folder `Pengajuan Finance` dan semua subfoldernya (per Cabang/Divisi, per bulan)
**dibuat otomatis oleh script** saat ada pengajuan masuk — Anda tidak perlu membuatnya manual.
Folder akan muncul di My Drive milik akun yang menjalankan Apps Script.

## 3. Buat project Apps Script

1. Dari Google Sheet yang sudah dibuat: menu **Ekstensi → Apps Script**.
2. Hapus isi default `Code.gs`, lalu salin seluruh isi file `apps-script/Code.gs` dari paket ini.
3. Isi bagian **KONFIGURASI (WAJIB DIISI)** di bagian atas file:
   - `SHEET_ID` → ID Sheet dari langkah 1.
   - `FINANCE_EMAIL` → **ganti dari placeholder `finance@wmcenter.id`** dengan alamat
     email/distribusi Finance yang sesungguhnya menerima notifikasi pengajuan baru.
     Boleh lebih dari satu alamat, dipisah koma.
   - Biarkan `DRIVE_ROOT_FOLDER_NAME`, `MAX_FILE_SIZE_MB`, dan lainnya kecuali ada
     kebutuhan khusus.
4. Simpan project (beri nama misalnya "Portal Pengajuan Finance - Backend").

## 4. Deploy sebagai Web App

1. Di editor Apps Script: klik **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. Isi:
   - **Execute as**: `Me` (akun Anda — ini yang membuat Sheet/Drive bisa ditulis walau
     pengguna portal tidak login).
   - **Who has access**: `Anyone`.
4. Klik **Deploy**. Google akan meminta otorisasi — izinkan akses ke Sheet, Drive, dan
   pengiriman email dengan akun Anda.
5. Salin **URL Web App** yang diberikan (diakhiri `/exec`).

> Setiap kali Anda mengubah isi `Code.gs`, Anda harus membuat **versi deployment baru**
> (Deploy → Manage deployments → Edit → New version) agar perubahan aktif di URL yang sama.

## 5. Hubungkan frontend ke Apps Script

1. Buka `frontend/assets/js/config.js`.
2. Ganti nilai `APPS_SCRIPT_URL` dengan URL Web App dari langkah 4:
   ```js
   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb..../exec",
   ```
3. Jangan mengubah file lain di `config.js` kecuali memang perlu menyesuaikan batas ukuran berkas.

## 6. Publikasikan ke GitHub Pages

1. Buat repository GitHub baru (boleh privat jika organisasi punya GitHub Enterprise/akses privat Pages,
   atau publik jika tidak masalah — tidak ada data rahasia di frontend).
2. Unggah seluruh isi folder `frontend/` ke root repository (bukan folder `wm-portal-pengajuan/` itu sendiri).
3. Di repository: **Settings → Pages**.
   - Source: `Deploy from a branch`.
   - Branch: `main` (atau branch yang dipakai), folder `/ (root)`.
4. Tunggu beberapa menit, lalu buka URL yang diberikan GitHub Pages
   (biasanya `https://<org>.github.io/<nama-repo>/`).
5. Buka halaman tersebut, pastikan logo, warna, dan menu tampil sesuai desain WM Center.

## 7. Uji coba

Lanjutkan ke `docs/TEST-CHECKLIST.md` dan jalankan semua skenario di sana sebelum
membagikan link portal ke seluruh karyawan.

## 8. Bagikan ke karyawan

Setelah lolos uji coba, bagikan URL GitHub Pages ke seluruh cabang dan divisi
(misalnya ditempel di grup WhatsApp masing-masing, menggantikan kebiasaan mengirim
pengajuan langsung ke Finance via chat).

## Hal yang wajib diganti sebelum go-live

- [ ] `SHEET_ID` di `Code.gs` — ID Sheet asli.
- [ ] `FINANCE_EMAIL` di `Code.gs` — alamat email Finance asli (bukan placeholder).
- [ ] `APPS_SCRIPT_URL` di `frontend/assets/js/config.js` — URL Web App hasil deploy.

## Pemeliharaan rutin

- Jika daftar cabang, divisi, atau bank berubah: perbarui bersamaan di
  `frontend/index.html`, `apps-script/Code.gs`, dan tab `Master` di Sheet (lihat
  `docs/SHEET-TEMPLATE.md`).
- Jika ada perubahan pada `Code.gs`, selalu buat versi deployment baru (lihat langkah 4).
- Cadangkan (export) Sheet secara berkala karena ini adalah satu-satunya database.
