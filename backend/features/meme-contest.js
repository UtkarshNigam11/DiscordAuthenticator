const { EmbedBuilder } = require('discord.js');
const { pool } = require('../db');
const { client } = require('../discord');

// Meme contest configuration
const CONTEST_CONFIG = {
  CHANNEL_NAME: 'dev-lol',
  CONTEST_DURATION_MINUTES: 4320, // 3 days
  LAUGH_REACTION_EMOJI: '😂', // Kept for reaction, but not used for filtering
  MEME_LORD_ROLE_NAME: 'Meme-Lord',
  ROLE_DURATION_DAYS: 3
};

// Active contest tracking
let activeContest = null;
let contestCheckInterval = null;

// Initialize meme contest system
async function initializeMemeContest() {
  try {
    // Check if there's an active contest
    const result = await pool.query(
      'SELECT * FROM meme_contests WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );

    if (result.rows.length > 0) {
      activeContest = result.rows[0];
      console.log('Found active meme contest:', activeContest.id);
      
      // Check if contest should end
      if (new Date() > new Date(activeContest.end_date)) {
        await endContest(activeContest.id);
      }
    }

    // Start periodic contest checks
    startContestChecks();
  } catch (error) {
    console.error('Error initializing meme contest:', error);
  }
}

// Start periodic checks for contest end
function startContestChecks() {
  if (contestCheckInterval) {
    clearInterval(contestCheckInterval);
  }

  contestCheckInterval = setInterval(async () => {
    if (activeContest && new Date() > new Date(activeContest.end_date)) {
      await endContest(activeContest.id);
    }
  }, 60000); // Check every minute
}

// Start a new meme contest
async function startNewContest(channelId) {
  try {
    // Use UTC timestamps to avoid timezone issues with Railway
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + (CONTEST_CONFIG.CONTEST_DURATION_MINUTES * 60 * 1000)).toISOString();

    console.log('=== DEBUG TIMESTAMPS ===');
    console.log('Start Date (UTC):', startDate);
    console.log('End Date (UTC):', endDate);
    console.log('Expected minutes:', CONTEST_CONFIG.CONTEST_DURATION_MINUTES);

    const result = await pool.query(
      'INSERT INTO meme_contests (channel_id, start_date, end_date, status, created_at) VALUES ($1, $2::timestamp with time zone, $3::timestamp with time zone, $4, $5::timestamp with time zone) RETURNING *',
      [channelId, startDate, endDate, 'active', startDate]
    );

    activeContest = result.rows[0];
    console.log('Started new meme contest:', activeContest.id);
    console.log('DB Start Date:', activeContest.start_date);
    console.log('DB End Date:', activeContest.end_date);
    console.log('=== END DEBUG ===');

    return { 
      success: true, 
      message: `🎉 New meme contest started! Post your best memes in <#${channelId}> and get the most reactions to win the Meme-Lord role! Contest ends in ${CONTEST_CONFIG.CONTEST_DURATION_MINUTES} minutes.`,
      contest: activeContest
    };
  } catch (error) {
    console.error('Error starting meme contest:', error);
    return { success: false, message: 'Failed to start meme contest.' };
  }
}

// Handle new message in meme channel
async function handleNewMessage(message) {
  try {
    if (!activeContest || activeContest.channel_id !== message.channel.id) {
      return;
    }

    // Check if message has attachments or embeds (likely a meme)
    const hasMedia = message.attachments.size > 0 || message.embeds.length > 0;
    
    if (hasMedia) {
      // Add laughing reaction to encourage others to react
      await message.react(CONTEST_CONFIG.LAUGH_REACTION_EMOJI);
      
      // Store submission in database
      await pool.query(
        'INSERT INTO meme_submissions (contest_id, discord_id, message_id) VALUES ($1, $2, $3) ON CONFLICT (contest_id, message_id) DO NOTHING',
        [activeContest.id, message.author.id, message.id]
      );

      console.log(`New meme submission from ${message.author.tag} in contest ${activeContest.id}`);
    }
  } catch (error) {
    console.error('Error handling new message:', error);
  }
}

// Handle reaction updates
async function handleReactionUpdate(message, reaction) {
  try {
    if (!activeContest || activeContest.channel_id !== message.channel.id) {
      return;
    }

    // Always fetch full message and reaction if partial
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    // Debug log
    console.log('Reaction update:', {
      emoji: reaction.emoji.name,
      count: reaction.count,
      messageId: message.id,
      contestId: activeContest.id
    });

    // Update reaction count in database
    await pool.query(
      'UPDATE meme_submissions SET reaction_count = $1 WHERE contest_id = $2 AND message_id = $3',
      [reaction.count, activeContest.id, message.id]
    );

    console.log(`Updated reaction count for message ${message.id}: ${reaction.count}`);
  } catch (error) {
    console.error('Error handling reaction update:', error);
  }
}

