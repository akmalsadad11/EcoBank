/* =========================================================
   BANK SAMPAH DIGITAL - script.js
   Dipakai bersama oleh index, auth, setor, dan reward
   ========================================================= */

const urlDashboard = "index.html";
const urlAuth = "auth.html";
const POIN_AWAL = 2450;

/* ---------- Penyimpanan poin (localStorage, aman jika diblokir) ---------- */

function getPoin() {
    try {
        const v = parseInt(localStorage.getItem("bsd_poin"), 10);
        return Number.isNaN(v) ? POIN_AWAL : v;
    } catch (e) { return POIN_AWAL; }
}

function setPoin(n) {
    try { localStorage.setItem("bsd_poin", String(n)); } catch (e) { /* abaikan */ }
}

const fmt = (n) => n.toLocaleString("id-ID");

// Perbarui semua tampilan poin dan status tombol tukar di halaman
function refreshPoin() {
    const poin = getPoin();
    document.querySelectorAll("[data-poin]").forEach((el) => { el.textContent = fmt(poin); });

    document.querySelectorAll("[data-cost]").forEach((card) => {
        const cost = Number(card.dataset.cost);
        const btn = card.querySelector("button");
        const need = card.querySelector(".reward-need");
        const locked = poin < cost;
        card.classList.toggle("is-locked", locked);
        if (btn) btn.disabled = locked;
        if (need) need.textContent = locked ? "Kurang " + fmt(cost - poin) + " poin" : "";
    });
}

/* ---------- Toast ---------- */

function showToast(message, type = "success") {
    let wrap = document.getElementById("toastWrap");
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "toastWrap";
        wrap.className = "toast-wrap";
        wrap.setAttribute("aria-live", "polite");
        document.body.appendChild(wrap);
    }
    const icons = { success: "bi-check-circle-fill", error: "bi-x-circle-fill", info: "bi-info-circle-fill" };
    const toast = document.createElement("div");
    toast.className = "toast-item toast-" + type;
    toast.innerHTML = '<i class="bi ' + (icons[type] || icons.success) + '"></i><span></span>';
    toast.lastElementChild.textContent = message;
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function toastThenGo(message, url, type = "success") {
    showToast(message, type);
    setTimeout(() => { window.location.href = url; }, 1400);
}

/* ---------- Validasi form ---------- */

function validateForm(form) {
    if (form.checkValidity()) return true;
    form.classList.add("was-validated");
    const first = form.querySelector(":invalid");
    if (first) first.focus();
    return false;
}

/* ---------- Fungsi global (dipanggil dari onclick di reward.html) ---------- */

