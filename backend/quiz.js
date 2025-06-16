const { generateResponse } = require('./gemini');
const { Client, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const axios = require('axios'); // We'll need axios for web requests

// Store active quizzes
const activeQuizzes = new Map();

// Quiz types
const QUIZ_TYPES = {
    'core-cs': {
        name: "Core CS Quiz",
        duration: 10, // minutes
        questionCount: 20,
        subjects: ["Data Structures", "Algorithms", "Operating Systems", "Database", "Computer Networks"],
        description: "Test your knowledge of core computer science concepts!",
        triviaCategory: 18 // Open Trivia DB: Computers
    },
    'mental-ability': {
        name: "Mental Ability Quiz",
        duration: 10, // minutes
        questionCount: 10,
        subjects: ["Logical Reasoning", "Verbal Ability", "Numerical Ability", "Analytical Skills"],
        description: "Challenge your mental agility and problem-solving skills!",
        triviaCategory: 9 // Open Trivia DB: General Knowledge (best fit for now)
    }
};

// Function to fetch questions from Open Trivia DB
async function fetchQuestionsFromWeb(type, subject, count) {
    try {
        const quizType = QUIZ_TYPES[type];
        if (!quizType || !quizType.triviaCategory) {
            console.warn(`No Open Trivia DB category defined for quiz type: ${type}`);
            return [];
        }

        // Open Trivia DB API URL
        const apiUrl = `https://opentdb.com/api.php?amount=${count}&category=${quizType.triviaCategory}&type=multiple&encode=base64`;
        console.log(`Fetching questions from Open Trivia DB: ${apiUrl}`);

        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data.response_code !== 0) {
            console.error('Open Trivia DB API Error:', data.response_code, data.results);
            return [];
        }

        // Decode base64 encoded strings and map to our question format
        return data.results.map(q => ({
            question: Buffer.from(q.question, 'base64').toString('utf8'),
            options: [
                Buffer.from(q.correct_answer, 'base64').toString('utf8'),
                ...q.incorrect_answers.map(opt => Buffer.from(opt, 'base64').toString('utf8'))
            ].sort(), // Sort options to randomize their display order
            answer: String.fromCharCode(65 + [
                Buffer.from(q.correct_answer, 'base64').toString('utf8'),
                ...q.incorrect_answers.map(opt => Buffer.from(opt, 'base64').toString('utf8'))
            ].sort().indexOf(Buffer.from(q.correct_answer, 'base64').toString('utf8'))),
            explanation: "" // Open Trivia DB doesn't provide explanations
        }));

    } catch (error) {
        console.error('Error fetching questions from Open Trivia DB:', error);
        return [];
    }
}

// Get questions from predefined set or generate new ones
async function getQuestions(type) {
    let questions = [];
    const quizType = QUIZ_TYPES[type];
    
    if (!quizType) {
        throw new Error('Invalid quiz type');
    }

    const requiredCount = quizType.questionCount;

    // 1. First, try to fetch questions from a web source (Open Trivia DB)
    try {
        questions = await fetchQuestionsFromWeb(
            type,
            quizType.subjects[Math.floor(Math.random() * quizType.subjects.length)], // Subject is not used by Open Trivia DB directly, but kept for consistency
            requiredCount
        );
    } catch (error) {
        console.error('Error in fetchQuestionsFromWeb, falling back to Gemini:', error);
        questions = []; // Ensure questions is an empty array if web fetch fails
    }

    // 2. If web fetching didn't provide enough, generate more using Gemini
    if (questions.length < requiredCount) {
        try {
            const additionalQuestions = await generateQuizQuestions(
                type === 'core-cs' ? 'CS' : 'MA',
                quizType.subjects[Math.floor(Math.random() * quizType.subjects.length)],
                requiredCount - questions.length
            );
            questions = [...questions, ...additionalQuestions];
        } catch (error) {
            console.error('Error generating questions from Gemini:', error);
            if (questions.length > 0) {
                return shuffleArray(questions).slice(0, requiredCount);
            }
            throw new Error('Failed to generate questions from any source.');
        }
    }

    // Shuffle questions and return the required number
    return shuffleArray(questions).slice(0, requiredCount);
}

