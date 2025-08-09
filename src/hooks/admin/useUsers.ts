import { useState } from 'react';

export interface User {
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

export interface AppAssignment {
  app_name: string;
  app_display_name: string;
  role_name: string;
  role_label: string;
  granted_at: string;
}

export interface UserWithAssignments extends User {
  app_assignments: AppAssignment[];
}

interface UseUsersOptions {
  getToken: () => string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onAuthExpired?: () => void;
  setIsLoading?: (loading: boolean) => void;
}

export default function useUsers(options: UseUsersOptions) {
  const { getToken, onError, onSuccess, onAuthExpired, setIsLoading } = options;

  const [users, setUsers] = useState<User[]>([]);
  const [usersWithAssignments, setUsersWithAssignments] = useState<UserWithAssignments[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');

  const loadUsers = async (_tokenOverride?: string) => {
    try {
      const authToken = _tokenOverride || getToken();
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        const usersData = data.users || [];
        const cleanUsers: User[] = usersData.map((user: any) => ({
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
        const withAssignments: UserWithAssignments[] = usersData.map((user: any) => ({
          ...user,
          app_assignments: user.app_assignments || []
        }));
        setUsers(cleanUsers);
        setUsersWithAssignments(withAssignments);
      } else {
        onError(data.error || 'Failed to load users');
        if (data.error?.includes('expired')) onAuthExpired?.();
      }
    } catch (err) {
      onError('Error loading users');
      console.error('Load users error:', err);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    onError('');
    onSuccess('');
    setIsLoading?.(true);
    try {
      const response = await fetch(`/api/admin/users?user_id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await response.json();
      if (data.success) {
        onSuccess(`User role updated to '${newRole}' successfully!`);
        setEditingUser(null);
        setEditingRole('');
        await loadUsers();
      } else {
        onError(data.error || 'Failed to update user role');
        if (data.error?.includes('expired')) onAuthExpired?.();
      }
    } catch (err) {
      onError('Error updating user role');
      console.error('Update user role error:', err);
    } finally {
      setIsLoading?.(false);
    }
  };

  const startEditingUser = (userId: string, currentRole: string) => {
    setEditingUser(userId);
    setEditingRole(currentRole);
    onError('');
    onSuccess('');
  };

  const cancelEditingUser = () => {
    setEditingUser(null);
    setEditingRole('');
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    onError('');
    onSuccess('');
    setIsLoading?.(true);
    try {
      const response = await fetch(`/api/admin/users?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const data = await response.json();
      if (data.success) {
        onSuccess('User deleted successfully');
        await loadUsers();
      } else {
        onError(data.error || 'Failed to delete user');
        if (data.error?.includes('expired')) onAuthExpired?.();
      }
    } catch (err) {
      onError('Error deleting user');
      console.error('Delete user error:', err);
    } finally {
      setIsLoading?.(false);
    }
  };

  return {
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
  };
}
