// Vercel Function for health check
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID, x-porta-version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test Supabase connection
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    let status = 'healthy';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      status = 'unhealthy - supabase not configured';
    } else {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      const { error } = await supabase
        .from('users')
        .select('count', { count: 'exact' })
        .limit(1);

      if (error) {
        status = 'unhealthy - database error';
      }
    }

    return res.status(200).json({
      status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      message: 'Porta Gateway (React + Vite)',
      services: {
        database: { status: status.includes('healthy') ? 'healthy' : 'unhealthy' },
        authentication: { status: 'healthy', provider: 'Supabase' }
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
}