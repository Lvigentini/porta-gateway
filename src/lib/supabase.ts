import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate URL format before attempting to create client
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

let supabase: any = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found - authentication will fail');
} else if (!isValidUrl(supabaseUrl)) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    supabase = null;
  }
}

export { supabase };

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