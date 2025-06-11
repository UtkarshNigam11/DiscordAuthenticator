const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Log token status (without exposing the actual token)
console.log('Discord Token Status:', process.env.DISCORD_TOKEN ? 'Present' : 'Missing');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
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

// Login to Discord
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error);
  });
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

// New function to check if user exists in server
async function checkUserExists(username) {
  try {
    await waitForReady();
    
    if (!process.env.DISCORD_GUILD_ID) {
      console.error('DISCORD_GUILD_ID is missing');
      return { success: false, message: 'Server configuration error' };
    }

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    await guild.members.fetch();
    
    const member = guild.members.cache.find(m => 
      m.user.username.toLowerCase() === username.toLowerCase() ||
      m.user.tag.toLowerCase() === username.toLowerCase()
    );

    if (!member) {
      return { 
        success: false, 
        message: 'Could not find you in the server. Please make sure you have joined the AlgoPath Discord server first.' 
      };
    }

    return { 
      success: true, 
      message: 'User found in server',
      userId: member.id
    };
  } catch (err) {
    console.error('Error checking user:', err);
    return { 
      success: false, 
      message: 'Error checking Discord server. Please try again.' 
    };
  }
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
      r.name.toLowerCase() === 'algopath-verified' ||
      r.name.toLowerCase() === 'premium'
    );

    if (!role) {
      console.error('Could not find Verified role. Available roles are listed above.');
      return { success: false, message: '"Verified" role not found on server. Please check role name.' };
    }

    console.log(`Found role: ${role.name} (ID: ${role.id})`);
    
    // Check if member already has the role
    if (member.roles.cache.has(role.id)) {
      console.log('Member already has the role');
      return { success: true, message: 'User already verified!' };
    }

    await member.roles.add(role);
    console.log('Successfully assigned role to member');
    return { success: true, message: 'User verified and role assigned!' };
  } catch (err) {
    console.error('Error assigning role:', err);
    return { success: false, message: 'Failed to assign role. Please try again later.' };
  }
}

// Add welcome message when member joins
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`New member joined: ${member.user.tag}`);
    
    // Create verification URL with username
    const baseUrl = process.env.FRONTEND_URL || 'https://web-production-621c.up.railway.app';
    const verificationUrl = `${baseUrl}/verify?username=${encodeURIComponent(member.user.username)}`;
    
    const welcomeMessage = {
      content: `🎉 Welcome to AlgoPath, ${member.user.username}! 🎉\n\nTo access all channels, please verify your account:\n${verificationUrl}`,
      allowedMentions: { users: [member.id] }
    };
    
    // Find the welcome channel
    const welcomeChannel = member.guild.channels.cache.find(ch => 
      ch.name.toLowerCase() === 'welcome' && 
      ch.type === 0 // 0 is GUILD_TEXT
    );
    
    if (welcomeChannel) {
      await welcomeChannel.send(welcomeMessage);
      console.log(`Sent welcome message in channel ${welcomeChannel.name}`);
    } else {
      console.error('Could not find welcome channel. Available channels:');
      member.guild.channels.cache.forEach(ch => {
        console.log(`- ${ch.name} (Type: ${ch.type})`);
      });
    }
  } catch (error) {
    console.error('Error in welcome message:', error);
  }
});

// Function to clean up existing channels
async function cleanupChannels(guild) {
    try {
        console.log('Cleaning up existing channels...');
        const channels = await guild.channels.fetch();
        for (const [id, channel] of channels) {
            if (channel.type === 4) { // Category
                await channel.delete();
            } else if (channel.type === 0 || channel.type === 2) { // Text or Voice
                await channel.delete();
            }
        }
        console.log('Cleanup completed');
        return true;
    } catch (error) {
        console.error('Error during cleanup:', error);
        return false;
    }
}

