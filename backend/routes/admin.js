const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const router = express.Router();
const db = require('../db');
const excelParser = require('../services/excelParser');
const pdfGenerator = require('../services/pdfGenerator');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase clients for voucher operations
let supabase = null; // For read operations
let supabaseAdmin = null; // For admin operations (bypasses RLS)

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  // Regular client for read operations
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Admin client with service role key for write operations
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('Supabase admin client initialized for voucher management');
  } else {
    console.warn('Supabase service role key not found. Admin operations may fail due to RLS.');
  }
} else {
  console.warn('Supabase credentials not found. Voucher functionality will be disabled.');
}

// Helper function to check Supabase availability for read operations
const checkSupabase = (res) => {
  if (!supabase) {
    res.status(503).json({
      error: 'Supabase not configured',
      details: 'Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
    });
    return false;
  }
  return true;
};

// Helper function to check Supabase admin client availability for write operations
const checkSupabaseAdmin = (res) => {
  if (!supabaseAdmin) {
    res.status(503).json({
      error: 'Supabase admin client not configured',
      details: 'Please set SUPABASE_SERVICE_ROLE_KEY environment variable for admin operations'
    });
    return false;
  }
  return true;
};

// Configure multer for Excel file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename with timestamp prefix
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Check if file is Excel
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.toLowerCase().endsWith('.xlsx') ||
        file.originalname.toLowerCase().endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Simple admin authentication middleware (in production, use proper JWT/session)
const adminAuth = (req, res, next) => {
  const { authorization } = req.headers;
  
  // For demo purposes, accept a simple token
  // In production, implement proper JWT verification
  if (authorization === 'Bearer admin-token-123') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// POST /api/admin/login - Simple admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple demo credentials (use proper auth in production)
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      token: 'admin-token-123',
      message: 'Login successful'
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// POST /api/admin/upload-excel - Upload and process new Excel file
router.post('/upload-excel', adminAuth, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const filePath = req.file.path;
    
    // Parse and seed database
    const result = await excelParser.parseAndSeedDatabase(filePath);
    
    // Optionally, remove old Excel files (keep only the latest)
    const uploadDir = path.dirname(filePath);
    const files = fs.readdirSync(uploadDir)
      .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'))
      .map(file => ({
        name: file,
        path: path.join(uploadDir, file),
        stats: fs.statSync(path.join(uploadDir, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    // Keep only the 3 most recent Excel files
    for (let i = 3; i < files.length; i++) {
      try {
        fs.unlinkSync(files[i].path);
      } catch (err) {
        console.error('Error deleting old Excel file:', err);
      }
    }

    res.json({
      success: true,
      message: 'Excel file uploaded and processed successfully',
      filename: req.file.filename,
      questionsImported: result.totalInserted
    });

  } catch (error) {
    console.error('Error uploading Excel file:', error);
    res.status(500).json({ 
      error: 'Failed to process Excel file',
      details: error.message 
    });
  }
});

// GET /api/admin/preview-excel - Preview Excel file before processing
router.post('/preview-excel', adminAuth, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const preview = await excelParser.getQuestionPreview(req.file.path);
    
    // Delete the temporary file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      preview: preview
    });

  } catch (error) {
    console.error('Error previewing Excel file:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to preview Excel file',
      details: error.message 
    });
  }
});

