/* =====================================================
   CARDIFY
   SISTEM INVENTARIS
===================================================== */


/* =====================================================
   DEFAULT DATA
===================================================== */

const defaultBarang = [];


/* =====================================================
   DEFAULT ACCOUNT
===================================================== */

const defaultAccounts = [
    {
        id: 1,
        nama: "Admin Toko",
        username: "Admin",
        password: "25283",
        role: "Administrator"
    }
];


/* =====================================================
   LOCAL STORAGE
===================================================== */

let accounts = JSON.parse(
    localStorage.getItem("inventarisAccounts")
) || defaultAccounts;

let barang = JSON.parse(
    localStorage.getItem("inventarisToko")
) || defaultBarang;

let history = JSON.parse(
    localStorage.getItem("inventarisHistory")
) || [];

/* Transaksi stok: hanya menyimpan perubahan, bukan mengulang master barang. */
let stockTransactions = JSON.parse(
    localStorage.getItem("cardifyStockTransactions")
) || [];

let accountHistory = JSON.parse(
    localStorage.getItem("accountHistory")
) || [];

let currentAccount = null;
let selectedImage = "";


/* =====================================================
   SIMPAN AKUN DEFAULT
===================================================== */

if (!localStorage.getItem("inventarisAccounts")) {
    localStorage.setItem(
        "inventarisAccounts",
        JSON.stringify(defaultAccounts)
    );
}


/* =====================================================
   MIGRASI DATA BARANG
===================================================== */

barang = barang.map(item => ({
    ...item,

    id: item.id || Date.now(),

    kode:
        item.kode ||
        `BRG${String(item.id || Date.now()).slice(-5)}`,

    nama:
        item.nama || "",

    kategori:
        item.kategori || "",

    harga:
        Number(item.harga || 0),

    stok:
        Number(item.stok || 0),

    satuan:
        item.satuan || "unit",

    supplier:
        item.supplier || "",

    kondisi:
        item.kondisi || "Baik",

    lokasi:
        item.lokasi || "",

    tanggalMasuk:
        item.tanggalMasuk || "",

    gambar:
        item.gambar || ""
}));



/* =====================================================
   GOOGLE SHEETS SYNC
===================================================== */
const GOOGLE_SHEETS_CONFIG = window.CARDIFY_GOOGLE_SHEETS_CONFIG || {
    url: "",
    token: ""
};
let googleSyncTimer = null;
let googleSyncBusy = false;
let googleSyncPending = false;

function isGoogleSheetsConfigured() {
    return Boolean(GOOGLE_SHEETS_CONFIG.url && !GOOGLE_SHEETS_CONFIG.url.includes("PASTE_YOUR") && GOOGLE_SHEETS_CONFIG.token);
}

function showSyncStatus(message, type = "info") {
    const el = document.getElementById("googleSyncStatus");
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
}

async function googleSheetsRequest(action, extra = {}) {
    if (!isGoogleSheetsConfigured()) return { ok: false, skipped: true };
    const payload = {
        action,
        token: GOOGLE_SHEETS_CONFIG.token,
        ...extra
    };
    const response = await fetch(GOOGLE_SHEETS_CONFIG.url, {
        method: "POST",
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

async function loadFromGoogleSheets(showToast = false) {
    if (!isGoogleSheetsConfigured()) {
        showSyncStatus("Mode lokal — Google Sheets belum dikonfigurasi", "warning");
        return false;
    }
    try {
        showSyncStatus("Mengambil data dari Google Sheets…", "loading");
        const data = await googleSheetsRequest("load");
        if (Array.isArray(data.barang)) {
            barang = data.barang.map(item => ({
                ...item,
                id: item.id || Date.now() + Math.random(),
                harga: Number(item.harga || 0),
                stok: Number(item.stok || 0)
            }));
            localStorage.setItem("inventarisToko", JSON.stringify(barang));
        }
        if (Array.isArray(data.stockTransactions)) {
            stockTransactions = data.stockTransactions;
            localStorage.setItem("cardifyStockTransactions", JSON.stringify(stockTransactions));
        }
        if (Array.isArray(data.history)) {
            history = data.history;
            localStorage.setItem("inventarisHistory", JSON.stringify(history));
        }
        renderAll();
        renderTransactionBarangOptions();
        updateTransactionPreview();
        showSyncStatus(`Tersinkron • ${new Date().toLocaleTimeString("id-ID")}`, "success");
        if (showToast) showCardifyToast("Google Sheets", "Data berhasil disinkronkan.", "success");
        return true;
    } catch (error) {
        console.error("Google Sheets load error:", error);
        showSyncStatus("Gagal sinkron — data lokal tetap dipakai", "error");
        if (showToast) showCardifyToast("Sinkronisasi Gagal", error.message, "error");
        return false;
    }
}

function scheduleGoogleSheetsSync() {
    if (!isGoogleSheetsConfigured()) return;
    clearTimeout(googleSyncTimer);
    googleSyncPending = true;
    googleSyncTimer = setTimeout(syncToGoogleSheets, 350);
}

async function syncToGoogleSheets() {
    if (!isGoogleSheetsConfigured()) return;
    if (googleSyncBusy) return;
    googleSyncBusy = true;
    googleSyncPending = false;
    try {
        showSyncStatus("Menyimpan ke Google Sheets…", "loading");
        await googleSheetsRequest("sync", {
            barang,
            stockTransactions,
            history
        });
        showSyncStatus(`Tersimpan • ${new Date().toLocaleTimeString("id-ID")}`, "success");
    } catch (error) {
        console.error("Google Sheets sync error:", error);
        showSyncStatus("Gagal menyimpan ke Google Sheets", "error");
        showCardifyToast("Google Sheets", `Sinkronisasi gagal: ${error.message}`, "error");
    } finally {
        googleSyncBusy = false;
        if (googleSyncPending) scheduleGoogleSheetsSync();
    }
}

async function manualGoogleSheetsSync() {
    if (!isGoogleSheetsConfigured()) {
        showCardifyToast("Belum Terhubung", "Isi URL Web App dan token di google-sheets-config.js terlebih dahulu.", "warning");
        return;
    }
    await syncToGoogleSheets();
    await loadFromGoogleSheets(true);
}

/* =====================================================
   ELEMENT
===================================================== */

const splashScreen =
    document.getElementById("splashScreen");

const loginPage =
    document.getElementById("loginPage");

const app =
    document.getElementById("app");

const sidebar =
    document.getElementById("sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const menuToggle =
    document.getElementById("menuToggle");

const loginForm =
    document.getElementById("loginForm");

const usernameInput =
    document.getElementById("username");

const passwordInput =
    document.getElementById("password");

const showPassword =
    document.getElementById("showPassword");

const loginMessage =
    document.getElementById("loginMessage");

const barangModal =
    document.getElementById("barangModal");

const barangForm =
    document.getElementById("barangForm");

const addBarangBtn =
    document.getElementById("addBarangBtn");

const registerModal =
    document.getElementById("registerModal");

const registerForm =
    document.getElementById("registerForm");

const openRegisterBtn =
    document.getElementById("openRegisterBtn");

const logoutBtn =
    document.getElementById("logoutBtn");


/* =====================================================
   SPLASH SCREEN
===================================================== */

window.addEventListener("load", () => {

    const progress =
        document.getElementById("loadingProgress");

    const percent =
        document.getElementById("loadingPercent");

    let value = 0;

    const loading = setInterval(() => {

        value++;

        if (progress) {
            progress.style.width = `${value}%`;
        }

        if (percent) {
            percent.textContent = `${value}%`;
        }

        if (value >= 100) {

            clearInterval(loading);

            setTimeout(() => {

                if (splashScreen) {
                    splashScreen.classList.add("hidden");
                }

                checkLogin();

            }, 400);
        }

    }, 20);

});

/* =====================================================
   REGISTER ACCOUNT
===================================================== */

function openRegisterModal() {

    const modal =
        document.getElementById("registerModal");

    const form =
        document.getElementById("registerForm");

    const message =
        document.getElementById("registerMessage");

    if (!modal) {
        console.error("registerModal tidak ditemukan");
        return;
    }

    if (form) {
        form.reset();
    }

    if (message) {
        message.textContent = "";
    }

    modal.classList.remove("hidden");
}


/* TOMBOL BUAT AKUN BARU */

document.addEventListener(
    "click",
    function (event) {

        const button =
            event.target.closest("#openRegisterBtn");

        if (!button) return;

        event.preventDefault();

        openRegisterModal();

    }
);

/* =====================================================
   CHECK LOGIN
===================================================== */

function checkLogin() {

    const savedUsername =
        localStorage.getItem("inventarisUser");

    if (!savedUsername) {
        showLogin();
        return;
    }

    const savedAccount =
        accounts.find(
            account =>
                account.username.toLowerCase() ===
                savedUsername.toLowerCase()
        );

    if (savedAccount) {

        currentAccount = savedAccount;

        showApp();

    } else {

        localStorage.removeItem("inventarisUser");

        showLogin();
    }
}


/* =====================================================
   SHOW LOGIN
===================================================== */

function showLogin() {

    if (loginPage) {
        loginPage.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }
}


/* =====================================================
   SHOW APP
===================================================== */

function showApp() {

    if (loginPage) {
        loginPage.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }

    updateUserInfo();

    renderAll();
    if (isGoogleSheetsConfigured()) {
        loadFromGoogleSheets(false);
    } else {
        showSyncStatus("Mode lokal — Google Sheets belum dikonfigurasi", "warning");
    }

    navigate("dashboard");
}


/* =====================================================
   LOGIN
===================================================== */

if (loginForm) {

    loginForm.addEventListener("submit", event => {

        event.preventDefault();

        const username =
            usernameInput.value.trim();

        const password =
            passwordInput.value;

        const account =
            accounts.find(
                item =>
                    item.username.toLowerCase() ===
                        username.toLowerCase() &&
                    item.password === password
            );

        if (!account) {

            if (loginMessage) {
                loginMessage.textContent =
                    "Username atau password salah.";
            }

            return;
        }

        currentAccount = account;

        localStorage.setItem(
            "inventarisUser",
            account.username
        );

        addAccountHistory(
            `${account.username} berhasil masuk ke sistem`
        );

        if (loginMessage) {
            loginMessage.textContent = "";
        }

        showApp();
    });
}


/* =====================================================
   SHOW / HIDE PASSWORD
===================================================== */

if (showPassword) {

    showPassword.addEventListener("click", () => {

        if (!passwordInput) return;

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            showPassword.innerHTML =
                '<i class="fa-solid fa-eye-slash"></i>';

        } else {

            passwordInput.type = "password";

            showPassword.innerHTML =
                '<i class="fa-solid fa-eye"></i>';
        }
    });
}


/* =====================================================
   SIDEBAR
===================================================== */

if (menuToggle) {
    menuToggle.addEventListener(
        "click",
        openSidebar
    );
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}

function openSidebar() {

    if (sidebar) {
        sidebar.classList.add("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("show");
    }
}

function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
    }
}


/* =====================================================
   NAVIGATION
===================================================== */

document
    .querySelectorAll(".menu-item")
    .forEach(button => {

        button.addEventListener("click", () => {

            const page =
                button.dataset.page;

            navigate(page);
        });
    });


document
    .querySelectorAll("[data-page-target]")
    .forEach(button => {

        button.addEventListener("click", () => {

            navigate(
                button.dataset.pageTarget
            );
        });
    });


function navigate(page) {

    document
        .querySelectorAll(".page")
        .forEach(section => {
            section.classList.remove("active");
        });


    const target =
        document.getElementById(
            `page-${page}`
        );


    if (target) {
        target.classList.add("active");
    }


    document
        .querySelectorAll(".menu-item")
        .forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.page === page
            );
        });


    const titles = {
        dashboard: "Dashboard",
        inventaris: "Inventaris",
        riwayat: "Riwayat",
        profile: "Profile",
        histori: "Histori Akun",
        transaksi: "Transaksi Stok"
    };


    const pageTitle =
        document.getElementById("pageTitle");


    if (pageTitle) {
        pageTitle.textContent =
            titles[page] || "Dashboard";
    }


    closeSidebar();
}


