const { ApiError } = require('../utils/http');

const PG_UNIQUE = {
    users_telepon_key: 'Nomor telepon sudah terdaftar.',
    users_email_key: 'Email sudah terdaftar.',
    jenis_sampah_nama_uq: 'Nama jenis sampah sudah ada.',
};

function notFound(req, res) {
    res.status(404).json({ ok: false, pesan: 'Endpoint tidak ditemukan.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof ApiError) {
        return res.status(err.status).json({ ok: false, pesan: err.message, detail: err.details });
    }
    if (err.code === '23505') {
        return res.status(409).json({ ok: false, pesan: PG_UNIQUE[err.constraint] || 'Data sudah ada.' });
    }
    if (err.code === '23514') {
        return res.status(409).json({ ok: false, pesan: 'Perubahan ditolak karena melanggar aturan data (misalnya saldo atau poin tidak cukup).' });
    }
    if (err.name === 'MulterError') {
        const pesan = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 5 MB.' : 'Gagal mengunggah foto.';
        return res.status(400).json({ ok: false, pesan });
    }
    if (err.name === 'UploadError') {
        return res.status(400).json({ ok: false, pesan: err.message });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ ok: false, pesan: 'Format JSON tidak valid.' });
    }
    console.error(err);
    res.status(500).json({ ok: false, pesan: 'Terjadi kesalahan pada server.' });
}

module.exports = { notFound, errorHandler };
