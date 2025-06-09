// db.js
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

async function storeOTP(email, otp) {
  await pool.query(
    `INSERT INTO users (email, otp, is_verified)
     VALUES ($1, $2, false)
     ON CONFLICT (email)
     DO UPDATE SET otp = EXCLUDED.otp, is_verified = false`,
    [email, otp]
  );
}

async function verifyOTP(otp) {
  const res = await pool.query(
    'SELECT * FROM users WHERE otp = $1 AND is_verified = false',
    [otp]
  );
  return res.rows[0];
}

async function markVerified(email) {
  await pool.query('UPDATE users SET is_verified = true WHERE email = $1', [email]);
}

module.exports = { storeOTP, verifyOTP, markVerified };
