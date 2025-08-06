import { useState, useEffect } from 'react';

interface RegisteredApp {
  id: string;
  app_name: string;
  app_display_name: string;
  app_secret: string;
  allowed_origins: string[];
  redirect_urls: string[];
  status: 'active' | 'disabled' | 'pending';
  created_at: string;
  updated_at: string;
  secret_expires_at?: string;
  permissions: Record<string, any>;
  metadata: Record<string, any>;
}

interface AppRegistrationForm {
  app_name: string;
  app_display_name: string;
  allowed_origins: string[];
  redirect_urls: string[];
  permissions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export function AppManagement() {
  const [apps, setApps] = useState<RegisteredApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  
  const [newApp, setNewApp] = useState<AppRegistrationForm>({
    app_name: '',
    app_display_name: '',
    allowed_origins: [],
    redirect_urls: []
  });

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/apps');
      const data = await response.json();
      
      if (data.success) {
        setApps(data.apps || []);
      } else {
        setError(data.error || 'Failed to load apps');
      }
    } catch (error) {
      setError('Error loading apps');
      console.error('Load apps error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newApp)
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`App '${newApp.app_name}' registered successfully!`);
        setShowAddForm(false);
        setNewApp({
          app_name: '',
          app_display_name: '',
          allowed_origins: [],
          redirect_urls: []
        });
        loadApps(); // Reload the list
      } else {
        setError(data.error || 'Failed to register app');
      }
    } catch (error) {
      setError('Error registering app');
      console.error('Add app error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const rotateSecret = async (appName: string) => {
    if (!confirm(`Are you sure you want to rotate the secret for '${appName}'? This will invalidate the current secret.`)) {
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/rotate-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app_name: appName })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Secret rotated for '${appName}'. New secret: ${data.new_secret}`);
        loadApps(); // Reload to get updated expiry date
      } else {
        setError(data.error || 'Failed to rotate secret');
      }
    } catch (error) {
      setError('Error rotating secret');
      console.error('Rotate secret error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSecretVisibility = (appId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [appId]: !prev[appId]
    }));
  };

  const updateArrayField = (field: 'allowed_origins' | 'redirect_urls', value: string) => {
    const urls = value.split('\n').map(url => url.trim()).filter(url => url);
    setNewApp(prev => ({ ...prev, [field]: urls }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return { color: '#6b7280', text: 'No expiry' };
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { color: '#dc2626', text: 'EXPIRED' };
    } else if (daysUntilExpiry <= 7) {
      return { color: '#f59e0b', text: `Expires in ${daysUntilExpiry} days` };
    } else {
      return { color: '#16a34a', text: `Expires in ${daysUntilExpiry} days` };
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔧 App Management
        </h1>
        <p style={{ color: '#6b7280' }}>
          Manage registered applications and their authentication credentials
        </p>
      </div>

      {error && (
        <div style={{ 
          background: '#fee2e2', 
          color: '#dc2626', 
          padding: '1rem', 
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ 
          background: '#dcfce7', 
          color: '#16a34a', 
          padding: '1rem', 
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid #bbf7d0'
        }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          {showAddForm ? '❌ Cancel' : '➕ Add New App'}
        </button>

        <button
          onClick={loadApps}
          disabled={isLoading}
          style={{
            backgroundColor: '#6b7280',
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
          🔄 Refresh
        </button>
      </div>

      {showAddForm && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Register New Application</h3>
          
          <form onSubmit={handleAddApp}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  App Name (lowercase, no spaces):
                </label>
                <input
                  type="text"
                  value={newApp.app_name}
                  onChange={(e) => setNewApp({ ...newApp, app_name: e.target.value.toLowerCase() })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                  placeholder="cdtoolkit"
                  pattern="[a-z0-9_-]+"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Display Name:
                </label>
                <input
                  type="text"
                  value={newApp.app_display_name}
                  onChange={(e) => setNewApp({ ...newApp, app_display_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                  placeholder="CD Toolkit"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Allowed Origins (one per line):
              </label>
              <textarea
                value={newApp.allowed_origins.join('\n')}
                onChange={(e) => updateArrayField('allowed_origins', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="https://cdtoolkit.example.com&#10;https://cdtoolkit-dev.example.com"
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Redirect URLs (one per line):
              </label>
              <textarea
                value={newApp.redirect_urls.join('\n')}
                onChange={(e) => updateArrayField('redirect_urls', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="https://cdtoolkit.example.com&#10;https://cdtoolkit-dev.example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: '#16a34a',
                color: 'white',
                padding: '0.75rem 2rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Registering...' : '✅ Register App'}
            </button>
          </form>
        </div>
      )}

      {/* Apps List */}
      <div>
        <h3>Registered Applications ({apps.length})</h3>
        
        {apps.length === 0 && !isLoading ? (
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            No applications registered yet. Click "Add New App" to get started.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {apps.map(app => {
              const expiryStatus = getExpiryStatus(app.secret_expires_at);
              return (
                <div key={app.id} style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#1f2937' }}>{app.app_display_name}</h4>
                        <span style={{
                          background: app.status === 'active' ? '#dcfce7' : '#fee2e2',
                          color: app.status === 'active' ? '#16a34a' : '#dc2626',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {app.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        <strong>App Name:</strong> <code style={{ background: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>{app.app_name}</code>
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        <strong>Secret:</strong>{' '}
                        {showSecrets[app.id] ? (
                          <code style={{ background: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '3px', fontSize: '0.75rem' }}>
                            {app.app_secret}
                          </code>
                        ) : (
                          <span>••••••••••••••••</span>
                        )}
                        <button
                          onClick={() => toggleSecretVisibility(app.id)}
                          style={{
                            marginLeft: '0.5rem',
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          {showSecrets[app.id] ? '🙈 Hide' : '👁️ Show'}
                        </button>
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        <strong>Secret Expires:</strong>{' '}
                        <span style={{ color: expiryStatus.color, fontWeight: '500' }}>
                          {expiryStatus.text}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        <strong>Allowed Origins:</strong> {app.allowed_origins.join(', ') || 'None'}
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        <strong>Created:</strong> {formatDate(app.created_at)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        onClick={() => rotateSecret(app.app_name)}
                        disabled={isLoading}
                        style={{
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          borderRadius: '4px',
                          border: 'none',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.6 : 1
                        }}
                      >
                        🔄 Rotate Secret
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}