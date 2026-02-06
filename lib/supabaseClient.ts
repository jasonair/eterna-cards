import { createClient } from '@supabase/supabase-js';

// Hardcoded values for debugging - replace with your actual values
const supabaseUrl = 'https://iilkacrledtdiqiyvohv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbGthY3JsZWR0ZGlxaXl2b2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzkzNjUsImV4cCI6MjA3OTY1NTM2NX0.MIM4r1Z_jxqH8fkNvYlFmoy_NBEMHVdza0PVEG82nHI';

// Debug logging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});
