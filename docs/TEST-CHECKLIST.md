# Checklist Uji Coba — Portal Pengajuan Finance WM Center

Jalankan semua skenario ini setelah setup (lihat `docs/SETUP.md`) sebelum portal dibagikan
ke karyawan. Uji di tema terang dan gelap, serta minimal di satu ukuran HP (390px) dan
satu ukuran laptop/desktop.

## 1. Submit normal (jenis Barang, Cabang, tidak urgent)

- [ ] Buka `index.html`, pilih Tipe Lokasi = Cabang, pilih salah satu cabang.
- [ ] Isi semua kolom wajib dengan data valid, Jenis Pengajuan = Barang.
- [ ] Lampirkan 1 dokumen PDF di bawah 5MB.
- [ ] Jangan centang Urgent.
- [ ] Klik Kirim pengajuan → muncul popup dengan ID berformat `PGJ-YYYYMMDD-NNN`.
- [ ] Buka Google Sheet tab Pengajuan → baris baru muncul dengan data yang sesuai,
      Status = `Diajukan`, kolom Cabang terisi dan Divisi kosong.
- [ ] Cek folder Drive: `Pengajuan Finance/Cabang/<Cabang>/<YYYY-MM>/` berisi dokumen yang diunggah.
- [ ] Cek email masuk ke alamat `FINANCE_EMAIL` dengan subjek memuat ID pengajuan, tanpa lampiran
      berkas (hanya link Drive).

## 2. Submit jenis Jasa (wajib KTP/NPWP)

- [ ] Pilih Jenis Pengajuan = Jasa.
- [ ] Coba kirim tanpa mengisi KTP/NPWP → muncul pesan error, tidak terkirim.
- [ ] Lampirkan KTP/NPWP, kirim ulang → berhasil.
- [ ] Di Sheet, kolom Link KTP/NPWP terisi URL Drive yang valid dan bisa dibuka.

## 3. Submit urgent

- [ ] Centang "Ini pengajuan urgent".
- [ ] Coba kirim tanpa mengisi Alasan Urgent → muncul pesan error.
- [ ] Isi Alasan Urgent, kirim → berhasil.
- [ ] Di Sheet, kolom Urgent = `TRUE` dan Alasan Urgent terisi.
- [ ] Email notifikasi memiliki subjek berawalan `[URGENT]`.
- [ ] Di halaman Cek Status, baris ini menampilkan badge "Urgent".

## 4. Berkas terlalu besar

- [ ] Lampirkan berkas PDF di atas 5MB.
- [ ] Pastikan muncul pesan error ukuran berkas sebelum maupun saat submit, dan permintaan
      tidak terkirim ke server.
- [ ] (Lanjutan) Kirim langsung ke endpoint Apps Script (lihat skenario 6) dengan berkas
      besar yang di-base64 — pastikan server menolak dengan pesan ukuran berkas, bukan error
      tak terduga.

## 5. Tipe berkas salah

- [ ] Coba lampirkan berkas `.docx` atau `.xlsx` — pastikan file picker/validasi menolaknya
      atau muncul pesan error format berkas sebelum submit.
- [ ] Ubah ekstensi berkas `.txt` menjadi `.pdf` secara manual (tanpa mengubah isi), lampirkan,
      lalu submit — server harus tetap menolak jika tipe MIME asli tidak cocok, atau menerima
      hanya berdasarkan ekstensi sesuai yang diizinkan (dokumentasikan hasil aktualnya).

## 6. Panggilan langsung ke endpoint (melewati form)

Gunakan alat seperti `curl` atau Postman untuk mengirim POST langsung ke URL Apps Script,
tanpa lewat `index.html`, untuk memastikan validasi server tidak bisa dilewati.

- [ ] Kirim POST dengan body JSON kosong `{}` → server membalas `ok:false` dengan pesan
      validasi, bukan error 500.
- [ ] Kirim POST dengan `nominal: -1000` atau `nominal: "abc"` → ditolak.
- [ ] Kirim POST dengan `bank: "Bank Tidak Dikenal"` → ditolak.
- [ ] Kirim POST dengan `jenisPengajuan: "Jasa"` tanpa field `ktpNpwp` → ditolak.
- [ ] Kirim POST dengan field honeypot `website` terisi apa pun → server membalas
      `ok:true` dengan ID palsu, **tanpa** baris baru muncul di Sheet dan tanpa email terkirim.
- [ ] Kirim GET ke `?action=list` → hanya kolom ID, Tanggal, Lokasi, Jenis, Status, Urgent
      yang muncul di response. Pastikan tidak ada nama pemohon, nama penerima, bank/rekening,
      nominal, keperluan, link dokumen, atau nomor WhatsApp di response.

## 7. Halaman Cek Status

- [ ] Buka `status.html`, data pengajuan yang baru dibuat muncul, terbaru di atas.
- [ ] Cari dengan ID pengajuan yang valid → hanya baris itu yang tampil.
- [ ] Filter berdasarkan Lokasi, Jenis, dan Status secara terpisah dan gabungan → hasil sesuai.
- [ ] Cari ID yang tidak ada → tampil pesan "Tidak ada pengajuan yang cocok...".
- [ ] Matikan koneksi internet lalu klik "Muat ulang" → muncul pesan error yang jelas,
      bukan halaman kosong atau macet di "Memuat data...".

## 8. Tampilan & responsif

- [ ] Uji di 390×844 (HP): tidak ada scroll horizontal pada halaman (hanya di dalam tabel),
      menu samping berubah jadi panel geser, tombol cukup besar untuk disentuh.
- [ ] Uji di 1366×650 dan 1920×940: layout rapi, konten tidak melebihi lebar maksimum.
- [ ] Ganti ke mode gelap (ikut sistem) → semua teks tetap terbaca, logo berubah ke versi putih.
- [ ] Navigasi keyboard (Tab) menampilkan cincin fokus yang terlihat pada semua input dan tombol.

## 9. Konfigurasi belum diisi (pengujian kegagalan yang jelas)

- [ ] Dengan `APPS_SCRIPT_URL` masih placeholder, buka `index.html` dan `status.html` →
      muncul pesan yang jelas bahwa portal belum terhubung, bukan error teknis mentah
      di konsol browser saja.
