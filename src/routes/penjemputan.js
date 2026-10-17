const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { auth } = require('../middleware/auth');
const { ApiError, ok, parse, toId } = require('../utils/http');
const { todayJakarta } = require('../utils/format');
const { notifyRole } = require('../services/users');
const {
    BASE_SQL, ESTIMASI_KG, JAM_SLOT, mapPenjemputan, findPenjemputan,
} = require('../services/penjemputan');

router.use(auth('nasabah'));

const createSchema = z.object({
    alamat: z.string().trim().min(5, 'Alamat penjemputan wajib diisi.').max(300).optional(),
    jenis: z.array(z.string().trim().min(1).max(50)).min(1, 'Pilih minimal satu jenis sampah.').max(10),
    estimasi_berat: z.enum(Object.keys(ESTIMASI_KG), { errorMap: () => ({ message: 'Pilih estimasi berat.' }) }),
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal penjemputan wajib diisi.'),
    jam: z.enum(JAM_SLOT, { errorMap: () => ({ message: 'Pilih jam penjemputan.' }) }),
    catatan: z.string().trim().max(300).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
});

router.post('/', async (req, res) => {
    const d = parse(createSchema, req.body);
    if (d.tanggal < todayJakarta()) throw new ApiError(422, 'Tanggal penjemputan tidak boleh sebelum hari ini.');

    const alamat = d.alamat || req.user.alamat;
    if (!alamat) throw new ApiError(422, 'Alamat penjemputan wajib diisi.');

    const row = await tx(async (db) => {
        const { rows } = await db.query(
            `INSERT INTO penjemputan (nasabah_id, alamat, jenis, estimasi_berat, estimasi_kg, tanggal, jam, catatan, lat, lon)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, kode`,
            [req.user.id, alamat, d.jenis, d.estimasi_berat, ESTIMASI_KG[d.estimasi_berat],
                d.tanggal, d.jam, d.catatan || null, d.lat ?? null, d.lon ?? null]
        );
        await notifyRole(db, 'admin', `Permintaan penjemputan baru ${rows[0].kode} dari ${req.user.nama}.`, 'bi-truck');
        return rows[0];
    });

    ok(res, mapPenjemputan(await findPenjemputan({ query }, row.id)), 201, {
        pesan: 'Permintaan penjemputan terkirim ke petugas.',
    });
});

router.get('/', async (req, res) => {
    const { rows } = await query(`${BASE_SQL} WHERE p.nasabah_id = $1 ORDER BY p.created_at DESC LIMIT 50`, [req.user.id]);
    ok(res, rows.map(mapPenjemputan));
});

router.get('/:id', async (req, res) => {
    const row = await findPenjemputan({ query }, toId(req.params.id));
    if (row.nasabah_id !== req.user.id) throw new ApiError(404, 'Data penjemputan tidak ditemukan.');
    ok(res, mapPenjemputan(row));
});

// Nasabah hanya boleh membatalkan selama belum dijemput
router.patch('/:id/batal', async (req, res) => {
    const id = toId(req.params.id);
    await tx(async (db) => {
        const row = await findPenjemputan(db, id, { lock: true });
        if (row.nasabah_id !== req.user.id) throw new ApiError(404, 'Data penjemputan tidak ditemukan.');
        if (row.status !== 'baru') throw new ApiError(409, 'Penjemputan sudah diproses petugas dan tidak bisa dibatalkan.');
        await db.query(`UPDATE penjemputan SET status = 'dibatalkan', updated_at = now() WHERE id = $1`, [id]);
    });
    ok(res, mapPenjemputan(await findPenjemputan({ query }, id)), 200, { pesan: 'Penjemputan dibatalkan.' });
});

module.exports = router;
