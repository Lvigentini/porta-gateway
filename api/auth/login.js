// Authentication endpoint - JavaScript version
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, app, redirect_url } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get environment variables
    const supabaseUrl = process.env.VITE_CLIENT_SUPABASE_URL;
    const supabaseKey = process.env.VITE_CLIENT_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Step 1: Authenticate with Supabase
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
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

    // Step 2: Get user profile
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authResult.user.id}`, {
      headers: {
        'apikey': supabaseKey,
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

    // Step 3: Generate token
    const payload = {
      sub: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
      app: app || 'unknown',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      iss: 'porta-gateway'
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    const refresh_token = Buffer.from(JSON.stringify({
      ...payload, 
      type: 'refresh', 
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
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
      expires_in: 1800,
      redirect_url: finalRedirectUrl
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    });
  }
}