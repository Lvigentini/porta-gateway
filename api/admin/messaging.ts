// SendGrid Messaging API
import type { VercelRequest, VercelResponse } from '@vercel/node';

// SendGrid API key from environment
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Admin session token structure
interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  category: 'welcome' | 'notification' | 'system' | 'custom';
  created_at: string;
  updated_at: string;
}

// Default email templates
const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome-user',
    name: 'Welcome New User',
    subject: 'Welcome to {{app_name}}!',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1f2937;">Welcome to {{app_name}}!</h1>
        <p>Hello {{first_name}},</p>
        <p>We're excited to have you join our platform. Your account has been created with the following details:</p>
        <ul>
          <li><strong>Email:</strong> {{email}}</li>
          <li><strong>Role:</strong> {{role}}</li>
        </ul>
        <p>You can now log in and start using our services.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The {{app_name}} Team</p>
      </div>
    `,
    text_content: `Welcome to {{app_name}}!

Hello {{first_name}},

We're excited to have you join our platform. Your account has been created with the following details:

Email: {{email}}
Role: {{role}}

You can now log in and start using our services.

If you have any questions, please don't hesitate to contact our support team.

Best regards,
The {{app_name}} Team`,
    variables: ['app_name', 'first_name', 'email', 'role'],
    category: 'welcome',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'role-assigned',
    name: 'Role Assignment Notification',
    subject: 'Your role has been updated for {{app_name}}',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1f2937;">Role Update Notification</h1>
        <p>Hello {{first_name}},</p>
        <p>Your role for <strong>{{app_name}}</strong> has been updated:</p>
        <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <p><strong>New Role:</strong> {{role_name}}</p>
          <p><strong>Application:</strong> {{app_display_name}}</p>
          <p><strong>Assigned by:</strong> {{admin_email}}</p>
        </div>
        <p>This change is effective immediately. Please log in to access your new permissions.</p>
        <p>Best regards,<br>The {{app_name}} Team</p>
      </div>
    `,
    text_content: `Role Update Notification

Hello {{first_name}},

Your role for {{app_name}} has been updated:

New Role: {{role_name}}
Application: {{app_display_name}}
Assigned by: {{admin_email}}

This change is effective immediately. Please log in to access your new permissions.

Best regards,
The {{app_name}} Team`,
    variables: ['first_name', 'app_name', 'role_name', 'app_display_name', 'admin_email'],
    category: 'notification',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'system-alert',
    name: 'System Alert',
    subject: 'System Alert: {{alert_type}}',
    html_content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">System Alert</h1>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <h2 style="color: #dc2626; margin-top: 0;">{{alert_type}}</h2>
          <p>{{message}}</p>
        </div>
        <p><strong>Timestamp:</strong> {{timestamp}}</p>
        <p><strong>Affected System:</strong> {{system}}</p>
        <p>Please take appropriate action if required.</p>
        <p>Best regards,<br>System Administrator</p>
      </div>
    `,
    text_content: `System Alert

{{alert_type}}

{{message}}

Timestamp: {{timestamp}}
Affected System: {{system}}

Please take appropriate action if required.

Best regards,
System Administrator`,
    variables: ['alert_type', 'message', 'timestamp', 'system'],
    category: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Inline functions to avoid import issues
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

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
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
    if (req.method === 'GET') {
      const { action } = req.query;
      
      if (action === 'templates') {
        // Get email templates
        return res.status(200).json({
          success: true,
          templates: DEFAULT_TEMPLATES
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action parameter'
      });
    }

    if (req.method === 'POST') {
      const { action } = req.query;
      
      if (action === 'send') {
        // Send email
        return await handleSendEmail(req, res, adminValidation.admin!);
      }
      
      if (action === 'test') {
        // Test SendGrid connection
        return await handleTestConnection(res);
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid action parameter'
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('[Messaging API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleSendEmail(
  req: VercelRequest,
  res: VercelResponse,
  admin: AdminSession
) {
  try {
    if (!SENDGRID_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'SendGrid API key not configured'
      });
    }

    const { 
      to, 
      template_id, 
      variables = {}, 
      from_name = 'Porta Gateway',
      from_email = 'noreply@porta-gateway.com' 
    } = req.body;

    if (!to || !template_id) {
      return res.status(400).json({
        success: false,
        error: 'to and template_id are required'
      });
    }

    // Find template
    const template = DEFAULT_TEMPLATES.find(t => t.id === template_id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Replace template variables
    const subject = replaceTemplateVariables(template.subject, variables);
    const htmlContent = replaceTemplateVariables(template.html_content, variables);
    const textContent = replaceTemplateVariables(template.text_content, variables);

    // Send email via SendGrid
    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: {
          email: from_email,
          name: from_name
        },
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: textContent
          },
          {
            type: 'text/html',
            value: htmlContent
          }
        ],
        categories: [template.category, 'porta-gateway']
      })
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('[Messaging API] SendGrid error:', errorText);
      throw new Error(`SendGrid API error: ${sendGridResponse.status}`);
    }

    // Log the email send
    console.log('[Messaging API] Email sent:', {
      timestamp: new Date().toISOString(),
      admin_id: admin.adminId,
      admin_email: admin.email,
      to_email: to,
      template_id,
      subject,
      action: 'email_send'
    });

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      details: {
        to,
        subject,
        template: template.name
      }
    });

  } catch (error) {
    console.error('[Messaging API] Send email error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
}

async function handleTestConnection(res: VercelResponse) {
  try {
    if (!SENDGRID_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'SendGrid API key not configured'
      });
    }

    // Test SendGrid API connection
    const testResponse = await fetch('https://api.sendgrid.com/v3/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      throw new Error(`SendGrid test failed: ${testResponse.status}`);
    }

    const profile = await testResponse.json();

    return res.status(200).json({
      success: true,
      message: 'SendGrid connection test successful',
      profile: {
        username: profile.username,
        email: profile.email
      }
    });

  } catch (error) {
    console.error('[Messaging API] Test connection error:', error);
    return res.status(500).json({
      success: false,
      error: 'SendGrid connection test failed'
    });
  }
}

// Export helper function for other APIs to use
export async function sendTemplateEmail(
  to: string, 
  templateId: string, 
  variables: Record<string, string> = {}
): Promise<boolean> {
  try {
    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return false;
    }

    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const subject = replaceTemplateVariables(template.subject, variables);
    const htmlContent = replaceTemplateVariables(template.html_content, variables);
    const textContent = replaceTemplateVariables(template.text_content, variables);

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: {
          email: 'noreply@porta-gateway.com',
          name: 'Porta Gateway'
        },
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: textContent
          },
          {
            type: 'text/html',
            value: htmlContent
          }
        ],
        categories: [template.category, 'porta-gateway']
      })
    });

    return sendGridResponse.ok;
  } catch (error) {
    console.error('[SendGrid Helper] Error:', error);
    return false;
  }
}