// Generate additional questions using Gemini
async function generateQuizQuestions(type, subject, count) {
    const prompt = `Generate ${count} multiple choice questions for ${subject} in the following format:
    Q1. [Question]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Answer: [Correct option letter]
    Explanation: [Brief explanation of the answer]
    
    Make questions challenging but fair. Focus on fundamental concepts.`;

    const response = await generateResponse(prompt);
    return parseQuestions(response);
}

// Parse questions from Gemini response
function parseQuestions(response) {
    const questions = [];
    const lines = response.split('\n');
    let currentQuestion = null;

    for (const line of lines) {
        if (line.startsWith('Q')) {
            if (currentQuestion) questions.push(currentQuestion);
            currentQuestion = {
                question: line.substring(line.indexOf('.') + 1).trim(),
                options: [],
                answer: '',
                explanation: ''
            };
        } else if (line.match(/^[A-D]\)/)) {
            currentQuestion.options.push(line.substring(line.indexOf(')') + 1).trim());
        } else if (line.startsWith('Answer:')) {
            currentQuestion.answer = line.substring(7).trim();
        } else if (line.startsWith('Explanation:')) {
            currentQuestion.explanation = line.substring(12).trim();
        }
    }
    if (currentQuestion) questions.push(currentQuestion);
    return questions;
}

// Shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Create a new quiz
async function createQuiz(creator, type, guild) {
    if (activeQuizzes.has(creator.id)) {
        return { success: false, message: "You already have an active quiz!" };
    }

    const quizType = QUIZ_TYPES[type];
    if (!quizType) {
        return { success: false, message: "Invalid quiz type! Use 'core-cs' or 'mental-ability'" };
    }

    // Find the QUIZS category
    const quizCategory = guild.channels.cache.find(
        channel => channel.name === 'QUIZS' && channel.type === ChannelType.GuildCategory
    );

    if (!quizCategory) {
        return { success: false, message: "QUIZS category not found! Please create a category named 'QUIZS' first." };
    }

    // Find the Verified role
    const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');
    if (!verifiedRole) {
        return { success: false, message: "Verified role not found! Please create a role named 'Verified' first." };
    }

    // Create private channel in QUIZS category
    const channel = await guild.channels.create({
        name: `quiz-${creator.username}-vs-?`,
        type: ChannelType.GuildText,
        parent: quizCategory.id,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: ['ViewChannel']
            },
            {
                id: creator.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
                id: verifiedRole.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            }
        ]
    });

    // Generate questions
    const questions = await getQuestions(type);
    if (!questions || questions.length === 0) {
        await channel.delete();
        return { success: false, message: "Failed to generate questions. Please try again." };
    }

    const quiz = {
        type,
        channelId: channel.id,
        creatorId: creator.id,
        questions,
        participants: new Set([creator.id]),
        answers: new Map(),
        startTime: null,
        status: 'waiting',
        currentQuestion: 0,
        channel: channel // Store channel reference for cleanup
    };

    activeQuizzes.set(creator.id, quiz);

    console.log(`[createQuiz] Quiz created by ${creator.username} (${creator.id}). Status: ${quiz.status}, Channel: ${channel.name}`);

    // Create join button
    const joinButton = new ButtonBuilder()
        .setCustomId(`join_quiz_${creator.id}`)
        .setLabel('Join Quiz')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮');

    const row = new ActionRowBuilder()
        .addComponents(joinButton);

    // Send initial quiz message
    const message = await channel.send({
        content: `🎮 **${quizType.name}**\n\n` +
                `⏱️ Duration: ${quizType.duration} minutes\n` +
                `📝 Questions: ${quizType.questionCount}\n\n` +
                `📋 **Rules:**\n` +
                `• One question at a time\n` +
                `• Select your answer using the buttons\n` +
                `• No changing answers\n` +
                `• Timer will auto-submit if not completed\n\n` +
                `👥 Waiting for opponent to join...\n` +
                `Click the button below to join!`,
        components: [row]
    });

    // Set timeout to delete channel if no one joins in 10 minutes
    setTimeout(async () => {
        const currentQuiz = activeQuizzes.get(creator.id);
        if (currentQuiz && currentQuiz.status === 'waiting') {
            await channel.send('⏰ No one joined the quiz in 10 minutes. Channel will be deleted.');
            await channel.delete();
            activeQuizzes.delete(creator.id);
        }
    }, 10 * 60 * 1000); // 10 minutes

    return { 
        success: true, 
        message: `Quiz created! Check ${channel}`,
        quiz
    };
}

