const { z } = require('zod');
const { ApiError } = require('../utils/http');
const { rupiah } = require('../utils/format');
const { notify } = require('./users');

const itemSchema = z
    .object({
        jenis_id: z.coerce.number().int().positive().optional(),
        nama: z.string().trim().min(1).optional(),
        berat: z.coerce.number({ invalid_type_error: 'Berat harus berupa angka.' })
            .positive('Berat harus lebih dari 0.')
            .max(10000, 'Berat terlalu besar.'),
    })
    .refine((i) => i.jenis_id || i.nama, { message: 'Jenis sampah wajib diisi.' });

const itemsSchema = z.array(itemSchema).min(1, 'Minimal satu jenis sampah harus diisi.').max(30);

const round2 = (n) => Math.round(n * 100) / 100;

async function resolveItems(db, items) {
    const { rows: jenis } = await db.query('SELECT * FROM jenis_sampah WHERE aktif');
    const byId = new Map(jenis.map((j) => [j.id, j]));
    const byNama = new Map(jenis.map((j) => [j.nama.trim().toLowerCase(), j]));

    const unknown = [];
    const resolved = [];
    for (const it of items) {
        const j = it.jenis_id ? byId.get(it.jenis_id) : byNama.get(it.nama.trim().toLowerCase());
        if (!j) {
            unknown.push(it.nama || `ID ${it.jenis_id}`);
            continue;
        }
        const berat = round2(it.berat);
        resolved.push({
            jenis_id: j.id,
            nama_jenis: j.nama,
            berat,
            harga_per_kg: j.harga_per_kg,
            subtotal: Math.round(berat * j.harga_per_kg),
            poin: Math.floor(berat * j.poin_per_kg),
        });
    }
    if (unknown.length) {
        throw new ApiError(422, `Jenis sampah tidak dikenal: ${unknown.join(', ')}. Pilih sesuai master jenis sampah.`);
    }
    return resolved;
}

async function getSetoran(db, id) {
    const { rows } = await db.query(
        `SELECT s.*, u.kode AS nasabah_kode, u.nama AS nasabah_nama
         FROM setoran s JOIN users u ON u.id = s.nasabah_id WHERE s.id = $1`,
        [id]
    );
    if (!rows[0]) throw new ApiError(404, 'Transaksi tidak ditemukan.');
    const { rows: items } = await db.query(
        `SELECT id, jenis_id, nama_jenis, berat, harga_per_kg, subtotal, poin
         FROM setoran_item WHERE setoran_id = $1 ORDER BY id`,
        [id]
    );
    return mapSetoran(rows[0], items);
}

function mapSetoran(s, items) {
    return {
        id: s.id,
        kode: s.kode,
        tanggal: s.created_at,
        nasabah: { id: s.nasabah_id, kode: s.nasabah_kode, nama: s.nasabah_nama },
        penjemputan_id: s.penjemputan_id,
        total_berat: Number(s.total_berat),
        total_nilai: Number(s.total_nilai),
        total_poin: s.total_poin,
        status: s.status,
        dibatalkan_pada: s.dibatalkan_at,
        ...(items ? { items } : {}),
    };
}

// Catat setoran: hitung nilai & poin, tambah saldo nasabah. Harus dipanggil di dalam transaksi.
async function catatSetoran(db, { nasabahId, items, pencatatId, penjemputanId = null, fotoBukti = null }) {
    const resolved = await resolveItems(db, items);
    const totalBerat = round2(resolved.reduce((a, i) => a + i.berat, 0));
    const totalNilai = resolved.reduce((a, i) => a + i.subtotal, 0);
    const totalPoin = resolved.reduce((a, i) => a + i.poin, 0);

    const { rows: nasabah } = await db.query(
        `UPDATE users SET saldo = saldo + $1, poin = poin + $2
         WHERE id = $3 AND role = 'nasabah' AND aktif RETURNING id`,
        [totalNilai, totalPoin, nasabahId]
    );
    if (!nasabah[0]) throw new ApiError(404, 'Nasabah tidak ditemukan atau tidak aktif.');

    const { rows } = await db.query(
        `INSERT INTO setoran (nasabah_id, penjemputan_id, pencatat_id, total_berat, total_nilai, total_poin, foto_bukti)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, kode`,
        [nasabahId, penjemputanId, pencatatId, totalBerat, totalNilai, totalPoin, fotoBukti]
    );
    const setoranId = rows[0].id;

    for (const it of resolved) {
        await db.query(
            `INSERT INTO setoran_item (setoran_id, jenis_id, nama_jenis, berat, harga_per_kg, subtotal, poin)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [setoranId, it.jenis_id, it.nama_jenis, it.berat, it.harga_per_kg, it.subtotal, it.poin]
        );
    }

    await notify(
        db,
        nasabahId,
        `Setoran ${rows[0].kode} selesai. Saldo bertambah ${rupiah(totalNilai)} dan ${totalPoin} poin.`,
        'bi-check-circle'
    );
    return getSetoran(db, setoranId);
}

// Batalkan setoran: kurangi kembali saldo & poin. Ditolak jika saldo/poin sudah terpakai.
async function batalkanSetoran(db, id) {
    const { rows } = await db.query('SELECT * FROM setoran WHERE id = $1 FOR UPDATE', [id]);
    const s = rows[0];
    if (!s) throw new ApiError(404, 'Transaksi tidak ditemukan.');
    if (s.status === 'dibatalkan') throw new ApiError(409, 'Transaksi sudah dibatalkan.');

    const { rows: u } = await db.query(
        `UPDATE users SET saldo = saldo - $1, poin = poin - $2
         WHERE id = $3 AND saldo >= $1 AND poin >= $2 RETURNING id`,
        [s.total_nilai, s.total_poin, s.nasabah_id]
    );
    if (!u[0]) {
        throw new ApiError(409, 'Transaksi tidak bisa dibatalkan karena saldo atau poin nasabah sudah terpakai.');
    }

    await db.query(`UPDATE setoran SET status = 'dibatalkan', dibatalkan_at = now() WHERE id = $1`, [id]);
    await notify(db, s.nasabah_id, `Transaksi ${s.kode} dibatalkan. Saldo dan poin telah dikoreksi.`, 'bi-x-circle');
    return getSetoran(db, id);
}

module.exports = { itemsSchema, catatSetoran, batalkanSetoran, getSetoran, mapSetoran };
