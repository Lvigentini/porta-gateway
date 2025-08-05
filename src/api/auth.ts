// API endpoints for Porta Gateway
// Simple REST-style endpoints using fetch

import { AuthService } from '../services/AuthService';
import { LoginCredentials } from '../types/auth';

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

/**
 * Handle authentication requests
 */
export async function handleAuth(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: CORS_HEADERS 
    });
  }

  if (request.method === 'POST') {
    return handleLogin(request);
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }), 
    { 
      status: 405, 
      headers: { 
        'Content-Type': 'application/json',
        ...CORS_HEADERS 
      } 
    }
  );
}

/**
 * Handle login POST requests
 */
async function handleLogin(request: Request): Promise<Response> {
  try {
    const credentials: LoginCredentials = await request.json();

    // Validate required fields
    if (!credentials.email || !credentials.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        }
      );
    }

    // Authenticate using the same pattern as ARCA
    const result = await AuthService.authenticate(credentials);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        }
      );
    }

    // Return successful authentication
    return new Response(
      JSON.stringify({
        success: true,
        token: result.token,
        refresh_token: result.refresh_token,
        user: result.user,
        expires_in: 1800, // 30 minutes
        redirect_url: result.redirect_url
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      }
    );

  } catch (error) {
    console.error('Login handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      }
    );
  }
}

/**
 * Handle health check requests
 */
export async function handleHealth(): Promise<Response> {
  try {
    const health = await AuthService.getHealth();
    
    return new Response(
      JSON.stringify({
        status: health.status,
        timestamp: health.timestamp,
        version: '1.0.0',
        message: 'Porta Gateway is running'
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: 'Health check failed' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      }
    );
  }
}