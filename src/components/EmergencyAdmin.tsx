import { useState, useEffect } from 'react';

interface EmergencyAdminProps {
  onEmergencyLogin: (credentials: { email: string; token: string }) => void;
}

interface SystemStatus {
  status: string;
  emergencyModeRecommended: boolean;
  recentIssues: string[];
  recommendations: string[];
}

export function EmergencyAdmin({ onEmergencyLogin }: EmergencyAdminProps) {
  const [credentials, setCredentials] = useState({ email: '', token: '' });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkSystemHealth();
    runDiagnostics();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      if (data.systemHealth) {
        setSystemStatus(data.systemHealth);
      }
    } catch (error) {
      console.error('Failed to check system health:', error);
    }
  };

  const runDiagnostics = async () => {
    try {
      const response = await fetch('/api/admin/diagnose');
      const data = await response.json();
      
      if (data.success) {
        setDiagnostics(data.diagnostics);
      }
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  };

  const handleEmergencyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      onEmergencyLogin(credentials);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Emergency login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#16a34a';
      case 'degraded': return '#f59e0b';
      case 'emergency': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ 
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'system-ui'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🚨 Emergency Admin Access
        </h1>
        <p style={{ color: '#6b7280' }}>
          Use this interface only when normal authentication is unavailable
        </p>
      </div>

      {/* System Status */}
      {systemStatus && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, fontSize: '1.2rem', color: '#dc2626' }}>System Status</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <strong>Overall Status:</strong>
            <span style={{ 
              marginLeft: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: getStatusColor(systemStatus.status),
              color: 'white',
              fontSize: '0.875rem'
            }}>
              {systemStatus.status.toUpperCase()}
            </span>
          </div>

          {systemStatus.emergencyModeRecommended && (
            <div style={{ 
              background: '#fee2e2', 
              padding: '1rem', 
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              <strong style={{ color: '#dc2626' }}>⚠️ Emergency Mode Recommended</strong>
              <p style={{ margin: '0.5rem 0 0 0', color: '#7f1d1d' }}>
                System performance has degraded significantly. Emergency access may be required.
              </p>
            </div>
          )}

          {systemStatus.recentIssues.length > 0 && (
            <div>
              <strong>Recent Issues:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                {systemStatus.recentIssues.map((issue, index) => (
                  <li key={index} style={{ color: '#dc2626', marginBottom: '0.25rem' }}>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Emergency Login Form */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0 }}>Emergency Authentication</h2>
        
        <form onSubmit={handleEmergencyLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Emergency Admin Email:
            </label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Emergency Token:
            </label>
            <input
              type="password"
              value={credentials.token}
              onChange={(e) => setCredentials({ ...credentials, token: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Emergency access token"
              required
            />
          </div>

          {error && (
            <div style={{ 
              background: '#fee2e2', 
              color: '#dc2626', 
              padding: '0.75rem', 
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Authenticating...' : '🚨 Emergency Login'}
          </button>
        </form>
      </div>

      {/* Diagnostics Summary */}
      {diagnostics && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{ marginTop: 0 }}>Quick Diagnostics</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Environment:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                <li>Supabase URL: {diagnostics.environment?.supabase_url?.configured ? '✅' : '❌'}</li>
                <li>Supabase Key: {diagnostics.environment?.supabase_anon_key?.configured ? '✅' : '❌'}</li>
                <li>Emergency Admin: {diagnostics.environment?.emergency_admin?.configured ? '✅' : '❌'}</li>
              </ul>
            </div>
            
            <div>
              <strong>Services:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                <li>Supabase: {diagnostics.components?.supabase?.status === 'healthy' ? '✅' : '❌'}</li>
                <li>Authentication: {diagnostics.components?.authentication?.status === 'healthy' ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>

          {diagnostics.recommendations?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong>Recommendations:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                {diagnostics.recommendations.slice(0, 3).map((rec: string, index: number) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem',
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: '#92400e'
      }}>
        <strong>⚠️ Security Notice:</strong> Emergency access is logged and monitored. 
        Only use when normal authentication systems are unavailable. 
        Emergency tokens expire after 24 hours for security.
      </div>
    </div>
  );
}