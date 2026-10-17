const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { auth } = require('../middleware/auth');
const { ApiError, ok, parse, pagination, toId } = require('../utils/http');
const { normalizePhone, userPublic, csvCell } = require('../utils/format');
const {
    createUser, hashPassword, notify, mustFindUser,
} = require('../services/users');
const { BASE_SQL, mapPenjemputan, findPenjemputan } = require('../services/penjemputan');
const {
    itemsSchema, catatSetoran, batalkanSetoran, getSetoran, mapSetoran,
} = require('../services/setoran');

router.use(auth('admin'));

/* ===================== Dashboard ===================== */

router.get('/dashboard', async (req, res) => {
    const [nasabah, setoran, pending, tren, daftarPending] = await Promise.all([
        query(`SELECT COUNT(*) AS n FROM users WHERE role = 'nasabah' AND aktif`),
        query(`SELECT COALESCE(SUM(total_berat), 0) AS kg, COALESCE(SUM(total_nilai), 0) AS nilai
               FROM setoran WHERE status = 'selesai'`),
        query(`SELECT COUNT(*) AS n FROM penjemputan WHERE status = 'baru'`),
        query(
            `SELECT to_char(m, 'YYYY-MM') AS bulan, COALESCE(SUM(s.total_berat), 0) AS kg
             FROM generate_series(
                    date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '5 months',
                    date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta'),
                    interval '1 month') AS m
             LEFT JOIN setoran s
                    ON date_trunc('month', s.created_at AT TIME ZONE 'Asia/Jakarta') = m AND s.status = 'selesai'
             GROUP BY m ORDER BY m`
        ),
        query(`${BASE_SQL} WHERE p.status = 'baru' ORDER BY p.tanggal, p.id LIMIT 5`),
    ]);

    ok(res, {
        total_nasabah_aktif: nasabah.rows[0].n,
        total_sampah_kg: Number(setoran.rows[0].kg),
        total_nilai_transaksi: Number(setoran.rows[0].nilai),
        penjemputan_pending: pending.rows[0].n,
        tren_bulanan: tren.rows.map((r) => ({ bulan: r.bulan, kg: Number(r.kg) })),
        perlu_tindakan: daftarPending.rows.map(mapPenjemputan),
    });
});

/* ===================== Nasabah ===================== */

const phone = z.string().trim().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Gunakan nomor seluler Indonesia, contoh 081234567890.' });
    return n;
});
const email = z.string().trim().toLowerCase().email('Email tidak valid.');

const nasabahCreate = z.object({
    nama: z.string().trim().min(2, 'Nama wajib diisi.').max(100),
    telepon: phone,
    email: email.optional(),
    alamat: z.string().trim().min(5, 'Alamat wajib diisi.').max(300),
    password: z.string().min(6, 'Kata sandi minimal 6 karakter.').max(72),
});
const nasabahUpdate = nasabahCreate.partial();

router.get('/nasabah', async (req, res) => {
    const { page, limit, offset } = pagination(req.query, 50);
    const q = String(req.query.q || '').trim();
    const params = [];
    let where = `role = 'nasabah' AND aktif`;
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (nama ILIKE $1 OR kode ILIKE $1 OR telepon ILIKE $1 OR alamat ILIKE $1)`;
    }
    const [rows, count] = await Promise.all([
        query(`SELECT * FROM users WHERE ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params),
        query(`SELECT COUNT(*) AS n FROM users WHERE ${where}`, params),
    ]);
    ok(res, rows.rows.map(userPublic), 200, { page, limit, total: count.rows[0].n });
});

router.post('/nasabah', async (req, res) => {
    const d = parse(nasabahCreate, req.body);
    const user = await createUser({ query }, { role: 'nasabah', ...d });
    ok(res, userPublic(user), 201, { pesan: 'Nasabah ditambahkan.' });
});

