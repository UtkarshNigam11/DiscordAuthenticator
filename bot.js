// bot.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { generateOTP } = require('./otp');
const { sendOTP } = require('./mailer');
const { storeOTP, verifyOTP, markVerified } = require('./db');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Step 1: User sends !verify email@algouniversity.com
  if (message.content.startsWith('!verify')) {
    const email = message.content.split(' ')[1];
    if (!email || !email.includes('@')) return message.reply('❌ Please provide a valid email.');

    const otp = generateOTP();
    await storeOTP(email, otp);
    await sendOTP(email, otp);

    return message.reply(`📧 OTP sent to ${email}. Reply with \`!otp <your_otp>\` to verify.`);
  }

  // Step 2: User replies with !otp 123456
  if (message.content.startsWith('!otp')) {
    const otpInput = message.content.split(' ')[1];
    if (!otpInput) return message.reply('❌ Please enter an OTP.');

    const user = await verifyOTP(otpInput);
    if (!user) return message.reply('❌ Invalid or expired OTP.');

    await markVerified(user.email);

    const verifiedRole = message.guild.roles.cache.find(r => r.name === 'Verified');
    if (verifiedRole) {
      await message.member.roles.add(verifiedRole);
      return message.reply('✅ You have been verified and given access!');
    } else {
      return message.reply('⚠️ Verified, but "Verified" role not found. Ask an admin.');
    }
  }
});

client.login(config.discord.token);
