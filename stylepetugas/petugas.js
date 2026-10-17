/* =========================================================
   LOGIKA INTERAKTIF PETUGAS LAPANGAN - (petugas.js)
   ========================================================= */

// Dataset Utama
const tasksData = [
    {
        id: 'PCK-2023-1089',
        category: 'baru',
        badge: 'BARU',
        name: 'Siti Aminah',
        addressShort: 'Jl. Mangga Besar No. 45, Jakarta Barat',
        addressFull: 'Jl. Mangga Besar No. 45, RT 02/RW 01, Kel. Mangga Besar, Kec. Taman Sari, Jakarta Barat',
        phone: '081299887766',
        schedule: 'Hari ini, 10:00 - 12:00',
        dateSubmitted: '18 Okt 2023, 14:22 WIB',
        estWeight: '15.0 Kg (Plastik & Kertas)',
        targetKg: 15.0,
        statusStep: 0,
        statusText: 'BELUM DIJEMPUT',
        lat: '-6.1751',
        lon: '106.8271',
        items: [
            { name: 'Botol Plastik PET', weight: 5.2 },
            { name: 'Kardus Tebal', weight: 8.4 }
        ]
    },
    {
        id: 'PCK-2023-1090',
        category: 'baru',
        badge: 'BARU',
        name: 'Budi Santoso',
        addressShort: 'Komp. Permata Hijau Blok C, Kebayoran Lama',
        addressFull: 'Komp. Permata Hijau Blok C No. 8, Kebayoran Lama, Jakarta Selatan',
        phone: '081311223344',
        schedule: 'Hari ini, 13:00 - 15:00',
        dateSubmitted: '18 Okt 2023, 15:10 WIB',
        estWeight: '8.5 Kg (Kertas & Logam)',
        targetKg: 8.5,
        statusStep: 0,
        statusText: 'BELUM DIJEMPUT',
        lat: '-6.2215',
        lon: '106.7834',
        items: [
            { name: 'Kardus Tebal', weight: 6.0 },
            { name: 'Kaleng Alumunium', weight: 2.5 }
        ]
    },
    {
        id: 'PCK-2023-1091',
        category: 'baru',
        badge: 'BARU',
        name: 'Dewi Lestari',
        addressShort: 'Jl. Palmerah Barat No. 110, Palmerah',
        addressFull: 'Jl. Palmerah Barat No. 110, Palmerah, Jakarta Barat',
        phone: '085799001122',
        schedule: 'Besok, 09:00 - 11:00',
        dateSubmitted: '19 Okt 2023, 08:30 WIB',
        estWeight: '24.0 Kg (Campuran)',
        targetKg: 24.0,
        statusStep: 0,
        statusText: 'BELUM DIJEMPUT',
        lat: '-6.2058',
        lon: '106.7932',
        items: [
            { name: 'Campuran Plastik', weight: 10.0 },
            { name: 'Kertas Arsip', weight: 14.0 }
        ]
    },
    {
        id: 'PCK-2023-1085',
        category: 'diproses',
        badge: 'PROSES',
        name: 'Rudi Hermawan',
        addressShort: 'Jl. Kebon Jeruk Raya No. 12',
        addressFull: 'Jl. Kebon Jeruk Raya No. 12, Kebon Jeruk, Jakarta Barat',
        phone: '081800112233',
        schedule: 'Hari ini, 08:00 - 10:00',
        dateSubmitted: '18 Okt 2023, 07:15 WIB',
        estWeight: '10.0 Kg',
        targetKg: 10.0,
        statusStep: 1,
        statusText: 'TIBA DI LOKASI',
        lat: '-6.1912',
        lon: '106.7721',
        items: [
            { name: 'Minyak Jelantah', weight: 10.0 }
        ]
    },
    {
        id: 'PCK-2023-1070',
        category: 'selesai',
        badge: 'SELESAI',
        name: 'Eka Putri',
        addressShort: 'Gedung Wisma Asri Lantai 3',
        addressFull: 'Gedung Wisma Asri Lantai 3, Slipi, Jakarta Barat',
        phone: '081988776655',
        schedule: 'Kemarin',
        dateSubmitted: '17 Okt 2023, 11:00 WIB',
        estWeight: '13.6 Kg',
        targetKg: 13.6,
        statusStep: 2,
        statusText: 'SELESAI & SETOR',
        lat: '-6.1988',
        lon: '106.7990',
        items: [
            { name: 'Botol Plastik PET', weight: 5.2 },
            { name: 'Kardus Tebal', weight: 8.4 }
        ]
    }
];

