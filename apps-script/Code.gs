/**
 * Portal Pengajuan Finance WM Center — backend Apps Script.
 *
 * Deploy sebagai Web App:
 *   - Execute as: Me (akun pemilik Sheet & Drive)
 *   - Who has access: Anyone
 *
 * Lihat docs/SETUP.md untuk langkah lengkap.
 */

// ====================== KONFIGURASI (WAJIB DIISI) ======================

/** ID Google Sheet (database). Ambil dari URL Sheet: .../d/<ID_INI>/edit */
var SHEET_ID = "1tCXNM0LKcWKahEP6TUFEyduxXcXVn_zazggAkc_uCE0";

/** Nama tab berisi data pengajuan dan master data. */
var TAB_PENGAJUAN = "Pengajuan";
var TAB_MASTER = "Master";

/**
 * Nama folder root di Drive tempat semua dokumen pengajuan disimpan.
 * Folder ini (dan subfoldernya) dibuat otomatis jika belum ada, di folder
 * "My Drive" milik akun yang menjalankan script ini.
 */
var DRIVE_ROOT_FOLDER_NAME = "Pengajuan Finance";

/**
 * Alamat email Finance yang menerima notifikasi pengajuan baru.
 * GANTI dengan alamat distribusi Finance yang sesungguhnya sebelum go-live.
 * Boleh lebih dari satu, dipisah koma: "finance1@wmcenter.id,finance2@wmcenter.id"
 */
var FINANCE_EMAIL = "finance@wmcenter.id";

/** Batas ukuran per berkas (MB). Harus sama dengan MAX_FILE_SIZE_MB di config.js frontend. */
var MAX_FILE_SIZE_MB = 5;

/** Batas ukuran total payload JSON per permintaan (MB), jaga-jaga terhadap penyalahgunaan. */
var MAX_PAYLOAD_SIZE_MB = 30;

/** Lama cache (detik) untuk endpoint publik "list". */
var CACHE_TTL_SECONDS = 60;

// ====================== KOLOM TAB "Pengajuan" (urutan tetap) ======================
// Lihat docs/SHEET-TEMPLATE.md untuk penjelasan lengkap tiap kolom.
var COL = {
  ID: 1,
  TANGGAL: 2,
  TIPE_LOKASI: 3,
  CABANG: 4,
  DIVISI: 5,
  NAMA_PEMOHON: 6,
  NO_WHATSAPP: 7,
  JENIS_PENGAJUAN: 8,
  NOMINAL: 9,
  KEPERLUAN: 10,
  NAMA_PENERIMA: 11,
  BANK: 12,
  NO_REKENING: 13,
  LINK_DOKUMEN: 14,
  LINK_KTP_NPWP: 15,
  URGENT: 16,
  ALASAN_URGENT: 17,
  STATUS: 18,
  CATATAN_FINANCE: 19,
  TERAKHIR_DIUBAH: 20
};
var TOTAL_KOLOM = 20;

var TIPE_LOKASI_VALID = ["Cabang", "Head Office"];
var JENIS_PENGAJUAN_VALID = ["Barang", "Jasa", "Reimburse", "Lainnya"];
var BANK_VALID = ["BCA", "Mandiri", "BNI", "BRI", "BSI", "CIMB Niaga", "Permata", "Danamon", "OCBC", "Jago", "SeaBank", "Lainnya"];
var CABANG_VALID = ["Pemuda", "Bandung", "Kemang", "Cibubur", "Kebayoran", "BSD", "Surabaya", "Alam Sutera", "Puri", "Bekasi", "Sunter", "Tendean", "Depok"];
var DIVISI_VALID = ["Finance & Data Analisi", "HR-GA", "HR-PD", "HR-TA", "HR-EB", "Project Expense", "BD", "Brand Communication", "Creative", "Operasional", "Legal"];
var STATUS_DEFAULT = "Diajukan";

var ALLOWED_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf"
};

