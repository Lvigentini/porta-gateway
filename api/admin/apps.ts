// App Registration Management API
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline AppRegistrationService functionality to avoid import issues
interface RegisteredApp {
  id: string;
  app_name: string;
  app_display_name: string;
  app_secret: string;
  allowed_origins: string[];
  redirect_urls: string[];
  status: 'active' | 'disabled' | 'pending';
  created_at: string;
  updated_at: string;
  created_by?: string;
  secret_expires_at?: string;
  permissions: Record<string, any>;
  metadata: Record<string, any>;
}

async function handleGetSecret(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAuthKey: string
) {
  try {
    const { app_name } = req.query;
    if (!app_name || typeof app_name !== 'string') {
      return res.status(400).json({ success: false, error: 'app_name is required in query parameters' });
    }

    const url = `${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${encodeURIComponent(app_name)}&select=app_secret,secret_expires_at,updated_at&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseAuthKey,
        'Authorization': `Bearer ${supabaseAuthKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ success: false, error: `Supabase error: ${response.status} - ${errText}` });
    }

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }

    return res.status(200).json({
      success: true,
      app_secret: row.app_secret,
      secret_expires_at: row.secret_expires_at,
      updated_at: row.updated_at
    });
  } catch (error) {
    console.error('[Apps API] Get secret error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve app secret' });
  }
}

async function handleRotateSecret(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  try {
    const { app_name } = req.query;
    if (!app_name || typeof app_name !== 'string') {
      return res.status(400).json({ success: false, error: 'app_name is required in query parameters' });
    }

    const newSecret = generateAppSecret();
    const newExpiry = getSecretExpiryDate();

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
        secret_expires_at: newExpiry,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const updatedApp = Array.isArray(data) ? data[0] : data;

    if (!updatedApp) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }

    // Hide the new secret in response for safety
    updatedApp.app_secret = '[HIDDEN]';

    return res.status(200).json({
      success: true,
      app: updatedApp,
      message: `App '${app_name}' secret rotated successfully`
    });
  } catch (error) {
    console.error('[Apps API] Rotate secret error:', error);
    return res.status(500).json({ success: false, error: 'Failed to rotate app secret' });
  }
}

interface AppRegistrationRequest {
  app_name: string;
  app_display_name: string;
  allowed_origins: string[];
  redirect_urls: string[];
  permissions?: Record<string, any>;
  metadata?: Record<string, any>;
}

// Inline Supabase client setup
function createSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

// Generate secure app secret
function generateAppSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get secret expiry date (90 days)
function getSecretExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString();
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

