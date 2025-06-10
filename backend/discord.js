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

let isReady = false;

// Add error handling for login
client.on('error', error => {
  console.error('Discord client error:', error);
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  isReady = true;
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

async function waitForReady() {
  if (isReady) return;
  
  return new Promise((resolve) => {
    const checkReady = () => {
      if (isReady) {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}

async function assignRole(username) {
  try {
    // Wait for bot to be ready
    await waitForReady();
    
    if (!process.env.DISCORD_GUILD_ID) {
      console.error('DISCORD_GUILD_ID is missing');
      return { success: false, message: 'Server configuration error' };
    }

    console.log('Bot is ready, attempting to assign role...');
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log('Found guild:', guild.name);

    // Fetch all members to find the user by username
    await guild.members.fetch();
    const member = guild.members.cache.find(m => 
      m.user.username.toLowerCase() === username.toLowerCase() ||
      m.user.tag.toLowerCase() === username.toLowerCase()
    );

    if (!member) {
      console.error('Could not find member with username:', username);
      return { success: false, message: 'Could not find user in the server. Make sure you are a member of the server.' };
    }

    console.log('Found member:', member.user.tag);

    // Log all available roles
    console.log('Available roles in server:');
    guild.roles.cache.forEach(role => {
      console.log(`- ${role.name} (ID: ${role.id})`);
    });

    // Try to find the role (case-insensitive)
    const role = guild.roles.cache.find(r => 
      r.name.toLowerCase() === 'verified' || 
      r.name.toLowerCase() === 'algopath verified' ||
      r.name.toLowerCase() === 'algopath-verified'
    );

    if (!role) {
      console.error('Could not find Verified role. Available roles are listed above.');
      return { success: false, message: '"Verified" role not found on server. Please check role name.' };
    }

    console.log(`Found role: ${role.name} (ID: ${role.id})`);
    await member.roles.add(role);
    console.log('Successfully assigned role to member');
    return { success: true, message: 'User verified and role assigned!' };
  } catch (err) {
    console.error('Error assigning role:', err);
    return { success: false, message: 'Failed to assign role. Check bot permissions or user ID.' };
  }
}

module.exports = { assignRole };
