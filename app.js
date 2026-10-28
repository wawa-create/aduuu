
/* TransferCheck — prototype front-end only. */
(() => {
  "use strict";
  const STORAGE_KEY = "transfercheck_history_v1";
  const $ = (id) => document.getElementById(id);
  let selectedFiles = [];
  let draftResults = [];
  let toastTimer = null;

  const BANKS = [
    "Bank Central Asia", "BCA", "Bank Rakyat Indonesia", "BRI",
    "Bank Negara Indonesia", "BNI", "Bank Mandiri", "Mandiri",
    "Bank Syariah Indonesia", "BSI", "CIMB Niaga", "PermataBank",
    "Bank Permata", "Danamon", "BTN", "Bank Tabungan Negara",
    "OCBC", "Maybank", "Bank Mega", "PaninBank", "Bank Jago",
    "SeaBank", "blu by BCA Digital", "Jago", "Neo Commerce"
  ];

  function loadHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveHistory(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    renderDashboard();
    renderHistory();
  }

  function uid() {
    return "tr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[c]);
  }

  function normalize(value) {
    return String(value ?? "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  }

  function cleanAmount(value) {
    const digits = String(value ?? "").replace(/[^\d]/g, "");
    return digits ? String(Number(digits)) : "";
  }

  function formatMoney(value) {
    const n = Number(cleanAmount(value));
    return n ? "Rp " + n.toLocaleString("id-ID") : (value || "—");
  }

  function formatDateTime(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("id-ID", {
        dateStyle:"medium",
        timeStyle:"short"
      });
    } catch {
      return value;
    }
  }

  function showToast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.add("hidden"), 3200);
  }

  function goTo(page) {
    document.querySelectorAll(".page").forEach(el =>
      el.classList.toggle("active", el.id === "page-" + page)
    );

    document.querySelectorAll(".nav-item").forEach(el =>
      el.classList.toggle("active", el.dataset.page === page)
    );

    const titles = {
      dashboard:"Dashboard",
      pemeriksaan:"Pemeriksaan bukti",
      riwayat:"Riwayat pemeriksaan",
      panduan:"Panduan penggunaan"
    };

    $("pageTitle").textContent = titles[page] || "Dashboard";

    if (page === "riwayat") renderHistory();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  document.querySelectorAll("[data-page]").forEach(btn =>
    btn.addEventListener("click", () => goTo(btn.dataset.page))
  );

  document.querySelectorAll("[data-goto]").forEach(btn =>
    btn.addEventListener("click", () => goTo(btn.dataset.goto))
  );

  function renderDashboard() {
    const rows = loadHistory();

    $("statTotal").textContent = rows.length;
    $("statStrong").textContent = rows.filter(r => r.statusKey === "strong").length;
    $("statMatch").textContent = rows.filter(r => r.statusKey === "match").length;
    $("statIncomplete").textContent = rows.filter(r => r.statusKey === "incomplete").length;

    const recent = rows.slice()
      .sort((a,b) => (b.savedAt || "").localeCompare(a.savedAt || ""))
      .slice(0,5);

    $("recentList").innerHTML = recent.length ? recent.map(r => `
      <div class="recent-item">
        <div class="file-icon">▤</div>
        <div>
          <strong title="${escapeHtml(r.fileName)}">${escapeHtml(r.fileName)}</strong>
          <small>${escapeHtml(formatDateTime(r.savedAt))} · ${escapeHtml(r.amount ? formatMoney(r.amount) : "Nominal belum terbaca")}</small>
        </div>
        ${statusBadge(r.statusKey)}
      </div>`).join("") :
      `<div class="empty-inline">Belum ada aktivitas. Mulai pemeriksaan untuk membuat catatan pertama.</div>`;
  }

  function statusBadge(key) {
    const labels = {
      strong:"Indikasi duplikasi kuat",
      match:"Data transaksi cocok",
      clear:"Tidak ditemukan kecocokan",
      incomplete:"Data belum lengkap"
    };

    return `<span class="status status-${key}">${labels[key] || "Data belum lengkap"}</span>`;
  }

  function updateFileList() {
    $("fileSummary").textContent = selectedFiles.length
      ? `${selectedFiles.length} gambar dipilih · ${(selectedFiles.reduce((s,f)=>s+f.size,0)/1024/1024).toFixed(1)} MB`
      : "Belum ada gambar dipilih.";

    $("startOcr").disabled = !selectedFiles.length;

    $("selectedFiles").innerHTML = selectedFiles.map((f,i) => `
      <div class="selected-file">
        <span>▧</span>
        <div style="min-width:0;flex:1">
          <strong title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</strong>
          <small>${(f.size/1024).toFixed(0)} KB</small>
        </div>
        <button class="text-btn" data-remove-file="${i}" aria-label="Hapus ${escapeHtml(f.name)}">×</button>
      </div>
    `).join("");

    document.querySelectorAll("[data-remove-file]").forEach(btn =>
      btn.addEventListener("click", () => {
        selectedFiles.splice(Number(btn.dataset.removeFile),1);
        updateFileList();
      })
    );
  }

  $("fileInput").addEventListener("change", e => {
    addFiles([...e.target.files]);
    e.target.value = "";
  });

  function addFiles(files) {
    const allowed = files.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
    const room = Math.max(0, 12 - selectedFiles.length);

    selectedFiles = selectedFiles.concat(allowed.slice(0, room));

    if (files.length > allowed.length) {
      showToast("Sebagian file dilewati karena formatnya bukan JPG, PNG, atau WebP.");
    }

    if (allowed.length > room) {
      showToast("Maksimal 12 gambar per batch.");
    }

    updateFileList();
  }

  const dropzone = $("dropzone");

  ["dragenter","dragover"].forEach(ev =>
    dropzone.addEventListener(ev, e => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );

  ["dragleave","drop"].forEach(ev =>
    dropzone.addEventListener(ev, e => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );

  dropzone.addEventListener("drop", e => addFiles([...e.dataTransfer.files]));

  function detectBank(text) {
    const lower = text.toLowerCase();
    const found = BANKS.filter(b => lower.includes(b.toLowerCase()));
    const unique = [...new Set(found.map(canonicalBank))];
    return unique;
  }

  function canonicalBank(name) {
    const n = normalize(name);

    const map = [
      [["bankcentralasia","bca"],"BCA"],
      [["bankrakyatindonesia","bri"],"BRI"],
      [["banknegarindonesia","bni"],"BNI"],
      [["bankmandiri","mandiri"],"Mandiri"],
      [["banksyariahindonesia","bsi"],"BSI"],
      [["cimbniaga"],"CIMB Niaga"],
      [["permatabank","bankpermata"],"PermataBank"],
      [["danamon"],"Danamon"],
      [["banktabungannegara","btn"],"BTN"],
      [["ocbc"],"OCBC"],
      [["maybank"],"Maybank"],
      [["bankmega"],"Bank Mega"],
      [["paninbank"],"PaninBank"],
      [["bankjago","jago"],"Bank Jago"],
      [["seabank"],"SeaBank"],
      [["blubycadigital"],"blu by BCA Digital"],
      [["neocommerce"],"Bank Neo Commerce"]
    ];

    for (const [aliases, label] of map) {
      if (aliases.includes(n)) return label;
    }

    return name;
  }

  function findLabeledValue(lines, patterns, opts={}) {
    for (let i=0; i<lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      for (const pattern of patterns) {
        const match = line.match(pattern);

        if (match) {
          let value = (match[1] || "")
            .trim()
            .replace(/^[\s:：#-]+/, "")
            .trim();

          if (value && !/^(no|nomor|number|id)$/i.test(value)) {
            return value.slice(0, opts.max || 100);
          }

          const next = lines[i+1]?.trim();

          if (
            next &&
            next.length < 100 &&
            !/^(tanggal|date|waktu|time|nominal|jumlah|amount|bank|referensi|reference)/i.test(next)
          ) {
            return next;
          }
        }
      }
    }

    return "";
  }
