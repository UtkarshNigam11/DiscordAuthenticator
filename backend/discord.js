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

    // Create Verified role (or find existing one)
    let verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'verified');

    if (!verifiedRole) {
      verifiedRole = await guild.roles.create({
        name: 'Verified',
        color: '#00ff00',
        reason: 'Role for verified members',
        position: 1 // Position it below the @everyone role
      });
      console.log('Created new Verified role.');
    } else {
      console.log('Found existing Verified role.');
    }

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
    
    // Find the welcome channel - updated to correctly identify '📌welcome'
    const welcomeChannel = member.guild.channels.cache.find(ch => 
      ch.name === '📌welcome' && 
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

        // Create Verified role (or find existing one)
        let verifiedRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'verified');

        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: '#00ff00',
                reason: 'Role for verified members',
                position: 1 // Position it below the @everyone role
            });
            console.log('Created new Verified role.');
        } else {
            console.log('Found existing Verified role.');
        }

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
        const rulesChannel = guild.channels.cache.find(ch => ch.name === '📜rules');
        const introductionsChannel = guild.channels.cache.find(ch => ch.name === '🌍introductions');
        const generalChatChannel = guild.channels.cache.find(ch => ch.name === '💬general-chat');
        const dsaDoubtsChannel = guild.channels.cache.find(ch => ch.name === '📊dsa-doubts');
        const webDevChannel = guild.channels.cache.find(ch => ch.name === '🧑‍💻web-dev');
        const aiMlChannel = guild.channels.cache.find(ch => ch.name === '🤖ai-ml');
        const focusRoomChannel = guild.channels.cache.find(ch => ch.name === '🎙️ Focus Room');
        const studyLogsChannel = guild.channels.cache.find(ch => ch.name === '📚study-logs');
        const collabOpportunitiesChannel = guild.channels.cache.find(ch => ch.name === '🙌collab-opportunities');

        // Create verification URL placeholder
        const baseUrl = process.env.FRONTEND_URL || 'https://web-production-621c.up.railway.app';
        const verificationUrl = `${baseUrl}/verify?username={username}`;

        if (welcomeChannel) {
            await welcomeChannel.send({
                content: `# Welcome to AlgoPath! 🎉\n\n## Getting Started\n1. Read the <#${rulesChannel ? rulesChannel.id : 'rules'}> to understand our community guidelines\n2. To access all channels, please verify your account by clicking the link sent to you by the bot in a direct message!\n3. After verification, you'll get access to all channels and can introduce yourself in <#${introductionsChannel ? introductionsChannel.id : 'introductions'}>\n\n## Key Channels (Available after verification)\n- <#${generalChatChannel ? generalChatChannel.id : 'general-chat'}> - General discussion\n- <#${dsaDoubtsChannel ? dsaDoubtsChannel.id : 'dsa-doubts'}> - DSA help\n- <#${webDevChannel ? webDevChannel.id : 'web-dev'}> - Web development\n- <#${aiMlChannel ? aiMlChannel.id : 'ai-ml'}> - AI/ML discussions\n\n## Study Together (Available after verification)\n- Join <#${focusRoomChannel ? focusRoomChannel.id : 'focus-room'}> for focused study sessions\n- Share your progress in <#${studyLogsChannel ? studyLogsChannel.id : 'study-logs'}>\n- Find study partners in <#${collabOpportunitiesChannel ? collabOpportunitiesChannel.id : 'collab-opportunities'}>\n\nWe're excited to have you here! 🚀`
            });
        }

        // Send initial messages to specific channels
        if (rulesChannel) {
            await rulesChannel.send({
                content: `# AlgoPath Server Rules 📜\n\nWelcome to AlgoPath! To ensure a positive and productive environment for everyone, please adhere to the following rules:\n\n1.  **Be Respectful:** Treat all members with respect. Harassment, hate speech, or discrimination will not be tolerated.\n2.  **No Spamming:** Do not flood channels with excessive messages, images, or links.\n3.  **Stay On-Topic:** Keep discussions relevant to the channel's purpose.\n4.  **No Advertising:** Self-promotion or unsolicited advertising is not allowed.\n5.  **Sensitive Content:** Do not share any NSFW, gore, or otherwise inappropriate content.\n6.  **Privacy:** Do not share personal information about yourself or others.\n7.  **Follow Discord ToS:** Abide by Discord's Terms of Service and Community Guidelines.\n\nBreaking these rules may result in warnings, kicks, or bans. Thank you for making AlgoPath a great community!\n`
            });
        }

        if (studyLogsChannel) {
            await studyLogsChannel.send({
                content: `# How to Effectively Study on AlgoPath 🎓\n\nWelcome to your study journey! Here are some tips to make the most out of AlgoPath:\n\n1.  **Set Clear Goals:** Define what you want to achieve each study session or week.\n2.  **Utilize Resources:** Explore the channels for specific topics (DSA, Web Dev, AI/ML) and leverage shared resources.\n3.  **Engage Actively:** Ask questions, answer others, and participate in discussions. Teaching others is a great way to learn.\n4.  **Use Study Rooms:** Join voice channels like <#${focusRoomChannel ? focusRoomChannel.id : 'Focus Room'}> for focused study sessions with others.\n5.  **Share Progress:** Post your study logs in <#${studyLogsChannel ? studyLogsChannel.id : 'study-logs'}> to track your journey and stay motivated.\n6.  **Collaborate:** Look for study partners or project collaborators in <#${collabOpportunitiesChannel ? collabOpportunitiesChannel.id : 'collab-opportunities'}>.\n7.  **Take Breaks:** Remember to rest and avoid burnout. Short breaks improve focus.\n\nHappy learning! If you have any questions, feel free to ask in the relevant help channels.`
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
