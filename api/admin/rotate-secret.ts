// App Secret Rotation API
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline functions to avoid import issues
function generateAppSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getSecretExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 90); // 90 days
  return date.toISOString();
}

function createSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return { supabaseUrl, supabaseAnonKey };
}

// Admin session token structure
interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

function validateAdminAccess(req: VercelRequest): { isValid: boolean; admin?: AdminSession; error?: string } {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return { isValid: false, error: 'Authorization header required' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { isValid: false, error: 'Invalid authorization format. Use: Bearer <token>' };
    }

    const token = authHeader.substring(7);
    
    let adminSession: AdminSession;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      adminSession = JSON.parse(decoded);
    } catch (error) {
      return { isValid: false, error: 'Invalid token format' };
    }

    if (!adminSession.adminId || !adminSession.email || !adminSession.role || !adminSession.exp || !adminSession.iss) {
      return { isValid: false, error: 'Invalid token structure' };
    }

    if (adminSession.iss !== 'porta-gateway-admin') {
      return { isValid: false, error: 'Invalid token issuer' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (adminSession.exp < now) {
      return { isValid: false, error: 'Admin token expired. Please login again.' };
    }

    if (adminSession.role !== 'admin') {
      return { isValid: false, error: 'Admin role required' };
    }

    return { isValid: true, admin: adminSession };

  } catch (error) {
    return { isValid: false, error: 'Token validation failed' };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

  // Validate admin access
  const adminValidation = validateAdminAccess(req);
  if (!adminValidation.isValid) {
    return res.status(401).json({ 
      success: false, 
      error: adminValidation.error || 'Unauthorized' 
    });
  }

  try {
    const { app_name } = req.body;

    if (!app_name || typeof app_name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'app_name is required'
      });
    }

    const { supabaseUrl, supabaseAnonKey } = createSupabaseClient();

    // Generate new secret and expiry
    const newSecret = generateAppSecret();
    const newExpiryDate = getSecretExpiryDate();

    // Update the app with new secret
    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${app_name}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        app_secret: newSecret,
        secret_expires_at: newExpiryDate,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    const updatedApp = Array.isArray(data) ? data[0] : data;

    if (!updatedApp) {
      return res.status(404).json({
        success: false,
        error: 'App not found'
      });
    }

    console.log('[Secret Rotation] Secret rotated successfully for:', app_name);

    // Log the rotation for audit purposes
    console.log('[Secret Rotation] Audit log:', {
      timestamp: new Date().toISOString(),
      app_name,
      action: 'secret_rotation',
      new_expiry: newExpiryDate,
      user_agent: req.headers['user-agent'],
      ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
    });

    return res.status(200).json({
      success: true,
      app_name,
      new_secret: newSecret,
      secret_expires_at: newExpiryDate,
      message: `Secret rotated successfully for app '${app_name}'`,
      warning: 'Update your application configuration with the new secret. The old secret is now invalid.'
    });

  } catch (error) {
    console.error('[Secret Rotation] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to rotate app secret'
    });
  }
}