function tukarPoin(poinDibutuhkan, namaReward) {
    const poinSekarang = getPoin();
    if (poinSekarang >= poinDibutuhkan) {
        setPoin(poinSekarang - poinDibutuhkan);
        refreshPoin();
        showToast("Berhasil menukar " + fmt(poinDibutuhkan) + " poin dengan " + namaReward + ". Hadiah akan segera diproses.");
    } else {
        showToast("Poin Anda tidak cukup untuk menukar " + namaReward + ".", "error");
    }
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", function () {

    refreshPoin();

    /* ===== Form setor / jemput sampah ===== */
    const formSetor = document.getElementById("formSetorSampah");
    if (formSetor) {
        // Tanggal minimal: hari ini
        const tgl = formSetor.querySelector("[data-min-today]");
        if (tgl) {
            const d = new Date();
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            tgl.min = d.toISOString().slice(0, 10);
        }

        formSetor.addEventListener("submit", function (e) {
            e.preventDefault();
            const dipilih = formSetor.querySelectorAll('input[name="jenis"]:checked').length;
            const err = document.getElementById("jenisError");
            if (err) err.hidden = dipilih > 0;
            const formOk = validateForm(formSetor);
            if (!dipilih) {
                if (formOk) document.getElementById("j1").focus();
                return;
            }
            if (!formOk) return;
            toastThenGo("Permintaan penjemputan terkirim ke petugas.", urlDashboard);
        });

        formSetor.querySelectorAll('input[name="jenis"]').forEach(function (cb) {
            cb.addEventListener("change", function () {
                const err = document.getElementById("jenisError");
                if (err && formSetor.querySelector('input[name="jenis"]:checked')) err.hidden = true;
            });
        });
    }

    /* ===== Halaman auth ===== */

    // Pindah tab lewat tautan teks
    document.querySelectorAll("[data-switch-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const tab = document.querySelector(btn.dataset.switchTab);
            if (tab && window.bootstrap) bootstrap.Tab.getOrCreateInstance(tab).show();
        });
    });

    // Tampilkan / sembunyikan kata sandi
    document.querySelectorAll("[data-toggle-pass]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const input = document.querySelector(btn.dataset.togglePass);
            if (!input) return;
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            btn.setAttribute("aria-label", show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
            btn.firstElementChild.className = show ? "bi bi-eye-slash" : "bi bi-eye";
        });
    });

    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!validateForm(formLogin)) return;
            toastThenGo("Berhasil masuk. Selamat datang kembali.", urlDashboard);
        });
    }

    const forgot = document.getElementById("forgotPass");
    if (forgot) {
        forgot.addEventListener("click", function () {
            showToast("Fitur atur ulang kata sandi belum tersedia.", "info");
        });
    }

    const google = document.getElementById("btnGoogle");
    if (google) {
        google.addEventListener("click", function () {
            showToast("Login Google masih simulasi dan belum terhubung.", "info");
        });
    }

    const formRegister = document.getElementById("formRegister");
    if (formRegister) {
        const pass = document.getElementById("regPass");
        const pass2 = document.getElementById("regPass2");
        const cekSama = function () {
            pass2.setCustomValidity(pass2.value && pass2.value !== pass.value ? "Kata sandi tidak sama" : "");
        };
        pass.addEventListener("input", cekSama);
        pass2.addEventListener("input", cekSama);

        formRegister.addEventListener("submit", function (e) {
            e.preventDefault();
            cekSama();
            if (!validateForm(formRegister)) return;

            const telp = document.getElementById("regTelp").value;
            showToast("Pendaftaran berhasil. Silakan masuk dengan akun baru Anda.");
            formRegister.reset();
            formRegister.classList.remove("was-validated");

            // Sudah di halaman auth: pindah ke tab Masuk dan isi nomor telepon
            const loginTab = document.getElementById("login-tab");
            if (loginTab && window.bootstrap) {
                bootstrap.Tab.getOrCreateInstance(loginTab).show();
                const id = document.getElementById("loginId");
                if (id) { id.value = telp; document.getElementById("loginPass").focus(); }
            } else {
                setTimeout(function () { window.location.href = urlAuth; }, 1400);
            }
        });
    }

    /* ===== Dashboard ===== */

    // Inisial avatar otomatis dari nama
    document.querySelectorAll("[data-initials-from]").forEach(function (el) {
        const parts = el.dataset.initialsFrom.trim().split(/\s+/);
        el.textContent = (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
    });

    // Sembunyikan / tampilkan saldo
    const saldo = document.getElementById("saldo");
    const toggle = document.getElementById("toggleSaldo");
    if (saldo && toggle) {
        toggle.addEventListener("click", function () {
            const hidden = toggle.getAttribute("aria-pressed") === "true";
            toggle.setAttribute("aria-pressed", String(!hidden));
            toggle.setAttribute("aria-label", hidden ? "Sembunyikan saldo" : "Tampilkan saldo");
            toggle.firstElementChild.className = hidden ? "bi bi-eye" : "bi bi-eye-slash";
            saldo.textContent = hidden ? saldo.dataset.value : "Rp ••••••";
        });
    }

    // Tandai notifikasi dibaca
    const dot = document.getElementById("notifDot");
    const markRead = document.getElementById("markRead");
    if (markRead) {
        markRead.addEventListener("click", function () {
            document.querySelectorAll(".notif-item.unread").forEach(function (i) { i.classList.remove("unread"); });
            if (dot) dot.style.display = "none";
        });
    }
});