// Function to create server structure
async function createServerStructure(guild) {
    try {
        console.log('Creating server structure...');

        // First, clean up existing channels
        await cleanupChannels(guild);

        // Create Verified role
        const verifiedRole = await guild.roles.create({
            name: '✅ Verified',
            color: '#00ff00',
            reason: 'Role for verified members',
            position: 1 // Position it below the @everyone role
        });

        // Create categories
        const infoCategory = await guild.channels.create({
            name: '📢 INFO & RULES',
            type: 4, // GUILD_CATEGORY
            position: 0,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone role
                    deny: ['SendMessages'],
                    allow: ['ViewChannel', 'ReadMessageHistory']
                }
            ]
        });

        const generalCategory = await guild.channels.create({
            name: '💬 GENERAL',
            type: 4,
            position: 1,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone role
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id, // Verified role
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        const studyCategory = await guild.channels.create({
            name: '📖 STUDY ROOMS',
            type: 4,
            position: 2,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone role
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id, // Verified role
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        const dsaCategory = await guild.channels.create({
            name: '📁 DSA / DEV HELP',
            type: 4,
            position: 3,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone role
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id, // Verified role
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        const communityCategory = await guild.channels.create({
            name: '🤝 COMMUNITY',
            type: 4,
            position: 4,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone role
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id, // Verified role
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        // Create channels in INFO & RULES (public)
        await guild.channels.create({
            name: '📌welcome',
            type: 0,
            parent: infoCategory.id,
            topic: 'Welcome to AlgoPath! Start your journey here.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['SendMessages'],
                    allow: ['ViewChannel', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '📜rules',
            type: 0,
            parent: infoCategory.id,
            topic: 'Server rules and guidelines. Please read before participating.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['SendMessages'],
                    allow: ['ViewChannel', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '🎓how-to-study',
            type: 0,
            parent: infoCategory.id,
            topic: 'Tips and resources for effective studying and learning.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['SendMessages'],
                    allow: ['ViewChannel', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '✅verification',
            type: 0,
            parent: infoCategory.id,
            topic: 'Verify your account to access all channels.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        // Create channels in GENERAL (private)
        await guild.channels.create({
            name: '💬general-chat',
            type: 0,
            parent: generalCategory.id,
            topic: 'General discussion and casual conversation.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions']
                }
            ]
        });

        await guild.channels.create({
            name: '🌍introductions',
            type: 0,
            parent: generalCategory.id,
            topic: 'Introduce yourself to the community!',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '📸study-setups',
            type: 0,
            parent: generalCategory.id,
            topic: 'Share your study setup and workspace!',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '📅event-calendar',
            type: 0,
            parent: generalCategory.id,
            topic: 'Upcoming events and study sessions.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        // Create channels in STUDY ROOMS (private)
        await guild.channels.create({
            name: '📚study-logs',
            type: 0,
            parent: studyCategory.id,
            topic: 'Share your daily study progress and achievements.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '🧘‍♂️focus-music',
            type: 0,
            parent: studyCategory.id,
            topic: 'Share and discuss focus music and study playlists.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '🎙️ Focus Room',
            type: 2,
            parent: studyCategory.id,
            topic: 'Voice channel for focused study sessions.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'Connect', 'Speak']
                }
            ]
        });

        // Create channels in DSA / DEV HELP (private)
        await guild.channels.create({
            name: '📊dsa-doubts',
            type: 0,
            parent: dsaCategory.id,
            topic: 'Get help with Data Structures and Algorithms problems.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '🧑‍💻web-dev',
            type: 0,
            parent: dsaCategory.id,
            topic: 'Web development discussions and help.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '🤖ai-ml',
            type: 0,
            parent: dsaCategory.id,
            topic: 'Artificial Intelligence and Machine Learning discussions.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '💼career-tips',
            type: 0,
            parent: dsaCategory.id,
            topic: 'Career advice, interview preparation, and job opportunities.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        // Create channels in COMMUNITY (private)
        await guild.channels.create({
            name: '🙌collab-opportunities',
            type: 0,
            parent: communityCategory.id,
            topic: 'Find study partners and project collaborators.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        await guild.channels.create({
            name: '🎉milestones',
            type: 0,
            parent: communityCategory.id,
            topic: 'Celebrate your learning achievements and milestones!',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions']
                }
            ]
        });

        await guild.channels.create({
            name: '🤣memes-and-fun',
            type: 0,
            parent: communityCategory.id,
            topic: 'Share memes and have fun! Keep it appropriate.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                }
            ]
        });

        await guild.channels.create({
            name: '🎙️ Community Voice',
            type: 2,
            parent: communityCategory.id,
            topic: 'Voice channel for community discussions and casual chat.',
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                    allow: []
                },
                {
                    id: verifiedRole.id,
                    allow: ['ViewChannel', 'Connect', 'Speak']
                }
            ]
        });

        // Send welcome message to the welcome channel
        const welcomeChannel = guild.channels.cache.find(ch => ch.name === '📌welcome');
        if (welcomeChannel) {
            await welcomeChannel.send({
                content: `# Welcome to AlgoPath! 🎉

## Getting Started
1. Read the <#${guild.channels.cache.find(ch => ch.name === '📜rules').id}> to understand our community guidelines
2. Head to <#${guild.channels.cache.find(ch => ch.name === '✅verification').id}> to verify your account
3. After verification, you'll get access to all channels and can introduce yourself in <#${guild.channels.cache.find(ch => ch.name === '🌍introductions').id}>

## Key Channels (Available after verification)
- <#${guild.channels.cache.find(ch => ch.name === '💬general-chat').id}> - General discussion
- <#${guild.channels.cache.find(ch => ch.name === '📊dsa-doubts').id}> - DSA help
- <#${guild.channels.cache.find(ch => ch.name === '🧑‍💻web-dev').id}> - Web development
- <#${guild.channels.cache.find(ch => ch.name === '🤖ai-ml').id}> - AI/ML discussions

## Study Together (Available after verification)
- Join <#${guild.channels.cache.find(ch => ch.name === '🎙️ Focus Room').id}> for focused study sessions
- Share your progress in <#${guild.channels.cache.find(ch => ch.name === '📚study-logs').id}>
- Find study partners in <#${guild.channels.cache.find(ch => ch.name === '🙌collab-opportunities').id}>

We're excited to have you here! 🚀`
            });
        }

        console.log('Server structure created successfully!');
        return true;
    } catch (error) {
        console.error('Error creating server structure:', error);
        return false;
    }
}

// Add command to create server structure
client.on('messageCreate', async (message) => {
    if (message.content === '!setup' && message.member.permissions.has('ADMINISTRATOR')) {
        const result = await createServerStructure(message.guild);
        if (result) {
            message.reply('Server structure has been created successfully!');
        } else {
            message.reply('There was an error creating the server structure. Please check the console for details.');
        }
    }
});

module.exports = { assignRole, checkUserExists, client, createServerStructure };
