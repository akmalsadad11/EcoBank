require('dotenv').config();
const { pool } = require('../db');
const { createUser } = require('../services/users');
const { normalizePhone } = require('../utils/format');

const JENIS = [
    ['Botol Plastik PET', 3500, 12],
    ['Plastik Campur', 1500, 8],
    ['Kardus Tebal', 2500, 10],
    ['Kertas Koran', 2000, 8],
    ['Kertas Arsip', 2200, 8],
    ['Kaleng Aluminium', 9000, 20],
    ['Gelas Kaca', 500, 5],
    ['Elektronik Kecil', 6000, 25],
    ['Minyak Jelantah', 5000, 15],
];

const REWARDS = [
    ['Bibit tanaman hias', 'Satu pot bibit siap tanam dari mitra pembibitan lokal.', 'bi-flower1', 500],
    ['Voucher belanja Rp 25.000', 'Berlaku di minimarket mitra di seluruh Jabodetabek.', 'bi-cart3', 800],
    ['Pulsa Rp 50.000', 'Dikirim ke nomor telepon yang terdaftar di akun Anda.', 'bi-phone', 1000],
    ['Tumbler stainless', 'Tumbler 500 ml pengganti botol plastik sekali pakai.', 'bi-cup-hot', 1200],
    ['Token listrik Rp 100.000', 'Kode token dikirim lewat WhatsApp setelah penukaran diproses.', 'bi-lightning-charge', 1500],
    ['Paket sembako', 'Beras, minyak, dan gula. Diantar bersama jadwal penjemputan berikutnya.', 'bi-basket', 2000],
];

async function ensureUser(role, data) {
    const { rows } = await pool.query('SELECT id FROM users WHERE telepon = $1', [data.telepon]);
    if (rows[0]) return false;
    await createUser(pool, { role, ...data });
    return true;
}

(async () => {
    try {
        for (const [nama, harga, poin] of JENIS) {
            await pool.query(
                'INSERT INTO jenis_sampah (nama, harga_per_kg, poin_per_kg) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [nama, harga, poin]
            );
        }

        const { rows } = await pool.query('SELECT COUNT(*) AS n FROM rewards');
        if (rows[0].n === 0) {
            for (const [nama, deskripsi, ikon, biaya] of REWARDS) {
                await pool.query(
                    'INSERT INTO rewards (nama, deskripsi, ikon, biaya_poin) VALUES ($1, $2, $3, $4)',
                    [nama, deskripsi, ikon, biaya]
                );
            }
        }

        const adminTelp = normalizePhone(process.env.ADMIN_TELEPON || '081200000000');
        const adminBaru = await ensureUser('admin', {
            nama: process.env.ADMIN_NAMA || 'Administrator',
            telepon: adminTelp,
            email: process.env.ADMIN_EMAIL || 'admin@ecobank.local',
            password: process.env.ADMIN_PASSWORD || 'Admin12345',
            alamat: 'Kantor Bank Sampah',
        });
        console.log(adminBaru ? 'Akun admin dibuat.' : 'Akun admin sudah ada.');

        if (process.env.SEED_DEMO === 'true') {
            await ensureUser('petugas', {
                nama: 'Andi Wijaya', telepon: '081100000001', email: 'andi@ecobank.local',
                password: 'petugas123', alamat: 'Pos Petugas 04',
            });
            await ensureUser('nasabah', {
                nama: 'Rian Hermawan', telepon: '081234567890', email: 'rian@ecobank.local',
                password: 'nasabah123', alamat: 'Jl. Kebon Jeruk No. 12, RT 05/RW 03, Jakarta Barat',
            });
            console.log('Akun demo siap (petugas 081100000001 / petugas123, nasabah 081234567890 / nasabah123).');
        }
        console.log('Seed selesai.');
    } catch (err) {
        console.error('Seed gagal:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
