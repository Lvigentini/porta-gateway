// Vercel Function for authentication
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Import our authentication logic
// Note: We'll implement this as a simple function since we can't import from src/ in Vercel functions

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

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

      // Use Supabase to authenticate (same pattern as ARCA)
      const supabaseUrl = process.env.VITE_CLIENT_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_CLIENT_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Authenticate user
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !userProfile) {
        return res.status(401).json({ error: 'User profile not found' });
      }

      // Generate simple JWT token
      const jwtSecret = process.env.VITE_CLIENT_JWT_SECRET || 'dev-super-secret-key';
      
      const payload = {
        sub: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        app: app || 'unknown'
      };

      const token = jwt.sign(payload, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: '30m',
        issuer: 'porta-gateway'
      });

      const refresh_token = jwt.sign(
        { sub: userProfile.id, type: 'refresh' },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '7d', issuer: 'porta-gateway' }
      );

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