import { useState, useEffect } from 'react';
import { AuthService } from './services/AuthService';
import { handleAuth } from './api/auth';
import { APP_VERSION, BUILD_DATE } from './constants/version';
import { EmergencyAdmin } from './components/EmergencyAdmin';

function App() {
  const [status, setStatus] = useState<string>('Loading...');
  const [lastTest, setLastTest] = useState<string>('');
  const [showEmergencyAccess, setShowEmergencyAccess] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    // Set dynamic page title
    document.title = `Porta Gateway v${APP_VERSION}`;
    
    // Debug environment variables
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      isDev: import.meta.env.DEV
    });
    
    checkHealth();
    
    // Set up API route handlers for development
    setupAPIRoutes();
  }, []);

  const checkHealth = async () => {
    try {
      console.log('🏥 checkHealth: Starting health check...');
      const response = await fetch('/api/health');
      const health = await response.json();
      console.log('🏥 checkHealth: Health result:', health);
      
      setStatus(health.status);
      setLastTest(health.timestamp);
      setSystemHealth(health);
      
      // Show emergency access if system is in emergency mode
      if (health.systemHealth?.emergencyModeRecommended) {
        setShowEmergencyAccess(true);
      }
    } catch (error) {
      console.error('🏥 checkHealth: Error:', error);
      setStatus('Error checking health: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setShowEmergencyAccess(true); // Show emergency access if health check fails
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
    console.log('🚨🚨🚨 THIS IS THE NEW VERSION WITH DEBUG CODE 🚨🚨🚨');
    try {
      console.log('🔥 Starting test login...');
      
      // Debug environment variable
      console.log('🔐 VITE_ARCA_APP_SECRET value:', import.meta.env.VITE_ARCA_APP_SECRET);
      console.log('🔐 Expected value: e636839fd8ad07bfe5a85da0226f4ed133a5810e42e60221c4b16f40346549f0');
      
      const credentials = {
        email: 'admin@arca.dev',
        password: 'admin123',
        app: 'arca',
        redirect_url: 'https://arca-alpha.vercel.app',
        app_secret: import.meta.env.VITE_ARCA_APP_SECRET
      };
      
      console.log('📤 Sending credentials with app_secret:', credentials);
      
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

  const testLogout = async () => {
    try {
      console.log('🚪 Starting test logout...');
      
      const result = await AuthService.logout();
      
      if (result.success) {
        console.log('✅ Logout successful!');
        alert('Test logout successful!');
        // Refresh the status after logout
        await checkHealth();
      } else {
        console.log('❌ Logout failed:', result.error);
        alert('Test logout failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('💥 Test logout error:', error);
      alert('Test logout error: ' + error);
    }
  };

  const testSupabaseDirect = async () => {
    try {
      console.log('🧪 Testing Supabase direct connection...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
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

  const handleEmergencyLogin = async (credentials: { email: string; token: string }) => {
    try {
      const response = await fetch('/api/admin/emergency-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Emergency login successful!\nToken: ${result.token.substring(0, 20)}...\nExpires: ${result.expiresAt}`);
        setShowEmergencyAccess(false);
        checkHealth(); // Refresh health status
      } else {
        throw new Error(result.error || 'Emergency login failed');
      }
    } catch (error) {
      console.error('Emergency login failed:', error);
      throw error;
    }
  };

  const toggleEmergencyAccess = () => {
    setShowEmergencyAccess(!showEmergencyAccess);
  };

  // Show emergency access interface if requested or if system is unhealthy
  if (showEmergencyAccess) {
    return <EmergencyAdmin onEmergencyLogin={handleEmergencyLogin} />;
  }

  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'system-ui', 
      maxWidth: '800px', 
      margin: '0 auto' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#2563eb', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/apple-touch-icon.svg" alt="Porta Gateway" style={{ width: '32px', height: '32px' }} />
          Porta Gateway
        </h1>
        <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#6b7280' }}>
          <div><strong>v{APP_VERSION}</strong></div>
          <div>Build: {BUILD_DATE}</div>
        </div>
      </div>
      
      <div style={{ 
        background: '#f8fafc', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px', 
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0 }}>System Status & Testing</h2>
        
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Status Information */}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#374151' }}>Current Status</h3>
            <p><strong>Status:</strong> <span style={{ 
              color: status.includes('healthy') ? '#16a34a' : '#dc2626',
              fontWeight: 'bold'
            }}>{status}</span></p>
            <p><strong>Last Check:</strong> {lastTest}</p>
            <p><strong>Environment:</strong> {import.meta.env.DEV ? 'Development' : 'Production'}</p>
            
            {/* Emergency Mode Warning */}
            {systemHealth?.systemHealth?.emergencyModeRecommended && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '0.75rem',
                marginTop: '1rem'
              }}>
                <strong style={{ color: '#dc2626' }}>⚠️ Emergency Mode Recommended</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#7f1d1d' }}>
                  System performance degraded. Consider emergency access.
                </p>
              </div>
            )}
          </div>

          {/* Test Buttons */}
          <div style={{ flex: 2 }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#374151' }}>Test Functions</h3>
            
            {/* Primary Actions */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>Authentication</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <button 
                  onClick={testLogin}
                  style={{
                    background: '#16a34a',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔑 Test Login
                </button>

                <button 
                  onClick={testLogout}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🚪 Test Logout
                </button>

                <button 
                  onClick={checkHealth}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Refresh Status
                </button>
              </div>
            </div>

            {/* Debug/Advanced */}
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>Debug & Advanced</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button 
                  onClick={testSupabaseDirect}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔬 Supabase Direct
                </button>

                <button 
                  onClick={testProductionHealth}
                  style={{
                    background: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🏥 Prod Health
                </button>

                <button 
                  onClick={testSimpleEndpoint}
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🧪 Simple API
                </button>
              </div>
            </div>

            {/* Emergency Access */}
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>Emergency Access</h4>
              <button 
                onClick={toggleEmergencyAccess}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                🚨 Emergency Admin
              </button>
            </div>
          </div>
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
