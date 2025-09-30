const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

class Database {
  constructor() {
    this.supabase = null;
    this.sqlite = null;
    this.useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

    // Initialize Supabase if credentials are available (for voucher requests)
    if (this.useSupabase) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }

    // Always initialize SQLite for main app data (user_responses, questions, etc.)
    const dbPath = path.join(__dirname, 'database.sqlite');
    this.sqlite = new sqlite3.Database(dbPath);
    this.initSQLite();
  }

  async initSQLite() {
    return new Promise((resolve, reject) => {
      this.sqlite.serialize(() => {
        // Create tables
        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS user_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            language TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area TEXT NOT NULL,
            activity TEXT NOT NULL,
            criteria TEXT NOT NULL,
            language TEXT NOT NULL,
            sequence_order INTEGER DEFAULT 0
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER,
            response_id INTEGER,
            answer TEXT,
            remarks TEXT,
            FOREIGN KEY(question_id) REFERENCES questions(id),
            FOREIGN KEY(response_id) REFERENCES user_responses(id)
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS excel_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS access_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.sqlite.run(`
          CREATE TABLE IF NOT EXISTS nx_voucher_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_user_id TEXT NOT NULL,
            partner_user_email TEXT NOT NULL,
            customer_company_name TEXT NOT NULL,
            sfdc_opportunity_id TEXT,
            country TEXT NOT NULL,
            existing_nx_customer TEXT NOT NULL,
            has_completed_learning_paths TEXT,
            customer_first_name TEXT NOT NULL,
            customer_last_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_number INTEGER DEFAULT 1,
            certification_exam TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status_updated_date DATETIME,
            voucher_code TEXT,
            voucher_code_issued_date DATETIME,
            redemption_status BOOLEAN DEFAULT 0,
            redemption_date DATETIME,
            certification_achieved BOOLEAN DEFAULT 0,
            certification_achieved_date DATETIME
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async query(sql, params = []) {
    // Only use Supabase for voucher-related queries
    if (this.useSupabase && sql.includes('nx_voucher_requests')) {
      return this.executeSupabaseQuery(sql, params);
    } else {
      // Use SQLite for all other queries (user_responses, questions, etc.)
      return this.executeSQLiteQuery(sql, params);
    }
  }

  async executeSQLiteQuery(sql, params) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.sqlite.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        this.sqlite.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }

  async executeSupabaseQuery(sql, params) {
    // Handle common SQL operations for Supabase
    const trimmedSql = sql.trim().toUpperCase();

    if (trimmedSql.startsWith('SELECT')) {
      return this.executeSupabaseSelect(sql, params);
    } else if (trimmedSql.startsWith('INSERT')) {
      return this.executeSupabaseInsert(sql, params);
    } else if (trimmedSql.startsWith('UPDATE')) {
      return this.executeSupabaseUpdate(sql, params);
    } else if (trimmedSql.startsWith('DELETE')) {
      return this.executeSupabaseDelete(sql, params);
    } else {
      throw new Error(`Unsupported SQL operation: ${sql}`);
    }
  }

  async executeSupabaseSelect(sql, params) {
    // For voucher requests table
    if (sql.includes('nx_voucher_requests')) {
      console.log('Executing Supabase query for nx_voucher_requests...');
      try {
        const { data, error } = await this.supabase
          .from('nx_voucher_requests')
          .select('*')
          .order('request_date', { ascending: false });

        console.log('Supabase response:', { data, error });

        if (error) {
          console.error('Supabase error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          // If it's a permissions error, return empty array instead of throwing
          if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('RLS')) {
            console.warn('Permissions issue detected, returning empty array');
            return [];
          }
          throw error;
        }

        console.log('Successfully retrieved voucher requests:', data?.length || 0, 'records');
        return data || [];
      } catch (err) {
        console.error('Unexpected error in Supabase query:', err);
        return [];
      }
    }

    // For other tables, fall back to error
    throw new Error(`Supabase SELECT not implemented for: ${sql}`);
  }

  async executeSupabaseInsert(sql, params) {
    // Handle INSERT operations for Supabase
    if (sql.includes('nx_voucher_requests')) {
      // Parse INSERT statement (simplified approach)
      const values = this.parseInsertValues(sql, params);
      const { data, error } = await this.supabase
        .from('nx_voucher_requests')
        .insert(values)
        .select();

      if (error) throw error;
      return { lastID: data[0]?.id, changes: 1 };
    }

    throw new Error(`Supabase INSERT not implemented for: ${sql}`);
  }

  async executeSupabaseUpdate(sql, params) {
    // Handle UPDATE operations for Supabase
    if (sql.includes('nx_voucher_requests')) {
      const id = params[params.length - 1]; // Last param is usually the ID
      const updates = {};

      // Parse common update patterns
      if (sql.includes('status = ?')) {
        updates.status = params[0];
        if (sql.includes('status_updated_date')) {
          updates.status_updated_date = new Date().toISOString();
        }
      }

      if (sql.includes('voucher_code = ?')) {
        updates.voucher_code = params[0];
        updates.voucher_code_issued_date = params[1];
        updates.status = 'processed';
        updates.status_updated_date = new Date().toISOString();
      }

      if (sql.includes('redemption_status = ?')) {
        updates.redemption_status = params[0];
        updates.redemption_date = params[1];
        updates.status_updated_date = new Date().toISOString();
      }

      if (sql.includes('certification_achieved = ?')) {
        updates.certification_achieved = params[0];
        updates.certification_achieved_date = params[1];
        updates.status_updated_date = new Date().toISOString();
      }

      const { data, error } = await this.supabase
        .from('nx_voucher_requests')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return { changes: data.length };
    }

    throw new Error(`Supabase UPDATE not implemented for: ${sql}`);
  }

  async executeSupabaseDelete(sql, params) {
    throw new Error(`Supabase DELETE not implemented for: ${sql}`);
  }

  parseInsertValues(sql, params) {
    // Parse INSERT statement for nx_voucher_requests
    if (sql.includes('nx_voucher_requests')) {
      // Extract column names from SQL
      const columnMatch = sql.match(/\(([^)]+)\)/);
      if (columnMatch) {
        const columns = columnMatch[1].split(',').map(col => col.trim());
        const values = {};

        // Map parameters to column names
        columns.forEach((col, index) => {
          if (params[index] !== undefined) {
            values[col] = params[index];
          }
        });

        return values;
      }
    }

    return {};
  }

  async insertUserResponse(email, language) {
    const sql = 'INSERT INTO user_responses (email, language) VALUES (?, ?)';
    const result = await this.query(sql, [email, language]);
    return result.lastID;
  }

  async insertQuestion(area, activity, criteria, language, sequenceOrder = 0) {
    const sql = 'INSERT INTO questions (area, activity, criteria, language, sequence_order) VALUES (?, ?, ?, ?, ?)';
    return await this.query(sql, [area, activity, criteria, language, sequenceOrder]);
  }

  async getQuestionsByLanguage(language) {
    const sql = 'SELECT * FROM questions WHERE language = ? ORDER BY sequence_order ASC, id ASC';
    return await this.query(sql, [language]);
  }

  async insertAnswer(questionId, responseId, answer, remarks) {
    const sql = 'INSERT INTO answers (question_id, response_id, answer, remarks) VALUES (?, ?, ?, ?)';
    return await this.query(sql, [questionId, responseId, answer, remarks]);
  }

  async getResponseWithAnswers(responseId) {
    const response = await this.query('SELECT * FROM user_responses WHERE id = ?', [responseId]);
    const answers = await this.query(`
      SELECT a.*, q.area, q.activity, q.criteria, q.sequence_order
      FROM answers a 
      JOIN questions q ON a.question_id = q.id 
      WHERE a.response_id = ?
      ORDER BY q.sequence_order ASC, q.id ASC
    `, [responseId]);
    
    return {
      response: response[0],
      answers: answers
    };
  }

  async getAllResponses() {
    return await this.query('SELECT * FROM user_responses ORDER BY timestamp DESC');
  }

  async getAnswersByQuestionId(questionId) {
    return await this.query('SELECT * FROM answers WHERE question_id = ?', [questionId]);
  }

  async clearQuestions() {
    await this.query('DELETE FROM questions');
  }

  async insertExcelFile(filename) {
    const sql = 'INSERT INTO excel_files (filename) VALUES (?)';
    return await this.query(sql, [filename]);
  }

  async insertAccessRequest(email, message) {
    try {
      const sql = 'INSERT INTO access_requests (email, message) VALUES (?, ?)';
      const result = await this.query(sql, [email, message]);
      return result;
    } catch (error) {
      console.error('Database: Error inserting access request:', error);
      throw error;
    }
  }

  async getAllAccessRequests() {
    try {
      // First check if table exists
      const tableCheck = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name='access_requests'");
      
      if (tableCheck.length === 0) {
        return [];
      }
      
      const result = await this.query('SELECT * FROM access_requests ORDER BY timestamp DESC');
      return result;
    } catch (error) {
      console.error('Database: Error in getAllAccessRequests:', error);
      return [];
    }
  }

  async updateAccessRequestStatus(id, status) {
    const sql = 'UPDATE access_requests SET status = ? WHERE id = ?';
    return await this.query(sql, [status, id]);
  }

  // User authentication methods
  async createUser(email, password, name) {
    const sql = 'INSERT INTO users (email, password, name) VALUES (?, ?, ?)';
    const result = await this.query(sql, [email, password, name]);
    return result.lastID;
  }

  async getUserByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const users = await this.query(sql, [email]);
    return users.length > 0 ? users[0] : null;
  }

  async getUserById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const users = await this.query(sql, [id]);
    return users.length > 0 ? users[0] : null;
  }

  close() {
    if (this.sqlite) {
      this.sqlite.close();
    }
  }
}

module.exports = new Database();