/* =====================================================
   UPDATE USER INFORMATION
===================================================== */

function updateUserInfo() {

    if (!currentAccount) return;


    const sidebarUsername =
        document.getElementById(
            "sidebarUsername"
        );

    const sidebarRole =
        document.getElementById(
            "sidebarRole"
        );

    const topUsername =
        document.getElementById(
            "topUsername"
        );

    const welcomeUsername =
        document.getElementById(
            "welcomeUsername"
        );

    const profileName =
        document.getElementById(
            "profileName"
        );

    const profileUsername =
        document.getElementById(
            "profileUsername"
        );

    const profileRole =
        document.getElementById(
            "profileRole"
        );
  loadProfileImage();


    /* SIDEBAR */

    if (sidebarUsername) {
        sidebarUsername.textContent =
            currentAccount.username;
    }


    if (sidebarRole) {
        sidebarRole.textContent =
            currentAccount.role;
    }


    /* TOPBAR */

    if (topUsername) {
        topUsername.textContent =
            currentAccount.username;
    }


    /* DASHBOARD */

    if (welcomeUsername) {
        welcomeUsername.textContent =
            currentAccount.nama;
    }


    /* PROFILE */

    if (profileName) {
        profileName.textContent =
            currentAccount.nama;
    }


    if (profileUsername) {
        profileUsername.textContent =
            currentAccount.username;
    }


    if (profileRole) {
        profileRole.textContent =
            currentAccount.role;
    }
  renderProfilePage();
}

/* =====================================================
   PROFILE IMAGE
===================================================== */

const profileImageInput =
    document.getElementById("profileImageInput");

const profileAvatar =
    document.getElementById("profileAvatar");


/* =====================================================
   UPLOAD FOTO PROFILE
===================================================== */

if (profileImageInput) {

    profileImageInput.addEventListener(
        "change",
        function () {

            const file = this.files[0];

            if (!file) return;


            /* Maksimal 2 MB */

          if (file.size > 2 * 1024 * 1024) {

    showCardifyToast(
        "Foto Terlalu Besar",
        "Ukuran foto maksimal 2 MB.",
        "warning"
    );

    this.value = "";

    return;
}

            /* Pastikan file gambar */

            if (!file.type.startsWith("image/")) {

    showCardifyToast(
        "File Tidak Valid",
        "File yang dipilih harus berupa gambar.",
        "error"
    );

    this.value = "";

    return;
}

            const reader =
                new FileReader();


            reader.onload = function (event) {

                const image =
                    event.target.result;


                /* Simpan ke akun yang sedang login */

                if (currentAccount) {

                    currentAccount.profileImage =
                        image;


                    const accountIndex =
                        accounts.findIndex(
                            account =>
                                account.id ===
                                currentAccount.id
                        );


                    if (accountIndex !== -1) {

                        accounts[accountIndex] =
                            currentAccount;

                    }


                    localStorage.setItem(
                        "inventarisAccounts",
                        JSON.stringify(accounts)
                    );

                }

                /* Tampilkan foto */

                updateProfileImage(image);

            };


            reader.readAsDataURL(file);

        }
      );
}

/* =====================================================
   UPDATE SEMUA FOTO PROFILE
===================================================== */

function updateProfileImage(image) {

    const avatars = [

        document.getElementById("profileAvatar"),

        document.querySelector(".user-avatar"),

        document.querySelector(".top-avatar")

    ];


    avatars.forEach(avatar => {

        if (!avatar) return;


        if (image) {

            avatar.innerHTML = `
                <img
                    src="${escapeHTML(image)}"
                    alt="Foto profil"
                >
            `;

            avatar.classList.add(
                "has-profile-image"
            );

        } else {

            avatar.innerHTML = `
                <i class="fa-solid fa-user"></i>
            `;

            avatar.classList.remove(
                "has-profile-image"
            );

        }

    });

}


/* =====================================================
   LOAD FOTO PROFILE
===================================================== */

function loadProfileImage() {

    if (!currentAccount) return;


    const image =
        currentAccount.profileImage || "";


    updateProfileImage(image);

}

/* =====================================================
   NOTIFIKASI CARDIFY
===================================================== */

function showCardifyToast(title, message, type = "info") {

    let container =
        document.getElementById("cardifyToastContainer");

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "cardifyToastContainer";

        container.className =
            "cardify-toast-container";

        document.body.appendChild(container);
    }


    const toast =
        document.createElement("div");

    toast.className =
        `cardify-toast cardify-toast-${type}`;


    const iconMap = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation",
        warning: "fa-triangle-exclamation",
        info: "fa-bell"
    };


    toast.innerHTML = `
        <div class="cardify-toast-icon">
            <i class="fa-solid ${iconMap[type] || iconMap.info}"></i>
        </div>

        <div class="cardify-toast-content">
            <strong></strong>
            <span></span>
        </div>

        <button
            type="button"
            class="cardify-toast-close"
            aria-label="Tutup"
        >
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;


    toast.querySelector("strong").textContent =
        title || "Cardify";

    toast.querySelector("span").textContent =
        message || "";


    toast.querySelector(
        ".cardify-toast-close"
    ).addEventListener(
        "click",
        () => {

            toast.classList.remove("show");

            setTimeout(
                () => toast.remove(),
                220
            );
        }
    );


    container.appendChild(toast);


    requestAnimationFrame(() => {
        toast.classList.add("show");
    });


    setTimeout(() => {

        if (!toast.isConnected) return;

        toast.classList.remove("show");

        setTimeout(
            () => toast.remove(),
            220
        );

    }, 3500);
}


/* =====================================================
   KONFIRMASI CARDIFY
===================================================== */

function showCardifyConfirm(
    title,
    message,
    onConfirm
) {

    let modal =
        document.getElementById(
            "cardifyConfirmModal"
        );


    if (!modal) {

        modal =
            document.createElement("div");

        modal.id =
            "cardifyConfirmModal";

        modal.className =
            "cardify-confirm-overlay";

        modal.innerHTML = `
            <div class="cardify-confirm-box">

                <div class="cardify-confirm-icon">
                    <i class="fa-solid fa-circle-question"></i>
                </div>

                <div class="cardify-confirm-content">

                    <h3></h3>

                    <p></p>

                </div>

                <div class="cardify-confirm-actions">

                    <button
                        type="button"
                        class="cancel-btn"
                        id="cardifyConfirmCancel"
                    >
                        Batal
                    </button>

                    <button
                        type="button"
                        class="primary-btn"
                        id="cardifyConfirmOk"
                    >
                        Lanjutkan
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(modal);
    }


    modal.querySelector(
        ".cardify-confirm-content h3"
    ).textContent = title;


    modal.querySelector(
        ".cardify-confirm-content p"
    ).textContent = message;


    modal.classList.add("show");


    const cancel =
        document.getElementById(
            "cardifyConfirmCancel"
        );

    const ok =
        document.getElementById(
            "cardifyConfirmOk"
        );


    cancel.onclick = () => {

        modal.classList.remove("show");

    };


    ok.onclick = () => {

        modal.classList.remove("show");

        if (typeof onConfirm === "function") {
            onConfirm();
        }

    };


    modal.onclick = event => {

        if (event.target === modal) {

            modal.classList.remove("show");

        }

    };

}

/* =====================================================
   FORMAT RUPIAH
===================================================== */

function formatRupiah(number) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(
        Number(number) || 0
    );
}


/* =====================================================
   FORMAT DATE
===================================================== */

function formatDate(date) {
    if (!date) return "-";

    const value = String(date).trim();

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const parsed = new Date(year, month - 1, day);

        if (
            parsed.getFullYear() === year &&
            parsed.getMonth() === month - 1 &&
            parsed.getDate() === day
        ) {
            return parsed.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
    }

    // DD/MM/YYYY atau DD-MM-YYYY
    const match = value.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );

    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);

        const parsed = new Date(year, month - 1, day);

        if (
            parsed.getFullYear() === year &&
            parsed.getMonth() === month - 1 &&
            parsed.getDate() === day
        ) {
            return parsed.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
    }

    // Format lain, misalnya dari Google Sheets
    const parsed = new Date(value);

    if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    return "-";
}

/* =====================================================
   CONDITION
===================================================== */

function getConditionClass(kondisi) {

    if (kondisi === "Rusak Berat") {
        return "condition-berat";
    }

    if (kondisi === "Rusak Ringan") {
        return "condition-ringan";
    }

    return "condition-baik";
}


function getConditionIcon(kondisi) {

    if (kondisi === "Rusak Berat") {
        return "🔴";
    }

    if (kondisi === "Rusak Ringan") {
        return "🟡";
    }

    return "🟢";
}


/* =====================================================
   DASHBOARD STATISTICS
===================================================== */

function renderStats() {

    const totalStok =
        barang.reduce(
            (sum, item) =>
                sum + Number(item.stok || 0),
            0
        );


    const stokAman =
        barang.filter(
            item =>
                Number(item.stok || 0) > 5
        ).length;


    const stokMenipis =
        barang.filter(
            item =>
                Number(item.stok || 0) <= 5
        ).length;


    const nilai =
        barang.reduce(
            (sum, item) =>
                sum +
                Number(item.stok || 0) *
                Number(item.harga || 0),
            0
        );


    const baik =
        barang.filter(
            item =>
                (item.kondisi || "Baik") === "Baik"
        ).length;


    const ringan =
        barang.filter(
            item =>
                (item.kondisi || "Baik") ===
                "Rusak Ringan"
        ).length;


    const berat =
        barang.filter(
            item =>
                (item.kondisi || "Baik") ===
                "Rusak Berat"
        ).length;


    const totalBarang =
        document.getElementById(
            "totalBarang"
        );

    const stokAmanElement =
        document.getElementById(
            "stokAman"
        );

    const stokMenipisElement =
        document.getElementById(
            "stokMenipis"
        );

    const totalNilai =
        document.getElementById(
            "totalNilai"
        );

    const conditionBaik =
        document.getElementById(
            "conditionBaik"
        );

    const conditionRingan =
        document.getElementById(
            "conditionRingan"
        );

    const conditionBerat =
        document.getElementById(
            "conditionBerat"
        );


    if (totalBarang) {
        totalBarang.textContent =
            barang.length;
    }


    if (stokAmanElement) {
        stokAmanElement.textContent =
            stokAman;
    }


    if (stokMenipisElement) {
        stokMenipisElement.textContent =
            stokMenipis;
    }


    if (totalNilai) {
        totalNilai.textContent =
            formatRupiah(nilai);
    }


    if (conditionBaik) {
        conditionBaik.textContent =
            baik;
    }


    if (conditionRingan) {
        conditionRingan.textContent =
            ringan;
    }


    if (conditionBerat) {
        conditionBerat.textContent =
            berat;
    }
}


