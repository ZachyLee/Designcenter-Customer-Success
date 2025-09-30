# Solid Edge Success Criteria Checklist

A bilingual (English/Bahasa Indonesia) success criteria checklist application with dynamic Excel parsing, PDF export functionality, and an admin dashboard.

## Features

- Bilingual support (English/Bahasa Indonesia)
- Dynamic Excel question import
- PDF export functionality
- Admin dashboard with charts
- Neumorphism UI design

## Tech Stack

- Frontend: React + TailwindCSS
- Backend: Node.js + Express
- Database: SQLite
- Additional: Chart.js, jsPDF

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

3. Configure Environment Variables:
   - Add `NODE_ENV`: `production`
   - Railway will set `PORT` automatically

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

For local development, create `.env` files in the frontend directory:

- `.env.development`:
  ```
  VITE_API_URL=http://localhost:5000
  ```

For Railway deployment, environment variables are configured in the Railway dashboard:
- `NODE_ENV`: `production`
- `PORT`: Set automatically by Railway