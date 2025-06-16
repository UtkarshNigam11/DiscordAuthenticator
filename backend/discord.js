const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
require('dotenv').config();
const { checkLinkExists } = require('./linkValidator');
const { generateResponse } = require('./gemini');
const { QUIZ_TYPES, createQuiz, joinQuiz, handleAnswer } = require('./quiz');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config');

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
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction],
});

// Track bot ready state
let isReady = false;

// Handle bot ready event
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  isReady = true;

  // Create quiz channel if it doesn't exist
  const guild = client.guilds.cache.first();
  if (guild) {
    // Find the QUIZS category
    const quizCategory = guild.channels.cache.find(
      channel => channel.name === 'QUIZS' && channel.type === ChannelType.GuildCategory
    );

    if (!quizCategory) {
      console.error('QUIZS category not found!');
      return;
    }

    const quizChannel = guild.channels.cache.find(
      channel => channel.name.toLowerCase() === '🎯quiz-arena'
    );
    
    if (!quizChannel) {
      try {
        await guild.channels.create({
          name: '🎯quiz-arena',
          type: ChannelType.GuildText,
          topic: 'Start and join 1v1 quizzes here! Use !startquiz to begin.',
          parent: quizCategory.id, // Place in QUIZS category
          permissionOverwrites: [
            {
              id: guild.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
              deny: ['AddReactions']
            }
          ]
        });
        console.log('Created quiz channel: 🎯quiz-arena in QUIZS category');
      } catch (error) {
        console.error('Error creating quiz channel:', error);
      }
    }
  }

  // Schedule daily question posting at 10:00 AM IST (04:30 UTC)
  // Using cron syntax: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) day-of-week(0-6)
  cron.schedule('0 30 4 * * *', async () => {
    console.log('Running scheduled daily question task');
    // Get all guilds the bot is in
    client.guilds.cache.forEach(guild => {
      postDailyQuestion(guild);
    });
  });
  console.log('Daily question scheduler initialized');
});

// Handle reconnection
client.on('disconnect', () => {
  console.log('Bot disconnected. Attempting to reconnect...');
  isReady = false;
});