/* =====================================================
   IMAGE HTML
===================================================== */

function imageHTML(gambar) {

    if (gambar) {
        return `
            <img
                src="${escapeHTML(gambar)}"
                alt="Gambar barang"
            >
        `;
    }

    return `
        <i class="fa-solid fa-box no-image"></i>
    `;
}


/* =====================================================
   INVENTORY
===================================================== */

function renderInventory() {

    const tbody =
        document.getElementById(
            "inventoryTable"
        );

    const empty =
        document.getElementById(
            "emptyState"
        );


    if (!tbody) return;


    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const categoryFilter =
        document.getElementById(
            "categoryFilter"
        );

    const conditionFilter =
        document.getElementById(
            "conditionFilter"
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const category =
        categoryFilter
            ? categoryFilter.value
            : "all";


    const condition =
        conditionFilter
            ? conditionFilter.value
            : "all";


    const filtered =
        barang.filter(item => {

            const text = `
                ${item.kode || ""}
                ${item.nama || ""}
                ${item.kategori || ""}
                ${item.supplier || ""}
                ${item.lokasi || ""}
            `.toLowerCase();


            const matchSearch =
                text.includes(search);


            const matchCategory =
                category === "all" ||
                item.kategori === category;


            const matchCondition =
                condition === "all" ||
                (item.kondisi || "Baik") ===
                condition;


            return (
                matchSearch &&
                matchCategory &&
                matchCondition
            );
        });

    filtered.sort((a, b) => {
    return String(a.kode || "").localeCompare(
        String(b.kode || ""),
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );
});

    if (!filtered.length) {

        tbody.innerHTML = "";

        if (empty) {
            empty.classList.remove("hidden");
        }

        return;
    }


    if (empty) {
        empty.classList.add("hidden");
    }


    tbody.innerHTML =
        filtered.map(
            (item, index) => {

                const stok =
                    Number(item.stok || 0);


                const status =
                    stok <= 5
                        ? "menipis"
                        : "aman";


                const statusText =
                    status === "menipis"
                        ? "Menipis"
                        : "Aman";


                const kondisi =
                    item.kondisi || "Baik";


                return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            <strong>
                                ${escapeHTML(
                                    item.kode || "-"
                                )}
                            </strong>
                        </td>

                        <td>

                            <div class="table-product">

                                <div class="table-image">
                                    ${imageHTML(
                                        item.gambar
                                    )}
                                </div>

                                <div>

                                    <strong>
                                        ${escapeHTML(
                                            item.nama || "-"
                                        )}
                                    </strong>

                                    <span>
                                        ID #${item.id}
                                    </span>

                                </div>

                            </div>

                        </td>

                        <td>
                            ${escapeHTML(
                                item.kategori || "-"
                            )}
                        </td>

                        <td>
                            ${formatRupiah(
                                item.harga
                            )}
                        </td>

                        <td>
                            ${stok}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.satuan || "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.supplier || "-"
                            )}
                        </td>

                        <td>

                            <span
                                class="condition-badge
                                ${getConditionClass(kondisi)}"
                            >

                                ${getConditionIcon(kondisi)}

                                ${escapeHTML(
                                    kondisi
                                )}

                            </span>

                        </td>

                        <td>
                            ${escapeHTML(
                                item.lokasi || "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                item.tanggalMasuk
                            )}
                        </td>

                        <td>

                            <span
                                class="status ${status}"
                            >
                                ${statusText}
                            </span>

                        </td>

                        <td>

                            <div class="action-buttons">

                                <button
                                    class="action-btn edit"
                                    onclick="editBarang(${item.id})"
                                    title="Edit"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                </button>

                                <button
                                    class="action-btn delete"
                                    onclick="deleteBarang(${item.id})"
                                    title="Hapus"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>

                            </div>

                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* =====================================================
   SEARCH
===================================================== */

const searchInputElement =
    document.getElementById(
        "searchInput"
    );

if (searchInputElement) {

    searchInputElement.addEventListener(
        "input",
        renderInventory
    );
}


/* =====================================================
   CATEGORY FILTER
===================================================== */

const categoryFilterElement =
    document.getElementById(
        "categoryFilter"
    );

if (categoryFilterElement) {

    categoryFilterElement.addEventListener(
        "change",
        renderInventory
    );
}


/* =====================================================
   CONDITION FILTER
===================================================== */

const conditionFilterElement =
    document.getElementById(
        "conditionFilter"
    );

if (conditionFilterElement) {

    conditionFilterElement.addEventListener(
        "change",
        renderInventory
    );
}


/* =====================================================
   ADD BARANG
===================================================== */

if (addBarangBtn) {

    addBarangBtn.addEventListener(
        "click",
        openAddModal
    );
}


function openAddModal() {

    if (!barangForm) return;


    barangForm.reset();


    const barangId =
        document.getElementById(
            "barangId"
        );

    const modalTitle =
        document.getElementById(
            "modalTitle"
        );

    const kondisiInput =
        document.getElementById(
            "kondisiBarang"
        );

    const tanggalInput =
        document.getElementById(
            "tanggalMasuk"
        );


    if (barangId) {
        barangId.value = "";
    }


    if (modalTitle) {
        modalTitle.textContent =
            "Tambah Barang";
    }


    selectedImage = "";


    showImagePreview("");


    if (kondisiInput) {
        kondisiInput.value = "Baik";
    }


    if (tanggalInput) {

        tanggalInput.value =
            new Date()
                .toISOString()
                .split("T")[0];
    }


    if (barangModal) {
        barangModal.classList.remove("hidden");
    }
}


/* =====================================================
   IMAGE UPLOAD
===================================================== */

const gambarBarang =
    document.getElementById(
        "gambarBarang"
    );


if (gambarBarang) {

    gambarBarang.addEventListener(
        "change",
        function () {

            const file =
                this.files[0];


            if (!file) return;


            if (
    file.size >
    2 * 1024 * 1024
) {

    showCardifyToast(
        "Gambar Terlalu Besar",
        "Ukuran gambar maksimal 2 MB.",
        "warning"
    );

    this.value = "";

    return;
}


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    selectedImage =
                        event.target.result;

                    showImagePreview(
                        selectedImage
                    );
                };


            reader.readAsDataURL(file);
        }
    );
}

function showImagePreview(image) {
    const preview = document.getElementById("imagePreview");

    if (!preview) return;

    if (image) {
        preview.innerHTML = "";

        const img = document.createElement("img");
        img.src = image;
        img.alt = "Preview gambar";

        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.style.display = "block";
        img.style.borderRadius = "12px";

        preview.appendChild(img);
    } else {
        preview.innerHTML = `
            <i class="fa-solid fa-image"></i>
            <span>Preview gambar</span>
        `;
    }
}

/* =====================================================
   SAVE BARANG
===================================================== */

if (barangForm) {

    barangForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const id =
                document.getElementById(
                    "barangId"
                ).value;


            const kodeElement =
                document.getElementById(
                    "kodeBarang"
                );

            const namaElement =
                document.getElementById(
                    "namaBarang"
                );

            const kategoriElement =
                document.getElementById(
                    "kategoriBarang"
                );

            const hargaElement =
                document.getElementById(
                    "hargaBarang"
                );

            const stokElement =
                document.getElementById(
                    "stokBarang"
                );

            const satuanElement =
                document.getElementById(
                    "satuanBarang"
                );

            const supplierElement =
                document.getElementById(
                    "supplierBarang"
                );

            const kondisiElement =
                document.getElementById(
                    "kondisiBarang"
                );

            const lokasiElement =
                document.getElementById(
                    "lokasiBarang"
                );

            const tanggalElement =
                document.getElementById(
                    "tanggalMasuk"
                );


            const data = {

                kode:
                    kodeElement
                        ? kodeElement.value.trim()
                        : "",

                nama:
                    namaElement
                        ? namaElement.value.trim()
                        : "",

                kategori:
                    kategoriElement
                        ? kategoriElement.value
                        : "",

                harga:
                    hargaElement
                        ? Number(hargaElement.value || 0)
                        : 0,

                stok:
                    stokElement
                        ? Number(stokElement.value || 0)
                        : 0,

                satuan:
                    satuanElement
                        ? satuanElement.value.trim()
                        : "unit",

                supplier:
                    supplierElement
                        ? supplierElement.value.trim()
                        : "",

                kondisi:
                    kondisiElement
                        ? kondisiElement.value
                        : "Baik",

                lokasi:
                    lokasiElement
                        ? lokasiElement.value.trim()
                        : "",

                tanggalMasuk:
                    tanggalElement
                        ? tanggalElement.value
                        : "",

                gambar:
                    selectedImage || ""
            };


            if (!data.kode) {

                data.kode =
                    "BRG" +
                    Date.now()
                        .toString()
                        .slice(-5);
            }

            if (!data.nama) {

    showCardifyToast(
        "Data Belum Lengkap",
        "Nama barang wajib diisi.",
        "warning"
    );

    return;
}

            if (id) {

                const index =
                    barang.findIndex(
                        item =>
                            item.id ===
                            Number(id)
                    );


                if (index !== -1) {

                    const oldName =
                        barang[index].nama;


                    barang[index] = {
                        ...barang[index],
                        ...data
                    };


                    addHistory(
                        `Barang "${oldName}" diperbarui`
                 
                   );
                   addNotification(
    "Data Diperbarui",
    `Data barang "${oldName}" berhasil diperbarui.`
);
                }


            } else {

                const newBarang = {

                    id:
                        Date.now(),

                    ...data
                };


                barang.unshift(
                    newBarang
                );


                addHistory(
                    `Barang "${data.nama}" ditambahkan`
                );
                addNotification(
    "Barang Baru",
    `Barang "${data.nama}" berhasil ditambahkan ke inventaris.`
);
            }


            saveBarang();


            closeModal(
                "barangModal"
            );


            renderAll();
        }
    );
}


/* =====================================================
   EDIT BARANG
===================================================== */

function editBarang(id) {

    const item =
        barang.find(
            barangItem =>
                barangItem.id === id
        );


    if (!item) return;


    const fields = {

        barangId: item.id,

        kodeBarang: item.kode || "",

        namaBarang: item.nama || "",

        kategoriBarang:
            item.kategori || "",

        hargaBarang:
            item.harga || 0,

        stokBarang:
            item.stok || 0,

        satuanBarang:
            item.satuan || "unit",

        supplierBarang:
            item.supplier || "",

        kondisiBarang:
            item.kondisi || "Baik",

        lokasiBarang:
            item.lokasi || "",

        tanggalMasuk:
            item.tanggalMasuk || ""
    };


    Object.entries(fields).forEach(
        ([idField, value]) => {

            const element =
                document.getElementById(
                    idField
                );

            if (element) {
                element.value = value;
            }
        }
    );


    selectedImage =
        item.gambar || "";


    showImagePreview(
        selectedImage
    );


    const modalTitle =
        document.getElementById(
            "modalTitle"
        );


    if (modalTitle) {
        modalTitle.textContent =
            "Edit Barang";
    }


    if (barangModal) {
        barangModal.classList.remove("hidden");
    }
}

