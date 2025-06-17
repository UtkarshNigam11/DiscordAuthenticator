const { pool } = require('../db');

// Function to assign role to user
async function assignRole(username) {
  try {
    const client = require('../discord').client;
    await client.waitForReady();
    
    if (!process.env.DISCORD_GUILD_ID) {
      console.error('DISCORD_GUILD_ID is missing');
      return { success: false, message: 'Server configuration error' };
    }

    console.log('Bot is ready, attempting to assign role...');
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log('Found guild:', guild.name);

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

    const role = guild.roles.cache.find(r => 
      r.name.toLowerCase() === 'verified' || 
      r.name.toLowerCase() === 'algopath verified' ||
      r.name.toLowerCase() === 'algopath-verified' ||
      r.name.toLowerCase() === 'premium'
    );

    if (!role) {
      console.error('Could not find Verified role');
      return { success: false, message: '"Verified" role not found on server. Please check role name.' };
    }

    console.log(`Found role: ${role.name} (ID: ${role.id})`);
    
    if (member.roles.cache.has(role.id)) {
      console.log('Member already has the role');
      return { success: true, message: 'User already verified!' };
    }

    await member.roles.add(role);
    console.log('Successfully assigned role to member');

    const welcomeChannel = member.guild.channels.cache.find(ch => 
      ch.name.toLowerCase().trim() === '📌welcome' && 
      ch.type === 0
    );

    if (welcomeChannel) {
      await welcomeChannel.send(`✅ Welcome ${member.user}! You're now verified and can access all the channels in AlgoPath Discord.`);
      console.log(`Sent verification success message to ${welcomeChannel.name}`);
    }

    return { success: true, message: 'User verified and role assigned!' };
  } catch (err) {
    console.error('Error assigning role:', err);
    return { success: false, message: 'Failed to assign role. Please try again later.' };
  }
}

// Handle user verification through external web form
async function handleVerification(email, discordUsername) {
  try {
    // Check if user exists in database
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "This message is only available for AlgoPath premium users. Please purchase our premium version to enjoy this feature!"
      };
    }

    // Check premium status
    const isPremium = result.rows[0].is_premium;
    if (!isPremium) {
      return {
        success: false,
        message: "This message is only available for AlgoPath premium users. Please upgrade to premium to continue!"
      };
    }

    // Assign role to user
    const roleResult = await assignRole(discordUsername);
    return roleResult;
  } catch (error) {
    console.error('Error in verification:', error);
    return {
      success: false,
      message: "An error occurred during verification. Please try again later."
    };
  }
}

// Add welcome message when member joins
async function handleNewMember(member) {
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
}

module.exports = {
  handleVerification,
  handleNewMember,
  assignRole
}; 