// GET /api/admin/dashboard - Get dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    // Get basic statistics
    const totalResponses = await db.query('SELECT COUNT(*) as count FROM user_responses');
    const totalQuestions = await db.query('SELECT COUNT(*) as count FROM questions');
    
    // Get responses by language
    const responsesByLang = await db.query(`
      SELECT language, COUNT(*) as count 
      FROM user_responses 
      GROUP BY language
    `);

    // Get recent responses
    const recentResponses = await db.query(`
      SELECT email, language, timestamp 
      FROM user_responses 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);

    // Get question statistics
    const questionStats = await db.query(`
      SELECT 
        q.area,
        q.language,
        COUNT(DISTINCT q.id) as question_count,
        COUNT(a.id) as total_answers,
        SUM(CASE WHEN a.answer = 'Yes' THEN 1 ELSE 0 END) as yes_count,
        SUM(CASE WHEN a.answer = 'No' THEN 1 ELSE 0 END) as no_count,
        SUM(CASE WHEN a.answer = 'N/A' THEN 1 ELSE 0 END) as na_count
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      GROUP BY q.area, q.language
      ORDER BY q.area, q.language
    `);

    res.json({
      success: true,
      statistics: {
        totalResponses: totalResponses[0].count,
        totalQuestions: totalQuestions[0].count,
        responsesByLanguage: responsesByLang,
        recentResponses: recentResponses,
        questionStatistics: questionStats
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      details: error.message 
    });
  }
});

// GET /api/admin/report/pdf - Generate consolidated PDF report
router.get('/report/pdf', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, language } = req.query;
    
    // Build query for responses
    let sql = 'SELECT * FROM user_responses WHERE 1=1';
    const params = [];

    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate);
    }

    if (language && ['EN', 'ID'].includes(language)) {
      sql += ' AND language = ?';
      params.push(language);
    }

    sql += ' ORDER BY timestamp DESC';

    const responses = await db.query(sql, params);

    // Get question statistics
    const questionStats = await db.query(`
      SELECT 
        q.id,
        q.area,
        q.activity,
        q.criteria,
        q.language,
        COUNT(a.id) as total_responses,
        SUM(CASE WHEN a.answer = 'Yes' THEN 1 ELSE 0 END) as yes_count,
        SUM(CASE WHEN a.answer = 'No' THEN 1 ELSE 0 END) as no_count,
        SUM(CASE WHEN a.answer = 'N/A' THEN 1 ELSE 0 END) as na_count
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      ${language ? 'WHERE q.language = ?' : ''}
      GROUP BY q.id, q.area, q.activity, q.criteria, q.language
      ORDER BY q.sequence_order
    `, language ? [language] : []);

    const pdfBuffer = await pdfGenerator.generateConsolidatedReport(responses, questionStats);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="consolidated-report.pdf"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating consolidated report:', error);
    res.status(500).json({ 
      error: 'Failed to generate consolidated report',
      details: error.message 
    });
  }
});

// GET /api/admin/responses - Get all responses with filters (admin view)
router.get('/responses', adminAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      email, 
      language, 
      startDate, 
      endDate 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let sql = 'SELECT * FROM user_responses WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM user_responses WHERE 1=1';
    const params = [];

    if (email) {
      sql += ' AND email LIKE ?';
      countSql += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }

    if (language && ['EN', 'ID'].includes(language)) {
      sql += ' AND language = ?';
      countSql += ' AND language = ?';
      params.push(language);
    }

    if (startDate) {
      sql += ' AND timestamp >= ?';
      countSql += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND timestamp <= ?';
      countSql += ' AND timestamp <= ?';
      params.push(endDate);
    }

    // Get total count
    const totalResult = await db.query(countSql, params);
    const total = totalResult[0].total;

    // Get paginated results
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    const responses = await db.query(sql, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        responses: responses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin responses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch responses',
      details: error.message 
    });
  }
});

// GET /api/admin/responses/:id/details - Get detailed response data (admin only)
router.get('/responses/:id/details', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get response with answers
    const responseData = await db.getResponseWithAnswers(id);
    
    if (!responseData.response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Calculate answer summary
    const answerSummary = {
      total: responseData.answers.length,
      yes: responseData.answers.filter(a => a.answer === 'Yes').length,
      no: responseData.answers.filter(a => a.answer === 'No').length,
      na: responseData.answers.filter(a => a.answer === 'N/A').length,
      withRemarks: responseData.answers.filter(a => a.remarks && a.remarks.trim().length > 0).length
    };

    // Get completion percentage
    const totalQuestionsQuery = await db.query('SELECT COUNT(*) as count FROM questions WHERE language = ?', [responseData.response.language]);
    const totalQuestions = totalQuestionsQuery[0].count;
    const completionPercentage = Math.round((answerSummary.total / totalQuestions) * 100);

    res.json({
      success: true,
      data: {
        response: responseData.response,
        answerSummary,
        completionPercentage,
        totalExpectedQuestions: totalQuestions
      }
    });

  } catch (error) {
    console.error('Error fetching response details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch response details',
      details: error.message 
    });
  }
});

// DELETE /api/admin/responses/:id - Delete response (admin only)
router.delete('/responses/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete answers first
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

// GET /api/admin/access-requests - Get all access requests
router.get('/access-requests', adminAuth, async (req, res) => {
  try {
    const accessRequests = await db.getAllAccessRequests();
    
    res.json({
      success: true,
      data: accessRequests
    });
  } catch (error) {
    console.error('Error fetching access requests:', error);
    res.status(500).json({ 
      error: 'Failed to fetch access requests',
      details: error.message 
    });
  }
});

// PUT /api/admin/access-requests/:id/status - Update access request status
router.put('/access-requests/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.updateAccessRequestStatus(id, status);

    res.json({
      success: true,
      message: 'Access request status updated successfully'
    });
  } catch (error) {
    console.error('Error updating access request status:', error);
    res.status(500).json({
      error: 'Failed to update access request status',
      details: error.message
    });
  }
});

// ==================== VOUCHER MANAGEMENT ENDPOINTS ====================

// GET /api/admin/voucher-requests - Get all voucher requests
router.get('/voucher-requests', adminAuth, async (req, res) => {
  try {
    if (!checkSupabase(res)) return;

    console.log('Admin: Fetching voucher requests from Supabase...');
    const { data: voucherRequests, error } = await supabase
      .from('nx_voucher_requests')
      .select('*')
      .order('request_date', { ascending: false });

    console.log('Admin: Supabase response:', {
      dataCount: voucherRequests?.length || 0,
      error: error ? {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint
      } : null
    });

    if (error) {
      console.error('Admin: Supabase error details:', error);
      throw error;
    }

    // Enhance each request with voucher code information
    if (voucherRequests && voucherRequests.length > 0) {
      for (let i = 0; i < voucherRequests.length; i++) {
        const request = voucherRequests[i];

        // Look for voucher codes assigned to this candidate + certification exam
        const { data: voucherCodes, error: voucherError } = await supabaseAdmin
          .from('voucher_codes')
          .select('voucher_code, status, issue_date')
          .eq('candidate_email', request.customer_email)
          .eq('certification_exam', request.certification_exam)
          .eq('status', 'issued');

        if (!voucherError && voucherCodes && voucherCodes.length > 0) {
          // Assign voucher code info to the request for frontend display
          request.assigned_voucher_code = voucherCodes[0].voucher_code;
          request.voucher_assigned_at = voucherCodes[0].issue_date;

          // NOTE: Removed automatic issue_date updating logic that was causing
          // unwanted database modifications during read operations.
          // Issue dates should only be set when explicitly issuing vouchers.
        } else if (voucherError) {
          console.error(`Error fetching voucher codes for ${request.customer_email}:`, voucherError);
        }
      }
    }


    console.log('Admin: Successfully retrieved', voucherRequests?.length || 0, 'voucher requests');
    // Enhanced with voucher code lookup logic
    res.json({
      success: true,
      data: voucherRequests || []
    });
  } catch (error) {
    console.error('Admin: Error fetching voucher requests:', error);
    res.status(500).json({
      error: 'Failed to fetch voucher requests',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-requests/:id/approve - Approve voucher request
router.put('/voucher-requests/:id/approve', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;
    const { id } = req.params;

    console.log('Approving voucher request ID:', id, 'Type:', typeof id);

    // Convert ID to integer if it's a string
    const recordId = parseInt(id, 10);
    console.log('Converted ID:', recordId, 'Type:', typeof recordId);

    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        status: 'approved'
      })
      .eq('id', recordId)
      .select();

    console.log('Approve result:', { data, error, dataLength: data?.length });

    if (error) {
      console.error('Supabase error during approve:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No records updated - voucher request not found');
      return res.status(404).json({ error: 'Voucher request not found' });
    }

    res.json({
      success: true,
      message: 'Voucher request approved successfully'
    });
  } catch (error) {
    console.error('Error approving voucher request:', error);
    res.status(500).json({
      error: 'Failed to approve voucher request',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-requests/:id/reject - Reject voucher request
router.put('/voucher-requests/:id/reject', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;
    const { id } = req.params;
    const { reason } = req.body;

    // Validate rejection reason
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    if (reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason cannot be empty' });
    }

    if (reason.length > 36) {
      return res.status(400).json({ error: 'Rejection reason must be 36 characters or less' });
    }

    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Voucher request not found' });
    }

    res.json({
      success: true,
      message: 'Voucher request rejected successfully',
      rejectionReason: reason.trim()
    });
  } catch (error) {
    console.error('Error rejecting voucher request:', error);
    res.status(500).json({
      error: 'Failed to reject voucher request',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-requests/:id/issue-code - Issue voucher code
router.put('/voucher-requests/:id/issue-code', adminAuth, async (req, res) => {
  try {
    if (!checkSupabase(res)) return;
    const { id } = req.params;
    const { voucherCode, voucherCodeIssuedDate } = req.body;

    if (!voucherCode) {
      return res.status(400).json({ error: 'Voucher code is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        status: 'processed',
        issue_date: voucherCodeIssuedDate || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .in('status', ['approved', 'processed'])
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Voucher request not found or not approved' });
    }

    res.json({
      success: true,
      message: 'Voucher code issued successfully'
    });
  } catch (error) {
    console.error('Error issuing voucher code:', error);
    res.status(500).json({
      error: 'Failed to issue voucher code',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-requests/:id/record-redemption - Record redemption
router.put('/voucher-requests/:id/record-redemption', adminAuth, async (req, res) => {
  try {
    if (!checkSupabase(res)) return;
    const { id } = req.params;
    const { redemptionStatus, redemptionDate } = req.body;

    const redemptionDateValue = redemptionDate || new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        redemption_status: redemptionStatus || true,
        redemption_date: redemptionDateValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'processed')
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Voucher request not found or voucher code not in processed status' });
    }

    // Also update the voucher_codes table to mark as redeemed
    const updatedRequest = data[0];
    const { error: voucherError } = await supabaseAdmin
      .from('voucher_codes')
      .update({
        status: 'redeemed',
        redemption_date: redemptionDateValue,
        updated_at: new Date().toISOString()
      })
      .eq('candidate_email', updatedRequest.customer_email)
      .eq('certification_exam', updatedRequest.certification_exam)
      .eq('status', 'issued');

    if (voucherError) {
      console.error('Error updating voucher code status:', voucherError);
      // Don't fail the request, just log the error
    }

    res.json({
      success: true,
      message: 'Redemption status recorded successfully'
    });
  } catch (error) {
    console.error('Error recording redemption:', error);
    res.status(500).json({
      error: 'Failed to record redemption',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-requests/:id/mark-certification - Mark certification achieved
router.put('/voucher-requests/:id/mark-certification', adminAuth, async (req, res) => {
  try {
    if (!checkSupabase(res)) return;
    const { id } = req.params;
    const { certificationAchieved, certificationAchievedDate } = req.body;

    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        certification_achieved: certificationAchieved !== undefined ? certificationAchieved : true,
        certified_date: certificationAchievedDate || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'processed')
      .eq('redemption_status', true)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Voucher request not found or not redeemed' });
    }

    // Also update the voucher_codes table to mark certification achieved
    const updatedRequest = data[0];
    const certificationDate = certificationAchievedDate || new Date().toISOString();

    const voucherUpdateData = {
      certified_date: certificationDate,
      updated_at: new Date().toISOString()
    };

    // If marking certification (either achieved or not achieved), update status to 'completed'
    // Both true and false certification decisions result in 'completed' status
    voucherUpdateData.status = 'completed';

    const { error: voucherError } = await supabaseAdmin
      .from('voucher_codes')
      .update(voucherUpdateData)
      .eq('candidate_email', updatedRequest.customer_email)
      .eq('certification_exam', updatedRequest.certification_exam)
      .eq('status', 'redeemed');

    if (voucherError) {
      console.error('Error updating voucher code certification:', voucherError);
      // Don't fail the request, just log the error
    }

    res.json({
      success: true,
      message: 'Certification achievement recorded successfully'
    });
  } catch (error) {
    console.error('Error marking certification:', error);
    res.status(500).json({
      error: 'Failed to mark certification',
      details: error.message
    });
  }
});

// PUT /api/admin/fix-voucher-status - Fix voucher codes that should be 'completed'
router.put('/fix-voucher-status', adminAuth, async (req, res) => {
  try {
    if (!checkSupabase(res)) return;

    // Update voucher codes that have certified_date but are still 'redeemed'
    const { data, error } = await supabaseAdmin
      .from('voucher_codes')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .not('certified_date', 'is', null)
      .eq('status', 'redeemed')
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Updated ${data?.length || 0} voucher codes to 'completed' status`,
      updated: data
    });
  } catch (error) {
    console.error('Error fixing voucher status:', error);
    res.status(500).json({
      error: 'Failed to fix voucher status',
      details: error.message
    });
  }
});

