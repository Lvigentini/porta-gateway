import { useState, useEffect } from 'react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

interface AppAssignment {
  app_name: string;
  app_display_name: string;
  role_name: string;
  role_label: string;
  granted_at: string;
}

interface UserWithAssignments extends User {
  app_assignments: AppAssignment[];
}

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

interface AppRole {
  id: string;
  app_name: string;
  role_name: string;
  role_label: string;
  permissions: Record<string, any>;
}

interface AppRegistrationForm {
  app_name: string;
  app_display_name: string;
  allowed_origins: string[];
  redirect_urls: string[];
  roles: { role_name: string; role_label: string; permissions: Record<string, any> }[];
}

export function AdminDashboard() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'roles'>('apps');
  
  // Login state
  const [loginCredentials, setLoginCredentials] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // App management state
  const [apps, setApps] = useState<RegisteredApp[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersWithAssignments, setUsersWithAssignments] = useState<UserWithAssignments[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');

  // Roles & ACL state
  const [rolesView, setRolesView] = useState<'app' | 'user'>('app');
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [assignmentRoles, setAssignmentRoles] = useState<{ [key: string]: string }>({});
  
  const [newApp, setNewApp] = useState<AppRegistrationForm>({
    app_name: '',
    app_display_name: '',
    allowed_origins: [],
    redirect_urls: [],
    roles: [
      { role_name: 'admin', role_label: 'Administrator', permissions: { manage_users: true, full_access: true } },
      { role_name: 'edit', role_label: 'Editor', permissions: { create: true, read: true, update: true, delete: true } },
      { role_name: 'view', role_label: 'Viewer', permissions: { read: true } }
    ]
  });

  useEffect(() => {
    // Check for existing admin session in localStorage
    const savedToken = localStorage.getItem('porta_admin_token');
    const savedAdmin = localStorage.getItem('porta_admin_user');
    
    if (savedToken && savedAdmin) {
      try {
        setAdminToken(savedToken);
        setAdminUser(JSON.parse(savedAdmin));
        setIsLoggedIn(true);
        loadApps(savedToken);
        loadUsers(savedToken);
      } catch (error) {
        console.error('Invalid saved admin session');
        localStorage.removeItem('porta_admin_token');
        localStorage.removeItem('porta_admin_user');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginCredentials)
      });

      const data = await response.json();
      
      if (data.success) {
        setAdminToken(data.adminToken);
        setAdminUser(data.admin);
        setIsLoggedIn(true);
        
        // Save to localStorage for persistence
        localStorage.setItem('porta_admin_token', data.adminToken);
        localStorage.setItem('porta_admin_user', JSON.stringify(data.admin));
        
        setSuccess('Admin login successful!');
        setLoginCredentials({ email: '', password: '' });
        
        // Load apps and users after successful login
        loadApps(data.adminToken);
        loadUsers(data.adminToken);
        
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Check if we're in development mode (Vite dev server)
      const isDev = import.meta.env.DEV;
      
      if (isDev) {
        // Mock successful login for development
        const mockAdminUser = {
          id: 'dev-admin',
          email: loginCredentials.email,
          name: 'Development Admin',
          role: 'admin'
        };
        const mockToken = btoa(JSON.stringify({
          adminId: 'dev-admin',
          email: loginCredentials.email,
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
          iss: 'porta-gateway-admin'
        }));
        
        setAdminToken(mockToken);
        setAdminUser(mockAdminUser);
        setIsLoggedIn(true);
        
        localStorage.setItem('porta_admin_token', mockToken);
        localStorage.setItem('porta_admin_user', JSON.stringify(mockAdminUser));
        
        setSuccess('Development mode: Mock admin login successful');
        setLoginCredentials({ email: '', password: '' });
        
        // Load real data using mock token
        loadApps(mockToken);
        loadUsers(mockToken);
        
        console.log('Development mode: Mock admin login successful');
      } else {
        setError('Error during login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdminUser(null);
    setAdminToken('');
    localStorage.removeItem('porta_admin_token');
    localStorage.removeItem('porta_admin_user');
    setApps([]);
    setUsers([]);
    setSuccess('Logged out successfully');
  };

  const loadApps = async (token?: string) => {
    try {
      const authToken = token || adminToken;
      const response = await fetch('/api/admin/apps', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setApps(data.apps || []);
      } else {
        setError(data.error || 'Failed to load apps');
        
        // If token expired, logout
        if (data.error?.includes('expired')) {
          handleLogout();
        }
      }
    } catch (error) {
      setError('Error loading apps');
      console.error('Load apps error:', error);
    }
  };

  const loadUsers = async (token?: string) => {
    try {
      const authToken = token || adminToken;
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const usersData = data.users || [];
        
        // Set clean users for Users tab
        const cleanUsers = usersData.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login_at: user.last_login_at
        }));
        
        // Set users with assignments for Roles & ACL tab
        const usersWithAssignments = usersData.map((user: any) => ({
          ...user,
          app_assignments: user.app_assignments || []
        }));
        
        setUsers(cleanUsers);
        setUsersWithAssignments(usersWithAssignments);
      } else {
        setError(data.error || 'Failed to load users');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
      }
    } catch (error) {
      setError('Error loading users');
      console.error('Load users error:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/users?user_id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`User role updated to '${newRole}' successfully!`);
        setEditingUser(null);
        setEditingRole('');
        loadUsers(); // Reload users list
      } else {
        setError(data.error || 'Failed to update user role');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
      }
    } catch (error) {
      setError('Error updating user role');
      console.error('Update user role error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingUser = (userId: string, currentRole: string) => {
    setEditingUser(userId);
    setEditingRole(currentRole);
    setError('');
    setSuccess('');
  };

  const cancelEditingUser = () => {
    setEditingUser(null);
    setEditingRole('');
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
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          app_name: newApp.app_name,
          app_display_name: newApp.app_display_name,
          allowed_origins: newApp.allowed_origins,
          redirect_urls: newApp.redirect_urls,
          metadata: { 
            roles_defined: newApp.roles,
            created_via: 'admin_dashboard'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`App '${newApp.app_name}' registered successfully with ${newApp.roles.length} roles!`);
        setShowAddForm(false);
        setNewApp({
          app_name: '',
          app_display_name: '',
          allowed_origins: [],
          redirect_urls: [],
          roles: [
            { role_name: 'admin', role_label: 'Administrator', permissions: { manage_users: true, full_access: true } },
            { role_name: 'edit', role_label: 'Editor', permissions: { create: true, read: true, update: true, delete: true } },
            { role_name: 'view', role_label: 'Viewer', permissions: { read: true } }
          ]
        });
        loadApps();
      } else {
        setError(data.error || 'Failed to register app');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
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
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ app_name: appName })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Secret rotated for '${appName}'. New secret: ${data.new_secret}`);
        loadApps();
      } else {
        setError(data.error || 'Failed to rotate secret');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
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

  const updateRole = (index: number, field: keyof AppRole, value: string) => {
    setNewApp(prev => ({
      ...prev,
      roles: prev.roles.map((role, i) => 
        i === index ? { ...role, [field]: value } : role
      )
    }));
  };

  const addRole = () => {
    setNewApp(prev => ({
      ...prev,
      roles: [...prev.roles, { role_name: '', role_label: '', permissions: {} }]
    }));
  };

  const removeRole = (index: number) => {
    setNewApp(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }));
  };

  const assignRole = async (userId: string, appName: string, roleName: string) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ 
          user_id: userId, 
          app_name: appName, 
          role_name: roleName 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        // Reload users to reflect the changes
        loadUsers();
      } else {
        setError(data.error || 'Failed to assign role');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
      }
    } catch (error) {
      setError('Error assigning role');
      console.error('Assign role error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeRole = async (userId: string, appName: string) => {
    if (!confirm('Are you sure you want to revoke this user\'s role for this application?')) {
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ 
          user_id: userId, 
          app_name: appName 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        // Reload users to reflect the changes
        loadUsers();
      } else {
        setError(data.error || 'Failed to revoke role');
        
        if (data.error?.includes('expired')) {
          handleLogout();
        }
      }
    } catch (error) {
      setError('Error revoking role');
      console.error('Revoke role error:', error);
    } finally {
      setIsLoading(false);
    }
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

  // Login screen
  if (!isLoggedIn) {
    return (
      <div style={{ 
        padding: '2rem',
        maxWidth: '400px',
        margin: '4rem auto',
        fontFamily: 'system-ui'
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ color: '#1f2937', marginBottom: '0.5rem' }}>
            🔐 Admin Login
          </h1>
          <p style={{ color: '#6b7280' }}>
            Porta Gateway Administration
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

        <form onSubmit={handleLogin} style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '2rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Admin Email:
            </label>
            <input
              type="email"
              value={loginCredentials.email}
              onChange={(e) => setLoginCredentials({ ...loginCredentials, email: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="admin@yourdomain.com"
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Password:
            </label>
            <input
              type="password"
              value={loginCredentials.password}
              onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Your admin password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#3b82f6',
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
            {isLoading ? 'Logging in...' : '🔑 Login as Admin'}
          </button>
        </form>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#92400e',
          textAlign: 'center'
        }}>
          <strong>Note:</strong> Only users with 'admin' role can access this interface.
        </div>
      </div>
    );
  }

  // Main admin dashboard
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#1f2937', margin: 0 }}>
            🛠️ Porta Gateway Admin
          </h1>
          <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
            Welcome, {adminUser?.name || adminUser?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* Status Messages */}
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

      {/* Tab Navigation */}
      <div style={{ marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('apps')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'apps' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'apps' ? '#3b82f6' : '#6b7280',
            fontWeight: '500',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          📱 Apps & Registration
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'users' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'users' ? '#3b82f6' : '#6b7280',
            fontWeight: '500',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          👥 User Management
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'roles' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'roles' ? '#3b82f6' : '#6b7280',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          🔐 Roles & ACL
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'apps' && (
        <div>
          {/* App Management Controls */}
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
              {showAddForm ? '❌ Cancel' : '➕ Register New App'}
            </button>

            <button
              onClick={() => loadApps()}
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

          {/* Add App Form */}
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
                {/* Basic App Info */}
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

                {/* Roles Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ fontWeight: '500', fontSize: '1.1rem' }}>
                      App Roles:
                    </label>
                    <button
                      type="button"
                      onClick={addRole}
                      style={{
                        backgroundColor: '#10b981',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      ➕ Add Role
                    </button>
                  </div>

                  {newApp.roles.map((role, index) => (
                    <div key={index} style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '1rem',
                      marginBottom: '1rem',
                      background: '#ffffff'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                            Role Name:
                          </label>
                          <input
                            type="text"
                            value={role.role_name}
                            onChange={(e) => updateRole(index, 'role_name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '0.875rem'
                            }}
                            placeholder="admin, editor, viewer"
                            required
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                            Role Label:
                          </label>
                          <input
                            type="text"
                            value={role.role_label}
                            onChange={(e) => updateRole(index, 'role_label', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '0.875rem'
                            }}
                            placeholder="Administrator, Editor, Viewer"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRole(index)}
                          style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: 'none',
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                          }}
                          disabled={newApp.roles.length <= 1}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
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
                  {isLoading ? 'Registering...' : '✅ Register App with Roles'}
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
                No applications registered yet. Click "Register New App" to get started.
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

                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                            <strong>Roles:</strong>{' '}
                            {app.metadata?.roles_defined ? 
                              app.metadata.roles_defined.map((role: any) => role.role_label).join(', ') : 
                              'None defined'
                            }
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
      )}

      {activeTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0 }}>User Management ({users.length} users)</h3>
            <button
              onClick={() => loadUsers()}
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
              🔄 Refresh Users
            </button>
          </div>

          {users.length === 0 && !isLoading ? (
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              No users found.
            </div>
          ) : (
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', 
                gap: '1rem', 
                padding: '1rem 1.5rem', 
                background: '#f9fafb', 
                fontWeight: '500',
                fontSize: '0.875rem',
                color: '#6b7280',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div>User</div>
                <div>System Role</div>
                <div>Created</div>
                <div>Last Login</div>
                <div>Status</div>
                <div>Actions</div>
              </div>

              {users.map(user => (
                <div key={user.id} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', 
                  gap: '1rem', 
                  padding: '1rem 1.5rem', 
                  alignItems: 'center',
                  borderBottom: users.indexOf(user) === users.length - 1 ? 'none' : '1px solid #f3f4f6'
                }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#1f2937' }}>{user.full_name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user.email}</div>
                  </div>
                  
                  <div>
                    {editingUser === user.id ? (
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          width: '100%'
                        }}
                      >
                        <option value="user">User</option>
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: user.role === 'admin' ? '#fee2e2' : user.role === 'editor' ? '#fef3c7' : user.role === 'viewer' ? '#dbeafe' : '#f3f4f6',
                        color: user.role === 'admin' ? '#dc2626' : user.role === 'editor' ? '#d97706' : user.role === 'viewer' ? '#2563eb' : '#6b7280'
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {formatDate(user.created_at)}
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
                  </div>
                  
                  <div>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a'
                    }}>
                      ACTIVE
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {editingUser === user.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateUserRole(user.id, editingRole)}
                          disabled={isLoading || editingRole === user.role}
                          style={{
                            backgroundColor: '#16a34a',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: 'none',
                            fontSize: '0.75rem',
                            cursor: isLoading || editingRole === user.role ? 'not-allowed' : 'pointer',
                            opacity: isLoading || editingRole === user.role ? 0.5 : 1
                          }}
                        >
                          ✅
                        </button>
                        <button
                          onClick={cancelEditingUser}
                          disabled={isLoading}
                          style={{
                            backgroundColor: '#6b7280',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: 'none',
                            fontSize: '0.75rem',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.5 : 1
                          }}
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditingUser(user.id, user.role)}
                        disabled={isLoading}
                        style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          border: 'none',
                          fontSize: '0.75rem',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.5 : 1
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1.5rem' 
          }}>
            <h2 style={{ margin: 0, color: '#1f2937' }}>🔐 Roles & Access Control</h2>
            
            {/* View Toggle */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                onClick={() => setRolesView('app')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backgroundColor: rolesView === 'app' ? '#3b82f6' : 'transparent',
                  color: rolesView === 'app' ? 'white' : '#6b7280'
                }}
              >
                📱 App View
              </button>
              <button
                onClick={() => setRolesView('user')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  backgroundColor: rolesView === 'user' ? '#3b82f6' : 'transparent',
                  color: rolesView === 'user' ? 'white' : '#6b7280'
                }}
              >
                👤 User View
              </button>
            </div>
          </div>

          {/* App View */}
          {rolesView === 'app' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Select Application:
                </label>
                <select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    minWidth: '200px'
                  }}
                >
                  <option value="">Choose an app...</option>
                  {apps.map(app => (
                    <option key={app.id} value={app.app_name}>
                      {app.app_display_name} ({app.app_name})
                    </option>
                  ))}
                </select>
              </div>

              {selectedApp && (
                <div>
                  <h3 style={{ 
                    margin: '0 0 1rem 0', 
                    color: '#1f2937',
                    fontSize: '1.125rem' 
                  }}>
                    Users & Roles for {apps.find(app => app.app_name === selectedApp)?.app_display_name}
                  </h3>
                  
                  <div style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr auto',
                      gap: '1rem',
                      padding: '1rem',
                      backgroundColor: '#f3f4f6',
                      borderBottom: '1px solid #e5e7eb',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}>
                      <div>User</div>
                      <div>Current Role</div>
                      <div>Granted</div>
                      <div>Actions</div>
                    </div>

                    {usersWithAssignments
                      .filter(user => user.app_assignments.some(assignment => assignment.app_name === selectedApp))
                      .map(user => {
                        const assignment = user.app_assignments.find(a => a.app_name === selectedApp);
                        return (
                          <div 
                            key={user.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 1fr 1fr auto',
                              gap: '1rem',
                              padding: '1rem',
                              borderBottom: '1px solid #e5e7eb',
                              fontSize: '0.875rem'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                {user.full_name}
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                                {user.email}
                              </div>
                            </div>
                            <div>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.5rem',
                                backgroundColor: assignment?.role_name === 'admin' ? '#dbeafe' : '#fef3c7',
                                color: assignment?.role_name === 'admin' ? '#1d4ed8' : '#f59e0b',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}>
                                {assignment?.role_label || 'No Role'}
                              </span>
                            </div>
                            <div style={{ color: '#6b7280' }}>
                              {assignment ? formatDate(assignment.granted_at) : 'N/A'}
                            </div>
                            <div>
                              <button
                                onClick={() => revokeRole(user.id, selectedApp)}
                                disabled={isLoading}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: isLoading ? '#9ca3af' : '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: isLoading ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {isLoading ? 'Revoking...' : 'Revoke'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    }

                    {/* Users without assignments for this app */}
                    <div style={{ 
                      padding: '1rem',
                      borderTop: '2px solid #e5e7eb',
                      backgroundColor: '#f9fafb'
                    }}>
                      <h4 style={{ 
                        margin: '0 0 0.75rem 0', 
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#6b7280'
                      }}>
                        Assign New Users:
                      </h4>
                      {usersWithAssignments
                        .filter(user => !user.app_assignments.some(assignment => assignment.app_name === selectedApp))
                        .slice(0, 3)
                        .map(user => (
                          <div 
                            key={user.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem',
                              marginBottom: '0.5rem',
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '0.875rem'
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: '500' }}>{user.full_name}</span>
                              <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                                ({user.email})
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <select 
                                value={assignmentRoles[`app-${selectedApp}-user-${user.id}`] || ''}
                                onChange={(e) => setAssignmentRoles(prev => ({
                                  ...prev,
                                  [`app-${selectedApp}-user-${user.id}`]: e.target.value
                                }))}
                                style={{
                                  padding: '0.25rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem'
                                }}
                              >
                                <option value="">Select Role</option>
                                <option value="admin">Administrator</option>
                                <option value="editor">Editor</option>
                              </select>
                              <button
                                onClick={() => {
                                  const role = assignmentRoles[`app-${selectedApp}-user-${user.id}`];
                                  if (role) {
                                    assignRole(user.id, selectedApp, role);
                                    // Clear the selection after assignment
                                    setAssignmentRoles(prev => ({
                                      ...prev,
                                      [`app-${selectedApp}-user-${user.id}`]: ''
                                    }));
                                  }
                                }}
                                disabled={!assignmentRoles[`app-${selectedApp}-user-${user.id}`] || isLoading}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: assignmentRoles[`app-${selectedApp}-user-${user.id}`] && !isLoading ? '#10b981' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: assignmentRoles[`app-${selectedApp}-user-${user.id}`] && !isLoading ? 'pointer' : 'not-allowed'
                                }}
                              >
                                {isLoading ? 'Assigning...' : 'Assign'}
                              </button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}

              {!selectedApp && (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '3rem',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Select an application to view and manage user roles
                  </p>
                </div>
              )}
            </div>
          )}

          {/* User View */}
          {rolesView === 'user' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Select User:
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    minWidth: '200px'
                  }}
                >
                  <option value="">Choose a user...</option>
                  {usersWithAssignments.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <div>
                  {(() => {
                    const user = usersWithAssignments.find(u => u.id === selectedUser);
                    return user ? (
                      <div>
                        <h3 style={{ 
                          margin: '0 0 1rem 0', 
                          color: '#1f2937',
                          fontSize: '1.125rem' 
                        }}>
                          App Assignments for {user.full_name}
                        </h3>
                        
                        <div style={{
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr auto',
                            gap: '1rem',
                            padding: '1rem',
                            backgroundColor: '#f3f4f6',
                            borderBottom: '1px solid #e5e7eb',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            color: '#374151'
                          }}>
                            <div>Application</div>
                            <div>Role</div>
                            <div>Granted</div>
                            <div>Actions</div>
                          </div>

                          {user.app_assignments.map((assignment, index) => (
                            <div 
                              key={index}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr auto',
                                gap: '1rem',
                                padding: '1rem',
                                borderBottom: '1px solid #e5e7eb',
                                fontSize: '0.875rem'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                  {assignment.app_display_name}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                                  {assignment.app_name}
                                </div>
                              </div>
                              <div>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: assignment.role_name === 'admin' ? '#dbeafe' : '#fef3c7',
                                  color: assignment.role_name === 'admin' ? '#1d4ed8' : '#f59e0b',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {assignment.role_label}
                                </span>
                              </div>
                              <div style={{ color: '#6b7280' }}>
                                {formatDate(assignment.granted_at)}
                              </div>
                              <div>
                                <button
                                  onClick={() => revokeRole(user.id, assignment.app_name)}
                                  disabled={isLoading}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: isLoading ? '#9ca3af' : '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: isLoading ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {isLoading ? 'Revoking...' : 'Revoke'}
                                </button>
                              </div>
                            </div>
                          ))}

                          {user.app_assignments.length === 0 && (
                            <div style={{
                              padding: '2rem',
                              textAlign: 'center',
                              color: '#6b7280'
                            }}>
                              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                This user has no app assignments yet
                              </p>
                            </div>
                          )}

                          {/* Assign new apps to user */}
                          <div style={{ 
                            padding: '1rem',
                            borderTop: '2px solid #e5e7eb',
                            backgroundColor: '#f9fafb'
                          }}>
                            <h4 style={{ 
                              margin: '0 0 0.75rem 0', 
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: '#6b7280'
                            }}>
                              Assign to New Apps:
                            </h4>
                            {apps
                              .filter(app => !user.app_assignments.some(assignment => assignment.app_name === app.app_name))
                              .slice(0, 3)
                              .map(app => (
                                <div 
                                  key={app.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    marginBottom: '0.5rem',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  <div>
                                    <span style={{ fontWeight: '500' }}>{app.app_display_name}</span>
                                    <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                                      ({app.app_name})
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select 
                                      value={assignmentRoles[`user-${selectedUser}-app-${app.app_name}`] || ''}
                                      onChange={(e) => setAssignmentRoles(prev => ({
                                        ...prev,
                                        [`user-${selectedUser}-app-${app.app_name}`]: e.target.value
                                      }))}
                                      style={{
                                        padding: '0.25rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      <option value="">Select Role</option>
                                      <option value="admin">Administrator</option>
                                      <option value="editor">Editor</option>
                                    </select>
                                    <button
                                      onClick={() => {
                                        const role = assignmentRoles[`user-${selectedUser}-app-${app.app_name}`];
                                        if (role) {
                                          assignRole(selectedUser, app.app_name, role);
                                          // Clear the selection after assignment
                                          setAssignmentRoles(prev => ({
                                            ...prev,
                                            [`user-${selectedUser}-app-${app.app_name}`]: ''
                                          }));
                                        }
                                      }}
                                      disabled={!assignmentRoles[`user-${selectedUser}-app-${app.app_name}`] || isLoading}
                                      style={{
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: assignmentRoles[`user-${selectedUser}-app-${app.app_name}`] && !isLoading ? '#10b981' : '#9ca3af',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        cursor: assignmentRoles[`user-${selectedUser}-app-${app.app_name}`] && !isLoading ? 'pointer' : 'not-allowed'
                                      }}
                                    >
                                      {isLoading ? 'Assigning...' : 'Assign'}
                                    </button>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {!selectedUser && (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '3rem',
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Select a user to view and manage their app assignments
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}