
import { createClient } from '@supabase/supabase-js';

// Explicit configuration provided by user
const SUPABASE_URL = 'https://oslvdgslfsjdujyemyfo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbHZkZ3NsZnNqZHVqeWVteWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTkzMjQsImV4cCI6MjA3OTI3NTMyNH0.YHJM8pIDCT7q-1Bsg0TVczeM2VE0paXJ6VWTDtXQ6to';

// Flag to indicate configuration is present
export const isSupabaseConfigured = true;

console.log('Supabase Client Initialized', { url: SUPABASE_URL });

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