// ====================== ENTRY POINTS ======================

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || "list";
    if (action === "list") {
      return jsonOutput(handleList(e));
    }
    if (action === "master") {
      return jsonOutput(handleMaster());
    }
    return jsonOutput({ ok: false, message: "Aksi tidak dikenal." });
  } catch (err) {
    return jsonOutput({ ok: false, message: "Terjadi kesalahan: " + err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");

    // Anti-spam: honeypot. Jika terisi, balas sukses palsu tanpa menyimpan apa pun,
    // supaya bot otomatis tidak tahu bahwa permintaannya ditolak.
    if (body.website) {
      return jsonOutput({ ok: true, id: "PGJ-00000000-000" });
    }

    // Batas ukuran payload (jaga-jaga terhadap penyalahgunaan endpoint langsung).
    var approxSizeMb = (e.postData.contents || "").length / (1024 * 1024);
    if (approxSizeMb > MAX_PAYLOAD_SIZE_MB) {
      return jsonOutput({ ok: false, message: "Ukuran permintaan terlalu besar." });
    }

    var validation = validateSubmission(body);
    if (!validation.ok) {
      return jsonOutput({ ok: false, message: validation.message });
    }

    var result = saveSubmission(body);
    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ ok: false, message: "Terjadi kesalahan: " + err.message });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ====================== VALIDASI (server-side, duplikat dari frontend) ======================
// Wajib dijaga, karena endpoint ini bisa dipanggil langsung tanpa lewat form.

function validateSubmission(b) {
  function fail(msg) { return { ok: false, message: msg }; }

  if (TIPE_LOKASI_VALID.indexOf(b.tipeLokasi) === -1) return fail("Jenis lokasi tidak valid.");
  if (b.tipeLokasi === "Cabang" && CABANG_VALID.indexOf(b.cabang) === -1) return fail("Cabang tidak valid.");
  if (b.tipeLokasi === "Head Office" && DIVISI_VALID.indexOf(b.divisi) === -1) return fail("Divisi tidak valid.");

  if (!b.namaPemohon || !String(b.namaPemohon).trim()) return fail("Nama pemohon wajib diisi.");
  if (!b.noWhatsapp || !/^\d{9,15}$/.test(String(b.noWhatsapp))) return fail("Nomor WhatsApp tidak valid.");

  if (JENIS_PENGAJUAN_VALID.indexOf(b.jenisPengajuan) === -1) return fail("Jenis pengajuan tidak valid.");

  var nominal = Number(b.nominal);
  if (!nominal || isNaN(nominal) || nominal <= 0) return fail("Nominal tidak valid.");

  if (!b.keperluan || !String(b.keperluan).trim()) return fail("Keperluan wajib diisi.");
  if (!b.namaPenerima || !String(b.namaPenerima).trim()) return fail("Nama penerima wajib diisi.");
  if (BANK_VALID.indexOf(b.bank) === -1) return fail("Bank tidak valid.");
  if (!b.noRekening || !/^\d{4,30}$/.test(String(b.noRekening))) return fail("Nomor rekening tidak valid.");

  if (!b.dokumen || !Array.isArray(b.dokumen) || b.dokumen.length === 0) {
    return fail("Dokumen pendukung wajib dilampirkan.");
  }
  var fileCheck = validateFiles(b.dokumen);
  if (!fileCheck.ok) return fileCheck;

  if (b.jenisPengajuan === "Jasa") {
    if (!b.ktpNpwp || !b.ktpNpwp.base64) return fail("KTP/NPWP penerima wajib dilampirkan untuk jenis Jasa.");
    var ktpCheck = validateFiles([b.ktpNpwp]);
    if (!ktpCheck.ok) return ktpCheck;
  }

  if (b.isUrgent && (!b.alasanUrgent || !String(b.alasanUrgent).trim())) {
    return fail("Alasan urgent wajib diisi jika pengajuan ditandai urgent.");
  }

  return { ok: true };
}

function validateFiles(files) {
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!f || !f.base64 || !f.mimeType || !f.name) {
      return { ok: false, message: "Berkas tidak lengkap." };
    }
    if (!ALLOWED_MIME[f.mimeType]) {
      return { ok: false, message: "Berkas \"" + f.name + "\" harus berformat JPG, PNG, atau PDF." };
    }
    // base64 ~ 4/3 ukuran asli
    var approxBytes = f.base64.length * 0.75;
    if (approxBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, message: "Berkas \"" + f.name + "\" melebihi " + MAX_FILE_SIZE_MB + "MB." };
    }
  }
  return { ok: true };
}

