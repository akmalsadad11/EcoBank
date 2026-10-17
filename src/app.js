const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, layanan: 'ecobank-backend' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/nasabah', require('./routes/nasabah'));
app.use('/api/penjemputan', require('./routes/penjemputan'));
app.use('/api/rewards', require('./routes/reward'));
app.use('/api/notifikasi', require('./routes/notifikasi'));
app.use('/api/jenis-sampah', require('./routes/jenis'));
app.use('/api/petugas', require('./routes/petugas'));
app.use('/api/admin', require('./routes/admin'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
