const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('../db');

// Quiz types and their configurations
const QUIZ_TYPES = {
  'core-cs': {
    name: 'Core Computer Science',
    description: 'Test your knowledge of fundamental computer science concepts',
    questions: [
      {
        question: 'What is the time complexity of binary search?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correct: 1
      },
      {
        question: 'Which data structure follows LIFO principle?',
        options: ['Queue', 'Stack', 'Tree', 'Graph'],
        correct: 1
      },
      {
        question: 'What is the main advantage of using a hash table?',
        options: ['Constant time search', 'Ordered storage', 'Memory efficiency', 'Easy to implement'],
        correct: 0
      }
    ]
  },
  'mental-ability': {
    name: 'Mental Ability',
    description: 'Test your logical reasoning and problem-solving skills',
    questions: [
      {
        question: 'If all Bloops are Razzies and all Razzies are Lazzies, then:',
        options: [
          'All Bloops are Lazzies',
          'All Lazzies are Bloops',
          'Some Bloops are not Lazzies',
          'None of the above'
        ],
        correct: 0
      },
      {
        question: 'Complete the sequence: 2, 4, 8, 16, __',
        options: ['24', '32', '30', '28'],
        correct: 1
      },
      {
        question: 'If RED is coded as 1854, then how is GREEN coded?',
        options: ['7185514', '7185515', '7185516', '7185517'],
        correct: 1
      }
    ]
  }
};

// Active quizzes storage
const activeQuizzes = new Map();

// Create a new quiz
async function createQuiz(creator, type, guild) {
  try {
    if (!QUIZ_TYPES[type]) {
      return { success: false, message: 'Invalid quiz type. Available types: core-cs, mental-ability' };
    }

    const quizChannel = guild.channels.cache.find(ch => 
      ch.name.toLowerCase() === '🎯quiz-arena' && 
      ch.type === 0
    );

    if (!quizChannel) {
      return { success: false, message: 'Quiz channel not found. Please contact an administrator.' };
    }

    // Create quiz embed
    const embed = new EmbedBuilder()
      .setTitle(`${QUIZ_TYPES[type].name} Quiz`)
      .setDescription(`${QUIZ_TYPES[type].description}\nCreated by ${creator.tag}`)
      .setColor('#0099ff')
      .addFields(
        { name: 'Status', value: 'Waiting for opponent...', inline: true },
        { name: 'Type', value: type, inline: true }
      );

    // Create join button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`join_quiz_${creator.id}`)
          .setLabel('Join Quiz')
          .setStyle(ButtonStyle.Primary)
      );

    // Send quiz message
    const message = await quizChannel.send({
      embeds: [embed],
      components: [row]
    });

    // Store quiz data
    activeQuizzes.set(creator.id, {
      type,
      creator,
      message,
      status: 'waiting',
      questions: QUIZ_TYPES[type].questions,
      currentQuestion: 0,
      scores: new Map()
    });

    return { 
      success: true, 
      message: `Quiz created! Waiting for an opponent to join...` 
    };
  } catch (error) {
    console.error('Error creating quiz:', error);
    return { success: false, message: 'Failed to create quiz. Please try again.' };
  }
}

// Join an existing quiz
async function joinQuiz(joiner, creatorId, guild) {
  try {
    const quiz = activeQuizzes.get(creatorId);
    if (!quiz) {
      return { success: false, message: 'No active quiz found with this creator.' };
    }

    if (quiz.status !== 'waiting') {
      return { success: false, message: 'This quiz has already started or ended.' };
    }

    if (joiner.id === creatorId) {
      return { success: false, message: 'You cannot join your own quiz.' };
    }

    // Update quiz status
    quiz.status = 'in_progress';
    quiz.opponent = joiner;
    quiz.scores.set(creatorId, 0);
    quiz.scores.set(joiner.id, 0);

    // Update quiz message
    const embed = new EmbedBuilder()
      .setTitle(`${QUIZ_TYPES[quiz.type].name} Quiz`)
      .setDescription(`${QUIZ_TYPES[quiz.type].description}\nCreated by ${quiz.creator.tag}`)
      .setColor('#0099ff')
      .addFields(
        { name: 'Status', value: 'In Progress', inline: true },
        { name: 'Type', value: quiz.type, inline: true },
        { name: 'Players', value: `${quiz.creator.tag} vs ${joiner.tag}`, inline: true }
      );

    await quiz.message.edit({
      embeds: [embed],
      components: []
    });

    // Start the quiz
    await startQuiz(quiz);

    return { 
      success: true, 
      message: `Joined quiz! The quiz will begin shortly...` 
    };
  } catch (error) {
    console.error('Error joining quiz:', error);
    return { success: false, message: 'Failed to join quiz. Please try again.' };
  }
}

