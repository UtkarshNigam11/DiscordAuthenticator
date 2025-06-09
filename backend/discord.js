const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Log token status (without exposing the actual token)
console.log('Discord Token Status:', process.env.DISCORD_TOKEN ? 'Present' : 'Missing');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// Add error handling for login
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Wrap the login in a try-catch
try {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Discord token is missing from environment variables');
  }
  client.login(process.env.DISCORD_TOKEN);
} catch (error) {
  console.error('Failed to login to Discord:', error.message);
}

async function assignRole(discordUserId) {
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordUserId);
    const role = guild.roles.cache.find(r => r.name === 'Verified');

    if (!role) return { success: false, message: '"Verified" role not found on server.' };

    await member.roles.add(role);
    return { success: true, message: 'User verified and role assigned!' };
  } catch (err) {
    console.error('Error assigning role:', err);
    return { success: false, message: 'Failed to assign role. Check bot permissions or user ID.' };
  }
}

module.exports = { assignRole };
