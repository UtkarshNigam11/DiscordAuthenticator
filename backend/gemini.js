const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

async function generateResponse(prompt) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }

        const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Question: ${prompt}`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating response from Gemini:', error);

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
    generateResponse
};
