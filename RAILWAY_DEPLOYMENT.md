# Railway Deployment Guide

## 🚀 Deploy to Railway

### Step 1: Prepare Your Repository
1. Make sure all files are committed to GitHub
2. Ensure `package.json` has the correct scripts:
   - `"start": "node backend/server.js"`
   - `"build": "cd frontend && npm run build"`

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository: `ZachyLee/Solid-Edge-Success-Criteria`

### Step 3: Configure Environment Variables
Add these environment variables in Railway:
- `NODE_ENV`: `production`
- `PORT`: Railway will set this automatically

### Step 4: Build Configuration
Railway will automatically:
- ✅ Install dependencies (`npm install`)
- ✅ Build frontend (`cd frontend && npm run build`)
- ✅ Start backend server (`npm start`)

### Step 5: Update CORS Origins
After deployment, update the CORS origins in `backend/server.js`:
```javascript
origin: process.env.NODE_ENV === 'production' 
  ? ['https://your-actual-railway-url.railway.app']
  : ['http://localhost:3000', 'http://127.0.0.1:3000'],
```

### Step 6: Access Your App
- Railway will provide a URL like: `https://your-app-name.railway.app`
- Your app will be live and accessible!

## ✅ What Railway Handles:
- **Automatic builds** from GitHub
- **Environment variables** management
- **SSL certificates** automatically
- **Custom domains** (optional)
- **Database hosting** (if needed)

## 🔧 Troubleshooting:
- Check Railway logs for build errors
- Verify environment variables are set
- Ensure all dependencies are in `package.json` 