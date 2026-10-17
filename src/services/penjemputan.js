const { ApiError } = require('../utils/http');
const { fotoUrl } = require('../utils/format');

const BASE_SQL = `
    SELECT p.*,
           u.kode AS nasabah_kode, u.nama AS nasabah_nama, u.telepon AS nasabah_telepon,
           pt.kode AS petugas_kode, pt.nama AS petugas_nama
    FROM penjemputan p
    JOIN users u ON u.id = p.nasabah_id
    LEFT JOIN users pt ON pt.id = p.petugas_id`;

const ESTIMASI_KG = {
    'Kurang dari 5 kg': 2.5,
    '5 - 10 kg': 7.5,
    '10 - 20 kg': 15,
    '20 - 50 kg': 35,
    'Lebih dari 50 kg': 50,
};
const JAM_SLOT = ['08:00 - 10:00', '10:00 - 12:00', '13:00 - 15:00', '15:00 - 17:00'];

// Nasabah: 0 Diajukan, 1 Dijemput, 2 Selesai
const TAHAP_NASABAH = { baru: 0, dalam_perjalanan: 1, tiba: 1, selesai: 2, dibatalkan: null };
// Petugas: -1 belum mulai, 0 Mulai perjalanan, 1 Tiba di lokasi, 2 Selesai & setor
const LANGKAH_PETUGAS = { baru: -1, dalam_perjalanan: 0, tiba: 1, selesai: 2, dibatalkan: null };
const KATEGORI_PETUGAS = { baru: 'baru', dalam_perjalanan: 'diproses', tiba: 'diproses', selesai: 'selesai' };

function mapPenjemputan(r) {
    const telp = r.nasabah_telepon || '';
    const lat = r.lat === null || r.lat === undefined ? null : Number(r.lat);
    const lon = r.lon === null || r.lon === undefined ? null : Number(r.lon);
    return {
        id: r.id,
        kode: r.kode,
        status: r.status,
        kategori_petugas: KATEGORI_PETUGAS[r.status] || null,
        tahap_nasabah: TAHAP_NASABAH[r.status],
        langkah_petugas: LANGKAH_PETUGAS[r.status],
        nasabah: { id: r.nasabah_id, kode: r.nasabah_kode, nama: r.nasabah_nama, telepon: telp },
        petugas: r.petugas_id ? { id: r.petugas_id, kode: r.petugas_kode, nama: r.petugas_nama } : null,
        alamat: r.alamat,
        jenis: r.jenis,
        estimasi_berat: r.estimasi_berat,
        estimasi_kg: Number(r.estimasi_kg),
        tanggal: r.tanggal,
        jam: r.jam,
        catatan: r.catatan,
        lat,
        lon,
        foto_bukti_url: fotoUrl(r.foto_bukti),
        diajukan_pada: r.created_at,
        selesai_pada: r.selesai_at,
        telepon_url: telp ? `tel:${telp}` : null,
        wa_url: telp ? `https://wa.me/62${telp.slice(1)}` : null,
        maps_url: lat !== null && lon !== null
            ? `https://maps.google.com/?q=${lat},${lon}`
            : `https://maps.google.com/?q=${encodeURIComponent(r.alamat)}`,
    };
}

async function findPenjemputan(db, id, { lock = false } = {}) {
    // FOR UPDATE tidak boleh dipakai bersama LEFT JOIN, jadi kunci baris penjemputan saja
    if (lock) await db.query('SELECT id FROM penjemputan WHERE id = $1 FOR UPDATE', [id]);
    const { rows } = await db.query(`${BASE_SQL} WHERE p.id = $1`, [id]);
    if (!rows[0]) throw new ApiError(404, 'Data penjemputan tidak ditemukan.');
    return rows[0];
}

module.exports = { BASE_SQL, ESTIMASI_KG, JAM_SLOT, mapPenjemputan, findPenjemputan };
