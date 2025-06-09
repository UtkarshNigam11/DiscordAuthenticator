// mailer.js
const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  }
});

async function sendOTP(email, otp) {
  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: 'Your AlgoPath Discord OTP',
    text: `Your OTP for joining the AlgoPath Discord server is: ${otp}`,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendOTP };
