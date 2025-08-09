import React, { useState } from 'react';

export interface RegisteredApp {
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
}

interface AppsTabProps {
  apps: RegisteredApp[];
  isLoading: boolean;
  formatDate: (date?: string) => string;
  rotateAppSecret: (appName: string) => void;
  onCreateApp: (payload: {
    app_name: string;
    app_display_name: string;
    allowed_origins: string[];
    redirect_urls: string[];
  }) => Promise<boolean> | boolean;
  onCopySecret: (appName: string) => Promise<string | null> | string | null;
}

const AppsTab: React.FC<AppsTabProps> = ({ apps, isLoading, formatDate, rotateAppSecret, onCreateApp, onCopySecret }) => {
  const [showAddApp, setShowAddApp] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppDisplayName, setNewAppDisplayName] = useState('');
  const [newAllowedOrigins, setNewAllowedOrigins] = useState('');
  const [newRedirectUrls, setNewRedirectUrls] = useState('');

  const handleCreate = async () => {
    // Basic validation
    const name = newAppName.trim();
    const display = newAppDisplayName.trim();
    const origins = newAllowedOrigins.split(',').map(s => s.trim()).filter(Boolean);
    const redirects = newRedirectUrls.split(',').map(s => s.trim()).filter(Boolean);
    if (!name || !display || origins.length === 0 || redirects.length === 0) {
      alert('Please fill App Name, Display Name, Allowed Origins, and Redirect URLs.');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(name)) {
      alert('App Name must be lowercase letters, numbers, underscores, or hyphens.');
      return;
    }
    const payload = {
      app_name: name,
      app_display_name: display,
      allowed_origins: origins,
      redirect_urls: redirects
    };
    const ok = await onCreateApp(payload);
    if (ok) {
      setShowAddApp(false);
      setNewAppName('');
      setNewAppDisplayName('');
      setNewAllowedOrigins('');
      setNewRedirectUrls('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Registered Applications</h2>
        <button
          onClick={() => setShowAddApp(v => !v)}
          style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 0.75rem',
            borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600
          }}
        >{showAddApp ? 'Cancel' : 'Add App'}</button>
      </div>

      {showAddApp && (
        <div style={{
          backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>App Name</label>
              <input value={newAppName} onChange={e => setNewAppName(e.target.value)} placeholder="e.g. porta_client"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Display Name</label>
              <input value={newAppDisplayName} onChange={e => setNewAppDisplayName(e.target.value)} placeholder="e.g. Porta Client"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Allowed Origins (comma separated)</label>
              <input value={newAllowedOrigins} onChange={e => setNewAllowedOrigins(e.target.value)} placeholder="https://app.example.com, http://localhost:3000"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Redirect URLs (comma separated)</label>
              <input value={newRedirectUrls} onChange={e => setNewRedirectUrls(e.target.value)} placeholder="https://app.example.com/auth/callback"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >Create App</button>
            <button onClick={() => setShowAddApp(false)} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 2fr auto',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: '500',
          fontSize: '0.875rem',
          color: '#374151'
        }}>
          <div>Application</div>
          <div>Status</div>
          <div>Created</div>
          <div>Allowed Origins</div>
          <div>Actions</div>
        </div>

        {apps.map(app => (
          <div key={app.id} style={{
            display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 2fr auto',
            gap: '1rem', padding: '1rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem'
          }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1f2937' }}>{app.app_display_name}</div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{app.app_name}</div>
            </div>
            <div>
              <span style={{
                display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: 4,
                backgroundColor: app.status === 'active' ? '#d1fae5' : app.status === 'pending' ? '#fef3c7' : '#fee2e2',
                color: app.status === 'active' ? '#065f46' : app.status === 'pending' ? '#92400e' : '#991b1b',
                fontWeight: 500
              }}>{app.status}</span>
            </div>
            <div>{formatDate(app.created_at)}</div>
            <div style={{ color: '#6b7280' }}>{app.allowed_origins?.join(', ') || '-'}</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => rotateAppSecret(app.app_name)}
                disabled={isLoading}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >Rotate Secret</button>
              <button
                onClick={async () => {
                  const secret = await onCopySecret(app.app_name);
                  if (secret) {
                    try {
                      await navigator.clipboard.writeText(secret);
                      alert('App secret copied to clipboard');
                    } catch {
                      // Fallback
                      prompt('Copy the app secret:', secret);
                    }
                  }
                }}
                disabled={isLoading}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >Copy Secret</button>
            </div>
          </div>
        ))}

        {apps.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>No applications registered yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppsTab;
