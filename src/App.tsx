import { useState, useEffect } from 'react';
import { APP_VERSION, BUILD_DATE } from './constants/version';
import { EmergencyAdmin } from './components/EmergencyAdmin';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const [status, setStatus] = useState<string>('Loading...');
  const [lastCheck, setLastCheck] = useState<string>('');
  const [showEmergencyAccess, setShowEmergencyAccess] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Set dynamic page title
    document.title = `Porta Gateway v${APP_VERSION}`;
    
    // Check for admin route
    if (window.location.pathname === '/admin') {
      setShowAdminDashboard(true);
      return;
    }
    
    // Check for existing admin session
    const savedToken = localStorage.getItem('porta_admin_token');
    if (savedToken) {
      setIsAdmin(true);
    }
    
    checkHealth();
  }, []);

  const checkHealth = async () => {
    // Check if we're in development mode (Vite dev server) first
    const isDev = import.meta.env.DEV;
    
    if (isDev) {
      // Skip API call in development mode and use mock data immediately
      console.log('Development mode: Using mock health data');
      setStatus('healthy (dev mode)');
      setLastCheck(new Date().toISOString());
      setSystemHealth({
        status: 'healthy (dev mode)',
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        environment: {
          hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
          hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
          hasJwtSecret: !!import.meta.env.VITE_JWT_SECRET,
          hasArcaSecret: !!import.meta.env.VITE_ARCA_APP_SECRET
        },
        systemHealth: {
          overallStatus: 'healthy',
          emergencyModeRecommended: false
        }
      });
      return;
    }

    // Production mode - make actual API call
    try {
      const response = await fetch('/api/health');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const health = await response.json();
      
      setStatus(health.status);
      setLastCheck(health.timestamp);
      setSystemHealth(health);
      
      // Show emergency access if system is in emergency mode
      if (health.systemHealth?.emergencyModeRecommended) {
        setShowEmergencyAccess(true);
      }
    } catch (error) {
      console.error('Health check error:', error);
      setStatus('Error checking health');
      
      // Don't automatically show emergency access on health check failure
      // Let users manually access it via the SU Toolkit card
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
        checkHealth();
      } else {
        throw new Error(result.error || 'Emergency login failed');
      }
    } catch (error) {
      console.error('Emergency login failed:', error);
      throw error;
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('porta_admin_token');
    localStorage.removeItem('porta_admin_user');
  };

  // Show admin dashboard if on /admin route
  if (showAdminDashboard) {
    return <AdminDashboard />;
  }

  // Show emergency access interface if requested
  if (showEmergencyAccess) {
    return <EmergencyAdmin onEmergencyLogin={handleEmergencyLogin} />;
  }

  const getStatusInfo = () => {
    if (status.includes('healthy')) return { icon: '✅', colorClass: 'text-green-600' };
    if (status.includes('degraded')) return { icon: '⚠️', colorClass: 'text-yellow-600' };
    return { icon: '❌', colorClass: 'text-red-600' };
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <img 
              src="/apple-touch-icon.svg" 
              alt="Porta Gateway" 
              className="w-8 h-8"
            />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 m-0">
                Porta Gateway
              </h1>
              <p className="text-sm text-gray-500 m-0">
                Authentication & App Management Platform
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right text-sm text-gray-500">
              <div className="font-medium">v{APP_VERSION}</div>
              <div>{BUILD_DATE}</div>
            </div>
            
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  👤 Admin
                </span>
                <button
                  onClick={handleAdminLogout}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2 m-0">
            🏥 System Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2 m-0">
                Gateway Status
              </h3>
              <div className={`flex items-center space-x-2 text-lg font-medium ${getStatusInfo().colorClass}`}>
                <span>{getStatusInfo().icon}</span>
                <span>{status}</span>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2 m-0">
                Last Checked
              </h3>
              <div className="text-sm text-gray-900">
                {lastCheck ? new Date(lastCheck).toLocaleString() : 'Never'}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2 m-0">
                Environment
              </h3>
              <div className="text-sm text-gray-900">
                {systemHealth?.environment?.hasSupabaseUrl ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 flex space-x-4">
            <button
              onClick={checkHealth}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              🔄 Refresh Status
            </button>
          </div>
        </div>

        {/* Admin Access Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Admin Dashboard Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-5xl mb-4">🛠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 m-0">Admin Dashboard</h3>
            <p className="text-gray-600 text-sm mb-6 m-0">
              Manage applications, users, and system settings
            </p>
            <button
              onClick={() => window.location.href = '/admin'}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Access Admin Dashboard
            </button>
          </div>

          {/* SU Toolkit Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-5xl mb-4">🛠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 m-0">SU Toolkit</h3>
            <p className="text-gray-600 text-sm mb-6 m-0">
              Super User toolkit for system recovery and administration
            </p>
            <button
              onClick={() => setShowEmergencyAccess(true)}
              className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                systemHealth?.systemHealth?.emergencyModeRecommended 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
              }`}
            >
              {systemHealth?.systemHealth?.emergencyModeRecommended ? 'System Alert - Access SU Toolkit' : 'Access SU Toolkit'}
            </button>
          </div>
        </div>

        {/* Admin Tools Section (only if admin is logged in) */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2 m-0">
              🔧 Admin Tools & Testing
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={async () => {
                  try {
                    const credentials = {
                      email: 'admin@arca.dev',
                      password: 'admin123',
                      app: 'arca',
                      redirect_url: 'https://arca-alpha.vercel.app',
                      app_secret: import.meta.env.VITE_ARCA_APP_SECRET
                    };
                    
                    const response = await fetch('/api/auth/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(credentials)
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                      alert('✅ ARCA login test successful!');
                    } else {
                      alert('❌ ARCA login test failed: ' + result.error);
                    }
                  } catch (error) {
                    alert('❌ ARCA login test error: ' + error);
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                🔑 Test ARCA Login
              </button>
              
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/health');
                    const result = await response.json();
                    alert('🏥 Health check result:\n' + JSON.stringify(result, null, 2));
                  } catch (error) {
                    alert('❌ Health check error: ' + error);
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                🏥 Test Health API
              </button>
              
              <button
                onClick={() => window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
              >
                📚 API Documentation
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p className="m-0">
            Porta Gateway v{APP_VERSION} • Built {BUILD_DATE}
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;