const router = require('express').Router();
const { query, tx } = require('../db');
const { auth } = require('../middleware/auth');
const { ApiError, ok, toId } = require('../utils/http');
const { notify } = require('../services/users');

router.use(auth('nasabah'));

// Daftar hadiah + status apakah poin cukup (untuk halaman reward.html)
router.get('/', async (req, res) => {
    const { rows } = await query(
        `SELECT id, nama, deskripsi, ikon, biaya_poin, stok FROM rewards
         WHERE aktif AND (stok IS NULL OR stok > 0) ORDER BY biaya_poin`
    );
    const poin = req.user.poin;
    ok(res, {
        poin,
        rewards: rows.map((r) => ({
            ...r,
            cukup: poin >= r.biaya_poin,
            kurang_poin: Math.max(r.biaya_poin - poin, 0),
        })),
    });
});

router.get('/riwayat', async (req, res) => {
    const { rows } = await query(
        `SELECT id, kode, nama_reward, poin, status, created_at FROM penukaran
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.user.id]
    );
    ok(res, rows);
});

router.post('/:id/tukar', async (req, res) => {
    const rewardId = toId(req.params.id);

    const result = await tx(async (db) => {
        const { rows: r } = await db.query('SELECT * FROM rewards WHERE id = $1 AND aktif FOR UPDATE', [rewardId]);
        const reward = r[0];
        if (!reward) throw new ApiError(404, 'Hadiah tidak ditemukan.');
        if (reward.stok !== null && reward.stok <= 0) throw new ApiError(409, 'Stok hadiah habis.');

        // Potong poin secara atomik; gagal jika poin tidak cukup
        const { rows: u } = await db.query(
            'UPDATE users SET poin = poin - $1 WHERE id = $2 AND poin >= $1 RETURNING poin',
            [reward.biaya_poin, req.user.id]
        );
        if (!u[0]) throw new ApiError(409, `Poin Anda tidak cukup untuk menukar ${reward.nama}.`);

        if (reward.stok !== null) await db.query('UPDATE rewards SET stok = stok - 1 WHERE id = $1', [rewardId]);

        const { rows: t } = await db.query(
            `INSERT INTO penukaran (user_id, reward_id, nama_reward, poin) VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.user.id, rewardId, reward.nama, reward.biaya_poin]
        );
        await notify(db, req.user.id, `Penukaran ${reward.nama} (${reward.biaya_poin} poin) sedang diproses.`, 'bi-gift');
        return { penukaran: t[0], sisa_poin: u[0].poin };
    });

    ok(res, result, 201, {
        pesan: `Berhasil menukar ${result.penukaran.poin} poin dengan ${result.penukaran.nama_reward}. Hadiah akan segera diproses.`,
    });
});

module.exports = router;
