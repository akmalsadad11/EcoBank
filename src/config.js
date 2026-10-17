require('dotenv').config();
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    if (isProd) {
        throw new Error('JWT_SECRET wajib diisi (minimal 32 karakter) di mode production.');
    }
    console.warn('[config] JWT_SECRET belum diisi / terlalu pendek. Hanya boleh untuk development.');
}

module.exports = {
    isProd,
    port: Number(process.env.PORT) || 4000,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecobank',
    databaseSsl: process.env.DATABASE_SSL === 'true',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-jangan-dipakai-di-production-1234567890',
    corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
    publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
    uploadDir: path.join(__dirname, '..', 'uploads'),
    timezone: 'Asia/Jakarta',
};
