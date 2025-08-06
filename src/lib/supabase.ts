import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found - using fallback mode');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Connection test utility
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  tables?: string[];
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

    // Try to get available tables if the RPC function exists
    let tables: string[] = ['users'];
    
    try {
      const { data: rpcTables, error: rpcError } = await supabase.rpc('get_tables');
      if (!rpcError && rpcTables) {
        tables = rpcTables.map((t: any) => t.table_name || t);
      }
    } catch (rpcErr) {
      // RPC function might not exist yet, use default tables
      console.log('RPC function not available, using default table list');
    }

    return {
      connected: true,
      tables
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}