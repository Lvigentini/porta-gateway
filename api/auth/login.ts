// Vercel Function for authentication
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple inline function to record auth attempts (to avoid import issues)
function recordAuthAttempt(success: boolean, responseTime: number, error?: string): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    success,
    responseTime,
    error,
    type: 'auth_attempt'
  };
  console.log('[Auth] Authentication attempt:', logEntry);
}

// Inline app validation function with centralized + backward compatibility support
async function validateAppCredentials(
  appName: string, 
  providedSecret: string
): Promise<{ isValid: boolean; app?: any; error?: string; source?: string }> {
  if (!appName || !providedSecret) {
    return { isValid: false, error: 'App name and secret are required' };
  }

  try {
    console.log('[Auth] Validating app credentials for:', appName);
    
    // Try database first (new centralized approach)
    const dbResult = await validateFromDatabase(appName, providedSecret);
    if (dbResult.isValid) {
      return dbResult;
    }

    // Fallback to environment variables (backward compatibility)
    const envResult = await validateFromEnvironment(appName, providedSecret);
    if (envResult.isValid) {
      return envResult;
    }

    return { isValid: false, error: 'Invalid app credentials' };

  } catch (error) {
    console.error('[Auth] App validation error:', error);
    return { isValid: false, error: 'App validation failed' };
  }
}

async function validateFromDatabase(appName: string, providedSecret: string) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return { isValid: false, error: 'Supabase not configured' };
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${appName}&status=eq.active`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      return { isValid: false, error: 'Database query failed' };
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return { isValid: false, error: 'App not found in database' };
    }

    const app = data[0];
    
    // Check secret match
    if (app.app_secret !== providedSecret) {
      return { isValid: false, error: 'Invalid app secret' };
    }

    // Check secret expiry
    if (app.secret_expires_at) {
      const expiryDate = new Date(app.secret_expires_at);
      if (expiryDate < new Date()) {
        return { isValid: false, error: 'App secret expired' };
      }
    }

    console.log('[Auth] App validation successful (database):', appName);
    return { isValid: true, app, source: 'database' };

  } catch (error) {
    return { isValid: false, error: 'Database validation failed' };
  }
}

async function validateFromEnvironment(appName: string, providedSecret: string) {
  try {
    // Support legacy ARCA app secret from environment
    if (appName === 'arca') {
      const arcaSecret = process.env.VITE_ARCA_APP_SECRET;
      if (arcaSecret && arcaSecret === providedSecret) {
        console.log('[Auth] App validation successful (environment fallback):', appName);
        
        const mockApp = {
          id: 'env-arca',
          app_name: 'arca',
          app_display_name: 'ARCA Analytics (Environment)',
          allowed_origins: ['https://arca-alpha.vercel.app'],
          redirect_urls: ['https://arca-alpha.vercel.app'],
          status: 'active',
          metadata: { source: 'environment' }
        };

        return { isValid: true, app: mockApp, source: 'environment' };
      }
    }

    return { isValid: false, error: 'App not found in environment' };

  } catch (error) {
    return { isValid: false, error: 'Environment validation failed' };
  }
}

// Server-side authentication using Supabase REST API

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID, x-porta-version, x-arca-app-secret, x-app-secret');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const startTime = Date.now();
    
    try {
      const { email, password, app, redirect_url } = req.body;

      // Validate required fields
      if (!email || !password) {
        recordAuthAttempt(false, Date.now() - startTime, 'Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Validate app credentials (centralized with backward compatibility)
      if (app) {
        const providedSecret = req.headers['x-arca-app-secret'] || req.headers['x-app-secret'] || req.body.app_secret;
        
        if (!providedSecret) {
          recordAuthAttempt(false, Date.now() - startTime, 'Missing app secret');
          return res.status(400).json({ error: 'App secret is required' });
        }

        const appValidation = await validateAppCredentials(app, providedSecret);
        if (!appValidation.isValid) {
          recordAuthAttempt(false, Date.now() - startTime, `App validation failed: ${appValidation.error}`);
          return res.status(401).json({ error: appValidation.error || 'Invalid app credentials' });
        }

        console.log(`[Auth] App validation successful for ${app} (source: ${appValidation.source})`);
      }

      // Use Supabase REST API for server-side authentication (like curl test)
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        recordAuthAttempt(false, Date.now() - startTime, 'Supabase not configured');
        return res.status(500).json({ error: 'Supabase not configured' });
      }

      // Step 1: Authenticate with Supabase REST API
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!authResponse.ok) {
        recordAuthAttempt(false, Date.now() - startTime, 'Invalid login credentials');
        return res.status(401).json({ error: 'Invalid login credentials' });
      }

      type SupabaseAuthResponse = {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        user: {
          id: string;
          aud: string;
          role: string;
          email: string;
          email_confirmed_at: string;
          phone: string;
          confirmed_at: string;
          last_sign_in_at: string;
          app_metadata: {
            provider: string;
            providers: string[];
          };
          user_metadata: {};
          identities: any[];
          created_at: string;
          updated_at: string;
        };
      };

      const authResult = (await authResponse.json()) as SupabaseAuthResponse;
      
      if (!authResult.access_token || !authResult.user) {
        recordAuthAttempt(false, Date.now() - startTime, 'Authentication failed');
        return res.status(401).json({ error: 'Authentication failed' });
      }

      // Step 2: Fetch user profile using the access token
      const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authResult.user.id}`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${authResult.access_token}`
        }
      });

      if (!profileResponse.ok) {
        recordAuthAttempt(false, Date.now() - startTime, 'Failed to fetch user profile');
        return res.status(401).json({ error: 'Failed to fetch user profile' });
      }

      const profileData = await profileResponse.json();
      
      if (!Array.isArray(profileData) || profileData.length === 0) {
        recordAuthAttempt(false, Date.now() - startTime, 'User profile not found');
        return res.status(401).json({ error: 'User profile not found' });
      }

      const userProfile = profileData[0];

      // Generate simple JWT-like token (base64 encoded for simplicity)
      
      const payload = {
        sub: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        app: app || 'unknown',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
        iss: 'porta-gateway'
      };

      // Simple base64 encoded token (same as local version for consistency)
      const token = Buffer.from(JSON.stringify(payload)).toString('base64');
      const refresh_token = Buffer.from(JSON.stringify({
        ...payload, 
        type: 'refresh', 
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      })).toString('base64');

      // Determine redirect URL
      let finalRedirectUrl = redirect_url;
      if (app === 'arca' && !finalRedirectUrl) {
        finalRedirectUrl = 'https://arca-alpha.vercel.app';
      }

      // Record successful authentication
      recordAuthAttempt(true, Date.now() - startTime);

      return res.status(200).json({
        success: true,
        token,
        refresh_token,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.first_name && userProfile.last_name 
            ? `${userProfile.first_name} ${userProfile.last_name}` 
            : userProfile.email,
          role: userProfile.role || 'user'
        },
        expires_in: 1800, // 30 minutes
        redirect_url: finalRedirectUrl
      });

    } catch (error) {
      console.error('Login error:', error);
      recordAuthAttempt(false, Date.now() - startTime, 'Internal server error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}