router.put('/nasabah/:id', async (req, res) => {
    const id = toId(req.params.id);
    const d = parse(nasabahUpdate, req.body);
    await mustFindUser({ query }, id, 'nasabah');
    const hash = d.password ? await hashPassword(d.password) : null;
    const { rows } = await query(
        `UPDATE users SET nama = COALESCE($1, nama), telepon = COALESCE($2, telepon),
                email = COALESCE($3, email), alamat = COALESCE($4, alamat),
                password_hash = COALESCE($5, password_hash)
         WHERE id = $6 RETURNING *`,
        [d.nama || null, d.telepon || null, d.email || null, d.alamat || null, hash, id]
    );
    ok(res, userPublic(rows[0]), 200, { pesan: 'Data nasabah diperbarui.' });
});

// Nonaktifkan (riwayat transaksi tetap tersimpan)
router.delete('/nasabah/:id', async (req, res) => {
    const id = toId(req.params.id);
    await mustFindUser({ query }, id, 'nasabah');
    await query('UPDATE users SET aktif = FALSE WHERE id = $1', [id]);
    ok(res, null, 200, { pesan: 'Nasabah dinonaktifkan.' });
});

/* ===================== Petugas ===================== */

router.get('/petugas', async (req, res) => {
    const { rows } = await query(
        `SELECT u.*, (SELECT COUNT(*) FROM penjemputan p
                      WHERE p.petugas_id = u.id AND p.status IN ('baru', 'dalam_perjalanan', 'tiba')) AS tugas_aktif
         FROM users u WHERE u.role = 'petugas' AND u.aktif ORDER BY u.nama`
    );
    ok(res, rows.map((u) => ({ ...userPublic(u), tugas_aktif: u.tugas_aktif })));
});

router.post('/petugas', async (req, res) => {
    const d = parse(nasabahCreate, req.body);
    const user = await createUser({ query }, { role: 'petugas', ...d });
    ok(res, userPublic(user), 201, { pesan: 'Petugas ditambahkan.' });
});

router.delete('/petugas/:id', async (req, res) => {
    const id = toId(req.params.id);
    await mustFindUser({ query }, id, 'petugas');
    await query('UPDATE users SET aktif = FALSE WHERE id = $1', [id]);
    ok(res, null, 200, { pesan: 'Petugas dinonaktifkan.' });
});

/* ===================== Master jenis sampah ===================== */

const jenisSchema = z.object({
    nama: z.string().trim().min(2, 'Nama kategori wajib diisi.').max(80),
    harga_per_kg: z.coerce.number().int('Harga harus bilangan bulat.').min(0, 'Harga tidak boleh negatif.'),
    poin_per_kg: z.coerce.number().int().min(0).default(10),
});

router.get('/jenis-sampah', async (req, res) => {
    const { rows } = await query('SELECT * FROM jenis_sampah WHERE aktif ORDER BY id');
    ok(res, rows);
});

router.post('/jenis-sampah', async (req, res) => {
    const d = parse(jenisSchema, req.body);
    const { rows } = await query(
        'INSERT INTO jenis_sampah (nama, harga_per_kg, poin_per_kg) VALUES ($1, $2, $3) RETURNING *',
        [d.nama, d.harga_per_kg, d.poin_per_kg]
    );
    ok(res, rows[0], 201, { pesan: 'Jenis sampah ditambahkan.' });
});

router.put('/jenis-sampah/:id', async (req, res) => {
    const d = parse(jenisSchema.partial(), req.body);
    const { rows } = await query(
        `UPDATE jenis_sampah SET nama = COALESCE($1, nama), harga_per_kg = COALESCE($2, harga_per_kg),
                poin_per_kg = COALESCE($3, poin_per_kg)
         WHERE id = $4 AND aktif RETURNING *`,
        [d.nama ?? null, d.harga_per_kg ?? null, d.poin_per_kg ?? null, toId(req.params.id)]
    );
    if (!rows[0]) throw new ApiError(404, 'Jenis sampah tidak ditemukan.');
    ok(res, rows[0], 200, { pesan: 'Jenis sampah diperbarui.' });
});

