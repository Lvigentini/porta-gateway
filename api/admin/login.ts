// Admin Authentication API
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Admin session token structure
interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

// Inline functions to avoid import issues
function createSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return { supabaseUrl, supabaseAnonKey };
}

function createAdminToken(user: { id: string; email: string; role: string }): string {
  const payload: AdminSession = {
    adminId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours
    iss: 'porta-gateway-admin'
  };
  
  // Create base64 token (consistent with existing format)
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function logAdminAccess(
  email: string, 
  action: string, 
  success: boolean, 
  userAgent?: string,
  ipAddress?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    email,
    action,
    success,
    userAgent,
    ipAddress,
    type: 'admin_access'
  };
  
  console.log('[Admin] Admin access log:', logEntry);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      await logAdminAccess(
        email || 'unknown', 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const { supabaseUrl, supabaseAnonKey } = createSupabaseClient();

    // Step 1: Authenticate with Supabase
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!authResponse.ok) {
      await logAdminAccess(
        email, 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const authResult = await authResponse.json();
    
    if (!authResult.access_token || !authResult.user) {
      await logAdminAccess(
        email, 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    // Step 2: Get user profile and check admin role
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authResult.user.id}`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${authResult.access_token}`
      }
    });

    if (!profileResponse.ok) {
      await logAdminAccess(
        email, 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(401).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }

    const profileData = await profileResponse.json();
    
    if (!Array.isArray(profileData) || profileData.length === 0) {
      await logAdminAccess(
        email, 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(401).json({
        success: false,
        error: 'User profile not found'
      });
    }

    const userProfile = profileData[0];

    // Step 3: Check if user has admin role
    if (userProfile.role !== 'admin') {
      await logAdminAccess(
        email, 
        'admin_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
      );
      
      return res.status(403).json({
        success: false,
        error: 'Admin access required. Contact system administrator.'
      });
    }

    // Step 4: Create admin session token
    const adminToken = createAdminToken({
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role
    });

    // Log successful admin login
    await logAdminAccess(
      email, 
      'admin_login', 
      true, 
      req.headers['user-agent'] as string,
      req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
    );

    return res.status(200).json({
      success: true,
      adminToken,
      admin: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.first_name && userProfile.last_name 
          ? `${userProfile.first_name} ${userProfile.last_name}` 
          : userProfile.email,
        role: userProfile.role
      },
      expires_in: 28800, // 8 hours
      message: 'Admin authentication successful'
    });

  } catch (error) {
    console.error('[Admin] Login error:', error);
    
    await logAdminAccess(
      req.body?.email || 'unknown', 
      'admin_login', 
      false, 
      req.headers['user-agent'] as string,
      req.headers['x-forwarded-for'] as string || req.connection?.remoteAddress
    );

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}