function deleteBarang(id) {

    const item =
        barang.find(
            barangItem =>
                barangItem.id === id
        );


    if (!item) return;


    showCardifyConfirm(
        "Hapus Barang",
        `Hapus barang "${item.nama}"?`,
        () => {

            barang =
                barang.filter(
                    barangItem =>
                        barangItem.id !== id
                );


            saveBarang();


            addHistory(
                `Barang "${item.nama}" dihapus`
            );


            addNotification(
                "Barang Dihapus",
                `Barang "${item.nama}" berhasil dihapus dari inventaris.`
            );


            renderAll();


            showCardifyToast(
                "Barang Dihapus",
                `"${item.nama}" berhasil dihapus.`,
                "success"
            );

        }
    );

}

/* =====================================================
   SAVE INVENTORY
===================================================== */
function saveBarang() {

    localStorage.setItem(
        "inventarisToko",
        JSON.stringify(barang)
    );

    scheduleGoogleSheetsSync();
}

/* =====================================================
   INVENTORY HISTORY
===================================================== */

function addHistory(text) {

    history.unshift({

        text,

        user:
            currentAccount
                ? currentAccount.username
                : "System",

        time:
            new Date().toLocaleString(
                "id-ID"
            )
    });


    history =
        history.slice(0, 50);


    localStorage.setItem(
        "inventarisHistory",
        JSON.stringify(history)
    );
}


function renderHistory() {

    const container =
        document.getElementById(
            "historyList"
        );


    if (!container) return;


    if (!history.length) {

        container.innerHTML = `

            <div class="empty-state">

                <i class="fa-solid fa-clock-rotate-left"></i>

                <h3>
                    Belum ada riwayat
                </h3>

                <p>
                    Aktivitas inventaris akan muncul di sini.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        history.map(item => `

            <div class="history-item">

                <div class="history-icon">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                </div>

                <div class="history-content">

                    <strong>
                        ${escapeHTML(item.text)}
                    </strong>

                    <span>
                        Oleh ${escapeHTML(item.user)}
                    </span>

                </div>

                <div class="history-time">
                    ${escapeHTML(item.time)}
                </div>

            </div>

        `).join("");
}


/* =====================================================
   ACCOUNT HISTORY
===================================================== */

function addAccountHistory(text) {

    accountHistory.unshift({

        text,

        time:
            new Date().toLocaleString(
                "id-ID"
            )
    });


    accountHistory =
        accountHistory.slice(0, 50);


    localStorage.setItem(
        "accountHistory",
        JSON.stringify(accountHistory)
    );
}


function renderAccountHistory() {

    const container =
        document.getElementById(
            "accountHistory"
        );


    if (!container) return;


    if (!accountHistory.length) {

        container.innerHTML = `

            <div class="empty-state">

                <i class="fa-solid fa-user-clock"></i>

                <h3>
                    Belum ada histori akun
                </h3>

                <p>
                    Aktivitas akun akan muncul di sini.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        accountHistory.map(item => `

            <div class="history-item">

                <div class="history-icon">
                    <i class="fa-solid fa-user"></i>
                </div>

                <div class="history-content">

                    <strong>
                        ${escapeHTML(item.text)}
                    </strong>

                    <span>
                        Aktivitas akun
                    </span>

                </div>

                <div class="history-time">
                    ${escapeHTML(item.time)}
                </div>

            </div>

        `).join("");
}




/* =====================================================
   ADD ACCOUNT FROM PROFILE
===================================================== */

const profileAddAccountBtn =
    document.getElementById(
        "profileAddAccountBtn"
    );


if (profileAddAccountBtn) {

    profileAddAccountBtn.addEventListener(
        "click",
        openRegisterModal
    );
}


/* =====================================================
   REGISTER SUBMIT
===================================================== */

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const nama =
                document.getElementById(
                    "registerName"
                ).value.trim();


            const username =
                document.getElementById(
                    "registerUsername"
                ).value.trim();


            const password =
                document.getElementById(
                    "registerPassword"
                ).value;


            const confirmPassword =
                document.getElementById(
                    "registerConfirmPassword"
                ).value;


            const role =
                document.getElementById(
                    "registerRole"
                ).value;


            const message =
                document.getElementById(
                    "registerMessage"
                );


            if (!nama) {

                message.textContent =
                    "Nama wajib diisi.";

                return;
            }


            if (!username) {

                message.textContent =
                    "Username wajib diisi.";

                return;
            }


            if (password.length < 4) {

                message.textContent =
                    "Password minimal 4 karakter.";

                return;
            }


            if (password !== confirmPassword) {

                message.textContent =
                    "Konfirmasi password tidak sama.";

                return;
            }


            const alreadyExists =
                accounts.some(
                    account =>
                        account.username.toLowerCase() ===
                        username.toLowerCase()
                );


            if (alreadyExists) {

                message.textContent =
                    "Username sudah digunakan.";

                return;
            }


            const newAccount = {

                id:
                    Date.now(),

                nama,

                username,

                password,

                role
            };


            accounts.push(
                newAccount
            );


            localStorage.setItem(
                "inventarisAccounts",
                JSON.stringify(accounts)
            );


            addAccountHistory(
                `Akun "${username}" berhasil dibuat`
            );
            addNotification(
                 "Akun Baru",
            `Akun "${username}" berhasil ditambahkan ke Cardify.`
            );

            
showCardifyToast(
    "Akun Berhasil Dibuat",
    `Akun "${username}" berhasil dibuat.`,
    "success"
);

            closeModal(
                "registerModal"
            );


            if (usernameInput) {
                usernameInput.value =
                    username;
            }


            if (passwordInput) {
                passwordInput.value = "";
            }
        }
    );
}


/* =====================================================
   MODAL CLOSE BUTTON
===================================================== */

document
    .querySelectorAll("[data-close]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                closeModal(
                    button.dataset.close
                );
            }
        );
    });


/* =====================================================
   CLOSE MODAL WHEN CLICK OVERLAY
===================================================== */

document
    .querySelectorAll(".modal-overlay")
    .forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    modal.classList.add(
                        "hidden"
                    );
                }
            }
        );
    });


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal(id) {

    const modal =
        document.getElementById(id);


    if (modal) {
        modal.classList.add("hidden");
    }
}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            if (currentAccount) {

                addAccountHistory(
                    `${currentAccount.username} keluar dari sistem`
                );
            }


            localStorage.removeItem(
                "inventarisUser"
            );


            currentAccount = null;


            if (app) {
                app.classList.add("hidden");
            }


            if (loginPage) {
                loginPage.classList.remove("hidden");
            }


            if (usernameInput) {
                usernameInput.value = "";
            }


            if (passwordInput) {
                passwordInput.value = "";
            }


            if (loginMessage) {
                loginMessage.textContent = "";
            }


            closeSidebar();
        }
    );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =====================================================
   BARANG TERBARU - DASHBOARD
===================================================== */

function renderBarangTerbaru() {

    const container =
        document.getElementById("dashboardBarangList");

    if (!container) return;


    /* Kalau belum ada barang */
    if (!barang || barang.length === 0) {

        container.innerHTML = `
            <div class="dashboard-empty">
                <i class="fa-solid fa-box-open"></i>

                <h3>
                    Belum ada barang
                </h3>

                <p>
                    Barang yang ditambahkan akan muncul di sini
                </p>
            </div>
        `;

        return;
    }


/* Urutkan berdasarkan kode barang */
const terbaru =
    [...barang]
        .sort((a, b) => {
            return String(a.kode || "").localeCompare(
                String(b.kode || ""),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            );
        })
        .slice(0, 4);


    container.innerHTML =
        terbaru.map(item => {

            const nama =
                item.nama || "Tanpa Nama";

            const kategori =
                item.kategori || "Lainnya";

            const stok =
                Number(item.stok || 0);

            const harga =
                Number(item.harga || 0);

            const gambar =
                item.gambar || "";


            return `
                <div
                    class="dashboard-product-card"
                    onclick="showBarangDetail(${item.id})"
                    style="cursor: pointer;"
                    title="Klik untuk melihat detail"
                >

                    <div class="dashboard-product-image">

                        ${
                            gambar
                            ? `
                                <img
                                    src="${escapeHTML(gambar)}"
                                    alt="${escapeHTML(nama)}"
                                    onerror="this.style.display='none'"
                                >
                            `
                            : `
                                <i class="fa-solid fa-box-open"></i>
                            `
                        }

                    </div>


                    <div class="dashboard-product-info">

                        <h3 class="dashboard-product-name">
                            ${escapeHTML(nama)}
                        </h3>


                        <span class="dashboard-product-category">
                            ${escapeHTML(kategori)}
                        </span>


                        <div class="dashboard-product-stock">

                            <i class="fa-solid fa-box"></i>

                            Stok ${stok}
                            ${escapeHTML(
                                item.satuan || "unit"
                            )}

                        </div>


                        <div class="dashboard-product-price">
                            ${formatRupiah(harga)}
                        </div>

                    </div>


                    <div class="dashboard-product-arrow">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>

                </div>
            `;

        }).join("");
}


/* =====================================================
   DETAIL BARANG DARI DASHBOARD
===================================================== */

function showBarangDetail(id) {

    const item =
        barang.find(
            barangItem =>
                barangItem.id === id
        );


    if (!item) return;


    const detailContent =
        document.getElementById(
            "detailContent"
        );


    const detailModal =
        document.getElementById(
            "detailModal"
        );


    if (!detailContent || !detailModal) {
        return;
    }


    const stok =
        Number(item.stok || 0);


    const status =
        stok <= 5
            ? "Menipis"
            : "Aman";


    const gambar =
        item.gambar || "";


    detailContent.innerHTML = `

        <div class="dashboard-detail">

            <div class="dashboard-detail-image">

                ${
                    gambar
                    ? `
                        <img
                            src="${escapeHTML(gambar)}"
                            alt="${escapeHTML(
                                item.nama || "Barang"
                            )}"
                        >
                    `
                    : `
                        <i class="fa-solid fa-box-open"></i>
                    `
                }

            </div>


            <div class="dashboard-detail-info">

                <h2>
                    ${escapeHTML(
                        item.nama || "-"
                    )}
                </h2>


                <span class="dashboard-detail-category">
                    ${escapeHTML(
                        item.kategori || "-"
                    )}
                </span>


                <div class="dashboard-detail-grid">

                    <div>
                        <span>Kode Barang</span>
                        <strong>
                            ${escapeHTML(
                                item.kode || "-"
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Harga</span>
                        <strong>
                            ${formatRupiah(
                                item.harga
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Stok</span>
                        <strong>
                            ${stok}
                            ${escapeHTML(
                                item.satuan || "unit"
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Status</span>
                        <strong>
                            ${status}
                        </strong>
                    </div>


                    <div>
                        <span>Supplier</span>
                        <strong>
                            ${escapeHTML(
                                item.supplier || "-"
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Kondisi</span>
                        <strong>
                            ${escapeHTML(
                                item.kondisi || "Baik"
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Lokasi</span>
                        <strong>
                            ${escapeHTML(
                                item.lokasi || "-"
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>Tanggal Masuk</span>
                        <strong>
                            ${formatDate(
                                item.tanggalMasuk
                            )}
                        </strong>
                    </div>

                </div>

            </div>

        </div>
    `;


    detailModal.classList.remove("hidden");
}

