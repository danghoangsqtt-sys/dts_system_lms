import { createClient } from '@supabase/supabase-js';

// Trong Vite, phải dùng import.meta.env để lấy biến môi trường
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Thiếu biến môi trường Supabase! Hãy kiểm tra file .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);