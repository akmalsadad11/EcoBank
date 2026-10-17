const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

(async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'schema.sql'), 'utf8');
        await pool.query(sql);
        console.log('Migrasi selesai: semua tabel siap.');
    } catch (err) {
        console.error('Migrasi gagal:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