// Join an existing quiz
async function joinQuiz(user, creatorId, guild) {
    const quiz = activeQuizzes.get(creatorId);
    if (!quiz) {
        console.log(`[joinQuiz] No active quiz found for creator ${creatorId}`);
        return { 
            success: false, 
            message: "This quiz is no longer available!" 
        };
    }

    if (quiz.status !== 'waiting') {
        console.log(`[joinQuiz] Quiz status is ${quiz.status}, not 'waiting'. User: ${user.username}`);
        return { success: false, message: "This quiz has already started!" };
    }

    if (quiz.participants.has(user.id)) {
        console.log(`[joinQuiz] User ${user.username} already in quiz`);
        return { success: false, message: "You're already in this quiz!" };
    }

    // Update channel permissions
    const channel = await guild.channels.fetch(quiz.channelId);
    await channel.permissionOverwrites.create(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
    });

    // Update channel name
    await channel.setName(`quiz-${quiz.creatorId}-vs-${user.id}`);

    // Add participant
    quiz.participants.add(user.id);
    quiz.answers.set(user.id, new Array(quiz.questions.length).fill(null));

    console.log(`[joinQuiz] User ${user.username} joined. Participants: ${quiz.participants.size}, Quiz Status: ${quiz.status}`);

    // Start the quiz if we have 2 participants
    if (quiz.participants.size === 2) {
        quiz.status = 'active';
        quiz.startTime = Date.now();
        
        // Remove the join button
        try {
            const messages = await channel.messages.fetch();
            const quizMessage = messages.find(m => m.components.length > 0);
            if (quizMessage) {
                await quizMessage.edit({
                    content: quizMessage.content,
                    components: []
                });
            }
        } catch (error) {
            console.error('Error removing join button:', error);
        }

        console.log(`[joinQuiz] Quiz starting for creator ${creatorId}. Status: ${quiz.status}`);
        await sendQuestion(channel, quiz, 0);
    }

    return { 
        success: true, 
        message: `Successfully joined the quiz! The quiz will start automatically when both players are ready.` 
    };
}

// Send question to channel
async function sendQuestion(channel, quiz, questionIndex) {
    console.log(`[sendQuestion] Sending question ${questionIndex + 1}/${quiz.questions.length} for quiz ${quiz.creatorId}. Status: ${quiz.status}`);
    if (questionIndex >= quiz.questions.length) {
        console.log(`[sendQuestion] No more questions, ending quiz for ${quiz.creatorId}.`);
        return endQuiz(quiz, channel.guild);
    }

    const question = quiz.questions[questionIndex];
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('answer_A')
                .setLabel('A')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('answer_B')
                .setLabel('B')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('answer_C')
                .setLabel('C')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('answer_D')
                .setLabel('D')
                .setStyle(ButtonStyle.Primary)
        );

    try {
        await channel.send({
            content: `**Question ${questionIndex + 1}/${quiz.questions.length}**\n\n${question.question}\n\n` +
                    `A) ${question.options[0]}\n` +
                    `B) ${question.options[1]}\n` +
                    `C) ${question.options[2]}\n` +
                    `D) ${question.options[3]}`,
            components: [row]
        });
    } catch (error) {
        console.error(`Error sending question ${questionIndex + 1} to channel ${channel.id}:`, error);
        await channel.send('🚨 An error occurred while sending the next question. The quiz might be interrupted.');
    }
}

