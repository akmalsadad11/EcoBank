const router = require('express').Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('../config');
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { ApiError, ok, parse } = require('../utils/http');
const { normalizePhone, userPublic } = require('../utils/format');
const { createUser, checkPassword, hashPassword } = require('../services/users');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, pesan: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' },
});

const phone = z.string().trim().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Gunakan nomor seluler Indonesia, contoh 081234567890.' });
    return n;
});

const registerSchema = z.object({
    nama: z.string().trim().min(2, 'Nama lengkap wajib diisi.').max(100),
    telepon: phone,
    email: z.string().trim().toLowerCase().email('Masukkan alamat email yang valid.'),
    password: z.string().min(6, 'Kata sandi minimal 6 karakter.').max(72),
    alamat: z.string().trim().min(5, 'Alamat dipakai petugas untuk menjemput sampah.').max(300),
});

const loginSchema = z.object({
    id: z.string().trim().min(1, 'Isi nomor telepon atau email Anda.'),
    password: z.string().min(1, 'Kata sandi wajib diisi.'),
    ingat: z.boolean().optional(),
});

const REDIRECT = {
    nasabah: '/index.html',
    petugas: '/petugas/petugas.html',
    admin: '/admin/admin-dashboard.html',
};

// Pendaftaran publik: selalu sebagai nasabah
router.post('/register', limiter, async (req, res) => {
    const d = parse(registerSchema, req.body);
    const user = await createUser({ query }, { role: 'nasabah', ...d });
    ok(res, userPublic(user), 201, { pesan: 'Pendaftaran berhasil. Silakan masuk dengan akun baru Anda.' });
});

router.post('/login', limiter, async (req, res) => {
    const d = parse(loginSchema, req.body);
    const byEmail = d.id.includes('@');
    const ident = byEmail ? d.id.toLowerCase() : normalizePhone(d.id);

    let user = null;
    if (ident) {
        const { rows } = await query(
            `SELECT * FROM users WHERE ${byEmail ? 'email' : 'telepon'} = $1`,
            [ident]
        );
        user = rows[0] || null;
    }

    const valid = await checkPassword(d.password, user && user.password_hash);
    if (!user || !valid) throw new ApiError(401, 'Nomor telepon/email atau kata sandi salah.');
    if (!user.aktif) throw new ApiError(403, 'Akun Anda dinonaktifkan. Hubungi admin.');

    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
        expiresIn: d.ingat ? '30d' : '1d',
    });
    ok(res, { token, user: userPublic(user), redirect: REDIRECT[user.role] }, 200, { pesan: 'Berhasil masuk. Selamat datang kembali.' });
});

router.get('/me', auth(), async (req, res) => {
    ok(res, userPublic(req.user));
});

const profilSchema = z.object({
    nama: z.string().trim().min(2).max(100).optional(),
    alamat: z.string().trim().min(5).max(300).optional(),
    telepon: phone.optional(),
    email: z.string().trim().toLowerCase().email('Masukkan alamat email yang valid.').optional(),
});

router.put('/me', auth(), async (req, res) => {
    const d = parse(profilSchema, req.body);
    const { rows } = await query(
        `UPDATE users SET nama = COALESCE($1, nama), alamat = COALESCE($2, alamat),
                telepon = COALESCE($3, telepon), email = COALESCE($4, email)
         WHERE id = $5 RETURNING *`,
        [d.nama || null, d.alamat || null, d.telepon || null, d.email || null, req.user.id]
    );
    ok(res, userPublic(rows[0]), 200, { pesan: 'Data akun diperbarui.' });
});

const passwordSchema = z.object({
    password_lama: z.string().min(1, 'Kata sandi lama wajib diisi.'),
    password_baru: z.string().min(6, 'Kata sandi baru minimal 6 karakter.').max(72),
});

router.put('/password', auth(), async (req, res) => {
    const d = parse(passwordSchema, req.body);
    if (!(await checkPassword(d.password_lama, req.user.password_hash))) {
        throw new ApiError(400, 'Kata sandi lama salah.');
    }
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(d.password_baru), req.user.id]);
    ok(res, null, 200, { pesan: 'Kata sandi berhasil diganti.' });
});

module.exports = router;
