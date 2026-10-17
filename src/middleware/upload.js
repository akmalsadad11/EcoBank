const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

fs.mkdirSync(config.uploadDir, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, config.uploadDir),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (EXT[file.mimetype]) return cb(null, true);
        const err = new Error('Foto harus berformat JPG, PNG, atau WebP.');
        err.name = 'UploadError';
        cb(err);
    },
});

module.exports = { upload };
