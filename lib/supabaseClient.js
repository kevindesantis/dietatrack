import { createClient } from '@supabase/supabase-js';

// Configurazione pubblica Supabase già pronta per GitHub/Vercel.
// La anon public key può stare nel frontend. NON inserire mai qui la service_role key.
const supabaseUrl = 'https://ryhjtlehmhihmeabekjx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aGp0bGVobWhpaG1lYWJla2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTIyOTksImV4cCI6MjA5NDc2ODI5OX0.oRPGXrU3R4YvbiBvAQiBoTyI0oEeCKzDndQgDNtJOLk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
