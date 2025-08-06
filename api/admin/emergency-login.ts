// Emergency Admin Login Endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline EmergencyAuthService functionality (to avoid import issues in Vercel)
interface EmergencyAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    isEmergencyAccess: true;
  };
  error?: string;
  expiresAt?: string;
}

interface EmergencyCredentials {
  email: string;
  token: string;
}

const EMERGENCY_TOKEN_EXPIRY_HOURS = 24;

function validateEmergencyCredentials(credentials: EmergencyCredentials): EmergencyAuthResult {
  try {
    console.log('[Emergency] Validating emergency credentials for:', credentials.email);
    
    // Get emergency admin configuration from environment
    const emergencyEmail = process.env.EMERGENCY_ADMIN_EMAIL;
    const emergencyToken = process.env.EMERGENCY_ADMIN_TOKEN;
    const emergencyTokenDate = process.env.EMERGENCY_ADMIN_TOKEN_DATE;
    
    if (!emergencyEmail || !emergencyToken) {
      console.warn('[Emergency] Emergency admin credentials not configured');
      return {
        success: false,
        error: 'Emergency admin not configured'
      };
    }
    
    // Validate email match
    if (credentials.email !== emergencyEmail) {
      console.warn('[Emergency] Emergency email mismatch:', { provided: credentials.email, expected: emergencyEmail });
      return {
        success: false,
        error: 'Invalid emergency credentials'
      };
    }
    
    // Validate token
    if (credentials.token !== emergencyToken) {
      console.warn('[Emergency] Emergency token mismatch');
      return {
        success: false,
        error: 'Invalid emergency credentials'
      };
    }
    
    // Check token expiry (if date is provided)
    if (emergencyTokenDate) {
      const tokenDate = new Date(emergencyTokenDate);
      const now = new Date();
      const hoursOld = (now.getTime() - tokenDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursOld > EMERGENCY_TOKEN_EXPIRY_HOURS) {
        console.warn('[Emergency] Emergency token expired:', { hoursOld, maxHours: EMERGENCY_TOKEN_EXPIRY_HOURS });
        return {
          success: false,
          error: 'Emergency token expired'
        };
      }
    }
    
    // Calculate expiry time
    const baseDate = emergencyTokenDate ? new Date(emergencyTokenDate) : new Date();
    const expiresAt = new Date(baseDate.getTime() + (EMERGENCY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000));
    
    console.log('[Emergency] Emergency authentication successful');
    
    return {
      success: true,
      user: {
        id: 'emergency-admin-001',
        email: emergencyEmail,
        role: 'admin',
        isEmergencyAccess: true
      },
      expiresAt: expiresAt.toISOString()
    };
    
  } catch (error) {
    console.error('[Emergency] Error validating emergency credentials:', error);
    return {
      success: false,
      error: 'Emergency authentication failed'
    };
  }
}

function createEmergencyToken(user: { id: string; email: string; role: string }): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    isEmergencyAccess: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 hour expiry for emergency tokens
    iss: 'porta-gateway-emergency'
  };
  
  // Create simple base64 token (consistent with existing format)
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function logEmergencyAccess(
  email: string, 
  action: string, 
  success: boolean, 
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    email,
    action,
    success,
    userAgent,
    ipAddress,
    type: 'emergency_access'
  };
  
  // Log to console (in production, this should go to a monitoring service)
  console.log('[Emergency] Emergency access log:', logEntry);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { email, token } = req.body;

      // Validate required fields
      if (!email || !token) {
        await logEmergencyAccess(
          email || 'unknown', 
          'emergency_login', 
          false, 
          req.headers['user-agent'] as string,
          req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
        );
        
        return res.status(400).json({ 
          success: false,
          error: 'Email and emergency token are required' 
        });
      }

      // Validate emergency credentials
      const result = validateEmergencyCredentials({ email, token });
      
      // Log the access attempt
      await logEmergencyAccess(
        email, 
        'emergency_login', 
        result.success, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
      );

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error || 'Emergency authentication failed'
        });
      }

      // Create emergency access token
      const emergencyToken = createEmergencyToken(result.user!);

      return res.status(200).json({
        success: true,
        token: emergencyToken,
        user: {
          id: result.user!.id,
          email: result.user!.email,
          role: result.user!.role,
          isEmergencyAccess: true
        },
        expires_in: 7200, // 2 hours
        expiresAt: result.expiresAt,
        message: 'Emergency authentication successful - limited access granted'
      });

    } catch (error) {
      console.error('Emergency login error:', error);
      
      // Log the error
      await logEmergencyAccess(
        req.body?.email || 'unknown', 
        'emergency_login', 
        false, 
        req.headers['user-agent'] as string,
        req.headers['x-forwarded-for'] as string || req.connection.remoteAddress
      );

      return res.status(500).json({ 
        success: false,
        error: 'Emergency authentication service error' 
      });
    }
  }

  return res.status(405).json({ 
    success: false,
    error: 'Method not allowed' 
  });
}