// Dinonaktifkan agar riwayat transaksi lama tetap utuh
router.delete('/jenis-sampah/:id', async (req, res) => {
    const { rowCount } = await query('UPDATE jenis_sampah SET aktif = FALSE WHERE id = $1 AND aktif', [toId(req.params.id)]);
    if (!rowCount) throw new ApiError(404, 'Jenis sampah tidak ditemukan.');
    ok(res, null, 200, { pesan: 'Jenis sampah dihapus.' });
});

/* ===================== Penjemputan ===================== */

const TAB = {
    Baru: `p.status = 'baru'`,
    Dijemput: `p.status IN ('dalam_perjalanan', 'tiba')`,
    Selesai: `p.status = 'selesai'`,
};

// ?tab=Semua|Baru|Dijemput|Selesai
router.get('/penjemputan', async (req, res) => {
    const where = TAB[req.query.tab] || 'TRUE';
    const [rows, counts] = await Promise.all([
        query(`${BASE_SQL} WHERE ${where} ORDER BY p.created_at DESC LIMIT 200`),
        query(
            `SELECT COUNT(*) AS semua,
                    COUNT(*) FILTER (WHERE status = 'baru') AS baru,
                    COUNT(*) FILTER (WHERE status IN ('dalam_perjalanan', 'tiba')) AS dijemput,
                    COUNT(*) FILTER (WHERE status = 'selesai') AS selesai
             FROM penjemputan`
        ),
    ]);
    ok(res, rows.rows.map(mapPenjemputan), 200, { jumlah: counts.rows[0] });
});

router.patch('/penjemputan/:id/petugas', async (req, res) => {
    const id = toId(req.params.id);
    const { petugas_id } = parse(z.object({ petugas_id: z.coerce.number().int().positive('Pilih petugas.') }), req.body);

    await tx(async (db) => {
        const row = await findPenjemputan(db, id, { lock: true });
        if (['selesai', 'dibatalkan'].includes(row.status)) {
            throw new ApiError(409, 'Penjemputan yang sudah selesai atau dibatalkan tidak bisa diubah.');
        }
        const petugas = await mustFindUser(db, petugas_id, 'petugas');
        if (!petugas.aktif) throw new ApiError(409, 'Petugas tidak aktif.');
        await db.query('UPDATE penjemputan SET petugas_id = $1, updated_at = now() WHERE id = $2', [petugas_id, id]);
        await notify(db, petugas_id, `Tugas penjemputan ${row.kode} ditugaskan kepada Anda.`, 'bi-truck');
        await notify(db, row.nasabah_id, `Petugas ${petugas.nama} akan menjemput sampah Anda (${row.kode}).`, 'bi-truck');
    });
    ok(res, mapPenjemputan(await findPenjemputan({ query }, id)), 200, { pesan: 'Petugas ditugaskan.' });
});

router.patch('/penjemputan/:id/batal', async (req, res) => {
    const id = toId(req.params.id);
    await tx(async (db) => {
        const row = await findPenjemputan(db, id, { lock: true });
        if (['selesai', 'dibatalkan'].includes(row.status)) {
            throw new ApiError(409, 'Penjemputan yang sudah selesai atau dibatalkan tidak bisa dibatalkan.');
        }
        await db.query(`UPDATE penjemputan SET status = 'dibatalkan', updated_at = now() WHERE id = $1`, [id]);
        await notify(db, row.nasabah_id, `Penjemputan ${row.kode} dibatalkan oleh admin.`, 'bi-x-circle');
    });
    ok(res, mapPenjemputan(await findPenjemputan({ query }, id)), 200, { pesan: 'Penjemputan dibatalkan.' });
});

/* ===================== Setoran ===================== */

const setoranCreate = z.object({
    nasabah_id: z.coerce.number().int().positive('Pilih nasabah.'),
    items: itemsSchema,
});

