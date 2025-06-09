const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { pool } = require('./db');
const { generateOTP, validateOTP } = require('./otp');
const { sendMail } = require('./mailer');
const { assignRole } = require('./discord');
const { handleVerification, verifyOTP } = require('./verification');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Store Discord ID mapping
const discordIdMap = new Map();

// Log environment variables status (without exposing sensitive data)
console.log('Environment Check:');
console.log('- Discord Token:', process.env.DISCORD_TOKEN ? 'Present' : 'Missing');
console.log('- SendGrid API Key:', process.env.SENDGRID_API_KEY ? 'Present' : 'Missing');
console.log('- Database:', process.env.PGDATABASE ? 'Present' : 'Missing');

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (user.rows.length === 0) {
    return res.json({ success: false, message: 'Email not found in Algopath records' });
  }

  const otp = generateOTP();
  await pool.query('UPDATE users SET otp = $1, otp_created_at = NOW() WHERE email = $2', [otp, email]);
  await sendMail(email, otp);

  res.json({ success: true, message: 'OTP sent to your email.' });
});

app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  const result = await validateOTP(email, otp);
  if (!result.success) return res.json(result);

  const user = await pool.query('SELECT discord_id FROM users WHERE email = $1', [email]);
  const discordId = user.rows[0].discord_id;

  const roleResult = await assignRole(discordId);
  if (roleResult.success) {
    await pool.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);
  }

  res.json(roleResult);
});

// API endpoint for initial verification request
app.post('/api/verify', async (req, res) => {
    const { email, discordId } = req.body;
    
    if (!email || !discordId) {
        return res.json({
            success: false,
            message: 'Email and Discord username are required'
        });
    }

    // Store Discord ID mapping
    discordIdMap.set(email, discordId);

    const result = await handleVerification(email);
    res.json(result);
});

// API endpoint for OTP verification
app.post('/api/verify-otp', async (req, res) => {
    const { email, discordId, otp } = req.body;
    
    if (!email || !discordId || !otp) {
        return res.json({
            success: false,
            message: 'Email, Discord username, and OTP are required'
        });
    }

    // Verify the Discord ID matches
    const storedDiscordId = discordIdMap.get(email);
    if (storedDiscordId !== discordId) {
        return res.json({
            success: false,
            message: 'Discord username does not match the one used for verification'
        });
    }

    const result = verifyOTP(email, otp);
    if (result.success) {
        // Clear the Discord ID mapping after successful verification
        discordIdMap.delete(email);
    }
    
    res.json(result);
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