/* =====================================================
   RENDER ALL
===================================================== */

function renderAll() {

    renderStats();

    renderBarangTerbaru();

    renderInventory();

    renderStockTransactions();

    renderHistory();

    renderAccountHistory();

    updateUserInfo();
}
/* =====================================================
   NOTIFIKASI LONCENG
===================================================== */

const notificationBtn =
    document.getElementById("notificationBtn");

const notificationPanel =
    document.getElementById("notificationPanel");

const notificationList =
    document.getElementById("notificationList");

const notificationBadge =
    document.getElementById("notificationBadge");


/* =====================================================
   DATA NOTIFIKASI
===================================================== */

let notifications = JSON.parse(
    localStorage.getItem("cardifyNotifications")
) || [
    {
        id: 1,
        title: "Selamat datang di Cardify",
        message: "Sistem inventaris siap digunakan.",
        time: "Baru saja",
        read: false
    }
];


/* =====================================================
   SIMPAN NOTIFIKASI
===================================================== */

function saveNotifications() {

    localStorage.setItem(
        "cardifyNotifications",
        JSON.stringify(notifications)
    );

}


/* =====================================================
   TAMPILKAN NOTIFIKASI
===================================================== */

function renderNotifications() {

    if (!notificationList) return;


    if (!notifications.length) {

        notificationList.innerHTML = `
            <div class="notification-empty">
                <i class="fa-regular fa-bell-slash"></i>
                <p>Tidak ada notifikasi</p>
            </div>
        `;

        updateNotificationBadge();

        return;
    }


    notificationList.innerHTML =
        notifications.map(notification => {

            return `
                <div
                    class="notification-item ${
                        notification.read
                            ? "read"
                            : "unread"
                    }"
                    data-notification-id="${notification.id}"
                >

                    <div class="notification-icon">
                        <i class="fa-solid fa-bell"></i>
                    </div>

                    <div class="notification-content">

                        <strong>
                            ${escapeHTML(
                                notification.title
                            )}
                        </strong>

                        <p>
                            ${escapeHTML(
                                notification.message
                            )}
                        </p>

                        <span>
                            ${escapeHTML(
                                notification.time
                            )}
                        </span>

                    </div>

                </div>
            `;

        }).join("");


    updateNotificationBadge();
}


/* =====================================================
   BADGE JUMLAH NOTIFIKASI
===================================================== */

function updateNotificationBadge() {

    if (!notificationBadge) return;


    const unread =
        notifications.filter(
            notification =>
                !notification.read
        ).length;


    if (unread > 0) {

        notificationBadge.textContent =
            unread > 9 ? "9+" : unread;

        notificationBadge.classList.remove(
            "hidden"
        );

    } else {

        notificationBadge.textContent = "";

        notificationBadge.classList.add(
            "hidden"
        );
    }
}


/* =====================================================
   TAMBAH NOTIFIKASI
===================================================== */

function addNotification(
    title,
    message
) {

    notifications.unshift({

        id:
            Date.now(),

        title,

        message,

        time:
            new Date().toLocaleString(
                "id-ID",
                {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            ),

        read: false
    });


    /*
       Maksimal 20 notifikasi
    */

    notifications =
        notifications.slice(0, 20);


    saveNotifications();

    renderNotifications();
}


/* =====================================================
   KLIK LONCENG
===================================================== */

if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (!notificationPanel) return;


            notificationPanel.classList.toggle(
                "show"
            );


            renderNotifications();

        }
    );
}


/* =====================================================
   KLIK DI LUAR PANEL
===================================================== */

document.addEventListener(
    "click",
    event => {

        if (
            notificationPanel &&
            notificationPanel.classList.contains(
                "show"
            ) &&
            !notificationPanel.contains(event.target) &&
            notificationBtn &&
            !notificationBtn.contains(event.target)
        ) {

            notificationPanel.classList.remove(
                "show"
            );
        }

    }
);


/* =====================================================
   BACA NOTIFIKASI
===================================================== */

if (notificationList) {

    notificationList.addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    ".notification-item"
                );


            if (!item) return;


            const id =
                Number(
                    item.dataset.notificationId
                );


            const notification =
                notifications.find(
                    item =>
                        item.id === id
                );


            if (notification) {

                notification.read = true;

                saveNotifications();

                renderNotifications();
            }

        }
    );
}


/* =====================================================
   TANDAI SEMUA SUDAH DIBACA
===================================================== */

const markAllReadBtn =
    document.getElementById(
        "markAllReadBtn"
    );


if (markAllReadBtn) {

    markAllReadBtn.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            notifications.forEach(
                notification => {
                    notification.read = true;
                }
            );


            saveNotifications();

            renderNotifications();

        }
    );
}


/* =====================================================
   TRANSAKSI STOK - MASTER BARANG + MUTASI STOK
===================================================== */

const stockTransactionForm = document.getElementById("stockTransactionForm");
const transactionBarang = document.getElementById("transactionBarang");
const transactionQty = document.getElementById("transactionQty");
const transactionDate = document.getElementById("transactionDate");
const transactionNote = document.getElementById("transactionNote");
const transactionBarangInfo = document.getElementById("transactionBarangInfo");
const transactionSummary = document.getElementById("transactionSummary");
const stockTransactionTable = document.getElementById("stockTransactionTable");
const stockTransactionEmpty = document.getElementById("stockTransactionEmpty");
const exportTransactionBtn = document.getElementById("exportTransactionBtn");
const stockTransactionConfirm = document.getElementById("stockTransactionConfirm");
const stockConfirmContent = document.getElementById("stockConfirmContent");
const confirmStockTransaction = document.getElementById("confirmStockTransaction");
let pendingStockTransaction = null;

function saveStockTransactions() {
    localStorage.setItem("cardifyStockTransactions", JSON.stringify(stockTransactions));
    scheduleGoogleSheetsSync();
}

function initStockTransactionUI() {
    if (transactionDate && !transactionDate.value) {
        transactionDate.value = new Date().toISOString().split("T")[0];
    }
    renderTransactionBarangOptions();
    renderStockTransactions();
    updateTransactionPreview();
}

function renderTransactionBarangOptions() {

    if (!transactionBarang) return;

    const selectWrap =
        document.getElementById("transactionBarangSelect");

    if (!selectWrap) return;

    const optionsWrap =
        selectWrap.querySelector(".transaction-item-options");

    const valueText =
        selectWrap.querySelector(".custom-select-value");

    const current =
        transactionBarang.value;

    if (!optionsWrap) return;

    const items = [...barang].sort((a, b) =>
        String(a.nama || "").localeCompare(
            String(b.nama || ""),
            undefined,
            { sensitivity: "base" }
        )
    );

    if (!items.length) {

        optionsWrap.innerHTML = `
            <div class="transaction-no-items">
                <i class="fa-solid fa-box-open"></i>

                <span>
                    Belum ada barang.
                    Tambahkan barang di Inventaris.
                </span>
            </div>
        `;

    } else {

        optionsWrap.innerHTML = items.map(item => `

            <button
                type="button"
                class="transaction-item-option"
                data-value="${item.id}"
                role="option"
            >

                <span class="transaction-option-icon">
                    <i class="fa-solid fa-box"></i>
                </span>

                <span class="transaction-option-text">

                    <strong>
                        ${escapeHTML(item.nama || "Tanpa Nama")}
                    </strong>

                    <small>
                        ${escapeHTML(item.kode || "-")}
                        · Stok
                        ${Number(item.stok || 0)}
                        ${escapeHTML(item.satuan || "unit")}
                    </small>

                </span>

                <i class="fa-solid fa-check transaction-option-check"></i>

            </button>

        `).join("");
    }

    function setSelected(id, close = true) {

        const item = barang.find(
            row => String(row.id) === String(id)
        );

        transactionBarang.value =
            item ? String(item.id) : "";

      if (valueText) {

    valueText.innerHTML = item

        ? `
            <span class="transaction-select-icon">
                <i class="fa-solid fa-box"></i>
            </span>

            <span class="transaction-select-text">
                ${escapeHTML(item.nama || "Tanpa Nama")}
            </span>
          `

        : `
            <span class="transaction-select-icon">
                <i class="fa-solid fa-box"></i>
            </span>

            <span class="transaction-select-text">
                Pilih barang...
            </span>
          `;
}
      
        optionsWrap
            .querySelectorAll(".transaction-item-option")
            .forEach(btn => {

                const active =
                    String(btn.dataset.value) ===
                    String(transactionBarang.value);

                btn.classList.toggle("active", active);

                btn.setAttribute(
                    "aria-selected",
                    active ? "true" : "false"
                );

            });

        if (close) {

            selectWrap.classList.remove("open");

            const trigger =
                selectWrap.querySelector(
                    ".custom-select-trigger"
                );

            if (trigger) {
                trigger.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }

        transactionBarang.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }

    optionsWrap
        .querySelectorAll(".transaction-item-option")
        .forEach(btn => {

            btn.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                setSelected(
                    btn.dataset.value
                );

            });

        });

    if (
        current &&
        items.some(
            item =>
                String(item.id) === String(current)
        )
    ) {

        setSelected(current, false);

    } else {

        setSelected("", false);

    }
}
const transactionBarangSelect =
    document.getElementById("transactionBarangSelect");

if (transactionBarangSelect) {

    const trigger =
        transactionBarangSelect.querySelector(
            ".custom-select-trigger"
        );

    trigger?.addEventListener("click", event => {

        event.preventDefault();
        event.stopPropagation();

        const isOpen =
            transactionBarangSelect.classList.toggle("open");

        trigger.setAttribute(
            "aria-expanded",
            isOpen ? "true" : "false"
        );

    });

    document.addEventListener("click", event => {

        if (
            !transactionBarangSelect.contains(
                event.target
            )
        ) {

            transactionBarangSelect.classList.remove(
                "open"
            );

            trigger?.setAttribute(
                "aria-expanded",
                "false"
            );
        }

    });
}

function getSelectedTransactionItem() {
    if (!transactionBarang) return null;
    return barang.find(item => String(item.id) === String(transactionBarang.value)) || null;
}

function getTransactionType() {
    const checked = document.querySelector('input[name="transactionType"]:checked');
    return checked ? checked.value : "masuk";
}

