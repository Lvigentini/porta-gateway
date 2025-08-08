// Role Assignment & Management API
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
    const { supabaseUrl, supabaseAnonKey } = createSupabaseClient();

    if (req.method === 'POST') {
      // Assign role to user for an app
      return await handleAssignRole(req, res, supabaseUrl, supabaseAnonKey, adminValidation.admin!);
    }

    if (req.method === 'DELETE') {
      // Revoke role from user for an app
      return await handleRevokeRole(req, res, supabaseUrl, supabaseAnonKey, adminValidation.admin!);
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('[Roles API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleAssignRole(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string,
  admin: AdminSession
) {
  try {
    const { user_id, app_name, role_name } = req.body;

    if (!user_id || !app_name || !role_name) {
      return res.status(400).json({
        success: false,
        error: 'user_id, app_name, and role_name are required'
      });
    }

    // Validate that the app exists
    const appResponse = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${app_name}&select=app_name,app_display_name`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!appResponse.ok) {
      throw new Error(`Failed to validate app: ${appResponse.status}`);
    }

    const apps = await appResponse.json();
    if (apps.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Validate that the role exists for this app
    const roleResponse = await fetch(`${supabaseUrl}/rest/v1/app_roles?app_name=eq.${app_name}&role_name=eq.${role_name}&select=role_name,role_label`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!roleResponse.ok) {
      throw new Error(`Failed to validate role: ${roleResponse.status}`);
    }

    const roles = await roleResponse.json();
    if (roles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found for this application'
      });
    }

    // Validate that the user exists
    const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}&select=id,email`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to validate user: ${userResponse.status}`);
    }

    const users = await userResponse.json();
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if assignment already exists
    const existingResponse = await fetch(`${supabaseUrl}/rest/v1/user_app_roles?user_id=eq.${user_id}&app_name=eq.${app_name}&is_active=eq.true`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      if (existing.length > 0) {
        // Update existing assignment
        const updateData = {
          role_name,
          granted_at: new Date().toISOString(),
          granted_by: admin.adminId,
          updated_at: new Date().toISOString()
        };

        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/user_app_roles?user_id=eq.${user_id}&app_name=eq.${app_name}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        });

        if (!updateResponse.ok) {
          throw new Error(`Failed to update role assignment: ${updateResponse.status}`);
        }

        console.log('[Roles API] Role updated:', {
          timestamp: new Date().toISOString(),
          admin_id: admin.adminId,
          admin_email: admin.email,
          user_id,
          user_email: users[0].email,
          app_name,
          role_name,
          action: 'role_update'
        });

        return res.status(200).json({
          success: true,
          message: `User role updated to '${roles[0].role_label}' for ${apps[0].app_display_name}`,
          assignment: {
            user_id,
            app_name,
            role_name,
            role_label: roles[0].role_label,
            granted_at: updateData.granted_at
          }
        });
      }
    }

    // Create new assignment
    const assignmentData = {
      user_id,
      app_name,
      role_name,
      is_active: true,
      granted_at: new Date().toISOString(),
      granted_by: admin.adminId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createResponse = await fetch(`${supabaseUrl}/rest/v1/user_app_roles`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(assignmentData)
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create role assignment: ${createResponse.status}`);
    }

    console.log('[Roles API] Role assigned:', {
      timestamp: new Date().toISOString(),
      admin_id: admin.adminId,
      admin_email: admin.email,
      user_id,
      user_email: users[0].email,
      app_name,
      role_name,
      action: 'role_assign'
    });

    return res.status(201).json({
      success: true,
      message: `User assigned '${roles[0].role_label}' role for ${apps[0].app_display_name}`,
      assignment: {
        user_id,
        app_name,
        role_name,
        role_label: roles[0].role_label,
        granted_at: assignmentData.granted_at
      }
    });

  } catch (error) {
    console.error('[Roles API] Assign role error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to assign role'
    });
  }
}

async function handleRevokeRole(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string,
  admin: AdminSession
) {
  try {
    const { user_id, app_name } = req.body;

    if (!user_id || !app_name) {
      return res.status(400).json({
        success: false,
        error: 'user_id and app_name are required'
      });
    }

    // Get user details for logging
    const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}&select=id,email`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to validate user: ${userResponse.status}`);
    }

    const users = await userResponse.json();
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get app details for logging
    const appResponse = await fetch(`${supabaseUrl}/rest/v1/registered_apps?app_name=eq.${app_name}&select=app_name,app_display_name`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!appResponse.ok) {
      throw new Error(`Failed to validate app: ${appResponse.status}`);
    }

    const apps = await appResponse.json();
    if (apps.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Deactivate the role assignment (soft delete)
    const deactivateData = {
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: admin.adminId,
      updated_at: new Date().toISOString()
    };

    const deactivateResponse = await fetch(`${supabaseUrl}/rest/v1/user_app_roles?user_id=eq.${user_id}&app_name=eq.${app_name}&is_active=eq.true`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(deactivateData)
    });

    if (!deactivateResponse.ok) {
      throw new Error(`Failed to revoke role assignment: ${deactivateResponse.status}`);
    }

    const revokedAssignments = await deactivateResponse.json();
    
    if (revokedAssignments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active role assignment found for this user and application'
      });
    }

    console.log('[Roles API] Role revoked:', {
      timestamp: new Date().toISOString(),
      admin_id: admin.adminId,
      admin_email: admin.email,
      user_id,
      user_email: users[0].email,
      app_name,
      role_name: revokedAssignments[0].role_name,
      action: 'role_revoke'
    });

    return res.status(200).json({
      success: true,
      message: `User role revoked for ${apps[0].app_display_name}`,
      revoked_assignment: {
        user_id,
        app_name,
        role_name: revokedAssignments[0].role_name,
        revoked_at: deactivateData.revoked_at
      }
    });

  } catch (error) {
    console.error('[Roles API] Revoke role error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke role'
    });
  }
}