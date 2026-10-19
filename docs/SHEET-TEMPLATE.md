# Template Google Sheet — Portal Pengajuan Finance

Buat satu Google Sheet baru dengan dua tab: **Pengajuan** dan **Master**.
Nama tab harus persis sama (termasuk huruf besar/kecil) karena dirujuk langsung oleh `Code.gs`.

## Tab "Pengajuan"

Ini adalah database utama. Baris 1 = header. Jangan mengubah urutan kolom —
`Code.gs` membaca berdasarkan nomor kolom, bukan nama header.

| # | Header | Tipe | Diisi oleh | Keterangan |
|---|--------|------|-----------|------------|
| A | ID Pengajuan | Teks | Sistem | Format `PGJ-YYYYMMDD-NNN`, urut harian |
| B | Tanggal Pengajuan | Tanggal/jam | Sistem | Waktu submit, zona Asia/Jakarta |
| C | Tipe Lokasi | Teks | Sistem | `Cabang` atau `Head Office` |
| D | Cabang | Teks | Sistem | Terisi jika Tipe Lokasi = Cabang |
| E | Divisi | Teks | Sistem | Terisi jika Tipe Lokasi = Head Office |
| F | Nama Pemohon | Teks | Sistem | |
| G | No WhatsApp | Teks | Sistem | Hanya angka |
| H | Jenis Pengajuan | Teks | Sistem | `Barang` / `Jasa` / `Reimburse` / `Lainnya` |
| I | Nominal | Angka | Sistem | Dalam Rupiah, tanpa format |
| J | Keperluan | Teks | Sistem | |
| K | Nama Penerima | Teks | Sistem | |
| L | Bank | Teks | Sistem | |
| M | No Rekening | Teks | Sistem | |
| N | Link Dokumen | Teks | Sistem | URL Drive, dipisah koma jika lebih dari satu |
| O | Link KTP/NPWP | Teks | Sistem | Hanya terisi untuk jenis Jasa |
| P | Urgent | Boolean | Sistem | `TRUE` / `FALSE` |
| Q | Alasan Urgent | Teks | Sistem | Terisi jika Urgent = TRUE |
| R | Status | Teks | **Finance (manual)** | Dropdown, lihat di bawah |
| S | Catatan Finance | Teks | **Finance (manual)** | Catatan bebas, mis. alasan revisi/tolak |
| T | Terakhir Diubah | Tanggal/jam | Sistem (saat submit) + Finance (manual saat update) | |

Kolom A–Q dan T terisi otomatis oleh sistem saat submit — **jangan diedit manual**,
kecuali untuk memperbaiki kesalahan data secara darurat. Kolom R (Status) dan
S (Catatan Finance) adalah satu-satunya kolom yang rutin diubah manual oleh Finance.

### Dropdown kolom "Status" (R)

Buat validasi data (Data → Validasi data) pada kolom R, baris 2 ke bawah, dengan daftar:

```
Diajukan
Diproses
Perlu revisi
Dibayar
Ditolak
```

### Pemformatan bersyarat yang disarankan

1. **Baris urgent** — aturan pada rentang `A2:T`, kondisi "Rumus khusus":
   `=$P2=TRUE` → latar belakang kuning muda, supaya baris urgent menonjol.
2. **Status "Diajukan"** (belum disentuh Finance) — kondisi teks kolom R sama dengan `Diajukan`
   → latar abu-abu muda, sebagai pengingat belum diproses.
3. **Status "Perlu revisi"** — kondisi teks kolom R sama dengan `Perlu revisi` → latar merah muda.
4. **Status "Dibayar"** — kondisi teks kolom R sama dengan `Dibayar` → latar hijau muda.

### Mengunci kolom sistem (opsional, disarankan)

Lindungi rentang `A2:Q1000` (dan `T2:T1000`) melalui Data → Lindungi lembar dan rentang,
agar Finance tidak tidak sengaja menimpa data yang ditulis sistem. Biarkan kolom R dan S
tetap bisa diedit oleh siapa pun yang berhak memproses pengajuan.

## Tab "Master"

Tab ini bersifat referensi saja (belum dipakai langsung oleh `Code.gs` versi saat ini,
karena daftar cabang/divisi/bank sudah di-hardcode di frontend dan backend agar konsisten).
Simpan di sini sebagai dokumentasi hidup dan acuan bila daftar berubah di kemudian hari.

| A: Cabang | B: Divisi | C: Jenis Pengajuan | D: Bank |
|---|---|---|---|
| Pemuda | Finance & Data Analisi | Barang | BCA |
| Bandung | HR-GA | Jasa | Mandiri |
| Kemang | HR-PD | Reimburse | BNI |
| Cibubur | HR-TA | Lainnya | BRI |
| Kebayoran | HR-EB | | BSI |
| BSD | Project Expense | | CIMB Niaga |
| Surabaya | BD | | Permata |
| Alam Sutera | Brand Communication | | Danamon |
| Puri | Creative | | OCBC |
| Bekasi | Operasional | | Jago |
| Sunter | Legal | | SeaBank |
| Tendean | | | Lainnya |
| Depok | | | |

> Jika daftar cabang/divisi/bank berubah, perbarui tab ini **dan** daftar yang sama
> di `frontend/index.html` serta `apps-script/Code.gs` (variabel `CABANG_VALID`,
> `DIVISI_VALID`, `BANK_VALID`) agar ketiganya tetap konsisten.

## Setelah membuat Sheet

1. Catat **ID Sheet** dari URL-nya: `https://docs.google.com/spreadsheets/d/<ID_SHEET>/edit`.
2. Tempel ID itu ke variabel `SHEET_ID` di `apps-script/Code.gs`.
3. Lanjutkan ke `docs/SETUP.md`.
