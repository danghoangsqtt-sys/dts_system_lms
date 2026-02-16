
import { createClient } from '@supabase/supabase-js';

// These should ideally be in process.env. Using placeholders as per instruction pattern
const supabaseUrl = (process.env as any).SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
