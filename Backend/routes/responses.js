const express = require('express');
const router = express.Router();
const db = require('../db');
const pdfGenerator = require('../services/pdfGenerator');

// POST /api/responses - Submit a new response
router.post('/', async (req, res) => {
  try {
    const { email, language, answers } = req.body;

    // Validate required fields
    if (!email || !language || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, language, and answers array' 
      });
    }

    if (!['EN', 'ID'].includes(language)) {
      return res.status(400).json({ 
        error: 'Invalid language. Use EN or ID' 
      });
    }

    // Create user response record
    const responseId = await db.insertUserResponse(email, language);

    // Insert all answers
    const insertPromises = answers.map(answer => {
      const { questionId, answer: answerValue, remarks } = answer;
      
      if (!questionId || !answerValue) {
        throw new Error('Each answer must have questionId and answer value');
      }

      return db.insertAnswer(questionId, responseId, answerValue, remarks || '');
    });

    // Ensure all answers are inserted successfully
    try {
      await Promise.all(insertPromises);
    } catch (error) {
      // If answer insertion fails, delete the response to maintain consistency
      await db.query('DELETE FROM user_responses WHERE id = ?', [responseId]);
      throw new Error(`Failed to insert answers: ${error.message}`);
    }

    // Double check that all answers were inserted
    const insertedAnswers = await db.query(
      'SELECT COUNT(*) as count FROM answers WHERE response_id = ?', 
      [responseId]
    );

    if (insertedAnswers[0].count !== answers.length) {
      await db.query('DELETE FROM user_responses WHERE id = ?', [responseId]);
      throw new Error('Not all answers were inserted successfully');
    }

    res.json({
      success: true,
      responseId: responseId,
      message: 'Response submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting response:', error);
    res.status(500).json({ 
      error: 'Failed to submit response',
      details: error.message 
    });
  }
});

// GET /api/responses/:id - Get specific response with answers
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const responseData = await db.getResponseWithAnswers(id);

    if (!responseData.response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching response:', error);
    res.status(500).json({ 
      error: 'Failed to fetch response',
      details: error.message 
    });
  }
});

// GET /api/responses/:id/pdf - Generate PDF for specific response
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const responseData = await db.getResponseWithAnswers(id);

    if (!responseData.response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const pdfBuffer = pdfGenerator.generateUserReport(responseData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="checklist-${responseData.response.email}-${id}.pdf"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

// GET /api/responses - Get all responses (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { email, language, startDate, endDate, limit = 50 } = req.query;
    
    let sql = 'SELECT * FROM user_responses WHERE 1=1';
    const params = [];

    if (email) {
      sql += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }

    if (language && ['EN', 'ID'].includes(language)) {
      sql += ' AND language = ?';
      params.push(language);
    }

    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const responses = await db.query(sql, params);

    res.json({
      success: true,
      count: responses.length,
      responses: responses
    });

  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch responses',
      details: error.message 
    });
  }
});

// PUT /api/responses/:id - Update response (for admin corrections)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        error: 'Answers array is required' 
      });
    }

    // First verify the response exists
    const existingResponse = await db.query('SELECT * FROM user_responses WHERE id = ?', [id]);
    if (existingResponse.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Delete existing answers
    await db.query('DELETE FROM answers WHERE response_id = ?', [id]);

    // Insert updated answers
    const insertPromises = answers.map(answer => {
      const { questionId, answer: answerValue, remarks } = answer;
      return db.insertAnswer(questionId, id, answerValue, remarks || '');
    });

    await Promise.all(insertPromises);

    res.json({
      success: true,
      message: 'Response updated successfully'
    });

  } catch (error) {
    console.error('Error updating response:', error);
    res.status(500).json({ 
      error: 'Failed to update response',
      details: error.message 
    });
  }
});

// DELETE /api/responses/:id - Delete response
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete answers first (foreign key constraint)
    await db.query('DELETE FROM answers WHERE response_id = ?', [id]);
    
    // Delete response
    const result = await db.query('DELETE FROM user_responses WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({
      success: true,
      message: 'Response deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting response:', error);
    res.status(500).json({ 
      error: 'Failed to delete response',
      details: error.message 
    });
  }
});

module.exports = router;