let activeTaskId = 'PCK-2023-1089';
let currentFilter = 'baru';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearchAndSort();
    initDynamicScale();
    initPhotoUpload();
    initStepper();
    initMobileNav();
    renderTaskList();
    loadTaskDetail(activeTaskId);
});

// 1. Render Daftar Tugas dengan Filter, Pencarian, & Pengurutan
function renderTaskList() {
    const container = document.getElementById('taskListContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const sortVal = document.getElementById('sortSelect').value;
    if (!container) return;

    let filtered = tasksData.filter(t => {
        const matchCategory = t.category === currentFilter;
        const matchSearch = t.name.toLowerCase().includes(searchVal) || 
                            t.id.toLowerCase().includes(searchVal) || 
                            t.addressShort.toLowerCase().includes(searchVal);
        return matchCategory && matchSearch;
    });

    // Pengurutan
    if (sortVal === 'weight') {
        filtered.sort((a, b) => b.targetKg - a.targetKg);
    }

    container.innerHTML = '';
    updateBadgesCount();

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 font-xs py-4">Tidak ada tugas ditemukan.</div>`;
        return;
    }

    filtered.forEach(task => {
        const isActive = task.id === activeTaskId;
        const card = document.createElement('div');
        card.className = `task-card ${isActive ? 'active' : ''}`;
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold font-xs text-white">${task.id}</span>
                <span class="badge ${task.category === 'selesai' ? 'bg-success' : task.category === 'diproses' ? 'bg-warning text-dark' : 'bg-slate-700'} font-xs px-2 py-0.5 text-uppercase">${task.badge}</span>
            </div>
            <h6 class="fw-bold text-white mb-1 font-sm">${task.name}</h6>
            <p class="font-xs text-slate-400 text-truncate mb-2">${task.addressShort}</p>
            <div class="d-flex justify-content-between align-items-center font-xs text-slate-400">
                <span><i class="bi bi-clock me-1"></i>${task.schedule}</span>
                <span class="fw-semibold text-white">Est: ~${task.targetKg} Kg</span>
            </div>
        `;

        card.addEventListener('click', () => {
            selectTask(task.id);
        });

        container.appendChild(card);
    });
}

function updateBadgesCount() {
    document.getElementById('cntBaru').textContent = tasksData.filter(t => t.category === 'baru').length;
    document.getElementById('cntDiproses').textContent = tasksData.filter(t => t.category === 'diproses').length;
    document.getElementById('cntSelesai').textContent = tasksData.filter(t => t.category === 'selesai').length;
}

// 2. Memilih Tugas & Menampilkan Detail
function selectTask(taskId) {
    activeTaskId = taskId;
    renderTaskList();
    loadTaskDetail(taskId);

    if (window.innerWidth < 992) {
        document.getElementById('panelTaskList').classList.add('d-none');
        document.getElementById('panelTaskDetail').classList.remove('d-none');
    }
}

// 3. Memuat Data Detail ke Panel Kanan
function loadTaskDetail(taskId) {
    const task = tasksData.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('detailTaskId').textContent = `Detail Tugas: ${task.id}`;
    document.getElementById('detailTaskDate').textContent = `Diajukan pada: ${task.dateSubmitted}`;
    document.getElementById('detailTaskStatus').textContent = task.statusText;
    document.getElementById('detailCustomerName').textContent = task.name;
    document.getElementById('detailCustomerAddress').textContent = task.addressFull;
    document.getElementById('detailCustomerEstWeight').textContent = task.estWeight;
    document.getElementById('btnCall').href = `tel:${task.phone}`;
    document.getElementById('btnWA').href = `https://wa.me/62${task.phone.substring(1)}`;
    document.getElementById('detailMapCoords').textContent = `Lat: ${task.lat}, Lon: ${task.lon}`;
    document.getElementById('linkGoogleMaps').href = `https://maps.google.com/?q=${task.lat},${task.lon}`;

    // Stepper UI
    updateStepperUI(task.statusStep);

    // Render Baris Timbangan
    const wrapper = document.getElementById('scaleInputsWrapper');
    wrapper.innerHTML = '';
    task.items.forEach(item => {
        addScaleRow(item.name, item.weight);
    });

    calculateTotalWeight();
}

// 4. Baris Timbangan Dinamis & Kalkulator
function initDynamicScale() {
    document.getElementById('btnAddCategory').addEventListener('click', () => {
        addScaleRow('', 0);
    });

    document.getElementById('formScale').addEventListener('submit', (e) => {
        e.preventDefault();
        const task = tasksData.find(t => t.id === activeTaskId);
        if (task) {
            task.category = 'selesai';
            task.badge = 'SELESAI';
            task.statusStep = 2;
            task.statusText = 'SELESAI & SETOR';
            
            showToast(`Tugas ${activeTaskId} telah selesai & tersimpan!`);
            renderTaskList();
            loadTaskDetail(activeTaskId);
        }
    });
}

function addScaleRow(labelValue = '', weightValue = 0) {
    const wrapper = document.getElementById('scaleInputsWrapper');
    const index = wrapper.children.length + 1;

    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-2 scale-row';
    row.innerHTML = `
        <div class="flex-grow-1">
            <input type="text" class="form-control form-control-sm font-xs bg-app-dark text-white border-app category-name" placeholder="Jenis Sampah #${index}" value="${labelValue}">
        </div>
        <div class="w-30">
            <div class="input-group input-group-sm">
                <input type="number" step="0.1" class="form-control font-xs bg-app-dark text-white border-app scale-input" placeholder="0.0" value="${weightValue > 0 ? weightValue : ''}">
                <span class="input-group-text bg-app-dark text-slate-400 border-app font-xs">Kg</span>
            </div>
        </div>
        <button type="button" class="btn btn-outline-danger btn-xs py-1 px-2 btn-remove-row">
            <i class="bi bi-trash"></i>
        </button>
    `;

    row.querySelector('.scale-input').addEventListener('input', calculateTotalWeight);
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        calculateTotalWeight();
    });

    wrapper.appendChild(row);
}