// End the contest and determine winner
async function endContest(contestId) {
  try {
    // Get the submission with most reactions
    const result = await pool.query(
      `SELECT ms.*, mc.channel_id 
       FROM meme_submissions ms 
       JOIN meme_contests mc ON ms.contest_id = mc.id 
       WHERE ms.contest_id = $1 
       ORDER BY ms.reaction_count DESC, ms.created_at ASC 
       LIMIT 1`,
      [contestId]
    );

    if (result.rows.length === 0) {
      console.log('No submissions found for contest:', contestId);
      await pool.query(
        'UPDATE meme_contests SET status = $1 WHERE id = $2',
        ['ended', contestId]
      );
      activeContest = null;
      return;
    }

    const winner = result.rows[0];
    const channelId = winner.channel_id;

    // Update contest with winner
    await pool.query(
      'UPDATE meme_contests SET status = $1, winner_discord_id = $2, winner_message_id = $3 WHERE id = $4',
      ['ended', winner.discord_id, winner.message_id, contestId]
    );

    // Get guild and channel
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.error('Could not find channel:', channelId);
      return;
    }

    const guild = channel.guild;
    if (!guild) {
      console.error('Could not find guild for channel:', channelId);
      return;
    }

    // Find Meme-Lord role
    let memeLordRole = guild.roles.cache.find(role => role.name === CONTEST_CONFIG.MEME_LORD_ROLE_NAME);
    
    if (!memeLordRole) {
      console.log('Meme-Lord role not found, skipping role assignment');
      return;
    }

    // Get winner member
    const winnerMember = await guild.members.fetch(winner.discord_id);
    if (!winnerMember) {
      console.error('Could not find winner member:', winner.discord_id);
      return;
    }

    // Assign Meme-Lord role
    await winnerMember.roles.add(memeLordRole);

    // Remove role after specified duration
    setTimeout(async () => {
      try {
        const member = await guild.members.fetch(winner.discord_id);
        if (member && member.roles.cache.has(memeLordRole.id)) {
          await member.roles.remove(memeLordRole);
          console.log(`Removed Meme-Lord role from ${member.user.tag}`);
        }
      } catch (error) {
        console.error('Error removing Meme-Lord role:', error);
      }
    }, CONTEST_CONFIG.ROLE_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Send winner announcement
    const embed = new EmbedBuilder()
      .setTitle('🏆 Meme Contest Winner!')
      .setDescription(`Congratulations <@${winner.discord_id}>! Your meme got ${winner.reaction_count} ${CONTEST_CONFIG.LAUGH_REACTION_EMOJI} reactions and won the Meme-Lord role for ${CONTEST_CONFIG.ROLE_DURATION_DAYS} days!`)
      .setColor('#FFD700')
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log(`Meme contest ${contestId} ended. Winner: ${winner.discord_id} with ${winner.reaction_count} reactions`);
    activeContest = null;

  } catch (error) {
    console.error('Error ending contest:', error);
  }
}

// Get current contest status
async function getContestStatus() {
  try {
    if (!activeContest) {
      return { success: false, message: 'No active contest running.' };
    }

    // Check if contest has expired
    const timeLeft = new Date(activeContest.end_date) - new Date();
    const minutesLeft = Math.ceil(timeLeft / (1000 * 60));

    // If contest has expired, end it automatically
    if (timeLeft <= 0) {
      console.log('Contest has expired, ending automatically...');
      await endContest(activeContest.id);
      return { success: false, message: 'No active contest running.' };
    }

    const result = await pool.query(
      'SELECT discord_id, reaction_count FROM meme_submissions WHERE contest_id = $1 ORDER BY reaction_count DESC LIMIT 5',
      [activeContest.id]
    );

    return {
      success: true,
      contest: activeContest,
      minutesLeft,
      topSubmissions: result.rows
    };
  } catch (error) {
    console.error('Error getting contest status:', error);
    return { success: false, message: 'Failed to get contest status.' };
  }
}

// Cleanup function
function cleanup() {
  if (contestCheckInterval) {
    clearInterval(contestCheckInterval);
  }
}

module.exports = {
  CONTEST_CONFIG,
  initializeMemeContest,
  startNewContest,
  handleNewMessage,
  handleReactionUpdate,
  endContest,
  getContestStatus,
  cleanup
}; 