// ====================== SIMPAN PENGAJUAN ======================

function saveSubmission(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_PENGAJUAN);
    var now = new Date();
    var id = generateNextId(sheet, now);

    var folder = getOrCreateMonthlyFolder(b.tipeLokasi, b.cabang, b.divisi, now);
    var dokumenLinks = b.dokumen.map(function (f) { return uploadFile(folder, f, id); });
    var ktpLink = b.jenisPengajuan === "Jasa" && b.ktpNpwp ? uploadFile(folder, b.ktpNpwp, id + "-KTP-NPWP") : "";

    var row = new Array(TOTAL_KOLOM).fill("");
    row[COL.ID - 1] = id;
    row[COL.TANGGAL - 1] = now;
    row[COL.TIPE_LOKASI - 1] = b.tipeLokasi;
    row[COL.CABANG - 1] = b.tipeLokasi === "Cabang" ? b.cabang : "";
    row[COL.DIVISI - 1] = b.tipeLokasi === "Head Office" ? b.divisi : "";
    row[COL.NAMA_PEMOHON - 1] = b.namaPemohon;
    row[COL.NO_WHATSAPP - 1] = b.noWhatsapp;
    row[COL.JENIS_PENGAJUAN - 1] = b.jenisPengajuan;
    row[COL.NOMINAL - 1] = Number(b.nominal);
    row[COL.KEPERLUAN - 1] = b.keperluan;
    row[COL.NAMA_PENERIMA - 1] = b.namaPenerima;
    row[COL.BANK - 1] = b.bank;
    row[COL.NO_REKENING - 1] = b.noRekening;
    row[COL.LINK_DOKUMEN - 1] = dokumenLinks.join(", ");
    row[COL.LINK_KTP_NPWP - 1] = ktpLink;
    row[COL.URGENT - 1] = !!b.isUrgent;
    row[COL.ALASAN_URGENT - 1] = b.isUrgent ? b.alasanUrgent : "";
    row[COL.STATUS - 1] = STATUS_DEFAULT;
    row[COL.CATATAN_FINANCE - 1] = "";
    row[COL.TERAKHIR_DIUBAH - 1] = now;

    sheet.appendRow(row);

    CacheService.getScriptCache().remove("wm_list_cache");

    sendNotificationEmail(id, b, folder);

    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Format ID: PGJ-YYYYMMDD-NNN, urut harian, aman dari race condition via LockService. */
function generateNextId(sheet, now) {
  var ymd = Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd");
  var prefix = "PGJ-" + ymd + "-";

  var lastRow = sheet.getLastRow();
  var seq = 0;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var val = String(ids[i][0] || "");
      if (val.indexOf(prefix) === 0) {
        var n = parseInt(val.slice(prefix.length), 10);
        if (!isNaN(n) && n > seq) seq = n;
      }
    }
  }
  var next = seq + 1;
  var padded = ("000" + next).slice(-3);
  return prefix + padded;
}

/** Folder: Pengajuan Finance/Cabang/{Cabang}/{YYYY-MM}/ atau Pengajuan Finance/Head Office/{Divisi}/{YYYY-MM}/ */
function getOrCreateMonthlyFolder(tipeLokasi, cabang, divisi, now) {
  var root = getOrCreateChildFolder(DriveApp, DRIVE_ROOT_FOLDER_NAME);
  var tipeFolder = getOrCreateChildFolder(root, tipeLokasi);
  var namaSub = tipeLokasi === "Cabang" ? cabang : divisi;
  var subFolder = getOrCreateChildFolder(tipeFolder, namaSub);
  var bulan = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM");
  return getOrCreateChildFolder(subFolder, bulan);
}

function getOrCreateChildFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function uploadFile(folder, fileObj, prefix) {
  var ext = ALLOWED_MIME[fileObj.mimeType] || "bin";
  var safeName = prefix + "_" + sanitizeFileName(fileObj.name);
  var blob = Utilities.newBlob(Utilities.base64Decode(fileObj.base64), fileObj.mimeType, safeName);
  var file = folder.createFile(blob);
  return file.getUrl();
}

