// API endpoints for Porta Gateway
// Simple REST-style endpoints using fetch
import { AuthService } from '../services/AuthService';
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
export async function handleAuth(request) {
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
    });
}
/**
 * Handle login POST requests
 */
async function handleLogin(request) {
    try {
        console.log('🔐 handleLogin: Starting authentication...');
        const credentials = await request.json();
        console.log('🔐 handleLogin: Received credentials:', {
            email: credentials.email,
            app: credentials.app,
            hasPassword: !!credentials.password
        });
        // Validate required fields
        if (!credentials.email || !credentials.password) {
            console.log('🔐 handleLogin: Missing required fields');
            return new Response(JSON.stringify({ error: 'Email and password are required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...CORS_HEADERS
                }
            });
        }
        console.log('🔐 handleLogin: Calling AuthService.login...');
        // Authenticate using the same pattern as ARCA
        const result = await AuthService.login(credentials);
        console.log('🔐 handleLogin: AuthService result:', {
            success: result.success,
            error: result.error,
            hasUser: !!result.user
        });
        if (!result.success || !result.user) {
            console.log('🔐 handleLogin: Authentication failed:', result.error);
            return new Response(JSON.stringify({ error: result.error }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    ...CORS_HEADERS
                }
            });
        }
        console.log('🔐 handleLogin: Authentication successful, generating token');
        // Generate simple JWT-like token (base64 encoded for simplicity) 
        const payload = {
            sub: result.user.id,
            email: result.user.email,
            role: result.user.role,
            app: credentials.app || 'unknown',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
            iss: 'porta-gateway'
        };
        // Simple base64 encoded token for consistency
        const token = btoa(JSON.stringify(payload));
        const refresh_token = btoa(JSON.stringify({
            ...payload,
            type: 'refresh',
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        }));
        // Determine redirect URL
        let finalRedirectUrl = credentials.redirect_url;
        if (credentials.app === 'arca' && !finalRedirectUrl) {
            finalRedirectUrl = 'https://arca-alpha.vercel.app';
        }
        // Return successful authentication
        return new Response(JSON.stringify({
            success: true,
            token,
            refresh_token,
            user: {
                id: result.user.id,
                email: result.user.email,
                name: `${result.user.profile.firstName || ''} ${result.user.profile.lastName || ''}`.trim() || result.user.email,
                role: result.user.role
            },
            expires_in: 1800, // 30 minutes
            redirect_url: finalRedirectUrl
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            }
        });
    }
    catch (error) {
        console.error('🔐 handleLogin: Critical error:', error);
        console.error('🔐 handleLogin: Error stack:', error instanceof Error ? error.stack : 'No stack');
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            }
        });
    }
}
/**
 * Handle health check requests
 */
export async function handleHealth() {
    try {
        const health = await AuthService.getHealth();
        return new Response(JSON.stringify({
            status: health.status,
            timestamp: health.timestamp,
            version: '1.0.0',
            message: 'Porta Gateway is running'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            }
        });
    }
    catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            }
        });
    }
}