function calculateTotalWeight() {
    const inputs = document.querySelectorAll('.scale-input');
    let total = 0;

    inputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) total += val;
    });

    const display = document.getElementById('actualTotalWeight');
    const compBadge = document.getElementById('comparisonBadge');
    const currentTask = tasksData.find(t => t.id === activeTaskId);

    if (display) display.textContent = `${total.toFixed(1)} Kg`;

    if (compBadge && currentTask) {
        const diff = total - currentTask.targetKg;
        const diffText = diff >= 0 ? `+${diff.toFixed(1)} Kg dari est.` : `${diff.toFixed(1)} Kg dari est.`;
        compBadge.textContent = diffText;
        compBadge.className = diff >= 0 ? 'text-emerald font-xs' : 'text-warning font-xs';
    }
}

// 5. Unggah Foto Bukti
function initPhotoUpload() {
    const dropzone = document.getElementById('dropzone');
    const photoInput = document.getElementById('photoInput');
    const placeholder = document.getElementById('uploadPlaceholder');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const previewImg = document.getElementById('photoPreview');
    const btnRemove = document.getElementById('btnRemovePhoto');

    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemovePhoto')) return;
        photoInput.click();
    });

    photoInput.addEventListener('change', () => {
        const file = photoInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                placeholder.classList.add('d-none');
                previewContainer.classList.remove('d-none');
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemove.addEventListener('click', () => {
        photoInput.value = '';
        previewImg.src = '';
        previewContainer.classList.add('d-none');
        placeholder.classList.remove('d-none');
    });
}

// 6. Stepper Status Workflow
function initStepper() {
    const buttons = document.querySelectorAll('.btn-status-step');
    buttons.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            updateStepperUI(idx);
            const task = tasksData.find(t => t.id === activeTaskId);
            if (task) {
                task.statusStep = idx;
                const statusLabels = ['MULAI PERJALANAN', 'TIBA DI LOKASI', 'SELESAI & SETOR'];
                task.statusText = statusLabels[idx];
                document.getElementById('detailTaskStatus').textContent = statusLabels[idx];
                showToast(`Status tugas diubah: ${statusLabels[idx]}`);
            }
        });
    });
}

function updateStepperUI(stepIdx) {
    const buttons = document.querySelectorAll('.btn-status-step');
    buttons.forEach((btn, idx) => {
        if (idx === stepIdx) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 7. Filter Tabs, Search & Sort
function initTabs() {
    const tabBtns = document.querySelectorAll('#taskTabs .nav-link');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderTaskList();
        });
    });
}

function initSearchAndSort() {
    document.getElementById('searchInput').addEventListener('input', renderTaskList);
    document.getElementById('sortSelect').addEventListener('change', renderTaskList);
}

// 8. Tampilan Mobile
function initMobileNav() {
    document.getElementById('btnBackToList').addEventListener('click', () => {
        document.getElementById('panelTaskDetail').classList.add('d-none');
        document.getElementById('panelTaskList').classList.remove('d-none');
    });
}

// Helper Notification Toast
function showToast(message) {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toastMessage');
    if (toastEl && toastMsg) {
        toastMsg.querySelector('span').textContent = message;
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}