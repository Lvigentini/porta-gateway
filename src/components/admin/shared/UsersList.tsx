import React from 'react';

export interface AdminUserItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at?: string | null;
}

interface UsersListProps {
  users: AdminUserItem[];
  editingUser: string | null;
  editingRole: string;
  isLoading: boolean;
  formatDate: (iso: string) => string;
  onStartEdit: (userId: string, currentRole: string) => void;
  onCancelEdit: () => void;
  onChangeRole: (role: string) => void;
  onConfirmRole: (userId: string, role: string) => void;
  onDelete: (userId: string) => void;
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  editingUser,
  editingRole,
  isLoading,
  formatDate,
  onStartEdit,
  onCancelEdit,
  onChangeRole,
  onConfirmRole,
  onDelete,
}) => {
  return (
    <div>
      {users.map((user, idx) => (
        <div
          key={user.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
            gap: '1rem',
            padding: '1rem 1.5rem',
            alignItems: 'center',
            borderBottom: idx === users.length - 1 ? 'none' : '1px solid #f3f4f6',
          }}
        >
          <div>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{user.full_name}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user.email}</div>
          </div>

          <div>
            {editingUser === user.id ? (
              <select
                value={editingRole}
                onChange={(e) => onChangeRole(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  backgroundColor:
                    user.role === 'admin'
                      ? '#fee2e2'
                      : user.role === 'editor'
                      ? '#fef3c7'
                      : user.role === 'viewer'
                      ? '#dbeafe'
                      : '#f3f4f6',
                  color:
                    user.role === 'admin'
                      ? '#dc2626'
                      : user.role === 'editor'
                      ? '#d97706'
                      : user.role === 'viewer'
                      ? '#2563eb'
                      : '#6b7280',
                }}
              >
                {user.role.toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{formatDate(user.created_at)}</div>

          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {user.last_login_at ? formatDate(user.last_login_at) : 'Never'}
          </div>

          <div>
            <span
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
              }}
            >
              ACTIVE
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editingUser === user.id ? (
              <>
                <button
                  onClick={() => onConfirmRole(user.id, editingRole)}
                  disabled={isLoading || editingRole === user.role}
                  style={{
                    backgroundColor: '#16a34a',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    cursor:
                      isLoading || editingRole === user.role ? 'not-allowed' : 'pointer',
                    opacity: isLoading || editingRole === user.role ? 0.5 : 1,
                  }}
                >
                  ✅
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  ❌
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onStartEdit(user.id, user.role)}
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => onDelete(user.id)}
                  disabled={isLoading}
                  style={{
                    marginLeft: '0.5rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default UsersList;
