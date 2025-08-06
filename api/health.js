// Simple health check endpoint - JavaScript version
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabaseUrl = process.env.VITE_CLIENT_SUPABASE_URL;
    const supabaseKey = process.env.VITE_CLIENT_SUPABASE_ANON_KEY;

    return res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Porta Gateway JavaScript version',
      environment: {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        hasJwtSecret: !!process.env.VITE_CLIENT_JWT_SECRET,
        hasArcaSecret: !!process.env.VITE_CLIENT_ARCA_APP_SECRET,
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message || 'Unknown error'
    });
  }
}