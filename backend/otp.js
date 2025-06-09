const { pool } = require('./db');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function validateOTP(email, otp) {
  const res = await pool.query('SELECT otp, otp_created_at FROM users WHERE email = $1', [email]);

  if (res.rows.length === 0) return { success: false, message: 'Email not found.' };

  const { otp: storedOtp, otp_created_at } = res.rows[0];
  const now = new Date();
  const created = new Date(otp_created_at);
  const diff = (now - created) / 1000 / 60;

  if (storedOtp !== otp) return { success: false, message: 'Invalid OTP.' };
  if (diff > 10) return { success: false, message: 'OTP expired.' };

  return { success: true, message: 'OTP verified.' };
}

module.exports = { generateOTP, validateOTP };