// Start the quiz
async function startQuiz(quiz) {
  try {
    const quizChannel = quiz.message.channel;
    const currentQuestion = quiz.questions[quiz.currentQuestion];

    // Create question embed
    const embed = new EmbedBuilder()
      .setTitle(`Question ${quiz.currentQuestion + 1}`)
      .setDescription(currentQuestion.question)
      .setColor('#0099ff')
      .addFields(
        { name: 'Players', value: `${quiz.creator.tag} vs ${quiz.opponent.tag}`, inline: true },
        { name: 'Scores', value: `${quiz.scores.get(quiz.creator.id)} - ${quiz.scores.get(quiz.opponent.id)}`, inline: true }
      );

    // Create answer buttons
    const row = new ActionRowBuilder()
      .addComponents(
        currentQuestion.options.map((option, index) => 
          new ButtonBuilder()
            .setCustomId(`answer_${index}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Secondary)
        )
      );

    // Send question
    const questionMessage = await quizChannel.send({
      embeds: [embed],
      components: [row]
    });

    // Store question message
    quiz.currentQuestionMessage = questionMessage;

    // Set timeout for question
    setTimeout(() => {
      if (quiz.currentQuestionMessage === questionMessage) {
        handleQuestionTimeout(quiz);
      }
    }, 30000); // 30 seconds timeout
  } catch (error) {
    console.error('Error starting quiz:', error);
    await quiz.message.channel.send('An error occurred while starting the quiz. Please try again.');
  }
}

// Handle answer to question
async function handleAnswer(userId, answer, channel) {
  try {
    // Find the quiz this user is participating in
    let quiz = null;
    for (const [creatorId, activeQuiz] of activeQuizzes.entries()) {
      if (activeQuiz.creator.id === userId || activeQuiz.opponent?.id === userId) {
        quiz = activeQuiz;
        break;
      }
    }

    if (!quiz) {
      return { success: false, message: 'No active quiz found for you.' };
    }

    if (quiz.status !== 'in_progress') {
      return { success: false, message: 'This quiz is not in progress.' };
    }

    const currentQuestion = quiz.questions[quiz.currentQuestion];
    const isCorrect = parseInt(answer) === currentQuestion.correct;

    // Update score
    if (isCorrect) {
      quiz.scores.set(userId, quiz.scores.get(userId) + 1);
    }

    // Check if both players have answered
    if (quiz.currentQuestionMessage) {
      await quiz.currentQuestionMessage.edit({
        components: []
      });
    }

    // Move to next question or end quiz
    quiz.currentQuestion++;
    if (quiz.currentQuestion < quiz.questions.length) {
      await startQuiz(quiz);
    } else {
      await endQuiz(quiz);
    }

    return { 
      success: true, 
      message: isCorrect ? 'Correct answer!' : 'Wrong answer!' 
    };
  } catch (error) {
    console.error('Error handling answer:', error);
    return { success: false, message: 'Failed to process answer. Please try again.' };
  }
}

// Handle question timeout
async function handleQuestionTimeout(quiz) {
  try {
    if (quiz.currentQuestionMessage) {
      await quiz.currentQuestionMessage.edit({
        components: []
      });
    }

    // Move to next question or end quiz
    quiz.currentQuestion++;
    if (quiz.currentQuestion < quiz.questions.length) {
      await startQuiz(quiz);
    } else {
      await endQuiz(quiz);
    }
  } catch (error) {
    console.error('Error handling question timeout:', error);
  }
}

// End the quiz
async function endQuiz(quiz) {
  try {
    const quizChannel = quiz.message.channel;
    const creatorScore = quiz.scores.get(quiz.creator.id);
    const opponentScore = quiz.scores.get(quiz.opponent.id);

    // Determine winner
    let winner;
    if (creatorScore > opponentScore) {
      winner = quiz.creator;
    } else if (opponentScore > creatorScore) {
      winner = quiz.opponent;
    }

    // Create results embed
    const embed = new EmbedBuilder()
      .setTitle('Quiz Results')
      .setDescription(winner ? 
        `🏆 ${winner.tag} wins!` : 
        "It's a tie!")
      .setColor('#0099ff')
      .addFields(
        { name: 'Final Scores', value: `${quiz.creator.tag}: ${creatorScore} - ${quiz.opponent.tag}: ${opponentScore}`, inline: true }
      );

    await quizChannel.send({ embeds: [embed] });

    // Clean up
    activeQuizzes.delete(quiz.creator.id);
  } catch (error) {
    console.error('Error ending quiz:', error);
  }
}

module.exports = {
  QUIZ_TYPES,
  createQuiz,
  joinQuiz,
  handleAnswer
}; 