function sanitizeFileName(name) {
  return String(name || "berkas").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80);
}

// ====================== NOTIFIKASI EMAIL ======================

function sendNotificationEmail(id, b, folder) {
  var lokasiLabel = b.tipeLokasi === "Cabang" ? ("Cabang " + b.cabang) : ("Head Office - " + b.divisi);
  var subjectPrefix = b.isUrgent ? "[URGENT] " : "";
  var subject = subjectPrefix + "Pengajuan baru " + id + " - " + lokasiLabel;

  var lines = [
    "Ada pengajuan baru masuk ke Portal Pengajuan Finance.",
    "",
    "ID Pengajuan : " + id,
    "Lokasi       : " + lokasiLabel,
    "Pemohon      : " + b.namaPemohon + " (WA: " + b.noWhatsapp + ")",
    "Jenis        : " + b.jenisPengajuan,
    "Nominal      : Rp " + formatRibuanServer(b.nominal),
    "Keperluan    : " + b.keperluan,
    "Penerima     : " + b.namaPenerima + " - " + b.bank + " " + b.noRekening,
    "Urgent       : " + (b.isUrgent ? "YA - " + b.alasanUrgent : "Tidak"),
    "",
    "Folder dokumen di Drive: " + folder.getUrl(),
    "",
    "Buka Google Sheet untuk melihat dan memproses detail lengkap pengajuan ini."
  ];

  MailApp.sendEmail({
    to: FINANCE_EMAIL,
    subject: subject,
    body: lines.join("\n")
  });
}

function formatRibuanServer(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

// ====================== ENDPOINT PUBLIK: LIST & MASTER ======================

/**
 * Hanya mengembalikan kolom yang aman untuk publik:
 * ID, tanggal, lokasi, jenis pengajuan, status, urgent.
 * TIDAK PERNAH mengembalikan: nama pemohon, nama penerima, bank/rekening,
 * nominal, keperluan, link dokumen, atau nomor WhatsApp.
 */
function handleList(e) {
  var limit = Math.min(parseInt((e.parameter && e.parameter.limit) || "200", 10) || 200, 200);

  var cache = CacheService.getScriptCache();
  var cached = cache.get("wm_list_cache");
  var rows;
  if (cached) {
    rows = JSON.parse(cached);
  } else {
    rows = readAllRowsForPublicList();
    cache.put("wm_list_cache", JSON.stringify(rows), CACHE_TTL_SECONDS);
  }

  rows = rows.slice(0, limit);
  return { ok: true, rows: rows };
}

function readAllRowsForPublicList() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_PENGAJUAN);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, TOTAL_KOLOM).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r[COL.ID - 1]) continue;
    var tipeLokasi = r[COL.TIPE_LOKASI - 1];
    var lokasi = tipeLokasi === "Cabang"
      ? ("Cabang - " + r[COL.CABANG - 1])
      : ("Head Office - " + r[COL.DIVISI - 1]);
    out.push({
      id: r[COL.ID - 1],
      tanggal: formatDateIso(r[COL.TANGGAL - 1]),
      lokasi: lokasi,
      jenisPengajuan: r[COL.JENIS_PENGAJUAN - 1],
      status: r[COL.STATUS - 1] || STATUS_DEFAULT,
      isUrgent: r[COL.URGENT - 1] === true
    });
  }
  // Terbaru dulu.
  out.sort(function (a, b) { return new Date(b.tanggal) - new Date(a.tanggal); });
  return out;
}

function formatDateIso(val) {
  if (val instanceof Date) return val.toISOString();
  return String(val || "");
}

function handleMaster() {
  return {
    ok: true,
    cabang: CABANG_VALID,
    divisi: DIVISI_VALID,
    jenisPengajuan: JENIS_PENGAJUAN_VALID,
    bank: BANK_VALID,
    status: ["Diajukan", "Diproses", "Perlu revisi", "Dibayar", "Ditolak"]
  };
}
