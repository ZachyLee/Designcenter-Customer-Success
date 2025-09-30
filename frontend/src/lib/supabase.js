import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey ||
    supabaseUrl === 'https://your-project.supabase.co' ||
    supabaseAnonKey === 'your-anon-key-here') {
  throw new Error(`
🔴 Supabase Configuration Required!

Please configure your Supabase credentials in frontend/.env:

VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

📖 See SUPABASE_SETUP.md for detailed setup instructions.
  `);
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);