function updateTransactionPreview() {
    const item = getSelectedTransactionItem();
    const qty = Number(transactionQty?.value || 0);
    const type = getTransactionType();
    if (!item) {
        if (transactionBarangInfo) transactionBarangInfo.textContent = "Stok saat ini: -";
        if (transactionSummary) transactionSummary.innerHTML = '<i class="fa-solid fa-box-open"></i><p>Pilih barang untuk melihat ringkasan.</p>';
        return;
    }
    const stok = Number(item.stok || 0);
    const next = type === "masuk" ? stok + qty : stok - qty;
    if (transactionBarangInfo) transactionBarangInfo.textContent = `Stok saat ini: ${stok} ${item.satuan || "unit"}`;
    if (transactionSummary) transactionSummary.innerHTML = `
        <div class="transaction-summary-icon"><i class="fa-solid fa-box"></i></div>
        <strong>${escapeHTML(item.nama || "-")}</strong>
        <span>${escapeHTML(item.kode || "-")} · ${escapeHTML(item.kategori || "Lainnya")}</span>
        <div class="transaction-stock-flow"><b>${stok}</b><i class="fa-solid fa-arrow-right"></i><b class="${next < 0 ? "negative" : ""}">${next}</b></div>
        <small>${type === "masuk" ? "Stok bertambah" : "Stok berkurang"}${qty ? ` sebanyak ${qty} ${escapeHTML(item.satuan || "unit")}` : ""}</small>
    `;
}

function renderStockTransactions() {
    if (!stockTransactionTable) return;
    if (!stockTransactions.length) {
        stockTransactionTable.innerHTML = "";
        if (stockTransactionEmpty) stockTransactionEmpty.classList.remove("hidden");
        return;
    }
    if (stockTransactionEmpty) stockTransactionEmpty.classList.add("hidden");
    stockTransactionTable.innerHTML = stockTransactions.slice(0, 100).map(tx => `
        <tr>
            <td>${escapeHTML(tx.tanggal || "-")}</td>
            <td><strong>${escapeHTML(tx.kode || "-")}</strong></td>
            <td>${escapeHTML(tx.nama || "-")}</td>
            <td><span class="transaction-badge ${tx.type === "masuk" ? "in" : "out"}">${tx.type === "masuk" ? "Masuk" : "Keluar"}</span></td>
            <td>${Number(tx.qty || 0)} ${escapeHTML(tx.satuan || "unit")}</td>
            <td><strong>${Number(tx.stokAkhir || 0)} ${escapeHTML(tx.satuan || "unit")}</strong></td>
            <td>${escapeHTML(tx.user || "System")}</td>
            <td>${escapeHTML(tx.note || "-")}</td>
        </tr>
    `).join("");
}

function openStockTransactionConfirm() {
    const item = getSelectedTransactionItem();
    const qty = Number(transactionQty?.value || 0);
    const type = getTransactionType();
    if (!item) {
        showCardifyToast("Barang Belum Dipilih", "Pilih barang terlebih dahulu.", "warning");
        return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
        showCardifyToast("Jumlah Tidak Valid", "Jumlah harus berupa angka bulat lebih dari 0.", "warning");
        return;
    }
    const stok = Number(item.stok || 0);
    const next = type === "masuk" ? stok + qty : stok - qty;
    if (type === "keluar" && qty > stok) {
        showCardifyToast("Stok Tidak Cukup", `Stok ${item.nama} saat ini hanya ${stok} ${item.satuan || "unit"}.`, "error");
        return;
    }
    pendingStockTransaction = { itemId: item.id, qty, type, tanggal: transactionDate?.value || new Date().toISOString().split("T")[0], note: transactionNote?.value.trim() || "", next };
    if (stockConfirmContent) stockConfirmContent.innerHTML = `
        <div class="stock-confirm-row"><span>Barang</span><strong>${escapeHTML(item.nama)}</strong></div>
        <div class="stock-confirm-row"><span>Kode</span><strong>${escapeHTML(item.kode || "-")}</strong></div>
        <div class="stock-confirm-row"><span>Perubahan</span><strong>${type === "masuk" ? "+" : "-"}${qty} ${escapeHTML(item.satuan || "unit")}</strong></div>
        <div class="stock-confirm-row"><span>Stok</span><strong>${stok} → ${next} ${escapeHTML(item.satuan || "unit")}</strong></div>
    `;
    if (stockTransactionConfirm) stockTransactionConfirm.classList.remove("hidden");
}

function commitStockTransaction() {
    if (!pendingStockTransaction) return;
    const tx = pendingStockTransaction;
    const item = barang.find(item => item.id === tx.itemId);
    if (!item) return;
    item.stok = tx.next;
    stockTransactions.unshift({
        id: Date.now(),
        tanggal: tx.tanggal,
        kode: item.kode || "",
        nama: item.nama || "",
        type: tx.type,
        qty: tx.qty,
        stokAkhir: item.stok,
        satuan: item.satuan || "unit",
        note: tx.note,
        user: currentAccount ? currentAccount.username : "System"
    });
    stockTransactions = stockTransactions.slice(0, 500);
    saveBarang();
    saveStockTransactions();
    addHistory(`${tx.type === "masuk" ? "Barang masuk" : "Barang keluar"}: ${item.nama} ${tx.type === "masuk" ? "+" : "-"}${tx.qty} ${item.satuan || "unit"}`);
    addNotification(tx.type === "masuk" ? "Stok Bertambah" : "Stok Berkurang", `${item.nama}: stok sekarang ${item.stok} ${item.satuan || "unit"}.`);
    if (stockTransactionConfirm) stockTransactionConfirm.classList.add("hidden");
    pendingStockTransaction = null;
    if (stockTransactionForm) stockTransactionForm.reset();
    if (transactionDate) transactionDate.value = new Date().toISOString().split("T")[0];
    renderAll();
    renderTransactionBarangOptions();
    updateTransactionPreview();
    showCardifyToast("Transaksi Tersimpan", "Stok berhasil diperbarui tanpa mengulang data barang.", "success");
}

if (stockTransactionForm) stockTransactionForm.addEventListener("submit", event => { event.preventDefault(); openStockTransactionConfirm(); });
if (confirmStockTransaction) confirmStockTransaction.addEventListener("click", commitStockTransaction);
if (transactionBarang) transactionBarang.addEventListener("change", updateTransactionPreview);
if (transactionQty) transactionQty.addEventListener("input", updateTransactionPreview);
document.querySelectorAll('input[name="transactionType"]').forEach(input => input.addEventListener("change", () => {
    document.querySelectorAll(".transaction-type-option").forEach(label => label.classList.toggle("active", label.querySelector("input")?.checked));
    updateTransactionPreview();
}));
if (exportTransactionBtn) exportTransactionBtn.addEventListener("click", exportStockTransactionsCSV);

function exportStockTransactionsCSV() {
    if (!stockTransactions.length) { showCardifyToast("Export Gagal", "Belum ada transaksi stok.", "warning"); return; }
    const headers = ["Tanggal","Kode","Barang","Jenis","Jumlah","Satuan","Stok Akhir","Oleh","Keterangan"];
    const rows = stockTransactions.map(tx => [tx.tanggal,tx.kode,tx.nama,tx.type === "masuk" ? "Masuk" : "Keluar",tx.qty,tx.satuan,tx.stokAkhir,tx.user,tx.note]);
    const csv = [headers,...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `Cardify_Transaksi_Stok_${getExportDate()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    addHistory("Data transaksi stok berhasil di-export");
    showCardifyToast("Export Berhasil", "Riwayat transaksi stok berhasil di-export.", "success");
}

initStockTransactionUI();


/* =====================================================
   NOTIFIKASI AWAL
===================================================== */

renderNotifications();

/* =====================================================
   IMPORT & EXPORT DATA INVENTARIS
===================================================== */

const importBarangBtn =
    document.getElementById("importBarangBtn");

const exportBarangBtn =
    document.getElementById("exportBarangBtn");

const importFile =
    document.getElementById("importFile");


/* =====================================================
   EXPORT CSV
===================================================== */

if (exportBarangBtn) {

    exportBarangBtn.addEventListener(
        "click",
        exportBarangCSV
    );

}


function exportBarangCSV() {

    if (!barang || barang.length === 0) {

    showCardifyToast(
        "Export Gagal",
        "Belum ada data barang untuk di-export.",
        "warning"
    );

    return;
}


    const headers = [
        "Kode",
        "Nama",
        "Kategori",
        "Harga",
        "Stok",
        "Satuan",
        "Supplier",
        "Kondisi",
        "Lokasi",
        "Tanggal Masuk",
        "Gambar"
    ];


    const rows = barang.map(item => [

        item.kode || "",

        item.nama || "",

        item.kategori || "",

        item.harga || 0,

        item.stok || 0,

        item.satuan || "",

        item.supplier || "",

        item.kondisi || "Baik",

        item.lokasi || "",

        item.tanggalMasuk || "",

        item.gambar || ""

    ]);


    const csv = [

        headers,

        ...rows

    ].map(row =>

        row.map(value => {

            const text =
                String(value ?? "");

            return `"${text.replaceAll(
                '"',
                '""'
            )}"`;

        }).join(",")

    ).join("\n");


    /*
       BOM supaya Excel membaca UTF-8
    */

    const blob = new Blob(
        ["\uFEFF" + csv],
        {
            type:
                "text/csv;charset=utf-8;"
        }
    );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        `Cardify_Inventaris_${getExportDate()}.csv`;


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);


    addHistory(
        "Data inventaris berhasil di-export"
    );

    addNotification(
        "Export Berhasil",
        "Data inventaris berhasil di-export."
    );

}


function getExportDate() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;
}


/* =====================================================
   BUKA IMPORT
===================================================== */

if (importBarangBtn) {

    importBarangBtn.addEventListener(
        "click",
        () => {

            if (importFile) {
                importFile.click();
            }

        }
    );

}


/* =====================================================
   PILIH FILE IMPORT
===================================================== */

if (importFile) {

    importFile.addEventListener(
        "change",
        handleImportCSV
    );

}


/* =====================================================
   PROSES IMPORT CSV
=====================================================*/

