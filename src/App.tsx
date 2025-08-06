import { useState, useEffect } from 'react';
import { AuthService } from './services/AuthService';
import { handleAuth } from './api/auth';

function App() {
  const [status, setStatus] = useState<string>('Loading...');
  const [lastTest, setLastTest] = useState<string>('');

  useEffect(() => {
    checkHealth();
    
    // Set up API route handlers for development
    setupAPIRoutes();
  }, []);

  const checkHealth = async () => {
    try {
      const health = await AuthService.getHealth();
      setStatus(health.status);
      setLastTest(health.timestamp);
    } catch (error) {
      setStatus('Error checking health');
    }
  };

  const setupAPIRoutes = () => {
    // In production, Vercel will handle routing
    // This is for development testing
    if (import.meta.env.DEV) {
      console.log('Porta Gateway API endpoints available:');
      console.log('- POST /api/auth/login');
      console.log('- GET /api/health');
    }
  };

  const testLogin = async () => {
    console.log('BUTTON CLICKED - testLogin function called');
    try {
      console.log('🔥 Starting test login...');
      
      const credentials = {
        email: 'admin@arca.dev',
        password: 'admin123',
        app: 'arca',
        redirect_url: 'https://arca-alpha.vercel.app'
      };
      
      console.log('📤 Sending credentials:', credentials);
      
      // Check if we're running locally or in production
      const isLocal = import.meta.env.DEV;
      console.log('🔥 Running locally:', isLocal);
      
      let response: Response;
      
      if (isLocal) {
        // LOCAL: Use client-side auth handler
        console.log('🚀 Making local auth request...');
        const testRequest = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        response = await handleAuth(testRequest);
      } else {
        // PRODUCTION: Call actual Vercel function
        console.log('🚀 Making production API request to /api/auth/login...');
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
      }
      
      console.log('📨 Response status:', response.status);
      console.log('📨 Response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('📦 Full response body:', result);
      
      if (response.status >= 400) {
        console.error('🚨 API Error Response:', result);
      }
      
      if (result.success && result.token) {
        console.log('✅ Login successful!');
        alert('Test login successful! Token: ' + result.token.substring(0, 20) + '...');
      } else {
        console.log('❌ Login failed:', result.error || 'Unknown error');
        alert('Test login failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('💥 Test login error:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack');
      alert('Test error: ' + error);
    }
  };

  const testSupabaseDirect = async () => {
    try {
      console.log('🧪 Testing Supabase direct connection...');
      
      const supabaseUrl = import.meta.env.VITE_CLIENT_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_CLIENT_SUPABASE_ANON_KEY;
      
      console.log('🧪 Environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        url: supabaseUrl
      });

      // Test 1: Direct Supabase auth
      console.log('🧪 Step 1: Testing Supabase auth API...');
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'admin@arca.dev',
          password: 'admin123'
        })
      });

      const authResult = await authResponse.json();
      console.log('🧪 Auth API result:', {
        status: authResponse.status,
        hasAccessToken: !!authResult.access_token,
        hasUser: !!authResult.user,
        userId: authResult.user?.id
      });

      if (!authResult.access_token) {
        alert('❌ Supabase auth failed: ' + JSON.stringify(authResult));
        return;
      }

      // Test 2: User profile lookup
      console.log('🧪 Step 2: Testing user profile lookup...');
      const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authResult.user.id}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authResult.access_token}`
        }
      });

      const profileResult = await profileResponse.json();
      console.log('🧪 Profile API result:', {
        status: profileResponse.status,
        userCount: Array.isArray(profileResult) ? profileResult.length : 0,
        user: profileResult[0]
      });

      if (profileResult.length > 0) {
        alert('✅ Supabase direct test successful!\nUser: ' + profileResult[0].email + '\nRole: ' + profileResult[0].role);
      } else {
        alert('❌ User profile not found');
      }

    } catch (error) {
      console.error('🧪 Supabase direct test error:', error);
      alert('❌ Direct test error: ' + error);
    }
  };

  const testProductionHealth = async () => {
    try {
      console.log('🏥 Testing production health endpoint...');
      
      const response = await fetch('/api/health');
      const result = await response.json();
      
      console.log('🏥 Health response:', result);
      
      if (response.ok) {
        alert('✅ Production health check successful!\nStatus: ' + result.status);
      } else {
        alert('❌ Production health check failed: ' + result.error);
      }
    } catch (error) {
      console.error('🏥 Health check error:', error);
      alert('❌ Health check error: ' + error);
    }
  };

  const testSimpleEndpoint = async () => {
    try {
      console.log('🧪 Testing simple API endpoint...');
      
      const response = await fetch('/api/test-simple');
      const result = await response.json();
      
      console.log('🧪 Simple API response:', result);
      
      if (response.ok) {
        alert('✅ Simple API works!\nEnvironment variables found: ' + result.environment.envVars.join(', '));
      } else {
        alert('❌ Simple API failed: ' + result.error);
      }
    } catch (error) {
      console.error('🧪 Simple API error:', error);
      alert('❌ Simple API error: ' + error);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'system-ui', 
      maxWidth: '800px', 
      margin: '0 auto' 
    }}>
      <h1 style={{ color: '#2563eb', marginBottom: '2rem' }}>
        🚪 Porta Gateway
      </h1>
      
      <div style={{ 
        background: '#f8fafc', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px', 
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2>System Status</h2>
        <p><strong>Status:</strong> <span style={{ 
          color: status.includes('healthy') ? '#16a34a' : '#dc2626' 
        }}>{status}</span></p>
        <p><strong>Last Check:</strong> {lastTest}</p>
        
        <div style={{ marginTop: '1rem' }}>
          <button 
            onClick={checkHealth}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            Refresh Status
          </button>
          
          <button 
            onClick={testLogin}
            style={{
              background: '#16a34a',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            Test Login (Client)
          </button>

          <button 
            onClick={testSupabaseDirect}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Supabase Direct
          </button>

          <button 
            onClick={testProductionHealth}
            style={{
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '1rem'
            }}
          >
            Test Prod Health
          </button>

          <button 
            onClick={testSimpleEndpoint}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '1rem'
            }}
          >
            Test Simple API
          </button>
        </div>
      </div>

      <div style={{ 
        background: '#fefce8', 
        border: '1px solid #eab308', 
        borderRadius: '8px', 
        padding: '1.5rem' 
      }}>
        <h3>🔗 API Endpoints</h3>
        <ul style={{ margin: '1rem 0' }}>
          <li><code>POST /api/auth/login</code> - Authenticate users</li>
          <li><code>GET /api/health</code> - Health check</li>
        </ul>
        
        <h3>🎯 Usage</h3>
        <p>ARCA should POST to:</p>
        <code style={{ 
          background: '#1f2937', 
          color: '#f9fafb', 
          padding: '0.5rem', 
          borderRadius: '4px',
          display: 'block',
          marginTop: '0.5rem'
        }}>
          https://porta-gateway.vercel.app/api/auth/login
        </code>
      </div>
    </div>
  );
}

export default App;
