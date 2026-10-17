const bcrypt = require('bcryptjs');
const { ApiError } = require('../utils/http');

const PREFIX = { nasabah: 'NSB', petugas: 'PTG', admin: 'ADM' };

// Hash palsu untuk menyamakan waktu respons saat akun tidak ditemukan
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const hashPassword = (plain) => bcrypt.hash(plain, 10);

async function checkPassword(plain, hash) {
    return bcrypt.compare(plain, hash || DUMMY_HASH);
}

async function createUser(db, { role, nama, telepon, email, password, alamat }) {
    const hash = await hashPassword(password);
    const { rows } = await db.query(
        `INSERT INTO users (kode, role, nama, telepon, email, password_hash, alamat)
         VALUES ($1 || '-' || lpad(nextval('seq_kode_user')::text, 4, '0'), $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [PREFIX[role], role, nama, telepon, email ? email.toLowerCase() : null, hash, alamat || null]
    );
    return rows[0];
}

async function notify(db, userId, pesan, ikon = 'bi-info-circle') {
    await db.query('INSERT INTO notifikasi (user_id, pesan, ikon) VALUES ($1, $2, $3)', [userId, pesan, ikon]);
}

async function notifyRole(db, role, pesan, ikon = 'bi-info-circle') {
    await db.query(
        `INSERT INTO notifikasi (user_id, pesan, ikon)
         SELECT id, $2, $3 FROM users WHERE role = $1 AND aktif`,
        [role, pesan, ikon]
    );
}

async function mustFindUser(db, id, role) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1 AND role = $2', [id, role]);
    if (!rows[0]) throw new ApiError(404, `${role === 'nasabah' ? 'Nasabah' : 'Petugas'} tidak ditemukan.`);
    return rows[0];
}

module.exports = { hashPassword, checkPassword, createUser, notify, notifyRole, mustFindUser };
