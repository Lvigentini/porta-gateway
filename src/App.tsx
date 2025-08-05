import { useState, useEffect } from 'react';
import { AuthService } from './services/AuthService';
import { handleAuth, handleHealth } from './api/auth';

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
    try {
      const testRequest = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@arca.dev',
          password: 'admin123',
          app: 'arca',
          redirect_url: 'https://arca-alpha.vercel.app'
        })
      });

      const response = await handleAuth(testRequest);
      const result = await response.json();
      
      if (result.success) {
        alert('Test login successful! Token: ' + result.token.substring(0, 20) + '...');
      } else {
        alert('Test login failed: ' + result.error);
      }
    } catch (error) {
      alert('Test error: ' + error);
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
              cursor: 'pointer'
            }}
          >
            Test Login
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
