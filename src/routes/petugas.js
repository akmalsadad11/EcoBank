const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { ApiError, ok, parse, toId } = require('../utils/http');
const { notify } = require('../services/users');
const { BASE_SQL, mapPenjemputan, findPenjemputan } = require('../services/penjemputan');
const { itemsSchema, catatSetoran, getSetoran } = require('../services/setoran');

router.use(auth('petugas'));

// Petugas melihat tugas miliknya + tugas baru yang belum diambil siapa pun
const VISIBLE = `(p.petugas_id = $1 OR (p.petugas_id IS NULL AND p.status = 'baru'))`;
const KATEGORI = {
    baru: `p.status = 'baru'`,
    diproses: `p.status IN ('dalam_perjalanan', 'tiba')`,
    selesai: `p.status = 'selesai'`,
};

async function hitung(petugasId) {
    const { rows } = await query(
        `SELECT CASE WHEN p.status = 'baru' THEN 'baru'
                     WHEN p.status = 'selesai' THEN 'selesai' ELSE 'diproses' END AS kat,
                COUNT(*) AS n
         FROM penjemputan p WHERE p.status <> 'dibatalkan' AND ${VISIBLE} GROUP BY 1`,
        [petugasId]
    );
    const c = { baru: 0, diproses: 0, selesai: 0 };
    rows.forEach((r) => { c[r.kat] = r.n; });
    return c;
}

// ?kategori=baru|diproses|selesai &q=cari &sort=weight
router.get('/tugas', async (req, res) => {
    const kategori = KATEGORI[req.query.kategori] ? req.query.kategori : 'baru';
    const params = [req.user.id];
    let where = `${VISIBLE} AND ${KATEGORI[kategori]}`;

    const q = String(req.query.q || '').trim();
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (u.nama ILIKE $2 OR p.kode ILIKE $2 OR p.alamat ILIKE $2)`;
    }
    const order = req.query.sort === 'weight' ? 'p.estimasi_kg DESC, p.id' : 'p.tanggal, p.jam, p.id';

    const { rows } = await query(`${BASE_SQL} WHERE ${where} ORDER BY ${order} LIMIT 100`, params);
    ok(res, rows.map(mapPenjemputan), 200, { jumlah: await hitung(req.user.id) });
});

async function assertAccess(row, user) {
    if (row.status === 'dibatalkan') throw new ApiError(409, 'Penjemputan ini sudah dibatalkan.');
    if (row.petugas_id && row.petugas_id !== user.id) throw new ApiError(403, 'Tugas ini ditangani petugas lain.');
}

router.get('/tugas/:id', async (req, res) => {
    const row = await findPenjemputan({ query }, toId(req.params.id));
    await assertAccess(row, req.user);

    const data = mapPenjemputan(row);
    const { rows } = await query('SELECT id FROM setoran WHERE penjemputan_id = $1', [row.id]);
    data.setoran = rows[0] ? await getSetoran({ query }, rows[0].id) : null;
    ok(res, data);
});

// Ubah status: baru -> dalam_perjalanan ("Mulai perjalanan") -> tiba ("Tiba di lokasi")
const statusSchema = z.object({
    status: z.enum(['dalam_perjalanan', 'tiba'], { errorMap: () => ({ message: 'Status harus dalam_perjalanan atau tiba.' }) }),
});

router.patch('/tugas/:id/status', async (req, res) => {
    const id = toId(req.params.id);
    const { status } = parse(statusSchema, req.body);

    await tx(async (db) => {
        const row = await findPenjemputan(db, id, { lock: true });
        await assertAccess(row, req.user);
        if (row.status === 'selesai') throw new ApiError(409, 'Tugas sudah selesai.');
        if (row.status === status) return;

        await db.query(
            `UPDATE penjemputan SET status = $1, petugas_id = $2, updated_at = now() WHERE id = $3`,
            [status, req.user.id, id]
        );
        const pesan = status === 'dalam_perjalanan'
            ? `Petugas ${req.user.nama} sedang menuju lokasi penjemputan ${row.kode}.`
            : `Petugas ${req.user.nama} telah tiba di lokasi penjemputan ${row.kode}.`;
        await notify(db, row.nasabah_id, pesan, 'bi-truck');
    });

    ok(res, mapPenjemputan(await findPenjemputan({ query }, id)), 200, {
        pesan: status === 'dalam_perjalanan' ? 'Status tugas: mulai perjalanan.' : 'Status tugas: tiba di lokasi.',
    });
});

// "Selesai & setor": kirim hasil timbangan (+ foto bukti opsional).
// Bisa JSON {items:[{nama|jenis_id, berat}]} atau multipart/form-data dengan field items (JSON string) dan foto.
router.post('/tugas/:id/selesai', upload.single('foto'), async (req, res) => {
    const id = toId(req.params.id);

    let rawItems = req.body.items;
    if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch (e) { throw new ApiError(400, 'Format items tidak valid.'); }
    }
    const items = parse(itemsSchema, rawItems);

    const setoran = await tx(async (db) => {
        const row = await findPenjemputan(db, id, { lock: true });
        await assertAccess(row, req.user);
        if (row.status === 'selesai') throw new ApiError(409, 'Tugas sudah selesai.');

        const result = await catatSetoran(db, {
            nasabahId: row.nasabah_id,
            items,
            pencatatId: req.user.id,
            penjemputanId: id,
            fotoBukti: req.file ? req.file.filename : null,
        });
        await db.query(
            `UPDATE penjemputan SET status = 'selesai', petugas_id = $1, foto_bukti = $2,
                    selesai_at = now(), updated_at = now() WHERE id = $3`,
            [req.user.id, req.file ? req.file.filename : null, id]
        );
        return result;
    });

    ok(res, { penjemputan: mapPenjemputan(await findPenjemputan({ query }, id)), setoran }, 201, {
        pesan: 'Tugas telah selesai & tersimpan!',
    });
});

module.exports = router;