// GET /api/admin/voucher-codes - Get all voucher codes
router.get('/voucher-codes', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    console.log('Admin: Fetching voucher codes from Supabase...');

    const { data, error } = await supabaseAdmin
      .from('voucher_codes')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase error fetching voucher codes:', error);
      throw error;
    }

    console.log('Admin: Successfully retrieved', data?.length || 0, 'voucher codes');

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Admin: Error fetching voucher codes:', error);
    res.status(500).json({
      error: 'Failed to fetch voucher codes',
      details: error.message
    });
  }
});

// POST /api/admin/upload-voucher-codes - Upload voucher codes from Excel
router.post('/upload-voucher-codes', adminAuth, upload.single('voucherCodesFile'), async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing voucher codes Excel file:', req.file.filename);

    // Parse Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['Certification Exam', 'Voucher code'];
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Prepare voucher codes data for insertion
    const voucherCodes = data.map(row => ({
      voucher_code: row['Voucher code']?.toString().trim(),
      certification_exam: row['Certification Exam']?.toString().trim(),
      status: 'available',
      created_at: new Date().toISOString()
    })).filter(code => code.voucher_code && code.certification_exam);

    if (voucherCodes.length === 0) {
      return res.status(400).json({ error: 'No valid voucher codes found in the file' });
    }

    // Insert voucher codes into Supabase
    const { data: insertedData, error } = await supabaseAdmin
      .from('voucher_codes')
      .insert(voucherCodes)
      .select();

    if (error) {
      console.error('Supabase error inserting voucher codes:', error);
      throw error;
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log('Successfully inserted', insertedData?.length || 0, 'voucher codes');

    res.json({
      success: true,
      message: `Successfully uploaded ${insertedData?.length || 0} voucher codes`,
      data: insertedData
    });

  } catch (error) {
    console.error('Error uploading voucher codes:', error);

    // Clean up file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Failed to upload voucher codes',
      details: error.message
    });
  }
});

