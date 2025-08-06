// Vercel Function for authentication
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Server-side authentication using Supabase REST API

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-ID, x-porta-version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { email, password, app, redirect_url } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Validate ARCA app requests
      if (app === 'arca') {
        const arcaAppSecret = process.env.VITE_CLIENT_ARCA_APP_SECRET;
        const providedSecret = req.headers['x-arca-app-secret'] || req.body.app_secret;
        
        if (!arcaAppSecret || providedSecret !== arcaAppSecret) {
          return res.status(401).json({ error: 'Invalid app credentials' });
        }
      }

      // Use Supabase REST API for server-side authentication (like curl test)
      const supabaseUrl = process.env.VITE_CLIENT_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_CLIENT_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
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
        return res.status(401).json({ error: 'Invalid login credentials' });
      }

      const authResult = await authResponse.json();
      
      if (!authResult.access_token || !authResult.user) {
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
        return res.status(401).json({ error: 'Failed to fetch user profile' });
      }

      const profileData = await profileResponse.json();
      
      if (!Array.isArray(profileData) || profileData.length === 0) {
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
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}