function setoranFilter(req) {
    const params = [];
    const where = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.tanggal || '')) {
        params.push(req.query.tanggal);
        where.push(`(s.created_at AT TIME ZONE 'Asia/Jakarta')::date = $${params.length}`);
    }
    if (['selesai', 'dibatalkan'].includes(String(req.query.status || '').toLowerCase())) {
        params.push(String(req.query.status).toLowerCase());
        where.push(`s.status = $${params.length}`);
    }
    return { params, clause: where.length ? 'WHERE ' + where.join(' AND ') : '' };
}

const SETORAN_LIST = `
    SELECT s.*, u.kode AS nasabah_kode, u.nama AS nasabah_nama
    FROM setoran s JOIN users u ON u.id = s.nasabah_id`;

router.get('/setoran', async (req, res) => {
    const { page, limit, offset } = pagination(req.query, 50);
    const { params, clause } = setoranFilter(req);
    const [rows, count] = await Promise.all([
        query(`${SETORAN_LIST} ${clause} ORDER BY s.created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
        query(`SELECT COUNT(*) AS n FROM setoran s ${clause}`, params),
    ]);
    ok(res, rows.rows.map((r) => mapSetoran(r)), 200, { page, limit, total: count.rows[0].n });
});

// Tombol "Export" di dashboard: unduh CSV (mendukung filter tanggal & status yang sama)
router.get('/setoran/export', async (req, res) => {
    const { params, clause } = setoranFilter(req);
    const { rows } = await query(`${SETORAN_LIST} ${clause} ORDER BY s.created_at DESC LIMIT 5000`, params);
    const head = ['Kode', 'Tanggal', 'ID Nasabah', 'Nasabah', 'Berat (Kg)', 'Total Nilai (Rp)', 'Poin', 'Status'];
    const lines = rows.map((r) => [
        r.kode,
        new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        r.nasabah_kode, r.nasabah_nama, r.total_berat, r.total_nilai, r.total_poin, r.status,
    ].map(csvCell).join(','));
    res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="setoran-ecobank.csv"',
    });
    res.send('\uFEFF' + [head.join(','), ...lines].join('\r\n'));
});

router.get('/setoran/:id', async (req, res) => {
    ok(res, await getSetoran({ query }, toId(req.params.id)));
});

// "Konfirmasi & simpan setoran" (pencatatan manual oleh admin)
router.post('/setoran', async (req, res) => {
    const d = parse(setoranCreate, req.body);
    const result = await tx((db) => catatSetoran(db, {
        nasabahId: d.nasabah_id, items: d.items, pencatatId: req.user.id,
    }));
    ok(res, result, 201, { pesan: 'Setoran berhasil disimpan.' });
});

router.patch('/setoran/:id/batal', async (req, res) => {
    const result = await tx((db) => batalkanSetoran(db, toId(req.params.id)));
    ok(res, result, 200, { pesan: 'Transaksi dibatalkan dan saldo nasabah dikoreksi.' });
});

/* ===================== Penukaran poin ===================== */

router.get('/penukaran', async (req, res) => {
    const { rows } = await query(
        `SELECT t.id, t.kode, t.nama_reward, t.poin, t.status, t.created_at, u.kode AS nasabah_kode, u.nama AS nasabah_nama
         FROM penukaran t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC LIMIT 200`
    );
    ok(res, rows);
});

router.patch('/penukaran/:id/selesai', async (req, res) => {
    const { rows } = await query(
        `UPDATE penukaran SET status = 'selesai' WHERE id = $1 AND status = 'diproses' RETURNING *`,
        [toId(req.params.id)]
    );
    if (!rows[0]) throw new ApiError(404, 'Penukaran tidak ditemukan atau sudah selesai.');
    await notify({ query }, rows[0].user_id, `Hadiah ${rows[0].nama_reward} sudah diproses.`, 'bi-gift');
    ok(res, rows[0], 200, { pesan: 'Penukaran ditandai selesai.' });
});

module.exports = router;
