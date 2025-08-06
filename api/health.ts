// Vercel Function for health check
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline functions to avoid import issues in Vercel serverless functions
async function testSupabaseHealth() {
  const startTime = Date.now();
  
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        timestamp: new Date().toISOString(),
        component: 'supabase',
        success: false,
        responseTime: Date.now() - startTime,
        error: 'Supabase configuration missing'
      };
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/users?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Range': '0-0'
      },
      signal: AbortSignal.timeout(10000)
    });

    const responseTime = Date.now() - startTime;
    
    return {
      timestamp: new Date().toISOString(),
      component: 'supabase',
      success: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      component: 'supabase',
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function getEmergencyStatus() {
  const emergencyEmail = process.env.EMERGENCY_ADMIN_EMAIL;
  const emergencyToken = process.env.EMERGENCY_ADMIN_TOKEN;
  const emergencyTokenDate = process.env.EMERGENCY_ADMIN_TOKEN_DATE;
  
  const configured = !!(emergencyEmail && emergencyToken);
  
  if (!configured) {
    return { configured: false };
  }
  
  if (emergencyTokenDate) {
    const tokenDate = new Date(emergencyTokenDate);
    const expiryDate = new Date(tokenDate.getTime() + (24 * 60 * 60 * 1000));
    const now = new Date();
    const hoursUntilExpiry = Math.max(0, (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    return {
      configured: true,
      tokenExpiry: expiryDate.toISOString(),
      hoursUntilExpiry
    };
  }
  
  return { configured: true };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID, x-porta-version, x-arca-app-secret');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get emergency status and perform Supabase health check
    const emergencyStatus = getEmergencyStatus();
    const supabaseHealth = await testSupabaseHealth();
    
    let status = 'healthy';
    let dbStatus = 'healthy';
    let systemStatus = 'healthy';
    let emergencyModeRecommended = false;
    
    if (!supabaseHealth.success) {
      status = `unhealthy - ${supabaseHealth.error}`;
      dbStatus = 'unhealthy';
      systemStatus = 'emergency';
      emergencyModeRecommended = true;
    } else if (supabaseHealth.responseTime > 10000) {
      status = 'degraded - slow response times';
      systemStatus = 'degraded';
      emergencyModeRecommended = true;
    }

    return res.status(200).json({
      status,
      timestamp: new Date().toISOString(),
      version: '1.3.0',
      message: 'Porta Gateway (React + Vite)',
      environment: {
        hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
        hasJwtSecret: !!process.env.VITE_JWT_SECRET,
        hasArcaSecret: !!process.env.VITE_ARCA_APP_SECRET,
        hasEmergencyAccess: emergencyStatus.configured
      },
      services: {
        database: { 
          status: dbStatus,
          responseTime: supabaseHealth.responseTime,
          lastCheck: supabaseHealth.timestamp
        },
        authentication: { 
          status: systemStatus,
          provider: 'Supabase',
          metrics: {
            successRate: supabaseHealth.success ? 1.0 : 0.0,
            responseTime: supabaseHealth.responseTime
          }
        }
      },
      systemHealth: {
        overallStatus: systemStatus,
        emergencyModeRecommended,
        recentIssues: supabaseHealth.error ? [`Supabase: ${supabaseHealth.error}`] : [],
        recommendations: supabaseHealth.error ? ['Check Supabase service status'] : []
      },
      emergencyAccess: {
        configured: emergencyStatus.configured,
        tokenExpiry: emergencyStatus.tokenExpiry,
        hoursUntilExpiry: emergencyStatus.hoursUntilExpiry
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