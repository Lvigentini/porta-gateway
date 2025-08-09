import { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import UsersTab from './admin/tabs/UsersTab';
import MessagingTab from './admin/tabs/MessagingTab';
import RolesUserView from './admin/tabs/RolesUserView';
import AppsTab from './admin/tabs/AppsTab';
import UsersAddForm from './admin/tabs/UsersAddForm';
import TabsHeader from './admin/tabs/TabsHeader';
import useUsers from '../hooks/admin/useUsers';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
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

// Messaging UI is moved into `MessagingTab`

export function AdminDashboard() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'apps' | 'users' | 'roles' | 'messaging'>('apps');

  // Login state
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState('');
  const [, setSuccess] = useState('');

  // App management state
  const [apps, setApps] = useState<RegisteredApp[]>([]);

  // AppsTab manages its own add-app form state

  // Messaging state removed; handled inside MessagingTab

  // UsersAddForm manages its own form state

  // User management state via hook
  const {
    users,
    usersWithAssignments,
    editingUser,
    editingRole,
    setEditingRole,
    loadUsers,
    startEditingUser,
    cancelEditingUser,
    handleUpdateUserRole,
    handleDeleteUser,
  } = useUsers({
    getToken: () => adminToken,
    onError: (msg) => setError(msg),
    onSuccess: (msg) => setSuccess(msg),
    onAuthExpired: () => handleLogout(),
    setIsLoading: (v) => setIsLoading(v),
  });

  // Roles & ACL state
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [assignmentRoles, setAssignmentRoles] = useState<{ [key: string]: string }>({});

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

  // Handle successful login from AdminLogin component
  const handleLoggedIn = async ({ token, admin }: { token: string; admin: AdminUser }) => {
    setAdminToken(token);
    setAdminUser(admin);
    setIsLoggedIn(true);
    // Ensure persisted as well (AdminLogin already does, but keep consistent)
    localStorage.setItem('porta_admin_token', token);
    localStorage.setItem('porta_admin_user', JSON.stringify(admin));
    await loadApps(token);
    await loadUsers(token);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdminUser(null);
    setAdminToken('');
    localStorage.removeItem('porta_admin_token');
    localStorage.removeItem('porta_admin_user');
    setApps([]);
    setSuccess('Logged out successfully');
  };

  // Create User handler (used by UsersAddForm)
  const createUser = async (payload: {
    email: string;
    first_name?: string;
    last_name?: string;
    role: 'admin' | 'viewer' | 'editor' | 'reviewer';
    send_welcome_email: boolean;
  }): Promise<boolean> => {
    setError(''); setSuccess(''); setIsLoading(true);
    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.success) {
        setSuccess('User created successfully');
        await loadUsers();
        return true;
      } else {
        setError(data.error || 'Failed to create user');
        if (data.error?.includes('expired')) handleLogout();
        return false;
      }
    } catch (err) {
      setError('Error creating user');
      console.error('Create user error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create App handler (used by AppsTab)
  const createApp = async (payload: {
    app_name: string;
    app_display_name: string;
    allowed_origins: string[];
    redirect_urls: string[];
  }) => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const resp = await fetch('/api/admin/apps', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.success) {
        setSuccess('App created successfully');
        await loadApps();
      } else {
        setError(data.error || 'Failed to create app');
        if (data.error?.includes('expired')) handleLogout();
      }
    } catch (err) {
      setError('Error creating app');
      console.error('Create app error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Messaging helpers removed; MessagingTab encapsulates its own API calls

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

  // loadUsers provided by useUsers

  // handleUpdateUserRole provided by useUsers

  // startEditingUser, cancelEditingUser provided by useUsers

  // Formatting helpers
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // App secret rotation
  const rotateAppSecret = async (appName: string) => {
    if (!confirm('Rotate secret for this app? This will invalidate the old secret.')) return;
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/apps?action=rotate&app_name=${encodeURIComponent(appName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'App secret rotated');
        await loadApps();
      } else {
        setError(data.error || 'Failed to rotate app secret');
        if (data.error?.includes('expired')) handleLogout();
      }
    } catch (err) {
      setError('Error rotating app secret');
      console.error('Rotate secret error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Role assignments per app
  const assignRole = async (userId: string, appName: string, roleName: string) => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ user_id: userId, app_name: appName, role_name: roleName })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Role assigned');
        loadUsers();
      } else {
        setError(data.error || 'Failed to assign role');
        if (data.error?.includes('expired')) handleLogout();
      }
    } catch (err) {
      setError('Error assigning role');
      console.error('Assign role error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeRole = async (userId: string, appName: string) => {
    if (!confirm('Revoke this user\'s role for this application?')) return;
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ user_id: userId, app_name: appName })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || 'Role revoked');
        loadUsers();
      } else {
        setError(data.error || 'Failed to revoke role');
        if (data.error?.includes('expired')) handleLogout();
      }
    } catch (err) {
      setError('Error revoking role');
      console.error('Revoke role error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Render
  if (!isLoggedIn || !adminToken || !adminUser) {
    return (
      <div>
        <AdminLogin onLoggedIn={handleLoggedIn} />
      </div>
    );
  }

  return (
    <div>
      {/* Tabs Header */}
      <TabsHeader activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'apps' && (
        <AppsTab
          apps={apps}
          isLoading={isLoading}
          formatDate={formatDate}
          rotateAppSecret={rotateAppSecret}
          onCreateApp={createApp}
        />
      )}

      {activeTab === 'users' && (
        <div>
          <UsersAddForm isLoading={isLoading} onCreateUser={createUser} />
          <UsersTab
            users={users}
            editingUser={editingUser}
            editingRole={editingRole}
            isLoading={isLoading}
            formatDate={formatDate}
            onStartEdit={startEditingUser}
            onCancelEdit={cancelEditingUser}
            onChangeRole={setEditingRole}
            onConfirmRole={handleUpdateUserRole}
            onDelete={handleDeleteUser}
          />
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <h2 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Roles</h2>
          {/* User View */}
          <RolesUserView
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            usersWithAssignments={usersWithAssignments}
            apps={apps}
            assignmentRoles={assignmentRoles}
            setAssignmentRoles={setAssignmentRoles}
            isLoading={isLoading}
            formatDate={formatDate}
            assignRole={assignRole}
            revokeRole={revokeRole}
          />
        </div>
      )}

      {activeTab === 'messaging' && (
        <div>
          <MessagingTab />
        </div>
      )}

      {/* duplicate Messaging block removed; MessagingTab is rendered earlier */}
    </div>
  );
}