const router = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { ok } = require('../utils/http');

router.use(auth());

router.get('/', async (req, res) => {
    const { rows } = await query(
        `SELECT id, pesan, ikon, dibaca, created_at FROM notifikasi
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [req.user.id]
    );
    ok(res, rows, 200, { belum_dibaca: rows.filter((n) => !n.dibaca).length });
});

// "Tandai dibaca"
router.post('/baca', async (req, res) => {
    await query('UPDATE notifikasi SET dibaca = TRUE WHERE user_id = $1 AND NOT dibaca', [req.user.id]);
    ok(res, null, 200, { pesan: 'Semua notifikasi ditandai dibaca.' });
});

module.exports = router;
