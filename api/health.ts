// Vercel Function for health check
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    // Test Supabase connection using REST API
    const supabaseUrl = process.env.VITE_CLIENT_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_CLIENT_SUPABASE_ANON_KEY;

    let status = 'healthy';
    let dbStatus = 'healthy';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      status = 'unhealthy - supabase not configured';
      dbStatus = 'unhealthy';
    } else {
      // Test database connection with a simple query
      try {
        const dbResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=count&limit=1`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Range': '0-0'
          }
        });

        if (!dbResponse.ok) {
          status = 'unhealthy - database error';
          dbStatus = 'unhealthy';
        }
      } catch (dbError) {
        status = 'unhealthy - database connection failed';
        dbStatus = 'unhealthy';
      }
    }

    return res.status(200).json({
      status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      message: 'Porta Gateway (React + Vite)',
      environment: {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseAnonKey,
        hasJwtSecret: !!process.env.VITE_CLIENT_JWT_SECRET,
        hasArcaSecret: !!process.env.VITE_CLIENT_ARCA_APP_SECRET
      },
      services: {
        database: { status: dbStatus },
        authentication: { status: 'healthy', provider: 'Supabase' }
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}