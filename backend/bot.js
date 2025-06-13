// bot.js
const { handleVerification, verifyOTP } = require('./verification');
const { client } = require('./discord');
const { checkLinkExists } = require('./linkValidator');

// Store email-discord user mapping
const userEmailMap = new Map();

// Export the client for use in other files
module.exports = {
  client,
  userEmailMap
};

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ensure this is active and at the top

  // Enhanced logging for message reception
  console.log('=== New Message ===');
  console.log(`Channel: ${message.channel.name} (${message.channel.id})`);
  console.log(`Author: ${message.author.tag} (${message.author.id})`);
  console.log(`Content: ${message.content}`);
  console.log('==================');

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

  // New command to send a random question link
  if (message.content === '!question') {
    console.log('=== !question Command Processing ===');
    console.log('Starting to process !question command');
    
    let foundValidLink = false;
    let attempts = 0;
    const maxAttempts = 10; // Limit attempts to avoid infinite loops

    while (!foundValidLink && attempts < maxAttempts) {
      const randomProblemId = Math.floor(Math.random() * (422 - 2 + 1)) + 2;
      const problemUrl = `https://www.thejoboverflow.com/problem/${randomProblemId}/`;

      console.log(`Attempt ${attempts + 1}: Checking link ${problemUrl}`);
      try {
        const linkExists = await checkLinkExists(problemUrl);
        console.log(`Link check result for ${problemUrl}: ${linkExists}`);

        if (linkExists) {
          console.log(`Link ${problemUrl} exists. Sending to channel.`);
          await message.channel.send(`Here's a random AlgoUniversity question for you: ${problemUrl}`);
          foundValidLink = true;
        } else {
          console.log(`Link ${problemUrl} does not exist, trying another...`);
          attempts++;
        }
      } catch (error) {
        console.error('Error in link checking process:', error);
        attempts++;
      }
    }

    if (!foundValidLink) {
      console.log('Could not find a valid link after multiple attempts.');
      await message.channel.send('Sorry, I could not find a valid random question at this time. Please try again later.');
    }
    console.log('=== !question Command Processing Complete ===');
  }
});
