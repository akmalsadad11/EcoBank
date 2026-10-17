const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/http');

// Master jenis & harga sampah (dipakai form timbangan petugas dan form setoran admin)
router.get('/', auth(), async (req, res) => {
    const { rows } = await query(
        'SELECT id, kode, nama, harga_per_kg, poin_per_kg FROM jenis_sampah WHERE aktif ORDER BY nama'
    );
    ok(res, rows);
});

module.exports = router;
