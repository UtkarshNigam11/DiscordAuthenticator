const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('AI Help Module: Initializing...');
console.log('GEMINI_API_KEY status:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure the model with safety settings
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",  // Use flash for better free-tier limits
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
});

const SYSTEM_PROMPT = `You are a helpful programming assistant. Your role is to:
1. Help users understand the logic and approach to solve programming problems
2. Point out errors in their code and suggest fixes
3, Keep the answer under 2000 characters.
4. Guide users to write their own code rather than giving them complete solutions

When responding:
- Focus on explaining the logic and approach
- Point out specific errors if present
- Provide hints and guidance rather than complete code`;

// Handle !ai help command
async function handleAIHelp(message) {
  console.log('AI Help: Received command:', message.content);
  try {
    // Get the query from the message
    const query = message.content
      .replace('!ai help me find', '')
      .replace('!ai help me build', '')
      .trim();
    console.log('AI Help: Extracted query:', query);
    
    if (!query) {
      console.log('AI Help: Empty query detected');
      return message.reply('Please provide a question or topic to search for. Example: `!ai help me find how to solve binary search` or `!ai help me build a sliding window`');
    }

    // Show typing indicator
    console.log('AI Help: Sending typing indicator');
    await message.channel.sendTyping();

    // Generate response using the original generateResponse function
    console.log('AI Help: Generating response...');
    const response = await generateResponse(query);
    console.log('AI Help: Response generated:', response.substring(0, 100) + '...');

    // Split response if it's too long
    const maxLength = 1900; // Discord message limit is 2000
    if (response.length > maxLength) {
      console.log('AI Help: Response too long, splitting into chunks');
      const chunks = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      console.log('AI Help: Sending response');
      await message.reply(response);
    }
    console.log('AI Help: Response sent successfully');
  } catch (error) {
    console.error('AI Help: Error in handleAIHelp:', error);
    await message.reply('Sorry, I encountered an error while processing your request. Please try again later.');
  }
}

// Original generateResponse function from gemini.js
async function generateResponse(prompt) {
    console.log('AI Help: generateResponse called with prompt:', prompt);
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error('AI Help: GEMINI_API_KEY is missing');
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }

        const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Question: ${prompt}`;
        console.log('AI Help: Sending request to Gemini API...');

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        console.log('AI Help: Received response from Gemini API');
        return response.text();
    } catch (error) {
        console.error('AI Help: Error in generateResponse:', error);

        // Graceful response for quota error
        if (error.message.includes('429') || error.status === 429) {
            return '🚫 Gemini free-tier limit reached. Please try again in a minute or reduce your usage.';
        }

        if (error.message.includes('API key')) {
            return '⚠️ Gemini API key not configured properly. Please check your .env file.';
        }

        return '⚠️ An error occurred while processing your request. Please try again later.';
    }
}

module.exports = {
  handleAIHelp,
  generateResponse
}; 