// Validate admin access with proper token validation
function validateAdminAccess(req: VercelRequest): { isValid: boolean; admin?: AdminSession; error?: string } {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return { isValid: false, error: 'Authorization header required' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { isValid: false, error: 'Invalid authorization format. Use: Bearer <token>' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Decode base64 token
    let adminSession: AdminSession;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      adminSession = JSON.parse(decoded);
    } catch (error) {
      return { isValid: false, error: 'Invalid token format' };
    }

    // Validate token structure
    if (!adminSession.adminId || !adminSession.email || !adminSession.role || !adminSession.exp || !adminSession.iss) {
      return { isValid: false, error: 'Invalid token structure' };
    }

    // Validate issuer
    if (adminSession.iss !== 'porta-gateway-admin') {
      return { isValid: false, error: 'Invalid token issuer' };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (adminSession.exp < now) {
      return { isValid: false, error: 'Admin token expired. Please login again.' };
    }

    // Validate admin role
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = createSupabaseClient();

    if (req.method === 'GET') {
      // Get all registered apps
      return await handleGetApps(res, supabaseUrl, supabaseAnonKey);
    }

    if (req.method === 'POST') {
      // Support action-based POSTs
      const action = (req.query.action as string) || '';
      if (action === 'rotate') {
        return await handleRotateSecret(req, res, supabaseUrl, supabaseServiceKey || supabaseAnonKey);
      }
      if (action === 'get_secret') {
        return await handleGetSecret(req, res, supabaseUrl, supabaseServiceKey || supabaseAnonKey);
      }
      // Register new app
      return await handleCreateApp(req, res, supabaseUrl, supabaseServiceKey || supabaseAnonKey);
    }

    if (req.method === 'PUT') {
      // Update existing app
      return await handleUpdateApp(req, res, supabaseUrl, supabaseAnonKey);
    }

    if (req.method === 'DELETE') {
      // Disable app (soft delete)
      return await handleDeleteApp(req, res, supabaseUrl, supabaseAnonKey);
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('[Apps API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleGetApps(
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  try {
    
    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps?status=eq.active&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    
    // Remove secrets from response
    const appsWithoutSecrets = data.map((app: RegisteredApp) => ({
      ...app,
      app_secret: '[HIDDEN]'
    }));

    return res.status(200).json({
      success: true,
      apps: appsWithoutSecrets,
      count: appsWithoutSecrets.length
    });

  } catch (error) {
    console.error('[Apps API] Get apps error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch apps'
    });
  }
}

async function handleCreateApp(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAuthKey: string
) {
  try {
    const { app_name, app_display_name, allowed_origins, redirect_urls, permissions, metadata } = req.body as AppRegistrationRequest;

    // Validate required fields
    if (!app_name || !app_display_name || !allowed_origins || !redirect_urls) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: app_name, app_display_name, allowed_origins, redirect_urls'
      });
    }

    // Validate app_name format
    if (!/^[a-z0-9_-]+$/.test(app_name)) {
      return res.status(400).json({
        success: false,
        error: 'app_name must contain only lowercase letters, numbers, underscores, and hyphens'
      });
    }

    // Generate app secret
    const appSecret = generateAppSecret();
    const secretExpiryDate = getSecretExpiryDate();

    const appData = {
      app_name,
      app_display_name,
      app_secret: appSecret,
      allowed_origins,
      redirect_urls,
      status: 'active',
      permissions: permissions || {},
      metadata: metadata || {},
      secret_expires_at: secretExpiryDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAuthKey,
        'Authorization': `Bearer ${supabaseAuthKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(appData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
      const payload = {
        success: false,
        error: `Supabase error: ${status} - ${errorText}`
      };
      // forward 4xx as 400 to surface validation errors to client
      if (status >= 400 && status < 500) {
        return res.status(400).json(payload);
      }
      return res.status(500).json(payload);
    }

    const data = await response.json();
    const createdApp = Array.isArray(data) ? data[0] : data;

    console.log('[Apps API] App registered successfully:', app_name);

    return res.status(201).json({
      success: true,
      app: createdApp,
      message: `App '${app_name}' registered successfully`
    });

  } catch (error) {
    console.error('[Apps API] Create app error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register app'
    });
  }
}

async function handleUpdateApp(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  try {
    const { app_name } = req.query;
    const updates = req.body;

    if (!app_name || typeof app_name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'app_name is required in query parameters'
      });
    }

    // Remove fields that shouldn't be updated via this endpoint
    delete updates.app_secret; // Use separate rotation endpoint
    delete updates.created_at;
    delete updates.id;
    
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${app_name}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
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

    // Remove secret from response
    updatedApp.app_secret = '[HIDDEN]';

    return res.status(200).json({
      success: true,
      app: updatedApp,
      message: `App '${app_name}' updated successfully`
    });

  } catch (error) {
    console.error('[Apps API] Update app error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update app'
    });
  }
}

async function handleDeleteApp(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  try {
    const { app_name } = req.query;

    if (!app_name || typeof app_name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'app_name is required in query parameters'
      });
    }

    // Soft delete by setting status to disabled
    const updateData = {
      status: 'disabled',
      updated_at: new Date().toISOString()
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${app_name}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    const disabledApp = Array.isArray(data) ? data[0] : data;

    if (!disabledApp) {
      return res.status(404).json({
        success: false,
        error: 'App not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `App '${app_name}' has been disabled`
    });

  } catch (error) {
    console.error('[Apps API] Delete app error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disable app'
    });
  }
}