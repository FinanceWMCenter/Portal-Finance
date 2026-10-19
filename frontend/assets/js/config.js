/**
 * Konfigurasi Portal Pengajuan Finance WM Center.
 *
 * SATU-SATUNYA hal yang perlu diubah di sini adalah URL Web App Apps Script
 * hasil deploy (lihat docs/SETUP.md langkah "Deploy Apps Script").
 *
 * Jangan taruh ID Sheet, ID folder Drive, atau alamat email apa pun di sini.
 * Berkas ini berjalan di browser siapa saja, jadi semua yang ditulis di sini
 * bersifat terbuka/publik.
 */
window.WM_CONFIG = {
  // Ganti dengan URL Web App Apps Script, contoh:
  // "https://script.google.com/macros/s/AKfycb.../exec"
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzf5V5ZxSzlr7SttK30Y9c8G_qdNsVZX2Y-wVDj_I4-2432Uo1WBObCqfRrIENIndZT0A/exec",

  // Ukuran maksimum per berkas unggahan (harus sama dengan batas di Code.gs).
  MAX_FILE_SIZE_MB: 5,

  // Jumlah baris maksimum yang ditampilkan di halaman Cek Status.
  MAX_STATUS_ROWS: 200,
};
