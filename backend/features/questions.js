const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { checkLinkExists } = require('../linkValidator');

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

// Handle !question command
async function handleQuestionCommand(message) {
  try {
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
  } catch (error) {
    console.error('Error fetching question:', error);
    await message.reply('Sorry, I encountered an error while fetching a question. Please try again later.');
  }
}

// Handle !leetcode command
async function handleLeetCodeCommand(message) {
  try {
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
  } catch (error) {
    console.error('Error in LeetCode command:', error);
    await message.reply('Sorry, I encountered an error while processing your request. Please try again later.');
  }
}

module.exports = {
  handleQuestionCommand,
  handleLeetCodeCommand,
  showAvailableTopics,
  sendQuestionToChannel,
  getRandomLeetCodeQuestion,
  getRandomJobOverflowQuestion,
  LEETCODE_TOPICS
}; 