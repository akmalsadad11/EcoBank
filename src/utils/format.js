const config = require('../config');

// 0812..., 62812..., +62812... -> 0812...
function normalizePhone(raw) {
    if (!raw) return null;
    let s = String(raw).replace(/[\s\-().]/g, '');
    if (s.startsWith('+62')) s = '0' + s.slice(3);
    else if (s.startsWith('62')) s = '0' + s.slice(2);
    return /^08[0-9]{8,12}$/.test(s) ? s : null;
}

const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

// Hari ini (YYYY-MM-DD) menurut WIB
function todayJakarta() {
    return new Date().toLocaleDateString('en-CA', { timeZone: config.timezone });
}

function userPublic(u) {
    return {
        id: u.id,
        kode: u.kode,
        role: u.role,
        nama: u.nama,
        telepon: u.telepon,
        email: u.email,
        alamat: u.alamat,
        saldo: Number(u.saldo),
        poin: u.poin,
        aktif: u.aktif,
        created_at: u.created_at,
    };
}

const fotoUrl = (file) => (file ? `${config.publicUrl}/uploads/${file}` : null);

function csvCell(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = { normalizePhone, rupiah, todayJakarta, userPublic, fotoUrl, csvCell };
