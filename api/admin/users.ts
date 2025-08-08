// User Management API
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
    const { supabaseUrl, supabaseAnonKey } = createSupabaseClient();

    if (req.method === 'GET') {
      // Get all users
      return await handleGetUsers(res, supabaseUrl, supabaseAnonKey);
    }

    if (req.method === 'POST') {
      // Create new user
      return await handleCreateUser(req, res, supabaseUrl, supabaseAnonKey, adminValidation.admin!);
    }

    if (req.method === 'PUT') {
      // Update user role
      return await handleUpdateUser(req, res, supabaseUrl, supabaseAnonKey, adminValidation.admin!);
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('[Users API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleGetUsers(
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  try {
    // First, get all users
    const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      throw new Error(`Supabase users error: ${usersResponse.status}`);
    }

    const users = await usersResponse.json();

    // Get user app role assignments with app and role details
    const userAppRolesResponse = await fetch(`${supabaseUrl}/rest/v1/user_app_roles?select=user_id,app_name,role_name,is_active,granted_at,app_roles(role_label),registered_apps(app_display_name)&is_active=eq.true`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    let userAppRoles = [];
    if (userAppRolesResponse.ok) {
      userAppRoles = await userAppRolesResponse.json();
    }

    // Build app assignments map by user_id
    const appAssignmentsByUser: { [userId: string]: any[] } = {};
    userAppRoles.forEach((assignment: any) => {
      if (!appAssignmentsByUser[assignment.user_id]) {
        appAssignmentsByUser[assignment.user_id] = [];
      }
      appAssignmentsByUser[assignment.user_id].push({
        app_name: assignment.app_name,
        app_display_name: assignment.registered_apps?.app_display_name || assignment.app_name,
        role_name: assignment.role_name,
        role_label: assignment.app_roles?.role_label || assignment.role_name,
        granted_at: assignment.granted_at
      });
    });
    
    // Remove sensitive fields and add computed fields + app assignments
    const sanitizedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.email,
      role: user.role || 'user',
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at,
      app_assignments: appAssignmentsByUser[user.id] || []
    }));

    return res.status(200).json({
      success: true,
      users: sanitizedUsers,
      count: sanitizedUsers.length
    });

  } catch (error) {
    console.error('[Users API] Get users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
}

async function handleUpdateUser(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string,
  admin: AdminSession
) {
  try {
    const { user_id } = req.query;
    const { role } = req.body;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'user_id is required in query parameters'
      });
    }

    if (!role || typeof role !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'role is required in request body'
      });
    }

    // Validate role values
    const validRoles = ['admin', 'user', 'viewer', 'editor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Prevent admin from removing their own admin role
    if (user_id === admin.adminId && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove admin role from your own account'
      });
    }

    const updateData = {
      role,
      updated_at: new Date().toISOString()
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user_id}`, {
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
    const updatedUser = Array.isArray(data) ? data[0] : data;

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Log the role change
    console.log('[Users API] Role updated:', {
      timestamp: new Date().toISOString(),
      admin_id: admin.adminId,
      admin_email: admin.email,
      user_id,
      user_email: updatedUser.email,
      old_role: 'unknown', // We'd need to fetch this separately
      new_role: role,
      action: 'role_update'
    });

    // Sanitize response
    const sanitizedUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      full_name: updatedUser.first_name && updatedUser.last_name 
        ? `${updatedUser.first_name} ${updatedUser.last_name}` 
        : updatedUser.email,
      role: updatedUser.role,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      last_login_at: updatedUser.last_login_at
    };

    return res.status(200).json({
      success: true,
      user: sanitizedUser,
      message: `User role updated to '${role}'`
    });

  } catch (error) {
    console.error('[Users API] Update user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
}

async function handleCreateUser(
  req: VercelRequest,
  res: VercelResponse,
  supabaseUrl: string,
  supabaseAnonKey: string,
  admin: AdminSession
) {
  try {
    const { email, first_name, last_name, role, send_welcome_email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate role
    const validRoles = ['admin', 'user', 'viewer', 'editor'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Check if user already exists
    const existingUserResponse = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (existingUserResponse.ok) {
      const existingUsers = await existingUserResponse.json();
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
      }
    }

    const newUserData = {
      email,
      first_name: first_name || '',
      last_name: last_name || '',
      role: role || 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newUserData)
    });

    if (!createResponse.ok) {
      throw new Error(`Supabase error: ${createResponse.status}`);
    }

    const userData = await createResponse.json();
    const createdUser = Array.isArray(userData) ? userData[0] : userData;

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    // Send welcome email if requested
    if (send_welcome_email) {
      try {
        await sendWelcomeEmail({
          email,
          first_name: first_name || '',
          last_name: last_name || '',
          role: role || 'user'
        });
        console.log('[Users API] Welcome email sent successfully:', email);
      } catch (emailError) {
        console.error('[Users API] Failed to send welcome email:', {
          email,
          error: (emailError as Error)?.message || String(emailError),
          stack: (emailError as Error)?.stack
        });
        // Continue without failing the user creation - email is optional
      }
    }

    // Log the user creation
    console.log('[Users API] User created:', {
      timestamp: new Date().toISOString(),
      admin_id: admin.adminId,
      admin_email: admin.email,
      created_user_id: createdUser.id,
      created_user_email: email,
      role: role || 'user',
      welcome_email_sent: send_welcome_email,
      action: 'user_create'
    });

    // Sanitize response
    const sanitizedUser = {
      id: createdUser.id,
      email: createdUser.email,
      first_name: createdUser.first_name,
      last_name: createdUser.last_name,
      full_name: createdUser.first_name && createdUser.last_name 
        ? `${createdUser.first_name} ${createdUser.last_name}` 
        : createdUser.email,
      role: createdUser.role,
      created_at: createdUser.created_at,
      updated_at: createdUser.updated_at,
      last_login_at: null
    };

    return res.status(201).json({
      success: true,
      user: sanitizedUser,
      message: `User created successfully${send_welcome_email ? ' and welcome email sent' : ''}`
    });

  } catch (error) {
    console.error('[Users API] Create user error:', {
      error: (error as Error)?.message || String(error),
      stack: (error as Error)?.stack,
      body: req.body
    });
    return res.status(500).json({
      success: false,
      error: `Failed to create user: ${(error as Error)?.message || String(error)}`
    });
  }
}

// Welcome email function using SendGrid
async function sendWelcomeEmail(user: { email: string; first_name: string; last_name: string; role: string }) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: user.email }]
        }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'l.vigentini@gmail.com',
          name: 'Porta Gateway'
        },
        subject: 'Welcome to Porta Gateway!',
        content: [
          {
            type: 'text/plain',
            value: `Welcome to Porta Gateway!

Hello ${user.first_name || 'User'},

We're excited to have you join our platform. Your account has been created with the following details:

Email: ${user.email}
Role: ${user.role}

You can now log in and start using our services.

If you have any questions, please don't hesitate to contact our support team.

Best regards,
The Porta Gateway Team`
          },
          {
            type: 'text/html',
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1f2937;">Welcome to Porta Gateway!</h1>
                <p>Hello ${user.first_name || 'User'},</p>
                <p>We're excited to have you join our platform. Your account has been created with the following details:</p>
                <ul>
                  <li><strong>Email:</strong> ${user.email}</li>
                  <li><strong>Role:</strong> ${user.role}</li>
                </ul>
                <p>You can now log in and start using our services.</p>
                <p>If you have any questions, please don't hesitate to contact our support team.</p>
                <p>Best regards,<br>The Porta Gateway Team</p>
              </div>
            `
          }
        ],
        categories: ['welcome', 'porta-gateway']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SendGrid] Error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('[SendGrid] Welcome email error:', error);
    throw error;
  }
}