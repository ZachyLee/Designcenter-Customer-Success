# Supabase Authentication Setup Guide

This application now uses Supabase for user authentication and profile management. Follow these steps to set up Supabase integration.

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new Supabase project

## Setup Steps

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: Solid Edge Success Criteria
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your location
4. Click "Create new project"

### 2. Get Project Credentials

Once your project is created:

1. Go to **Settings > API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL**
   - **Anon public key**

### 3. Configure Environment Variables

#### Frontend Configuration

Create a `.env` file in the `frontend/` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with the values from step 2.

#### Backend Configuration (Optional)

If you want the backend to also use Supabase for database operations, create a `.env` file in the root directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=5000
NODE_ENV=development
```

### 4. Authentication Configuration

The authentication is handled entirely by Supabase. No additional setup is required as the user authentication tables are automatically managed by Supabase.

#### Email Confirmation (Optional)

By default, Supabase requires email confirmation for new users. To configure this:

1. Go to **Authentication > Settings** in your Supabase dashboard
2. Under **User Management**:
   - Toggle "Enable email confirmations" as needed
   - Configure email templates if desired

### 5. Test the Application

1. Start the development servers:
   ```bash
   npm run dev
   ```

2. Visit [http://localhost:3000](http://localhost:3000)

3. Test the authentication flow:
   - Create a new account (sign up)
   - Sign in with existing credentials
   - Verify that protected routes work correctly

## Features

### User Authentication
- ✅ Sign up with email and password
- ✅ Sign in with email and password
- ✅ Automatic session management
- ✅ Protected routes
- ✅ User profile management
- ✅ Sign out functionality

### Security
- ✅ Password hashing (handled by Supabase)
- ✅ JWT token management (handled by Supabase)
- ✅ Session persistence
- ✅ Automatic token refresh

## Troubleshooting

### Environment Variables Not Loading
- Ensure `.env` files are in the correct directories
- Restart the development servers after adding environment variables
- Verify that environment variable names start with `VITE_` for frontend variables

### Authentication Errors
- Check that Supabase URL and keys are correct
- Verify that your Supabase project is active
- Check browser console for detailed error messages

### Network Issues
- Ensure your Supabase project has proper CORS settings
- Check that your internet connection allows access to Supabase

## Production Deployment

For production deployment:

1. Set environment variables in your hosting platform
2. Ensure CORS settings in Supabase include your production domain
3. Consider enabling Row Level Security (RLS) for additional security

## Support

If you encounter issues:
1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Review the [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
3. Check the browser console for error messages