// Handle answer submission
async function handleAnswer(userId, answer, channel) {
    console.log(`[handleAnswer] User ${userId} submitted answer ${answer} in channel ${channel.id}.`);
    const quiz = Array.from(activeQuizzes.values()).find(q => q.channelId === channel.id);
    
    if (!quiz) {
        console.log(`[handleAnswer] Quiz not found for channel ${channel.id}. Active quizzes size: ${activeQuizzes.size}`);
        return { success: false, message: "No active quiz found!" };
    }

    console.log(`[handleAnswer] Quiz found for channel ${channel.id}. Status: ${quiz.status}, Current Q: ${quiz.currentQuestion}`);

    if (quiz.status !== 'active') {
        console.log(`[handleAnswer] Quiz status is ${quiz.status}, not 'active'.`);
        return { success: false, message: "No active quiz found!" };
    }

    if (!quiz.participants.has(userId)) {
        console.log(`[handleAnswer] User ${userId} not in quiz participants.`);
        return { success: false, message: "You're not in this quiz!" };
    }

    const userAnswers = quiz.answers.get(userId);
    if (userAnswers[quiz.currentQuestion] !== null) {
        console.log(`[handleAnswer] User ${userId} already answered Q${quiz.currentQuestion + 1}.`);
        return { success: false, message: "You've already answered this question!" };
    }

    // Store answer
    userAnswers[quiz.currentQuestion] = answer;
    console.log(`[handleAnswer] Answer ${answer} recorded for user ${userId} on Q${quiz.currentQuestion + 1}.`);

    // Check if all participants have answered
    const allAnswered = Array.from(quiz.participants).every(pid => 
        quiz.answers.get(pid)[quiz.currentQuestion] !== null
    );
    console.log(`[handleAnswer] All participants answered for Q${quiz.currentQuestion + 1}: ${allAnswered}`);

    if (allAnswered) {
        quiz.currentQuestion++;
        console.log(`[handleAnswer] Advancing to next question: Q${quiz.currentQuestion + 1}.`);
        try {
            await sendQuestion(channel, quiz, quiz.currentQuestion);
        } catch (error) {
            console.error('Error advancing to next question in handleAnswer:', error);
            return { success: false, message: "An error occurred while preparing the next question." };
        }
    }

    return { success: true, message: "Answer recorded!" };
}

// End quiz and show results
async function endQuiz(quiz, guild) {
    // Calculate scores
    const scores = new Map();
    for (const [userId, answers] of quiz.answers) {
        let score = 0;
        for (let i = 0; i < answers.length; i++) {
            if (answers[i] === quiz.questions[i].answer) {
                score++;
            }
        }
        scores.set(userId, score);
    }

    // Get channel
    const channel = await guild.channels.fetch(quiz.channelId);
    if (!channel) return;

    // Send results
    const resultsMessage = await channel.send({
        content: `🏁 **Quiz Ended!**\n\n` +
                `📊 **Results:**\n` +
                Array.from(scores.entries())
                    .map(([userId, score]) => `<@${userId}>: ${score}/${quiz.questions.length}`)
                    .join('\n')
    });

    // Delete channel after 2 minutes
    setTimeout(async () => {
        try {
            await channel.delete();
        } catch (error) {
            console.error('Error deleting quiz channel:', error);
        }
    }, 2 * 60 * 1000); // 2 minutes

    // Clean up quiz data
    activeQuizzes.delete(quiz.creatorId);
}

module.exports = {
    QUIZ_TYPES,
    createQuiz,
    joinQuiz,
    handleAnswer
}; 