// POST /api/admin/issue-voucher-code - Issue a voucher code for an approved request
router.post('/issue-voucher-code', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    const { requestId, certificationExam, partnerEmail, partnerCompany, customerCompany, candidateFirstName, candidateLastName, candidateEmail, country } = req.body;

    if (!requestId || !certificationExam) {
      return res.status(400).json({ error: 'Request ID and certification exam are required' });
    }

    // Check if this request already has a voucher code issued
    const { data: existingRequest, error: checkError } = await supabaseAdmin
      .from('nx_voucher_requests')
      .select('status, issue_date')
      .eq('id', requestId)
      .single();

    if (checkError) {
      console.error('Error checking existing request:', checkError);
      return res.status(500).json({ error: 'Failed to check existing request' });
    }

    if (existingRequest && (existingRequest.status === 'processed' || existingRequest.issue_date)) {
      return res.status(400).json({ error: 'Voucher code has already been issued for this request' });
    }

    // Debug: Log the certification exam being searched for
    console.log(`Looking for available voucher codes for certification exam: "${certificationExam}"`);
    console.log(`Partner details: email="${partnerEmail}", company="${partnerCompany}"`);

    // First, let's see what voucher codes exist in the database
    const { data: allVouchers, error: allVouchersError } = await supabaseAdmin
      .from('voucher_codes')
      .select('certification_exam, status, voucher_code');

    if (allVouchersError) {
      console.error('Error fetching all vouchers for debugging:', allVouchersError);
    } else {
      console.log('All voucher codes in database:');
      allVouchers.forEach(v => {
        console.log(`  - "${v.certification_exam}" | ${v.status} | ${v.voucher_code}`);
      });
    }

    // Find an available voucher code for the specified certification exam
    // Order by ID to ensure top-to-bottom assignment (first created = first assigned)
    // Use a transaction to prevent race conditions from fast clicking
    const { data: availableVouchers, error: findError } = await supabaseAdmin
      .from('voucher_codes')
      .select('*')
      .eq('certification_exam', certificationExam)
      .eq('status', 'available')
      .order('id', { ascending: true })
      .limit(1);

    if (findError) {
      console.error('Error finding available voucher:', findError);
      return res.status(500).json({ error: 'Failed to find available voucher code' });
    }

    if (!availableVouchers || availableVouchers.length === 0) {
      return res.status(404).json({
        error: `No available voucher codes found for ${certificationExam}`
      });
    }

    const voucherToIssue = availableVouchers[0];

    // Update the voucher code with assignment details and mark as issued
    const { data: updatedVoucher, error: updateError } = await supabaseAdmin
      .from('voucher_codes')
      .update({
        status: 'issued',
        partner_email: partnerEmail,
        partner_company: partnerCompany,
        customer_company: customerCompany,
        candidate_first_name: candidateFirstName,
        candidate_last_name: candidateLastName,
        candidate_email: candidateEmail,
        country: country,
        issue_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', voucherToIssue.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating voucher code:', updateError);
      return res.status(500).json({ error: 'Failed to issue voucher code' });
    }

    // Also update the voucher request status to "processed" and set issue_date and voucher_code
    // ONLY if voucher was successfully assigned
    if (updatedVoucher && updatedVoucher.voucher_code) {
      try {
        const { error: requestUpdateError } = await supabaseAdmin
          .from('nx_voucher_requests')
          .update({
            status: 'processed',
            voucher_code: updatedVoucher.voucher_code,
            issue_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (requestUpdateError) {
          console.error('Error updating voucher request status:', requestUpdateError);
          return res.status(500).json({ error: 'Voucher assigned but failed to update request status' });
        }
      } catch (requestUpdateError) {
        console.error('Error updating voucher request status:', requestUpdateError);
        return res.status(500).json({ error: 'Voucher assigned but failed to update request status' });
      }
    } else {
      console.error('No voucher code in updatedVoucher:', updatedVoucher);
      return res.status(500).json({ error: 'Failed to assign voucher code' });
    }

    res.json({
      success: true,
      voucherCode: updatedVoucher.voucher_code,
      message: `Voucher code ${updatedVoucher.voucher_code} issued successfully`
    });

  } catch (error) {
    console.error('Error issuing voucher code:', error);
    res.status(500).json({
      error: 'Failed to issue voucher code',
      details: error.message
    });
  }
});