client.on('reconnecting', () => {
  console.log('Bot is reconnecting...');
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// Topic list for LeetCode
const LEETCODE_TOPICS = {
  'array': 'Array',
  'string': 'String',
  'dp': 'Dynamic Programming',
  'graph': 'Graph',
  'tree': 'Tree',
  'linkedlist': 'Linked List',
  'stack': 'Stack',
  'queue': 'Queue',
  'heap': 'Heap',
  'hash': 'Hash Table',
  'binarysearch': 'Binary Search',
  'sorting': 'Sorting',
  'greedy': 'Greedy',
  'backtracking': 'Backtracking',
  'bitmanipulation': 'Bit Manipulation',
  'math': 'Math',
  'geometry': 'Geometry',
  'design': 'Design',
  'simulation': 'Simulation'
};

// Cache for LeetCode problems
let leetcodeProblems = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Function to fetch LeetCode problems
async function fetchLeetCodeProblems() {
  try {
    const response = await axios.get('https://leetcode.com/api/problems/all/');
    return response.data.stat_status_pairs.map(problem => ({
      id: problem.stat.question_id,
      title: problem.stat.question__title_slug,
      difficulty: problem.difficulty.level,
      topics: problem.stat.question__title_slug.split('-').map(word => word.toLowerCase())
    }));
  } catch (error) {
    console.error('Error fetching LeetCode problems:', error);
    return null;
  }
}

// Function to get a random LeetCode question
async function getRandomLeetCodeQuestion(difficulty = 'all', topic = 'all') {
  // Check if we need to refresh the cache
  const now = Date.now();
  if (!leetcodeProblems || now - lastFetchTime > CACHE_DURATION) {
    leetcodeProblems = await fetchLeetCodeProblems();
    lastFetchTime = now;
  }

  if (!leetcodeProblems) {
    throw new Error('Failed to fetch LeetCode problems');
  }

  // Filter problems by difficulty
  let filteredProblems = leetcodeProblems;
  if (difficulty !== 'all') {
    const difficultyMap = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };
    filteredProblems = filteredProblems.filter(p => p.difficulty === difficultyMap[difficulty]);
  }

  // Filter problems by topic if specified
  if (topic !== 'all') {
    filteredProblems = filteredProblems.filter(p => 
      p.topics.some(t => t.includes(topic.toLowerCase()))
    );
  }

  if (filteredProblems.length === 0) {
    throw new Error('No problems found with the specified criteria');
  }

  // Select a random problem
  const randomProblem = filteredProblems[Math.floor(Math.random() * filteredProblems.length)];
  return `https://leetcode.com/problems/${randomProblem.title}/`;
}

// Function to get a random JobOverflow question
async function getRandomJobOverflowQuestion() {
  const randomProblemId = Math.floor(Math.random() * (422 - 2 + 1)) + 2;
  return `https://www.thejoboverflow.com/problem/${randomProblemId}/`;
}

// Function to send question to the questions channel
async function sendQuestionToChannel(guild, message, questionUrl, platform, difficulty = '', topic = '') {
  const questionsChannel = guild.channels.cache.find(ch => 
    ch.name.toLowerCase() === 'questions' && 
    ch.type === 0 // 0 is GUILD_TEXT
  );

  if (questionsChannel) {
    let messageText = `New ${platform} question for you: ${questionUrl}`;
    if (difficulty && difficulty !== 'all') {
      messageText += `\nDifficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    }
    if (topic && topic !== 'all') {
      messageText += `\nTopic: ${topic}`;
    }
    await questionsChannel.send(messageText);
  } else {
    await message.reply('❌ Could not find the questions channel. Please make sure it exists.');
  }
}

// Function to show available topics
async function showAvailableTopics(message) {
  const topicList = Object.entries(LEETCODE_TOPICS)
    .map(([key, value]) => `\`${key}\`: ${value}`)
    .join('\n');
  
  await message.reply(`Available topics for LeetCode:\n${topicList}`);
}

// Message event handler
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Handle quiz commands
  if (message.content.startsWith('!startquiz')) {
    const args = message.content.split(' ');
    if (args.length !== 2) {
      return message.reply('Usage: !startquiz <type>\nTypes: core-cs, mental-ability');
    }

    const type = args[1].toLowerCase();
    const result = await createQuiz(message.author, type, message.guild);
    return message.reply(result.message);
  }

  if (message.content.startsWith('!joinquiz')) {
    const args = message.content.split(' ');
    if (args.length !== 2) {
      return message.reply('Usage: !joinquiz <creator_id>');
    }

    const creatorId = args[1];
    const result = await joinQuiz(message.author, creatorId, message.guild);
    return message.reply(result.message);
  }

  // Handle AI help channel messages
  if (message.channel.name.toLowerCase() === '🤖ai-help') {
    // Check if message starts with !ai
    if (message.content.startsWith('!ai')) {
      try {
        // Get the question part after !ai
        const question = message.content.slice(3).trim();
        
        if (!question) {
          return message.reply('Please provide a question after !ai. For example: `!ai how do I implement binary search?`');
        }

        // Show typing indicator
        await message.channel.sendTyping();
        
        // Generate response from Gemini
        const response = await generateResponse(question);
        
        // Send the response
        await message.reply(response);
      } catch (error) {
        console.error('Error in AI help channel:', error);
        await message.reply('Sorry, I encountered an error while processing your request. Please try again later.');
      }
    }
    return;
  }

  // All other commands should only work in the questions channel
  if (message.channel.name.toLowerCase() !== 'questions') {
    return;
  }

  // Enhanced logging for message reception
  console.log('=== New Message ===');
  console.log(`Channel: ${message.channel.name} (${message.channel.id})`);
  console.log(`Author: ${message.author.tag} (${message.author.id})`);
  console.log(`Content: ${message.content}`);
  console.log('==================');

  // Handle !question command (JobOverflow)
  if (message.content === '!question') {
    console.log('=== !question Command Processing ===');
    console.log('Starting to process !question command');
    
    let foundValidLink = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!foundValidLink && attempts < maxAttempts) {
      const problemUrl = await getRandomJobOverflowQuestion();
      console.log(`Attempt ${attempts + 1}: Checking link ${problemUrl}`);
      
      try {
        const linkExists = await checkLinkExists(problemUrl);
        console.log(`Link check result for ${problemUrl}: ${linkExists}`);

        if (linkExists) {
          console.log(`Link ${problemUrl} exists. Sending to channel.`);
          await sendQuestionToChannel(message.guild, message, problemUrl, 'JobOverflow');
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
      await message.reply('Sorry, I could not find a valid random question at this time. Please try again later.');
    }
    console.log('=== !question Command Processing Complete ===');
  }

  // Handle !leetcode command
  if (message.content.startsWith('!leetcode')) {
    console.log('=== !leetcode Command Processing ===');
    const args = message.content.split(' ');
    
    // Show topics if requested
    if (args[1]?.toLowerCase() === 'topics') {
      return showAvailableTopics(message);
    }

    const difficulty = args[1]?.toLowerCase() || 'all';
    const topic = args[2]?.toLowerCase() || 'all';

    if (!['easy', 'medium', 'hard', 'all'].includes(difficulty)) {
      return message.reply('❌ Invalid difficulty. Please use: easy, medium, hard, or all');
    }

    if (topic !== 'all' && !LEETCODE_TOPICS[topic]) {
      return message.reply(`❌ Invalid topic. Use \`!leetcode topics\` to see available topics.`);
    }

    console.log(`Starting to process !leetcode command with difficulty: ${difficulty} and topic: ${topic}`);
    
    try {
      const problemUrl = await getRandomLeetCodeQuestion(difficulty, topic);
      console.log(`Found problem URL: ${problemUrl}`);
      await sendQuestionToChannel(message.guild, message, problemUrl, 'LeetCode', difficulty, topic);
    } catch (error) {
      console.error('Error getting LeetCode question:', error);
      await message.reply('Sorry, I could not find a valid random question at this time. Please try again later.');
    }
    console.log('=== !leetcode Command Processing Complete ===');
  }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('join_quiz_')) {
        await interaction.deferUpdate(); // Defer the update immediately
        const creatorId = interaction.customId.split('_')[2];
        const result = await joinQuiz(interaction.user, creatorId, interaction.guild);
        
        await interaction.followUp({ 
            content: result.message,
            ephemeral: true // Only visible to the user who clicked
        });
    }
    else if (interaction.customId.startsWith('answer_')) {
        await interaction.deferUpdate(); // Defer the update immediately
        const answer = interaction.customId.split('_')[1];
        const result = await handleAnswer(interaction.user.id, answer, interaction.channel);
        
        await interaction.followUp({ 
            content: result.message,
            ephemeral: true // Only visible to the user who clicked
        });
    }
});

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

    // Add the role
    await member.roles.add(role);
    console.log('Successfully assigned role to member');

    // Send message to the welcome channel after verification
    const welcomeChannel = member.guild.channels.cache.find(ch => 
      ch.name.toLowerCase().trim() === '📌welcome' && 
      ch.type === 0 // 0 is GUILD_TEXT
    );

    if (welcomeChannel) {
      await welcomeChannel.send(`✅ Welcome ${member.user}! You're now verified and can access all the channels in AlgoPath Discord.`);
      console.log(`Sent verification success message to ${welcomeChannel.name}`);
    } else {
      console.error('Could not find 📌welcome channel to send verification success message.');
    }

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
      content: `🎉 Welcome to AlgoPath, ${member.user}! 🎉\n\nTo access all channels, please verify your account:\n${verificationUrl}\n\nIf you have any issues, please contact our support team.`,
      allowedMentions: { users: [member.id] }
    };
    
    // Find the verify-here channel in INFO & RULES category
    const infoRulesCategory = member.guild.channels.cache.find(ch => 
      ch.name.toLowerCase().trim() === '📢 info & rules' && 
      ch.type === 4 // 4 is GUILD_CATEGORY
    );

    if (infoRulesCategory) {
      const verifyChannel = member.guild.channels.cache.find(ch => 
        ch.name.toLowerCase().trim() === 'verify-here' && 
        ch.parentId === infoRulesCategory.id
      );

      if (verifyChannel) {
        // Send the initial greeting message
        await verifyChannel.send(`👋 Welcome ${member.user} to AlgoPath Discord channel!`);

        // Send the detailed verification message
        await verifyChannel.send(welcomeMessage);
        console.log(`Sent welcome and verification messages in channel ${verifyChannel.name}`);
      } else {
        console.error('Could not find verify-here channel in INFO & RULES category');
      }
    } else {
      console.error('Could not find INFO & RULES category');
    }
  } catch (error) {
    console.error('Error in welcome message:', error);
  }
});

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

module.exports = {
  client,
  waitForReady,
  assignRole,
  checkUserExists
};
