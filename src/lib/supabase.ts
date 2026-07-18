import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('gpm_supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('gpm_supabase_anon_key') : null;

export const supabaseUrl = envUrl && envUrl !== 'YOUR_SUPABASE_URL' ? envUrl : (localUrl || '');
export const supabaseAnonKey = envKey && envKey !== 'YOUR_SUPABASE_ANON_KEY' ? envKey : (localKey || '');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gpm_supabase_url', url.trim());
    localStorage.setItem('gpm_supabase_anon_key', key.trim());
    window.location.reload();
  }
}

export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('gpm_supabase_url');
    localStorage.removeItem('gpm_supabase_anon_key');
    window.location.reload();
  }
}