// PUT /api/admin/voucher-codes/:id/reset - Reset voucher code assignment
router.put('/voucher-codes/:id/reset', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Voucher code ID is required' });
    }

    // Reset the voucher code assignment in Supabase
    const { data: updatedVoucher, error } = await supabaseAdmin
      .from('voucher_codes')
      .update({
        status: 'available',
        partner_name: null,
        partner_email: null,
        customer_company: null,
        candidate_first_name: null,
        candidate_last_name: null,
        candidate_email: null,
        country: null,
        issue_date: null,
        redemption_date: null,
        certified_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error resetting voucher code:', error);
      return res.status(500).json({ error: 'Failed to reset voucher code assignment' });
    }

    res.json({
      success: true,
      message: 'Voucher code assignment reset successfully',
      data: updatedVoucher
    });

  } catch (error) {
    console.error('Error resetting voucher code assignment:', error);
    res.status(500).json({
      error: 'Failed to reset voucher code assignment',
      details: error.message
    });
  }
});

// POST /api/admin/cleanup-duplicate-vouchers - Clean up duplicate voucher assignments
router.post('/cleanup-duplicate-vouchers', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    console.log('Admin: Starting cleanup of duplicate voucher assignments...');

    // Find duplicate voucher assignments (same candidate email + certification exam)
    const { data: voucherCodes, error: fetchError } = await supabaseAdmin
      .from('voucher_codes')
      .select('*')
      .eq('status', 'issued')
      .not('candidate_email', 'is', null);

    if (fetchError) {
      console.error('Error fetching voucher codes:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch voucher codes' });
    }

    // Group by candidate email + certification exam to find duplicates
    const candidateExamGroups = {};

    voucherCodes.forEach(voucher => {
      const key = `${voucher.candidate_email}_${voucher.certification_exam}`;
      if (!candidateExamGroups[key]) {
        candidateExamGroups[key] = [];
      }
      candidateExamGroups[key].push(voucher);
    });

    // Find groups with duplicates (more than 1 voucher for same candidate + exam)
    const duplicateGroups = Object.entries(candidateExamGroups)
      .filter(([key, vouchers]) => vouchers.length > 1);

    let cleanupCount = 0;

    if (duplicateGroups.length > 0) {
      console.log(`Found ${duplicateGroups.length} duplicate groups affecting multiple vouchers`);

      for (const [key, vouchers] of duplicateGroups) {
        // Keep the first voucher (earliest issue date), reset others to 'available'
        const sortedVouchers = vouchers.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const vouchersToReset = sortedVouchers.slice(1); // All except the first one

        for (const voucher of vouchersToReset) {
          console.log(`Resetting duplicate voucher: ${voucher.voucher_code} for ${voucher.candidate_email}`);

          const { error: resetError } = await supabaseAdmin
            .from('voucher_codes')
            .update({
              status: 'available',
              partner_email: null,
              customer_company: null,
              candidate_first_name: null,
              candidate_last_name: null,
              candidate_email: null,
              country: null,
              assigned_at: null
            })
            .eq('id', voucher.id);

          if (!resetError) {
            cleanupCount++;
          } else {
            console.error(`Error resetting voucher ${voucher.voucher_code}:`, resetError);
          }
        }
      }
    }

    console.log(`Admin: Cleanup completed. Reset ${cleanupCount} duplicate voucher assignments.`);

    res.json({
      success: true,
      message: `Cleanup completed. Reset ${cleanupCount} duplicate voucher assignments.`,
      duplicateGroupsFound: duplicateGroups.length,
      vouchersReset: cleanupCount
    });

  } catch (error) {
    console.error('Error during voucher cleanup:', error);
    res.status(500).json({
      error: 'Failed to cleanup duplicate vouchers',
      details: error.message
    });
  }
});

