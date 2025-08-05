import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found - authentication will fail');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Connection test utility
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  if (!supabase) {
    return {
      connected: false,
      error: 'Supabase client not initialized - check environment variables'
    };
  }

  try {
    // Test basic connection with a simple query
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact' })
      .limit(1);

    if (error) {
      return {
        connected: false,
        error: error.message
      };
    }

    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}