function handleImportCSV(event) {

    const file =
        event.target.files[0];

    if (!file) return;


    if (
        !file.name
            .toLowerCase()
            .endsWith(".csv")
    ) {

        showCardifyToast(
            "Import Gagal",
            "File yang digunakan harus berformat CSV.",
            "error"
        );

        event.target.value = "";

        return;
    }


    const reader =
        new FileReader();


    reader.onload = function(e) {

        try {

            const text =
                e.target.result
                    .replace(/^\uFEFF/, "");


            const rows =
                parseCSV(text);


            if (rows.length < 2) {

                showCardifyToast(
                    "Import Gagal",
                    "File CSV tidak memiliki data barang.",
                    "warning"
                );

                event.target.value = "";

                return;
            }


            const headers =
                rows[0].map(header =>
                    header.trim()
                );


            const requiredHeaders = [
                "Kode",
                "Nama",
                "Kategori",
                "Harga",
                "Stok",
                "Satuan",
                "Supplier",
                "Kondisi",
                "Lokasi",
                "Tanggal Masuk"
            ];


            const missingHeaders =
                requiredHeaders.filter(
                    header =>
                        !headers.includes(header)
                );


            if (missingHeaders.length) {

                showCardifyToast(
                    "Format CSV Tidak Sesuai",
                    "Kolom yang kurang: " +
                    missingHeaders.join(", "),
                    "error"
                );

                event.target.value = "";

                return;
            }


            const importedBarang = [];


            for (
                let i = 1;
                i < rows.length;
                i++
            ) {

                const row =
                    rows[i];


                if (
                    !row ||
                    row.every(
                        value =>
                            !String(value).trim()
                    )
                ) {
                    continue;
                }


                const getValue =
                    header => {

                        const index =
                            headers.indexOf(
                                header
                            );

                        return index !== -1
                            ? String(
                                row[index] ?? ""
                            ).trim()
                            : "";
                    };


                const nama =
                    getValue("Nama");


                if (!nama) continue;


                const kode =
                    getValue("Kode") ||
                    generateKodeBarang();


                const newItem = {

                    id:
                        Date.now() +
                        i,

                    kode,

                    nama,

                    kategori:
                        getValue("Kategori") ||
                        "Lainnya",

                    harga:
                        Number(
                            getValue("Harga")
                                .replace(
                                    /[^0-9.-]/g,
                                    ""
                                )
                        ) || 0,

                    stok:
                        Number(
                            getValue("Stok")
                        ) || 0,

                    satuan:
                        getValue("Satuan") ||
                        "pcs",

                    supplier:
                        getValue("Supplier"),

                    kondisi:
                        getValue("Kondisi") ||
                        "Baik",

                    lokasi:
                        getValue("Lokasi"),

                    tanggalMasuk: 
                      getValue("TanggalMasuk") || getValue("Tanggal Masuk"),

                    gambar:
                        getValue("Gambar")

                };


                importedBarang.push(
                    newItem
                );
            }


            if (!importedBarang.length) {

                showCardifyToast(
                    "Import Gagal",
                    "Tidak ada data barang yang bisa di-import.",
                    "warning"
                );

                event.target.value = "";

                return;
            }


            showCardifyConfirm(
                "Konfirmasi Import",
                `Ditemukan ${importedBarang.length} barang. Tambahkan ke inventaris?`,
                () => {

                    barang = [
                        ...importedBarang,
                        ...barang
                    ];


                    saveBarang();


                    addHistory(
                        `${importedBarang.length} barang berhasil di-import`
                    );


                    addNotification(
                        "Import Berhasil",
                        `${importedBarang.length} barang berhasil ditambahkan ke inventaris.`
                    );


                    renderAll();


                    showCardifyToast(
                        "Import Berhasil",
                        `${importedBarang.length} barang berhasil di-import.`,
                        "success"
                    );

                }
            );


            /*
               Supaya file yang sama
               bisa dipilih lagi.
            */

            event.target.value = "";


        } catch (error) {

            console.error(
                "Gagal memproses CSV:",
                error
            );


            showCardifyToast(
                "Import Gagal",
                "File CSV tidak dapat diproses. Pastikan format file benar.",
                "error"
            );


            event.target.value = "";

        }

    };


    reader.onerror = function() {

        showCardifyToast(
            "Import Gagal",
            "File CSV tidak dapat dibaca.",
            "error"
        );


        event.target.value = "";

    };


    reader.readAsText(
        file,
        "UTF-8"
    );

}


/* =====================================================
   PARSER CSV
===================================================== */

function parseCSV(text) {

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];

        const next =
            text[i + 1];


        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {

            value += '"';

            i++;

            continue;
        }


        if (char === '"') {

            insideQuotes =
                !insideQuotes;

            continue;
        }


        if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(value);

            value = "";

            continue;
        }


        if (
            (char === "\n" ||
             char === "\r") &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {
                i++;
            }


            row.push(value);

            rows.push(row);

            row = [];

            value = "";

            continue;
        }


        value += char;
    }


    /*
       Data terakhir
    */

    if (
        value !== "" ||
        row.length > 0
    ) {

        row.push(value);

        rows.push(row);
    }


    return rows;
}


/* =====================================================
   GENERATE KODE BARANG
===================================================== */

function generateKodeBarang() {

    let kode;


    do {

        kode =
            "BRG" +
            String(
                Math.floor(
                    10000 +
                    Math.random() * 90000
                )
            );

    } while (
        barang.some(
            item =>
                item.kode === kode
        )
    );


    return kode;
}
/* =====================================================
   PROFILE - DAFTAR AKUN & GANTI AKUN AKTIF
===================================================== */

function renderProfilePage() {

    if (!currentAccount) return;


    const profileDetailName =
        document.getElementById("profileDetailName");

    const profileDetailUsername =
        document.getElementById("profileDetailUsername");

    const profileDetailRole =
        document.getElementById("profileDetailRole");

    const profileDetailEmail =
        document.getElementById("profileDetailEmail");

    const profileAccountsList =
        document.getElementById("profileAccountsList");


    /* =========================================
       DETAIL AKUN AKTIF
    ========================================= */

    if (profileDetailName) {
        profileDetailName.textContent =
            currentAccount.nama || "-";
    }

    if (profileDetailUsername) {
        profileDetailUsername.textContent =
            currentAccount.username || "-";
    }

    if (profileDetailRole) {
        profileDetailRole.textContent =
            currentAccount.role || "-";
    }

    if (profileDetailEmail) {
        profileDetailEmail.textContent =
            currentAccount.email || "-";
    }


    /* =========================================
       DAFTAR AKUN
    ========================================= */

    if (!profileAccountsList) return;

    profileAccountsList.innerHTML = "";


    accounts.forEach(account => {

        const item =
            document.createElement("button");

        item.type = "button";

        item.className =
            "profile-account-item";


        /* Akun yang sedang aktif */

        const isActive =
            currentAccount &&
            String(account.id) ===
            String(currentAccount.id);


        if (isActive) {
            item.classList.add("active");
        }


        /* =====================================
           AVATAR AKUN
        ===================================== */

        const avatar =
            document.createElement("div");

        avatar.className =
            "profile-account-avatar";


        if (account.profileImage) {

            avatar.innerHTML = `
                <img
                    src="${escapeHTML(account.profileImage)}"
                    alt="Foto profil"
                >
            `;

        } else {

            avatar.textContent =
                (account.nama || "A")
                    .trim()
                    .charAt(0)
                    .toUpperCase();

        }


        /* =====================================
           INFORMASI AKUN
        ===================================== */

        const info =
            document.createElement("div");

        info.className =
            "profile-account-info";


        const name =
            document.createElement("strong");

        name.textContent =
            account.nama || "-";


        const username =
            document.createElement("span");

        username.textContent =
            "@" + (account.username || "-");


        info.appendChild(name);
        info.appendChild(username);


        item.appendChild(avatar);
        item.appendChild(info);


        /* =====================================
           STATUS AKTIF
        ===================================== */

        if (isActive) {

            const status =
                document.createElement("span");

            status.className =
                "profile-account-status";

            status.textContent =
                "Aktif";

            item.appendChild(status);

        }

        /* =====================================
           KLIK AKUN
        ===================================== */

        item.addEventListener(
            "click",
            () => {

                if (isActive) {
                    return;
                }

                switchAccountWithPassword(
                    account
                );

            }
        );


        profileAccountsList.appendChild(item);

    });

}


/* =====================================================
   GANTI AKUN DENGAN PASSWORD
===================================================== */
let accountToSwitch = null;

const accountPasswordModal =
    document.getElementById("accountPasswordModal");

const accountPasswordInput =
    document.getElementById("accountPasswordInput");

const accountPasswordError =
    document.getElementById("accountPasswordError");

const passwordModalText =
    document.getElementById("passwordModalText");

function switchAccountWithPassword(account) {
    if (!account) return;

    if (
        currentAccount &&
        String(account.id) ===
        String(currentAccount.id)
    ) {
        return;
    }

    accountToSwitch = account;

    if (passwordModalText) {
        passwordModalText.textContent =
            `Masukkan sandi untuk akun "${account.username}".`;
    }

    if (accountPasswordInput) {
        accountPasswordInput.value = "";
    }

    if (accountPasswordError) {
        accountPasswordError.textContent = "";
    }

    if (accountPasswordModal) {
    accountPasswordModal.classList.remove("hidden");
    accountPasswordModal.classList.add("show");
}

    setTimeout(() => {
        if (accountPasswordInput) {
            accountPasswordInput.focus();
        }
    }, 100);
}

function closePasswordModal() {
    if (accountPasswordModal) {
    accountPasswordModal.classList.remove("show");
    accountPasswordModal.classList.add("hidden");
}
    accountToSwitch = null;

    if (accountPasswordInput) {
        accountPasswordInput.value = "";
    }

    if (accountPasswordError) {
        accountPasswordError.textContent = "";
    }
}

document
    .getElementById("closePasswordModal")
    ?.addEventListener(
        "click",
        closePasswordModal
    );

document
    .getElementById("cancelPasswordModal")
    ?.addEventListener(
        "click",
        closePasswordModal
    );

document
    .getElementById("toggleAccountPassword")
    ?.addEventListener(
        "click",
        () => {
            if (!accountPasswordInput) return;

            const icon =
                document.querySelector(
                    "#toggleAccountPassword i"
                );

            if (
                accountPasswordInput.type ===
                "password"
            ) {
                accountPasswordInput.type =
                    "text";

                if (icon) {
                    icon.className =
                        "fa-solid fa-eye-slash";
                }
            } else {
                accountPasswordInput.type =
                    "password";

                if (icon) {
                    icon.className =
                        "fa-solid fa-eye";
                }
            }
        }
    );

document
    .getElementById("submitPasswordModal")
    ?.addEventListener(
        "click",
        () => {
            if (!accountToSwitch) return;

            const password =
                accountPasswordInput?.value || "";

            if (!password) {
                if (accountPasswordError) {
                    accountPasswordError.textContent =
                        "Sandi wajib diisi.";
                }
                return;
            }

            if (
                password !==
                accountToSwitch.password
            ) {
                if (accountPasswordError) {
                    accountPasswordError.textContent =
                        "Sandi salah. Silakan coba lagi.";
                }

                accountPasswordInput?.focus();
                return;
            }

            const account =
                accountToSwitch;

            currentAccount = account;

            localStorage.setItem(
                "inventarisUser",
                account.username
            );

            closePasswordModal();

            renderAll();

            addAccountHistory(
                `Beralih ke akun "${account.username}"`
            );

            if (
                typeof addNotification ===
                "function"
            ) {
                addNotification(
                    "Akun Diganti",
                    `Sekarang menggunakan akun "${account.username}".`
                );
            }
        }
    );

accountPasswordInput?.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            document
                .getElementById(
                    "submitPasswordModal"
                )
                ?.click();
        }

        if (event.key === "Escape") {
            closePasswordModal();
        }
    }
);

/* =====================================================
   HAPUS AKUN YANG SEDANG LOGIN
===================================================== */

let deleteAccountTarget = null;

const deleteAccountModal =
    document.getElementById("deleteAccountModal");

const deleteAccountModalText =
    document.getElementById("deleteAccountModalText");

const deleteCurrentAccountBtn =
    document.getElementById("deleteCurrentAccountBtn");

const closeDeleteModalBtn =
    document.getElementById("closeDeleteModal");

const cancelDeleteModalBtn =
    document.getElementById("cancelDeleteModal");

const submitDeleteModalBtn =
    document.getElementById("submitDeleteModal");


/* =====================================================
   BUKA MODAL HAPUS
===================================================== */

function openDeleteAccountModal(account) {

    if (!account || !deleteAccountModal) {
        return;
    }

    deleteAccountTarget = account;

    if (deleteAccountModalText) {

        deleteAccountModalText.innerHTML =
            `Yakin ingin menghapus akun <strong>"${escapeHTML(
                account.nama || account.username
            )}"</strong>?<br>
            Akun ini akan dihapus secara permanen.`;
    }

    /* PASTIKAN MODAL TAMPIL */

    deleteAccountModal.classList.remove("hidden");
    deleteAccountModal.classList.add("show");
}


