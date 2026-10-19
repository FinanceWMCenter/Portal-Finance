/**
 * Portal Pengajuan Finance WM Center — logika halaman.
 * Berjalan di browser saja; tidak ada data rahasia di sini.
 */
(function () {
  "use strict";

  var CFG = window.WM_CONFIG || {};
  var MAX_FILE_MB = CFG.MAX_FILE_SIZE_MB || 5;
  var MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
  var ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf"];
  var ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

  // ---------- Util umum ----------

  function onlyDigits(str) {
    return (str || "").replace(/[^\d]/g, "");
  }

  function formatRibuan(digitStr) {
    if (!digitStr) return "";
    return digitStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function fileExt(name) {
    var m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  function isAllowedFile(file) {
    var ext = fileExt(file.name);
    if (ALLOWED_EXT.indexOf(ext) === -1) return false;
    // Tipe MIME browser kadang kosong untuk beberapa OS; andalkan ekstensi sebagai cek utama,
    // MIME sebagai pelengkap jika tersedia.
    if (file.type && ALLOWED_MIME.indexOf(file.type) === -1) return false;
    return true;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Gagal membaca berkas " + file.name)); };
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToBase64(dataUrl) {
    var idx = dataUrl.indexOf(",");
    return idx === -1 ? dataUrl : dataUrl.slice(idx + 1);
  }

  /**
   * Mengecilkan gambar besar di browser sebelum dikirim, supaya payload ke
   * Apps Script tidak terlalu besar. PDF tidak diproses di sini.
   */
  function compressImageIfNeeded(file) {
    if (!/^image\//.test(file.type) || file.size <= 900 * 1024) {
      return readFileAsDataUrl(file).then(function (dataUrl) {
        return { name: file.name, mimeType: file.type || "application/octet-stream", base64: dataUrlToBase64(dataUrl) };
      });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxDim = 1800;
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          var ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        var base64 = dataUrlToBase64(dataUrl);
        var newName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") + ".jpg";
        resolve({ name: newName, mimeType: "image/jpeg", base64: base64 });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        // Jika gagal dikompres, kirim apa adanya.
        readFileAsDataUrl(file).then(function (dataUrl) {
          resolve({ name: file.name, mimeType: file.type || "application/octet-stream", base64: dataUrlToBase64(dataUrl) });
        }, reject);
      };
      img.src = url;
    });
  }

  function formatTanggal(isoOrDate) {
    var d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (isNaN(d.getTime())) return String(isoOrDate || "-");
    var bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return d.getDate() + " " + bulan[d.getMonth()] + " " + d.getFullYear();
  }

  function setError(fieldId, message) {
    var el = document.getElementById("err-" + fieldId);
    var input = document.getElementById(fieldId);
    if (el) { el.textContent = message || ""; el.hidden = !message; }
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearAllErrors(form) {
    form.querySelectorAll(".wm-error").forEach(function (el) { el.hidden = true; el.textContent = ""; });
  }

  // ---------- Halaman: Ajukan Pengajuan (index.html) ----------

  function initFormPage() {
    var form = document.getElementById("pengajuanForm");
    if (!form) return;

    var tipeLokasi = document.getElementById("tipeLokasi");
    var fieldCabang = document.getElementById("field-cabang");
    var fieldDivisi = document.getElementById("field-divisi");
    var cabangSelect = document.getElementById("cabang");
    var divisiSelect = document.getElementById("divisi");

    var jenisPengajuan = document.getElementById("jenisPengajuan");
    var fieldKtpNpwp = document.getElementById("field-ktpNpwp");
    var ktpNpwpInput = document.getElementById("ktpNpwp");

    var isUrgent = document.getElementById("isUrgent");
    var fieldAlasanUrgent = document.getElementById("field-alasanUrgent");
    var alasanUrgent = document.getElementById("alasanUrgent");

    var nominal = document.getElementById("nominal");
    var noWhatsapp = document.getElementById("noWhatsapp");
    var noRekening = document.getElementById("noRekening");
    var dokumenInput = document.getElementById("dokumen");
    var fileList = document.getElementById("fileList");
    var ktpNpwpFileList = document.getElementById("ktpNpwpFileList");

    var formError = document.getElementById("formError");
    var formSuccess = document.getElementById("formSuccess");
    var submitBtn = document.getElementById("submitBtn");

    var resultModal = document.getElementById("resultModal");
    var resultId = document.getElementById("resultId");
    var closeResultModal = document.getElementById("closeResultModal");

    var dokumenFiles = [];   // File[]
    var ktpNpwpFile = null;  // File

    tipeLokasi.addEventListener("change", function () {
      var v = tipeLokasi.value;
      fieldCabang.hidden = v !== "Cabang";
      fieldDivisi.hidden = v !== "Head Office";
      if (v !== "Cabang") cabangSelect.value = "";
      if (v !== "Head Office") divisiSelect.value = "";
    });

    jenisPengajuan.addEventListener("change", function () {
      var isJasa = jenisPengajuan.value === "Jasa";
      fieldKtpNpwp.hidden = !isJasa;
      if (!isJasa) { ktpNpwpInput.value = ""; ktpNpwpFile = null; ktpNpwpFileList.innerHTML = ""; }
    });

    isUrgent.addEventListener("change", function () {
      fieldAlasanUrgent.hidden = !isUrgent.checked;
      if (!isUrgent.checked) alasanUrgent.value = "";
    });

    nominal.addEventListener("input", function () {
      var digits = onlyDigits(nominal.value);
      nominal.value = formatRibuan(digits);
    });
    noWhatsapp.addEventListener("input", function () {
      noWhatsapp.value = onlyDigits(noWhatsapp.value);
    });
    noRekening.addEventListener("input", function () {
      noRekening.value = onlyDigits(noRekening.value);
    });

    function renderFileChips(container, files, onRemove) {
      container.innerHTML = "";
      files.forEach(function (f, idx) {
        var chip = document.createElement("span");
        chip.className = "file-chip";
        var sizeKb = Math.round(f.size / 1024);
        chip.innerHTML = '<span>' + escapeHtml(f.name) + ' (' + sizeKb + ' KB)</span>';
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", "Hapus " + f.name);
        btn.innerHTML = "&times;";
        btn.addEventListener("click", function () { onRemove(idx); });
        chip.appendChild(btn);
        container.appendChild(chip);
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    dokumenInput.addEventListener("change", function () {
      var incoming = Array.prototype.slice.call(dokumenInput.files || []);
      dokumenFiles = dokumenFiles.concat(incoming);
      dokumenInput.value = "";
      renderFileChips(fileList, dokumenFiles, function (idx) {
        dokumenFiles.splice(idx, 1);
        renderFileChips(fileList, dokumenFiles, arguments.callee);
      });
      renderFileChips(fileList, dokumenFiles, removeDokumen);
    });
    function removeDokumen(idx) {
      dokumenFiles.splice(idx, 1);
      renderFileChips(fileList, dokumenFiles, removeDokumen);
    }

    ktpNpwpInput.addEventListener("change", function () {
      ktpNpwpFile = ktpNpwpInput.files && ktpNpwpInput.files[0] ? ktpNpwpInput.files[0] : null;
      ktpNpwpFileList.innerHTML = "";
      if (ktpNpwpFile) renderFileChips(ktpNpwpFileList, [ktpNpwpFile], function () {
        ktpNpwpFile = null; ktpNpwpInput.value = ""; ktpNpwpFileList.innerHTML = "";
      });
    });

    function validate() {
      clearAllErrors(form);
      var ok = true;
      function fail(id, msg) { setError(id, msg); ok = false; }

      if (!tipeLokasi.value) fail("tipeLokasi", "Pilih jenis lokasi.");
      if (tipeLokasi.value === "Cabang" && !cabangSelect.value) fail("cabang", "Pilih cabang.");
      if (tipeLokasi.value === "Head Office" && !divisiSelect.value) fail("divisi", "Pilih divisi.");

      var namaPemohon = document.getElementById("namaPemohon");
      if (!namaPemohon.value.trim()) fail("namaPemohon", "Nama pemohon wajib diisi.");

      var waDigits = onlyDigits(noWhatsapp.value);
      if (waDigits.length < 9) fail("noWhatsapp", "Nomor WhatsApp tidak valid.");

      if (!jenisPengajuan.value) fail("jenisPengajuan", "Pilih jenis pengajuan.");

      var nominalDigits = onlyDigits(nominal.value);
      if (!nominalDigits || Number(nominalDigits) <= 0) fail("nominal", "Nominal wajib diisi dan lebih dari 0.");

      var keperluan = document.getElementById("keperluan");
      if (!keperluan.value.trim()) fail("keperluan", "Keperluan wajib diisi.");

      var namaPenerima = document.getElementById("namaPenerima");
      if (!namaPenerima.value.trim()) fail("namaPenerima", "Nama penerima wajib diisi.");

      var bank = document.getElementById("bank");
      if (!bank.value) fail("bank", "Pilih bank.");

      var noRekeningDigits = onlyDigits(noRekening.value);
      if (!noRekeningDigits) fail("noRekening", "Nomor rekening wajib diisi.");

      if (dokumenFiles.length === 0) {
        fail("dokumen", "Lampirkan minimal satu dokumen pendukung.");
      } else {
        for (var i = 0; i < dokumenFiles.length; i++) {
          var f = dokumenFiles[i];
          if (f.size > MAX_FILE_BYTES) { fail("dokumen", "Berkas \"" + f.name + "\" melebihi " + MAX_FILE_MB + "MB."); break; }
          if (!isAllowedFile(f)) { fail("dokumen", "Berkas \"" + f.name + "\" harus berformat JPG, PNG, atau PDF."); break; }
        }
      }

      if (jenisPengajuan.value === "Jasa") {
        if (!ktpNpwpFile) {
          fail("ktpNpwp", "KTP/NPWP penerima wajib dilampirkan untuk jenis Jasa.");
        } else if (ktpNpwpFile.size > MAX_FILE_BYTES) {
          fail("ktpNpwp", "Berkas melebihi " + MAX_FILE_MB + "MB.");
        } else if (!isAllowedFile(ktpNpwpFile)) {
          fail("ktpNpwp", "Berkas harus berformat JPG, PNG, atau PDF.");
        }
      }

      if (isUrgent.checked && !alasanUrgent.value.trim()) {
        fail("alasanUrgent", "Jelaskan alasan urgent.");
      }

      return ok;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      formError.hidden = true;
      formSuccess.hidden = true;

      if (!CFG.APPS_SCRIPT_URL || CFG.APPS_SCRIPT_URL.indexOf("GANTI_DENGAN") === 0) {
        formError.textContent = "Portal belum terhubung ke Apps Script. Hubungi admin untuk mengisi config.js.";
        formError.hidden = false;
        return;
      }

      if (!validate()) {
        formError.textContent = "Periksa kembali isian yang ditandai merah di bawah.";
        formError.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Mengirim...";

      Promise.all(dokumenFiles.map(compressImageIfNeeded))
        .then(function (dokumenPayload) {
          var ktpPromise = ktpNpwpFile ? compressImageIfNeeded(ktpNpwpFile) : Promise.resolve(null);
          return ktpPromise.then(function (ktpPayload) {
            var payload = {
              website: document.getElementById("website").value, // honeypot
              tipeLokasi: tipeLokasi.value,
              cabang: cabangSelect.value,
              divisi: divisiSelect.value,
              namaPemohon: document.getElementById("namaPemohon").value.trim(),
              noWhatsapp: onlyDigits(noWhatsapp.value),
              jenisPengajuan: jenisPengajuan.value,
              nominal: Number(onlyDigits(nominal.value)),
              keperluan: document.getElementById("keperluan").value.trim(),
              namaPenerima: document.getElementById("namaPenerima").value.trim(),
              bank: document.getElementById("bank").value,
              noRekening: onlyDigits(noRekening.value),
              isUrgent: !!isUrgent.checked,
              alasanUrgent: isUrgent.checked ? alasanUrgent.value.trim() : "",
              dokumen: dokumenPayload,
              ktpNpwp: ktpPayload
            };
            return fetch(CFG.APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify(payload)
            });
          });
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Kirim pengajuan";
          if (data && data.ok) {
            resultId.textContent = data.id || "-";
            resultModal.hidden = false;
            form.reset();
            dokumenFiles = []; ktpNpwpFile = null;
            fileList.innerHTML = ""; ktpNpwpFileList.innerHTML = "";
            fieldCabang.hidden = true; fieldDivisi.hidden = true;
            fieldKtpNpwp.hidden = true; fieldAlasanUrgent.hidden = true;
          } else {
            formError.textContent = (data && data.message) || "Pengajuan gagal dikirim. Coba lagi.";
            formError.hidden = false;
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Kirim pengajuan";
          formError.textContent = "Tidak dapat menghubungi server. Periksa koneksi internet Anda dan coba lagi.";
          formError.hidden = false;
        });
    });

    closeResultModal.addEventListener("click", function () { resultModal.hidden = true; });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !resultModal.hidden) resultModal.hidden = true;
    });
  }

  // ---------- Halaman: Cek Status (status.html) ----------

  function initStatusPage() {
    var tbody = document.getElementById("statusTbody");
    if (!tbody) return;

    var cariId = document.getElementById("cariId");
    var filterLokasi = document.getElementById("filterLokasi");
    var filterJenis = document.getElementById("filterJenis");
    var filterStatus = document.getElementById("filterStatus");
    var tableWrap = document.getElementById("tableWrap");
    var emptyState = document.getElementById("emptyState");
    var loadingFlash = document.getElementById("loadingFlash");
    var statusError = document.getElementById("statusError");
    var refreshBtn = document.getElementById("refreshBtn");
    var tableFooter = document.getElementById("tableFooter");
    var rowCountInfo = document.getElementById("rowCountInfo");

    var allRows = [];

    function badgeClass(status) {
      switch (status) {
        case "Dibayar": return "is-good";
        case "Diproses": return "is-primary";
        case "Perlu revisi": return "is-warning";
        case "Ditolak": return "is-critical";
        default: return "";
      }
    }

    function render() {
      var q = (cariId.value || "").trim().toLowerCase();
      var lok = filterLokasi.value;
      var jenis = filterJenis.value;
      var stat = filterStatus.value;

      var rows = allRows.filter(function (r) {
        if (q && String(r.id || "").toLowerCase().indexOf(q) === -1) return false;
        if (lok && r.lokasi !== lok) return false;
        if (jenis && r.jenisPengajuan !== jenis) return false;
        if (stat && r.status !== stat) return false;
        return true;
      });

      tbody.innerHTML = "";
      if (rows.length === 0) {
        tableWrap.hidden = true;
        emptyState.hidden = false;
        tableFooter.hidden = true;
        return;
      }
      emptyState.hidden = true;
      tableWrap.hidden = false;
      tableFooter.hidden = false;

      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="wm-mono">' + escapeHtml(r.id) + '</td>' +
          '<td>' + escapeHtml(formatTanggal(r.tanggal)) + '</td>' +
          '<td class="cell-start">' + escapeHtml(r.lokasi) + '</td>' +
          '<td>' + escapeHtml(r.jenisPengajuan) + '</td>' +
          '<td><span class="wm-badge ' + badgeClass(r.status) + '">' + escapeHtml(r.status) + '</span></td>' +
          '<td>' + (r.isUrgent ? '<span class="wm-badge is-critical">Urgent</span>' : '<span class="wm-hint">-</span>') + '</td>';
        tbody.appendChild(tr);
      });

      rowCountInfo.textContent = "Menampilkan " + rows.length + " dari " + allRows.length + " pengajuan.";
    }

    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function populateLokasiFilter(rows) {
      var set = {};
      rows.forEach(function (r) { if (r.lokasi) set[r.lokasi] = true; });
      var values = Object.keys(set).sort();
      filterLokasi.innerHTML = '<option value="">Semua lokasi</option>';
      values.forEach(function (v) {
        var opt = document.createElement("option");
        opt.value = v; opt.textContent = v;
        filterLokasi.appendChild(opt);
      });
    }

    function load() {
      statusError.hidden = true;
      loadingFlash.hidden = false;
      tableWrap.hidden = true;
      emptyState.hidden = true;
      tableFooter.hidden = true;

      if (!CFG.APPS_SCRIPT_URL || CFG.APPS_SCRIPT_URL.indexOf("GANTI_DENGAN") === 0) {
        loadingFlash.hidden = true;
        statusError.textContent = "Portal belum terhubung ke Apps Script. Hubungi admin untuk mengisi config.js.";
        statusError.hidden = false;
        return;
      }

      var url = CFG.APPS_SCRIPT_URL + "?action=list&limit=" + (CFG.MAX_STATUS_ROWS || 200);
      fetch(url, { method: "GET" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          loadingFlash.hidden = true;
          if (!data || !data.ok) {
            statusError.textContent = (data && data.message) || "Gagal memuat data pengajuan.";
            statusError.hidden = false;
            return;
          }
          allRows = data.rows || [];
          populateLokasiFilter(allRows);
          render();
        })
        .catch(function () {
          loadingFlash.hidden = true;
          statusError.textContent = "Tidak dapat menghubungi server. Periksa koneksi internet Anda dan coba lagi.";
          statusError.hidden = false;
        });
    }

    cariId.addEventListener("input", render);
    filterLokasi.addEventListener("change", render);
    filterJenis.addEventListener("change", render);
    filterStatus.addEventListener("change", render);
    refreshBtn.addEventListener("click", load);

    load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initFormPage();
    initStatusPage();
  });
})();
