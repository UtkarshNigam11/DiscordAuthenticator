const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { pool } = require('./db');
const { generateOTP, validateOTP } = require('./otp');
const { sendMail } = require('./mailer');
const { assignRole } = require('./features/verification');
const { checkUserExists } = require('./discord');
const { handleVerification, verifyOTP } = require('./verification');
const { client } = require('./discord'); // Import the Discord client

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend'), {
    index: 'landing.html'  // Set landing.html as the default index file
}));

// Store Discord ID mapping and email-Discord pairs
const discordIdMap = new Map();
const emailDiscordPairs = new Map();

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

  await pool.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);
  res.json({ success: true, message: 'OTP verified and cleared.' });
});

// API endpoint for initial verification request
app.post('/api/verify', async (req, res) => {
    const { email, discordId } = req.body;
    
    if (!email || !discordId) {
        return res.json({
            success: false,
            message: 'Email and Discord ID are required'
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
            message: 'Email, Discord ID, and OTP are required'
        });
    }

    const result = await verifyOTP(email, otp, discordId);
    if (result.success) {
        // Clear the Discord ID mapping after successful verification
        discordIdMap.delete(email);
    }
    
    res.json(result);
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/landing.html'));
});

// Serve the verification page
app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/verify.html'));
});

// Serve static files for all other routes
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        next();
    } else {
        res.sendFile(path.join(__dirname, '../frontend/landing.html'));
    }
});

// Start the server and Discord bot
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Login to Discord
  if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN)
      .then(() => {
        console.log('Discord bot is ready!');
      })
      .catch(error => {
        console.error('Failed to login to Discord:', error);
      });
  } else {
    console.error('Discord token is missing! Bot will not start.');
  }
});