// POST /api/admin/sync-voucher-codes - Sync voucher codes from voucher_codes table to nx_voucher_requests
router.post('/sync-voucher-codes', adminAuth, async (req, res) => {
  try {
    if (!checkSupabaseAdmin(res)) return;

    // Find all processed requests that don't have voucher_code populated
    const { data: processedRequests, error: findError } = await supabaseAdmin
      .from('nx_voucher_requests')
      .select('id, candidate_first_name, candidate_last_name, candidate_email, certification_exam')
      .eq('status', 'processed')
      .is('voucher_code', null);

    if (findError) {
      console.error('Error finding processed requests:', findError);
      return res.status(500).json({ error: 'Failed to find processed requests' });
    }

    console.log(`Found ${processedRequests.length} requests without voucher codes`);

    let syncedCount = 0;

    // For each request, find the corresponding voucher code
    for (const request of processedRequests) {
      const { data: voucherCodes, error: voucherError } = await supabaseAdmin
        .from('voucher_codes')
        .select('voucher_code')
        .eq('candidate_first_name', request.candidate_first_name)
        .eq('candidate_last_name', request.candidate_last_name)
        .eq('candidate_email', request.candidate_email)
        .eq('certification_exam', request.certification_exam)
        .eq('status', 'issued')
        .single();

      if (voucherError) {
        console.log(`No voucher found for ${request.candidate_first_name} ${request.candidate_last_name}`);
        continue;
      }

      // Update the request with the voucher code
      const { error: updateError } = await supabaseAdmin
        .from('nx_voucher_requests')
        .update({
          voucher_code: voucherCodes.voucher_code
        })
        .eq('id', request.id);

      if (updateError) {
        console.error(`Error updating request ${request.id}:`, updateError);
        continue;
      }

      console.log(`Synced voucher code ${voucherCodes.voucher_code} for ${request.candidate_first_name} ${request.candidate_last_name}`);
      syncedCount++;
    }

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} voucher codes`,
      syncedCount,
      totalProcessed: processedRequests.length
    });

  } catch (error) {
    console.error('Error syncing voucher codes:', error);
    res.status(500).json({
      error: 'Failed to sync voucher codes',
      details: error.message
    });
  }
});

// PUT /api/admin/fix-max-voucher-status - Fix Max's voucher code status
router.put('/fix-max-voucher-status', adminAuth, async (req, res) => {
  if (!checkSupabaseAdmin(res)) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('voucher_codes')
      .update({
        status: 'completed'
      })
      .eq('candidate_email', 'max@greatech.com')
      .eq('certification_exam', 'NX Design Associate')
      .eq('status', 'redeemed')
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Fixed Max's voucher code status to completed`,
      updatedRecord: data[0]
    });
  } catch (error) {
    console.error('Error fixing Max voucher status:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/fix-max-record - Fix Max's specific record
router.put('/fix-max-record', adminAuth, async (req, res) => {
  if (!checkSupabaseAdmin(res)) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        certification_achieved: null,
        certified_date: null
      })
      .eq('id', 36)
      .eq('customer_email', 'max@greatech.com')
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Fixed Max's record`,
      updatedRecord: data[0]
    });
  } catch (error) {
    console.error('Error fixing Max record:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/cleanup-certification-data - Clean up incorrect certification_achieved values
router.put('/cleanup-certification-data', adminAuth, async (req, res) => {
  if (!checkSupabaseAdmin(res)) return;

  try {
    // Reset certification_achieved to null for records that shouldn't have it set
    // These are records that haven't reached the certification stage yet
    const { data, error } = await supabaseAdmin
      .from('nx_voucher_requests')
      .update({
        certification_achieved: null,
        certified_date: null
      })
      .in('status', ['pending', 'approved', 'rejected'])
      .not('certification_achieved', 'is', null)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Cleaned up ${data?.length || 0} records with incorrect certification_achieved values`,
      updatedRecords: data
    });
  } catch (error) {
    console.error('Error cleaning up certification data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/debug-voucher-availability - Debug voucher availability issue
router.get('/debug-voucher-availability', adminAuth, async (req, res) => {
  if (!checkSupabaseAdmin(res)) return;

  try {
    // Get all voucher codes
    const { data: allVoucherCodes, error: voucherError } = await supabaseAdmin
      .from('voucher_codes')
      .select('*')
      .order('id', { ascending: true });

    if (voucherError) throw voucherError;

    // Get recent voucher requests
    const { data: recentRequests, error: requestError } = await supabase
      .from('nx_voucher_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (requestError) throw requestError;

    // Group voucher codes by certification exam and status
    const vouchersByExam = {};
    allVoucherCodes.forEach(voucher => {
      const exam = voucher.certification_exam;
      if (!vouchersByExam[exam]) {
        vouchersByExam[exam] = { available: 0, issued: 0, redeemed: 0, completed: 0, total: 0 };
      }
      vouchersByExam[exam][voucher.status] = (vouchersByExam[exam][voucher.status] || 0) + 1;
      vouchersByExam[exam].total++;
    });

    res.json({
      vouchersByExam,
      allVoucherCodes,
      recentRequests,
      summary: {
        totalVoucherCodes: allVoucherCodes.length,
        totalRequests: recentRequests.length,
        uniqueExams: Object.keys(vouchersByExam)
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/debug-certification-data - Debug endpoint to check certification data
router.get('/debug-certification-data', adminAuth, async (req, res) => {
  if (!checkSupabase(res)) return;

  try {
    const { data: allRequests, error } = await supabase
      .from('nx_voucher_requests')
      .select('id, customer_email, certification_achieved, status, redemption_status, certified_date')
      .order('id', { ascending: true });

    if (error) throw error;

    const summary = {
      total: allRequests.length,
      certificationAchievedTrue: allRequests.filter(req => req.certification_achieved === true).length,
      certificationAchievedFalse: allRequests.filter(req => req.certification_achieved === false).length,
      certificationAchievedNull: allRequests.filter(req => req.certification_achieved === null).length,
      certificationAchievedUndefined: allRequests.filter(req => req.certification_achieved === undefined).length,
    };

    res.json({
      summary,
      allRecords: allRequests,
      recordsWithFalse: allRequests.filter(req => req.certification_achieved === false),
      recordsWithNull: allRequests.filter(req => req.certification_achieved === null),
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/analytics - Analytics Dashboard Data
router.get('/analytics', adminAuth, async (req, res) => {
  console.log('Analytics: Endpoint called with query params:', req.query);
  if (!checkSupabase(res)) return;

  try {
    const { status, country, partner, startDate, endDate } = req.query;

    // Build base query conditions
    let queryConditions = '';
    const queryParams = [];

    if (status && status !== 'all') {
      queryConditions += queryConditions ? ' AND ' : ' WHERE ';
      queryConditions += 'status = ?';
      queryParams.push(status);
    }

    if (country && country !== 'all') {
      queryConditions += queryConditions ? ' AND ' : ' WHERE ';
      queryConditions += 'country = ?';
      queryParams.push(country);
    }

    if (partner && partner !== 'all') {
      queryConditions += queryConditions ? ' AND ' : ' WHERE ';
      queryConditions += 'partner_company = ?';
      queryParams.push(partner);
    }

    if (startDate) {
      queryConditions += queryConditions ? ' AND ' : ' WHERE ';
      queryConditions += 'request_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      queryConditions += queryConditions ? ' AND ' : ' WHERE ';
      queryConditions += 'request_date <= ?';
      queryParams.push(endDate);
    }

    // Use Supabase for queries
    let baseQuery = supabase.from('nx_voucher_requests').select('*');

    // Apply filters
    if (status && status !== 'all') {
      if (status === 'certifications-achieved') {
        baseQuery = baseQuery.eq('certification_achieved', true).not('certified_date', 'is', null);
      } else if (status === 'certifications-not-achieved') {
        baseQuery = baseQuery.eq('certification_achieved', false).not('certified_date', 'is', null);
      } else {
        baseQuery = baseQuery.eq('status', status);
      }
    }
    if (country && country !== 'all') {
      baseQuery = baseQuery.eq('country', country);
    }
    if (partner && partner !== 'all') {
      baseQuery = baseQuery.eq('partner_company', partner);
    }
    if (startDate) {
      baseQuery = baseQuery.gte('request_date', startDate);
    }
    if (endDate) {
      baseQuery = baseQuery.lte('request_date', endDate);
    }

    const { data: allRequests, error: requestsError } = await baseQuery;
    if (requestsError) throw requestsError;

    // 1. Top Partners by Certifications (Achieved and Not Achieved)
    const topPartnersAchieved = {};
    const topPartnersNotAchieved = {};

    // Count achieved certifications
    allRequests
      .filter(req => req.certification_achieved === true && req.certified_date !== null)
      .forEach(req => {
        const partner = req.partner_company || req.partner_name || req.partner_email || 'Unknown';
        topPartnersAchieved[partner] = (topPartnersAchieved[partner] || 0) + 1;
      });

    // Count not achieved certifications
    allRequests
      .filter(req => req.certification_achieved === false && req.certified_date !== null)
      .forEach(req => {
        const partner = req.partner_company || req.partner_name || req.partner_email || 'Unknown';
        topPartnersNotAchieved[partner] = (topPartnersNotAchieved[partner] || 0) + 1;
      });

    // Get all unique partners and create combined data
    const allPartners = new Set([...Object.keys(topPartnersAchieved), ...Object.keys(topPartnersNotAchieved)]);
    const topPartners = Array.from(allPartners).map(partner => ({
      partner,
      achieved: topPartnersAchieved[partner] || 0,
      notAchieved: topPartnersNotAchieved[partner] || 0,
      total: (topPartnersAchieved[partner] || 0) + (topPartnersNotAchieved[partner] || 0)
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 2. Voucher Code Status Distribution by Customer Type
    const customerTypeData = {
      'New - Certifications Achieved': 0,
      'New - Certifications Not Achieved': 0,
      'Existing - Certifications Achieved': 0,
      'Existing - Certifications Not Achieved': 0
    };

    allRequests.forEach(req => {
      if (req.certified_date !== null) { // Only count completed certifications
        const customerType = req.customer_type || 'Unknown';
        const isAchieved = req.certification_achieved === true;

        if (customerType === 'New') {
          if (isAchieved) {
            customerTypeData['New - Certifications Achieved']++;
          } else {
            customerTypeData['New - Certifications Not Achieved']++;
          }
        } else if (customerType === 'Existing') {
          if (isAchieved) {
            customerTypeData['Existing - Certifications Achieved']++;
          } else {
            customerTypeData['Existing - Certifications Not Achieved']++;
          }
        }
      }
    });

    const statusDistribution = Object.entries(customerTypeData)
      .filter(([type, count]) => count > 0) // Only include types with data
      .map(([type, count]) => ({ status: type, count }));

    // 3. Certifications by Country (Achieved and Not Achieved)
    const countryAchieved = {};
    const countryNotAchieved = {};

    // Count achieved certifications by country
    allRequests
      .filter(req => req.certification_achieved === true && req.certified_date !== null)
      .forEach(req => {
        const country = req.country || 'Unknown';
        countryAchieved[country] = (countryAchieved[country] || 0) + 1;
      });

    // Count not achieved certifications by country
    allRequests
      .filter(req => req.certification_achieved === false && req.certified_date !== null)
      .forEach(req => {
        const country = req.country || 'Unknown';
        countryNotAchieved[country] = (countryNotAchieved[country] || 0) + 1;
      });

    // Get all unique countries and create combined data
    const allCountries = new Set([...Object.keys(countryAchieved), ...Object.keys(countryNotAchieved)]);
    const certificationsByCountry = Array.from(allCountries).map(country => ({
      country,
      achieved: countryAchieved[country] || 0,
      notAchieved: countryNotAchieved[country] || 0,
      total: (countryAchieved[country] || 0) + (countryNotAchieved[country] || 0)
    }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 4. Certifications Over Time (last 12 months)
    const now = new Date();
    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      last12Months.push({
        month: monthName,
        year: date.getFullYear(),
        monthIndex: date.getMonth()
      });
    }

    const certificationsOverTime = last12Months.map(({ month, year, monthIndex }) => {
      const count = allRequests.filter(req => {
        if (req.certification_achieved !== true || !req.certified_date) return false;
        const certDate = new Date(req.certified_date);
        return certDate.getFullYear() === year && certDate.getMonth() === monthIndex;
      }).length;

      return { month, count };
    });

    // 5. Recent Voucher Requests (last 50)
    const recentRequests = allRequests
      .sort((a, b) => new Date(b.request_date) - new Date(a.request_date))
      .slice(0, 50);

    // 6. Get unique countries and partners for filter dropdowns
    const { data: allData, error: allDataError } = await supabase
      .from('nx_voucher_requests')
      .select('country, partner_email, partner_company');

    if (allDataError) throw allDataError;

    const countries = [...new Set(allData.map(req => req.country).filter(Boolean))].sort();
    const partners = [...new Set(allData.map(req => req.partner_company).filter(Boolean))].sort();

    console.log('Analytics: Debug partners array:', partners);
    console.log('Analytics: Sample data rows with partner_company:', allData.slice(0, 3).map(row => ({
      id: row.id,
      partner_company: row.partner_company,
      partner_email: row.partner_email
    })));

    res.json({
      topPartners,
      statusDistribution,
      certificationsByCountry,
      certificationsOverTime,
      recentRequests,
      countries,
      partners,
      totalRequests: allRequests.length,
      summary: {
        pending: allRequests.filter(req => req.status === 'pending').length,
        approved: allRequests.filter(req => req.status === 'approved').length,
        processed: allRequests.filter(req => req.status === 'processed').length,
        redeemed: allRequests.filter(req => req.status === 'redeemed').length,
        certificationsAchieved: allRequests.filter(req =>
          req.certification_achieved === true &&
          req.certified_date !== null
        ).length,
        certificationsNotAchieved: allRequests.filter(req =>
          req.certification_achieved === false &&
          req.certified_date !== null
        ).length,
        rejected: allRequests.filter(req => req.status === 'rejected').length,
      }
    });

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics data',
      details: error.message
    });
  }
});

// Partner Voucher Report PDF Export
router.post('/export-partner-voucher-pdf', async (req, res) => {
  try {
    console.log('Partner voucher PDF export request received');

    if (!checkSupabaseAdmin(res)) return;

    const { partnerEmail } = req.body;

    if (!partnerEmail) {
      return res.status(400).json({
        error: 'Partner email is required'
      });
    }

    console.log(`Generating partner voucher PDF for: ${partnerEmail}`);

    // Fetch voucher request data for the specific partner
    const { data: voucherRequests, error } = await supabase
      .from('nx_voucher_requests')
      .select('*')
      .eq('partner_email', partnerEmail)
      .order('request_date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`Found ${voucherRequests.length} voucher requests for partner: ${partnerEmail}`);

    // Transform data into the same format used by PartnerVoucherReport component
    const companyGroups = {};

    voucherRequests.forEach(request => {
      const companyKey = request.customer_company || 'Unknown Company';

      if (!companyGroups[companyKey]) {
        companyGroups[companyKey] = {
          companyName: companyKey,
          country: request.country || 'Not specified',
          customerType: request.customer_type || 'Not specified',
          totalVouchers: 0,
          pendingVouchers: 0,
          approvedVouchers: 0,
          issuedVouchers: 0,
          redeemedVouchers: 0,
          rejectedVouchers: 0,
          certifiedVouchers: 0,
          notCertifiedVouchers: 0,
          latestRequestDate: request.request_date,
          requests: []
        };
      }

      // Add request to company group
      companyGroups[companyKey].requests.push({
        candidateName: `${request.candidate_first_name || ''} ${request.candidate_last_name || ''}`.trim(),
        candidateEmail: request.candidate_email,
        certificationExam: request.certification_exam,
        status: request.status,
        requestDate: request.request_date,
        voucherCode: request.voucher_code || 'Pending',
        voucherCodeIssuedDate: request.issue_date,
        redemptionStatus: request.redemption_status || false,
        redemptionDate: request.redemption_date,
        certificationAchieved: request.certification_achieved,
        certificationAchievedDate: request.certified_date,
        rejectionReason: request.rejection_reason
      });

      // Count vouchers by status
      companyGroups[companyKey].totalVouchers++;
      switch (request.status) {
        case 'pending':
          companyGroups[companyKey].pendingVouchers++;
          break;
        case 'approved':
          companyGroups[companyKey].approvedVouchers++;
          break;
        case 'issued':
          companyGroups[companyKey].issuedVouchers++;
          break;
        case 'redeemed':
          companyGroups[companyKey].redeemedVouchers++;
          break;
        case 'rejected':
          companyGroups[companyKey].rejectedVouchers++;
          break;
      }

      // Count certifications
      if (request.certification_achieved === true) {
        companyGroups[companyKey].certifiedVouchers++;
      } else if (request.certification_achieved === false && request.certified_date) {
        companyGroups[companyKey].notCertifiedVouchers++;
      }

      // Track latest request date
      if (new Date(request.request_date) > new Date(companyGroups[companyKey].latestRequestDate)) {
        companyGroups[companyKey].latestRequestDate = request.request_date;
      }
    });

    // Convert to array and sort by latest request date
    const voucherData = Object.values(companyGroups).sort((a, b) =>
      new Date(b.latestRequestDate) - new Date(a.latestRequestDate)
    );

    console.log(`Processed data for ${voucherData.length} companies`);

    // Generate PDF
    const pdfBuffer = pdfGenerator.generatePartnerVoucherReport(partnerEmail, voucherData);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="partner-voucher-report-${partnerEmail.replace('@', '-')}-${new Date().toISOString().split('T')[0]}.pdf"`);

    console.log('PDF generated successfully, sending response');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating partner voucher PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF report',
      details: error.message
    });
  }
});


