const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db');
const { ApiError } = require('../utils/http');

// auth()            -> semua pengguna yang sudah masuk
// auth('admin')     -> hanya admin
// auth('petugas', 'admin') -> petugas atau admin
function auth(...roles) {
    return async (req, res, next) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) throw new ApiError(401, 'Silakan masuk terlebih dahulu.');

        let payload;
        try {
            payload = jwt.verify(token, config.jwtSecret);
        } catch (e) {
            throw new ApiError(401, 'Sesi berakhir, silakan masuk lagi.');
        }

        const { rows } = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
        const user = rows[0];
        if (!user || !user.aktif) throw new ApiError(401, 'Akun tidak ditemukan atau dinonaktifkan.');
        if (roles.length && !roles.includes(user.role)) throw new ApiError(403, 'Anda tidak memiliki akses ke fitur ini.');

        req.user = user;
        next();
    };
}

module.exports = { auth };
