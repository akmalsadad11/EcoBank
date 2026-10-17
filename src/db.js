const { Pool, types } = require('pg');
const config = require('./config');

// Kembalikan angka sebagai number JS, dan DATE sebagai string 'YYYY-MM-DD'
types.setTypeParser(20, (v) => parseInt(v, 10));    // BIGINT / COUNT
types.setTypeParser(1700, (v) => parseFloat(v));    // NUMERIC
types.setTypeParser(1082, (v) => v);                // DATE

const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
});

const query = (text, params) => pool.query(text, params);

// Jalankan beberapa query dalam satu transaksi
async function tx(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* abaikan */ }
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, tx };
