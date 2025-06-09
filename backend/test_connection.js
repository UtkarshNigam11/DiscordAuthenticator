const { pool } = require('./db');

async function testConnection() {
    try {
        const res = await pool.query('SELECT 1');
        console.log('Database connection successful:', res.rows);
    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await pool.end();
    }
}

testConnection(); 