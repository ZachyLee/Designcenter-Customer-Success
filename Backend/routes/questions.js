const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/questions?lang=EN or ID
router.get('/', async (req, res) => {
  try {
    const { lang } = req.query;
    
    if (!lang || !['EN', 'ID'].includes(lang)) {
      return res.status(400).json({ 
        error: 'Language parameter required. Use lang=EN or lang=ID' 
      });
    }

    const questions = await db.getQuestionsByLanguage(lang);
    
    // Group questions by area for better organization
    const groupedQuestions = questions.reduce((acc, question) => {
      if (!acc[question.area]) {
        acc[question.area] = [];
      }
      acc[question.area].push(question);
      return acc;
    }, {});

    res.json({
      success: true,
      language: lang,
      totalQuestions: questions.length,
      questions: questions,
      groupedQuestions: groupedQuestions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch questions',
      details: error.message 
    });
  }
});

// GET /api/questions/stats - Get question statistics
router.get('/stats', async (req, res) => {
  try {
    const { lang } = req.query;
    
    // Get all questions for the language
    const questions = lang ? 
      await db.getQuestionsByLanguage(lang) : 
      await db.query('SELECT * FROM questions');

    // Get answer statistics for each question
    const questionStats = [];
    
    for (const question of questions) {
      const answers = await db.getAnswersByQuestionId(question.id);
      
      const stats = {
        questionId: question.id,
        area: question.area,
        activity: question.activity,
        criteria: question.criteria,
        language: question.language,
        totalResponses: answers.length,
        yesCount: answers.filter(a => a.answer === 'Yes').length,
        noCount: answers.filter(a => a.answer === 'No').length,
        naCount: answers.filter(a => a.answer === 'N/A').length
      };
      
      questionStats.push(stats);
    }

    res.json({
      success: true,
      stats: questionStats
    });
  } catch (error) {
    console.error('Error fetching question statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch question statistics',
      details: error.message 
    });
  }
});

// GET /api/questions/:id - Get specific question
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const question = await db.query('SELECT * FROM questions WHERE id = ?', [id]);
    
    if (question.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({
      success: true,
      question: question[0]
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ 
      error: 'Failed to fetch question',
      details: error.message 
    });
  }
});

// GET /api/questions/:id/answers - Get all answers for a specific question
router.get('/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;
    
    const answers = await db.query(`
      SELECT a.*, ur.email, ur.timestamp 
      FROM answers a
      JOIN user_responses ur ON a.response_id = ur.id
      WHERE a.question_id = ?
      ORDER BY ur.timestamp DESC
    `, [id]);

    res.json({
      success: true,
      questionId: id,
      answers: answers
    });
  } catch (error) {
    console.error('Error fetching question answers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch question answers',
      details: error.message 
    });
  }
});

module.exports = router;