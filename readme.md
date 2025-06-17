# AlgoPath Discord Bot

A Discord bot for AlgoPath that provides coding questions, AI assistance, user verification, and interactive quizzes.

## Features

### 1. Questions Feature
- `!question` - Get a random JobOverflow question
- `!leetcode` - Get a random LeetCode question
  - Usage: `!leetcode <difficulty> <topic>`
  - Example: `!leetcode easy array`
  - Available difficulties: easy, medium, hard
  - Use `!leetcode topics` to see available topics
- Daily questions posted automatically at 10:00 AM IST

### 2. AI Help Feature
- `!ai help me find` - Get AI-powered help for coding questions
  - Example: `!ai help me find how to implement binary search`
  - Uses Google's Gemini API for intelligent responses

### 3. Verification Feature
- External web form for user verification
- Automatic role assignment after verification
- Welcome messages for new members

### 4. Quiz Feature
- Interactive 1v1 quizzes in the 🎯quiz-arena channel
- Available quiz types:
  - `core-cs`: Computer Science fundamentals
  - `mental-ability`: Logical reasoning and problem-solving
- Commands:
  - `!startquiz <type>` - Start a new quiz
  - `!joinquiz <creator_id>` - Join an existing quiz
- Features:
  - Multiple choice questions
  - Real-time scoring
  - 30-second time limit per question
  - Automatic winner determination

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_GUILD_ID=your_guild_id
   GEMINI_API_KEY=your_gemini_api_key
   FRONTEND_URL=your_frontend_url
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Project Structure

```
backend/
├── features/           # Feature modules
│   ├── questions.js    # Question-related features
│   ├── ai-help.js      # AI assistance features
│   ├── verification.js # User verification features
│   ├── quiz.js         # Interactive quiz features
│   └── index.js        # Feature exports
├── config.js          # Configuration
├── db.js             # Database connection
├── discord.js        # Discord client setup
└── server.js         # Express server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.