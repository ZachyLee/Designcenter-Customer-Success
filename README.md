# Designcenter Customer Success Portal

A comprehensive bilingual (English/Bahasa Indonesia) customer success platform featuring success criteria assessment, NX certification voucher management, and authentication system with partner portal capabilities.

## Features

### 🚀 **Core Functionality**
- **Bilingual Support** - Complete English/Bahasa Indonesia interface
- **Success Criteria Assessment** - Dynamic checklist with PDF export
- **User Authentication** - Secure signup/login with Supabase
- **Password Reset** - Email-based password recovery system
- **Neumorphism UI** - Modern glassmorphic design

### 🧩 **NX Certification Management**
- **Voucher Request System** - Partners can request NX Credly certification vouchers
- **Analytics Dashboard** - Country-wise voucher tracking and success rates
- **Partner Portal** - Dedicated features for partner users
- **Request Tracking** - Real-time status updates and approval workflow

### 📊 **Admin Dashboard**
- **Dynamic Excel Import** - Upload and manage question sets
- **Analytics & Charts** - Visual data representation with Chart.js
- **User Management** - Monitor assessments and responses
- **Voucher Management** - Approve/process certification requests

### 🔐 **Security & Authentication**
- **Supabase Integration** - Secure user authentication
- **Role-based Access** - Different interfaces for users vs partners
- **Session Management** - Persistent login state
- **Protected Routes** - Secure access control

## Tech Stack

- **Frontend**: React 18 + Vite, TailwindCSS, React Router
- **Backend**: Node.js + Express, SQLite/Supabase hybrid
- **Authentication**: Supabase Auth with email/password
- **Database**: SQLite (local) + Supabase (voucher management)
- **UI Libraries**: Chart.js, jsPDF, Axios
- **Styling**: Custom neumorphism design with TailwindCSS

## Deployment Platform

This application is optimized for **Railway** deployment, which provides:
- ✅ Automatic builds from GitHub
- ✅ Environment variables management
- ✅ SSL certificates automatically
- ✅ Custom domains (optional)
- ✅ Database hosting (if needed)
- ✅ Simple full-stack deployment

## Deployment Steps

1. Create a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. Set up Railway:
   - Visit [Railway](https://railway.app)
   - Sign up/Login with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. Configure Environment Variables in Railway Dashboard:
   ```
   NODE_ENV=production
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_secure_jwt_secret
   ```
   (Railway will set `PORT` automatically)

4. Deploy:
   - Railway will automatically build and deploy your application
   - Both frontend and backend will be deployed to the same domain
   - Your app will be available at: `https://your-app-name.railway.app`

## Development

1. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   ```

2. Start development servers:
   ```bash
   npm run dev
   ```

## Environment Variables

### Local Development
Create two `.env` files:

**Root `.env` (Backend):**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
PORT=5000
NODE_ENV=development
```

**Frontend `.env` (React):**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

### Production (Railway)
Environment variables are configured in Railway dashboard - frontend variables are embedded during build process.

## Application Structure

- **Landing Page** - Language selection and user welcome
- **Authentication** - Signup/login with password reset
- **Assessment Portal** - Success criteria checklist
- **Partner Portal** - NX voucher request and analytics
- **Admin Dashboard** - Data management and insights

## User Roles

- **Standard Users** - Access assessment checklist and results
- **Partners** - Additional access to NX certification voucher requests
- **Admins** - Full dashboard access and user management