const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { ok, pagination } = require('../utils/http');
const { userPublic } = require('../utils/format');
const { BASE_SQL, mapPenjemputan } = require('../services/penjemputan');

router.use(auth('nasabah'));

const RIWAYAT_SQL = `
    SELECT s.id, s.kode, s.created_at, s.total_berat, s.total_nilai, s.total_poin, s.status,
           COALESCE((SELECT string_agg(nama_jenis, ', ' ORDER BY id) FROM setoran_item WHERE setoran_id = s.id), '') AS jenis
    FROM setoran s WHERE s.nasabah_id = $1`;

const mapRiwayat = (r) => ({
    id: r.id,
    kode: r.kode,
    tanggal: r.created_at,
    jenis: r.jenis,
    berat: Number(r.total_berat),
    nilai: Number(r.total_nilai),
    poin: r.total_poin,
    status: r.status,
});

// Data untuk halaman index.html: saldo, poin, status penjemputan aktif, riwayat, notifikasi
router.get('/dashboard', async (req, res) => {
    const id = req.user.id;
    const [total, aktif, riwayat, notif] = await Promise.all([
        query(`SELECT COALESCE(SUM(total_berat), 0) AS kg FROM setoran WHERE nasabah_id = $1 AND status = 'selesai'`, [id]),
        query(
            `${BASE_SQL} WHERE p.nasabah_id = $1 AND p.status IN ('baru', 'dalam_perjalanan', 'tiba')
             ORDER BY p.tanggal, p.id LIMIT 1`,
            [id]
        ),
        query(`${RIWAYAT_SQL} ORDER BY s.created_at DESC LIMIT 10`, [id]),
        query(
            `SELECT id, pesan, ikon, dibaca, created_at FROM notifikasi
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [id]
        ),
    ]);

    ok(res, {
        user: userPublic(req.user),
        total_sampah_kg: Number(total.rows[0].kg),
        penjemputan_aktif: aktif.rows[0] ? mapPenjemputan(aktif.rows[0]) : null,
        riwayat: riwayat.rows.map(mapRiwayat),
        notifikasi: notif.rows,
        notifikasi_belum_dibaca: notif.rows.filter((n) => !n.dibaca).length,
    });
});

// "Semua transaksi"
router.get('/riwayat', async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const [rows, count] = await Promise.all([
        query(`${RIWAYAT_SQL} ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`, [req.user.id, limit, offset]),
        query('SELECT COUNT(*) AS n FROM setoran WHERE nasabah_id = $1', [req.user.id]),
    ]);
    ok(res, rows.rows.map(mapRiwayat), 200, { page, limit, total: count.rows[0].n });
});

module.exports = router;
