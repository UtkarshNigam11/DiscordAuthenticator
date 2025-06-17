const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();
const cron = require('node-cron');
const config = require('./config');
const features = require('./features');

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
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  isReady = true;

  // Schedule daily question posting at 10:00 AM IST (04:30 UTC)
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

// Message event handler
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Enhanced logging for message reception
  console.log('=== New Message ===');
  console.log(`Channel: ${message.channel.name} (${message.channel.id})`);
  console.log(`Author: ${message.author.tag} (${message.author.id})`);
  console.log(`Content: ${message.content}`);
  console.log('==================');

  // Handle commands based on channel
  switch (message.channel.name.toLowerCase()) {
    case 'questions':
      // Handle question commands
      if (message.content === '!question') {
        await features.questions.handleQuestionCommand(message);
      } else if (message.content.startsWith('!leetcode')) {
        await features.questions.handleLeetCodeCommand(message);
      }
      break;

    case '🤖ai-help':
      console.log('AI Help channel detected');
      // Handle AI help command
      if (message.content.startsWith('!ai help me find') || message.content.startsWith('!ai help me build')) {
        console.log('AI help command detected');
        await features.aiHelp.handleAIHelp(message);
      }
      break;

    case '🎯quiz-arena':
      // Handle quiz commands
      if (message.content.startsWith('!startquiz')) {
        const args = message.content.split(' ');
        if (args.length !== 2) {
          return message.reply('Usage: !startquiz <type>\nTypes: core-cs, mental-ability');
        }

        const type = args[1].toLowerCase();
        const result = await features.quiz.createQuiz(message.author, type, message.guild);
        return message.reply(result.message);
      }

      if (message.content.startsWith('!joinquiz')) {
        const args = message.content.split(' ');
        if (args.length !== 2) {
          return message.reply('Usage: !joinquiz <creator_id>');
        }

        const creatorId = args[1];
        const result = await features.quiz.joinQuiz(message.author, creatorId, message.guild);
        return message.reply(result.message);
      }
      break;
  }
});

// Handle new member joins
client.on('guildMemberAdd', async (member) => {
  await features.verification.handleNewMember(member);
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('join_quiz_')) {
    await interaction.deferUpdate(); // Defer the update immediately
    const creatorId = interaction.customId.split('_')[2];
    const result = await features.quiz.joinQuiz(interaction.user, creatorId, interaction.guild);
    
    await interaction.followUp({ 
      content: result.message,
      ephemeral: true // Only visible to the user who clicked
    });
  }
  else if (interaction.customId.startsWith('answer_')) {
    await interaction.deferUpdate(); // Defer the update immediately
    const answer = interaction.customId.split('_')[1];
    const result = await features.quiz.handleAnswer(interaction.user.id, answer, interaction.channel);
    
    await interaction.followUp({ 
      content: result.message,
      ephemeral: true // Only visible to the user who clicked
    });
  }
});

// Function to post daily question
async function postDailyQuestion(guild) {
  try {
    const dailyQuestionChannel = guild.channels.cache.find(ch => 
      ch.name.toLowerCase() === 'daily-question' && 
      ch.type === 0 // 0 is GUILD_TEXT
    );

    if (!dailyQuestionChannel) {
      console.error('Could not find daily-question channel');
      return;
    }

    // Alternate between LeetCode and JobOverflow questions
    const isLeetCode = Math.random() > 0.5;
    let questionUrl;

    if (isLeetCode) {
      questionUrl = await features.questions.getRandomLeetCodeQuestion();
      await features.questions.sendQuestionToChannel(guild, null, questionUrl, 'LeetCode');
    } else {
      questionUrl = await features.questions.getRandomJobOverflowQuestion();
      await features.questions.sendQuestionToChannel(guild, null, questionUrl, 'JobOverflow');
    }
  } catch (error) {
    console.error('Error posting daily question:', error);
  }
}

// Function to check if user exists in server
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
  checkUserExists
};