// GET /api/admin/debug-voucher-simple - Simple debug endpoint (no auth for testing)
router.get('/debug-voucher-simple', async (req, res) => {
  if (!checkSupabaseAdmin(res)) return;

  try {
    // Just get counts by status and exam
    const { data: voucherCodes, error } = await supabaseAdmin
      .from('voucher_codes')
      .select('certification_exam, status');

    if (error) throw error;

    const summary = {};
    voucherCodes.forEach(v => {
      const exam = v.certification_exam;
      if (!summary[exam]) summary[exam] = {};
      summary[exam][v.status] = (summary[exam][v.status] || 0) + 1;
    });

    res.json({
      summary,
      totalCodes: voucherCodes.length,
      message: "Voucher codes by certification exam and status"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users from Supabase Auth
router.get('/users', adminAuth, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' });
    }

    // Fetch users from Supabase Auth using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching users from Supabase Auth:', error);
      return res.status(500).json({ error: error.message });
    }

    // Transform the user data to include relevant information
    // Note: Supabase stores metadata with different field name formats
    const users = data.users.map(user => {
      const metadata = user.user_metadata || {};
      return {
        id: user.id,
        email: user.email,
        user_type: metadata.userType || metadata.user_type || 'User',
        first_name: metadata.firstName || metadata.first_name || '',
        last_name: metadata.lastName || metadata.last_name || '',
        company: metadata.companyName || metadata.company || '',
        country: metadata.country || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at
      };
    });

    res.json(users);
  } catch (error) {
    console.error('Error in /users endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user from Supabase Auth
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' });
    }

    const userId = req.params.id;

    // Delete user from Supabase Auth using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user from Supabase Auth:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'User deleted successfully from authentication system' });
  } catch (error) {
    console.error('Error in DELETE /users/:id endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;