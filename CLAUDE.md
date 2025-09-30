# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solid Edge Success Criteria Checklist - A bilingual (English/Bahasa Indonesia) web application for success criteria assessment with dynamic Excel parsing, PDF export, and admin dashboard functionality.

## Technology Stack

- **Frontend**: React 18 + Vite, TailwindCSS, React Router, Chart.js, Axios
- **Backend**: Node.js + Express, SQLite/Supabase hybrid database
- **Key Libraries**: jsPDF, xlsx, multer, bcryptjs, jsonwebtoken

## Development Commands

### Starting the Application
```bash
# Full development environment (both frontend and backend)
npm run dev

# Individual services
npm run server    # Backend only (port 5000)
npm run client    # Frontend only (port 3000)

# Alternative: Use batch files
start-backend.bat     # Windows - starts backend
start-frontend.bat    # Windows - starts frontend
```

### Building and Deployment
```bash
# Install all dependencies (root + frontend)
npm run install-all

# Build frontend for production
npm run build

# Production start (serves built frontend + backend)
npm start

# Railway-specific build command
npm run railway-build
```

### Code Quality
```bash
# Frontend linting
cd frontend && npm run lint

# Frontend preview (after build)
cd frontend && npm run preview
```

## Architecture Overview

### Backend Structure
- **server.js**: Main Express application with CORS, static file serving, and production frontend serving
- **db.js**: Database abstraction layer supporting both SQLite (local) and Supabase (production)
- **routes/**: API endpoints organized by feature
  - `questions.js`: Question management and retrieval
  - `responses.js`: User response handling and PDF generation
  - `admin.js`: Admin authentication, dashboard data, Excel upload
- **services/**: Business logic modules
  - `excelParser.js`: Excel file parsing and database seeding
  - `pdfGenerator.js`: PDF export functionality using jsPDF

### Frontend Structure
- **React Router**: SPA with routes for landing, checklist, summary, and admin
- **Components**: Feature-based organization
  - `LandingPage.jsx`: Entry point with language selection
  - `Checklist.jsx`: Main assessment interface with sequential questions
  - `Summary.jsx`: Results display and PDF export
  - `AdminDashboard.jsx`: Admin panel with charts and Excel upload
  - `ChartView.jsx`: Data visualization components

### Database Schema
- **user_responses**: Assessment sessions (email, language, timestamp)
- **questions**: Bilingual question storage (area, activity, criteria, language, sequence_order)
- **answers**: User responses linked to questions and sessions
- **excel_files**: Excel upload tracking
- **access_requests**: Admin access request management

### Key Features
1. **Bilingual Support**: Questions and UI in English/Bahasa Indonesia
2. **Dynamic Excel Import**: Admin can upload Excel files to update questions
3. **PDF Export**: Generates assessment reports with jsPDF
4. **Sequential Navigation**: Questions presented in defined order with auto-scroll
5. **Admin Dashboard**: Charts showing response analytics and question management
6. **Neumorphism UI**: Custom TailwindCSS styling with neumorphic design

## Application URLs
- **User Interface**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin (admin/admin123)
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## Important Implementation Notes

### Database Flexibility
The application uses a hybrid database approach through `db.js`:
- SQLite for local development (database.sqlite)
- Supabase support for production (requires SUPABASE_URL and SUPABASE_ANON_KEY)
- All database operations go through the Database class abstraction

### Excel Integration
- Questions are auto-imported from `backend/uploads/SE_Success_Criteria_Checklist_Eng_Bahasa.xlsx` on startup
- Admin can upload new Excel files to update question sets
- Excel parser expects specific column structure for bilingual questions

### Production Deployment
- Optimized for Railway deployment with automatic frontend/backend serving
- Environment-aware CORS configuration
- Single-domain deployment pattern (backend serves frontend static files)

### Auto-scroll Navigation
- Checklist component implements automatic scrolling to top when navigating between questions
- Uses useEffect and window.scrollTo for smooth user experience