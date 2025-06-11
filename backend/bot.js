// bot.js
const { handleVerification, verifyOTP } = require('./verification');
const { client } = require('./discord');

// Store email-discord user mapping
const userEmailMap = new Map();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Step 1: User sends !verify email@example.com
  if (message.content.startsWith('!verify')) {
    const email = message.content.split(' ')[1];
    if (!email || !email.includes('@')) {
      return message.reply({ content: `<@${message.author.id}> ❌ Please provide a valid email address.` });
    }

    // Store the mapping between Discord user and email
    userEmailMap.set(message.author.id, email);

    const result = await handleVerification(email);
    return message.reply({ content: `<@${message.author.id}> ${result.message}` });
  }

  // Step 2: User replies with !otp 123456
  if (message.content.startsWith('!otp')) {
    const otpInput = message.content.split(' ')[1];
    if (!otpInput) {
      return message.reply({ content: `<@${message.author.id}> ❌ Please enter an OTP.` });
    }

    const email = userEmailMap.get(message.author.id);
    if (!email) {
      return message.reply({ content: `<@${message.author.id}> ❌ Please use !verify command first with your email.` });
    }

    const result = verifyOTP(email, otpInput);
    if (!result.success) {
      return message.reply({ content: `<@${message.author.id}> ${result.message}` });
    }

    // Clear the email mapping after successful verification
    userEmailMap.delete(message.author.id);

    // Add verified role
    const verifiedRole = message.guild.roles.cache.find(r => r.name === 'Verified');
    if (verifiedRole) {
      await message.member.roles.add(verifiedRole);
      return message.reply({ content: `<@${message.author.id}> ✅ You have been verified and given access!` });
    } else {
      return message.reply({ content: `<@${message.author.id}> ⚠️ Verified, but "Verified" role not found. Please contact an administrator.` });
    }
  }
});