/* =====================================================
   TUTUP MODAL HAPUS
===================================================== */

function closeDeleteAccountModal() {

    if (deleteAccountModal) {

        deleteAccountModal.classList.remove("show");
        deleteAccountModal.classList.add("hidden");
    }

    deleteAccountTarget = null;
}


/* =====================================================
   TOMBOL HAPUS AKUN
===================================================== */

if (deleteCurrentAccountBtn) {

    deleteCurrentAccountBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            if (!currentAccount) {

                showCardifyToast(
                    "Tidak Ada Akun",
                    "Tidak ada akun yang sedang digunakan.",
                    "warning"
                );

                return;
            }

            openDeleteAccountModal(currentAccount);
        }
    );
}


/* =====================================================
   TUTUP MODAL
===================================================== */

if (closeDeleteModalBtn) {

    closeDeleteModalBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            closeDeleteAccountModal();
        }
    );
}


if (cancelDeleteModalBtn) {

    cancelDeleteModalBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            closeDeleteAccountModal();
        }
    );
}


/* =====================================================
   KLIK LUAR MODAL
===================================================== */

if (deleteAccountModal) {

    deleteAccountModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                deleteAccountModal
            ) {

                closeDeleteAccountModal();
            }
        }
    );
}


/* =====================================================
   KONFIRMASI HAPUS AKUN
===================================================== */

if (submitDeleteModalBtn) {

    submitDeleteModalBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            if (!deleteAccountTarget) {
                return;
            }

            const account =
                deleteAccountTarget;


            /* CARI AKUN */

            const accountIndex =
                accounts.findIndex(
                    item =>
                        String(item.id) ===
                        String(account.id)
                );


            if (accountIndex === -1) {

                closeDeleteAccountModal();

                showCardifyToast(
                    "Gagal",
                    "Akun tidak ditemukan.",
                    "error"
                );

                return;
            }


            const deletedUsername =
                account.username;


            /* HAPUS AKUN */

            accounts.splice(
                accountIndex,
                1
            );


            /* SIMPAN AKUN */

            localStorage.setItem(
                "inventarisAccounts",
                JSON.stringify(accounts)
            );


            /* HISTORI */

            addAccountHistory(
                `Akun "${deletedUsername}" dihapus`
            );


            /* NOTIFIKASI */

            if (
                typeof addNotification ===
                "function"
            ) {

                addNotification(
                    "Akun Dihapus",
                    `Akun "${deletedUsername}" berhasil dihapus.`
                );
            }


            /* HAPUS SESSION */

            localStorage.removeItem(
                "inventarisUser"
            );

            currentAccount = null;


            /* TUTUP MODAL */

            closeDeleteAccountModal();


            /* KEMBALI KE LOGIN */

            location.reload();
        }
    );
}/* =====================================================
   CUSTOM ROLE SELECT - BUAT AKUN BARU
===================================================== */

const registerRoleSelect =
    document.getElementById("registerRoleSelect");

const registerRoleTrigger =
    document.getElementById("registerRoleTrigger");

const registerRoleInput =
    document.getElementById("registerRole");

if (
    registerRoleSelect &&
    registerRoleTrigger &&
    registerRoleInput
) {

    registerRoleTrigger.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            registerRoleSelect.classList.toggle("open");

        }
    );


    registerRoleSelect
        .querySelectorAll(".custom-role-option")
        .forEach(option => {

            option.addEventListener(
                "click",
                function () {

                    const value =
                        this.dataset.value;

                    const icon =
                        this.querySelector(
                            ".role-option-icon i"
                        );

                    const iconClass =
                        icon
                            ? icon.className
                            : "fa-solid fa-users";


                    /* SIMPAN ROLE */

                    registerRoleInput.value =
                        value;


                    /* UPDATE TAMPILAN */

                    registerRoleTrigger
                        .querySelector(
                            ".custom-role-selected"
                        )
                        .innerHTML =
                        `<i class="${iconClass}"></i>${value}`;


                    /* ACTIVE */

                    registerRoleSelect
                        .querySelectorAll(
                            ".custom-role-option"
                        )
                        .forEach(item => {
                            item.classList.remove(
                                "active"
                            );
                        });

                    this.classList.add("active");


                    /* TUTUP */

                    registerRoleSelect
                        .classList.remove("open");

                }
            );

        });

}


/* KLIK DI LUAR */

document.addEventListener(
    "click",
    function (event) {

        if (
            registerRoleSelect &&
            !registerRoleSelect.contains(event.target)
        ) {

            registerRoleSelect.classList.remove(
                "open"
            );

        }

    }
);
/* =====================================================
   CUSTOM DROPDOWN CARDIFY
===================================================== */

document
    .querySelectorAll(".custom-select")
    .forEach(select => {

        const trigger =
            select.querySelector(
                ".custom-select-trigger"
            );

        const valueText =
            select.querySelector(
                ".custom-select-value"
            );

        const hiddenInput =
            select.querySelector(
                "input[type='hidden']"
            );

        const options =
            select.querySelectorAll(
                ".custom-select-options button"
            );


        if (!trigger || !hiddenInput) {
            return;
        }


        /* BUKA / TUTUP */

        trigger.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                document
                    .querySelectorAll(".custom-select.open")
                    .forEach(other => {

                        if (other !== select) {
                            other.classList.remove("open");
                        }

                    });

                select.classList.toggle("open");

            }
        );


        /* PILIH OPTION */

        options.forEach(option => {

            option.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    const value =
                        this.dataset.value ?? "";

                    const text =
                        this.textContent.trim();


                    hiddenInput.value = value;


                    if (valueText) {
                        valueText.textContent = text;
                    }


                    options.forEach(item => {
                        item.classList.remove("active");
                    });

                    this.classList.add("active");


                    select.classList.remove("open");


                    /*
                     * Beri tahu JS lama bahwa
                     * nilai filter sudah berubah.
                     */

                    hiddenInput.dispatchEvent(
                        new Event("change", {
                            bubbles: true
                        })
                    );

                }
            );

        });


        /* SET NILAI AWAL */

        const initialValue =
            hiddenInput.value;

        options.forEach(option => {

            if (
                option.dataset.value ===
                initialValue
            ) {

                option.classList.add("active");

                if (valueText) {
                    valueText.textContent =
                        option.textContent.trim();
                }

            }

        });

    });


/* TUTUP KALAU KLIK DI LUAR */

document.addEventListener(
    "click",
    function (event) {

        document
            .querySelectorAll(".custom-select.open")
            .forEach(select => {

                if (
                    !select.contains(
                        event.target
                    )
                ) {

                    select.classList.remove(
                        "open"
                    );

                }

            });

    }
);

function updateEmptyState() {
    const emptyState = document.getElementById("emptyState");
    if (!emptyState) return;

    emptyState.innerHTML = `
        <div style="font-size:28px; margin-bottom:8px;">🔍</div>
        <div style="font-size:13px; font-weight:600; color:#315f58; margin-bottom:5px;">
            Barang tidak ditemukan
        </div>
        <div style="font-size:10px; color:#829792;">
            Coba gunakan kata kunci lain atau periksa kembali pencarianmu.
        </div>
    `;
}

/* Google Sheets manual sync button */
document.addEventListener("click", event => {
    const button = event.target.closest("#googleSheetsSyncBtn");
    if (!button) return;
    manualGoogleSheetsSync();
});
/* =====================================================
   ANIMASI PILIHAN BARANG MASUK / KELUAR
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const transactionTypeOptions =
        document.querySelectorAll(".transaction-type-option");

    transactionTypeOptions.forEach(option => {

        option.addEventListener("click", () => {

            // hapus efek dari pilihan lain
            transactionTypeOptions.forEach(item => {
                item.classList.remove("active");
                item.classList.remove("click-effect");
            });

            // aktifkan pilihan yang ditekan
            option.classList.add("active");

            // trigger ulang animasi
            void option.offsetWidth;

            option.classList.add("click-effect");

            // hapus class setelah animasi selesai
            setTimeout(() => {
                option.classList.remove("click-effect");
            }, 400);

        });

    });

});
/* =====================================================
   FIX PILIH BARANG INVENTORY / TRANSAKSI
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const select = document.getElementById("transactionBarangSelect");

    if (!select) return;

    const trigger = select.querySelector(".custom-select-trigger");
    const options = select.querySelector(".custom-select-options");
    const hiddenInput = document.getElementById("transactionBarang");

    if (!trigger || !options || !hiddenInput) return;

    /* Buka / tutup dropdown */
    trigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        select.classList.toggle("open");
    });

    /* Pilih barang */
    options.querySelectorAll(".transaction-item-option").forEach(option => {

        option.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const value = option.dataset.value || "";
            const text = option.textContent.trim();

            // Simpan ID barang
            hiddenInput.value = value;

            // Tampilkan nama barang
            const triggerText =
                trigger.querySelector(".custom-select-text");

            if (triggerText) {
                triggerText.textContent = text;
            } else {
                trigger.textContent = text;
            }

            // Aktifkan pilihan
            options
                .querySelectorAll(".transaction-item-option")
                .forEach(item => item.classList.remove("active"));

            option.classList.add("active");

            // Tutup dropdown
            select.classList.remove("open");

            // Beri event supaya kode Cardify lain ikut mengetahui perubahan
            hiddenInput.dispatchEvent(
                new Event("change", { bubbles: true })
            );

        });

    });

    /* Klik di luar dropdown = tutup */
    document.addEventListener("click", (e) => {

        if (!select.contains(e.target)) {
            select.classList.remove("open");
        }

    });

});
document.getElementById("closePicker").addEventListener("click", function () {
    document.querySelector(".product-picker").classList.remove("active");
});
// =====================================================
// FIX INVALID DATE - FORCE AFTER DATA LOAD
// =====================================================

(function () {

    function fixInvalidDate() {

        document.querySelectorAll("*").forEach(function (el) {

            // Jangan ganggu elemen yang punya anak
            if (el.children.length > 0) return;

            const text = el.textContent.trim();

            if (text === "Invalid Date") {

                // Coba ambil tanggal dari parent/card
                const parent = el.closest(
                    ".item-card, .barang-card, .card, .detail-card, .inventory-card"
                );

                if (parent) {

                    const html = parent.innerHTML;

                    // Cari format tanggal dari HTML
                    const match = html.match(
                        /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
                    );

                    if (match) {
                        const tahun = match[1];
                        const bulan = String(match[2]).padStart(2, "0");
                        const hari = String(match[3]).padStart(2, "0");

                        el.textContent =
                            `${hari}/${bulan}/${tahun}`;

                        return;
                    }
                }

                // Kalau benar-benar tidak ditemukan
                el.textContent = "-";
            }

        });
    }

    // Jalankan berkali-kali karena data dimuat async
    setTimeout(fixInvalidDate, 300);
    setTimeout(fixInvalidDate, 800);
    setTimeout(fixInvalidDate, 1500);
    setTimeout(fixInvalidDate, 2500);
    setTimeout(fixInvalidDate, 4000);

    // Pantau kalau dashboard berubah setelah API selesai
    const observer = new MutationObserver(function () {
        fixInvalidDate();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();