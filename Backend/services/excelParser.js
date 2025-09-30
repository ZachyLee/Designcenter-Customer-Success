const XLSX = require('xlsx');
const db = require('../db');
const path = require('path');
const fs = require('fs');

class ExcelParser {
  async parseAndSeedDatabase(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Excel file not found: ${filePath}`);
      }

      // Check if questions already exist in database
      const existingQuestions = await db.query('SELECT COUNT(*) as count FROM questions');
      const questionCount = existingQuestions[0].count;
      
      if (questionCount > 0) {
        console.log(`Questions already exist in database (${questionCount} questions). Skipping Excel import.`);
        console.log('To re-import Excel data, please clear the questions table first.');
        return;
      }

      console.log(`Parsing Excel file: ${filePath}`);
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      
      // Get sheet names
      const sheetNames = workbook.SheetNames;
      console.log('Available sheets:', sheetNames);

      // Only clear questions if we're doing a fresh import
      await db.clearQuestions();
      console.log('Cleared existing questions');

      let totalInserted = 0;

      // Process each sheet
      for (const sheetName of sheetNames) {
        const language = this.determineLanguage(sheetName);
        if (!language) {
          console.log(`Skipping sheet: ${sheetName} (no language mapping)`);
          continue;
        }

        console.log(`Processing sheet: ${sheetName} (Language: ${language})`);
        
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Process rows (assuming first row is header)
        const headers = data[0];
        console.log('Headers:', headers);
        
        // Find column indices
        const areaIndex = this.findColumnIndex(headers, ['area', 'kategori', 'category', 'area of evaluation']);
        const activityIndex = this.findColumnIndex(headers, ['activity', 'aktivitas', 'feature evaluated', 'aktivitas / fitur yang dievaluasi']);
        const criteriaIndex = this.findColumnIndex(headers, ['criteria', 'kriteria', 'success criteria', 'kriteria sukses']);

        if (areaIndex === -1 || activityIndex === -1 || criteriaIndex === -1) {
          console.error(`Required columns not found in sheet: ${sheetName}`);
          console.error(`Area index: ${areaIndex}, Activity index: ${activityIndex}, Criteria index: ${criteriaIndex}`);
          continue;
        }

        // Process data rows
        console.log(`Processing ${data.length - 1} data rows for ${language}...`);
        let currentArea = ''; // Track current area for grouping
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          
          if (!row || row.length === 0) continue;
          
          const rawArea = row[areaIndex];
          const activity = row[activityIndex];
          const criteria = row[criteriaIndex];

          // If area is empty, use the previous area (area grouping in Excel)
          if (rawArea && this.cleanText(rawArea)) {
            currentArea = this.cleanText(rawArea);
          }
          
          // Skip rows without activity or criteria
          if (!activity || !criteria) continue;
          
          // Clean up the data
          const cleanActivity = this.cleanText(activity);
          const cleanCriteria = this.cleanText(criteria);

          if (currentArea && cleanActivity && cleanCriteria) {
            try {
              // Add sequence number to maintain Excel order (i-1 because i starts at 1 for data rows)
              await db.insertQuestion(currentArea, cleanActivity, cleanCriteria, language, i - 1);
              totalInserted++;
            } catch (error) {
              console.error(`Error inserting question from row ${i}:`, error.message);
            }
          }
        }
      }

      console.log(`Successfully imported ${totalInserted} questions`);
      
      // Record the Excel file upload
      const filename = path.basename(filePath);
      await db.insertExcelFile(filename);
      
      return { success: true, totalInserted };
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw error;
    }
  }

  determineLanguage(sheetName) {
    const name = sheetName.toLowerCase();
    if (name.includes('eng') || name.includes('english')) {
      return 'EN';
    } else if (name.includes('bahasa') || name.includes('indonesia') || name.includes('id')) {
      return 'ID';
    }
    return null;
  }

  findColumnIndex(headers, possibleNames) {
    if (!headers) return -1;
    
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim();
      for (const name of possibleNames) {
        if (header.includes(name.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }

  cleanText(text) {
    if (!text) return '';
    return String(text).trim().replace(/\s+/g, ' ');
  }

  async getQuestionPreview(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const preview = {};

      for (const sheetName of workbook.SheetNames) {
        const language = this.determineLanguage(sheetName);
        if (!language) continue;

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        preview[sheetName] = {
          language,
          rowCount: data.length - 1, // Exclude header
          headers: data[0] || [],
          sampleRows: data.slice(1, 4) // First 3 data rows
        };
      }

      return preview;
    } catch (error) {
      throw new Error(`Error previewing Excel file: ${error.message}`);
    }
  }

  // Utility method to force re-import by clearing questions first
  async forceReimport(filePath) {
    console.log('🔄 Force re-importing Excel data...');
    await db.clearQuestions();
    console.log('✅ Cleared existing questions');
    return this.parseAndSeedDatabase(filePath);
  }
}

module.exports = new ExcelParser();