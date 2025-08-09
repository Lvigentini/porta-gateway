import React from 'react';

type UserAssignment = {
  app_display_name: string;
  app_name: string;
  role_name: string;
  role_label: string;
  granted_at: string;
};

type UserWithAssignments = {
  id: string;
  full_name: string;
  email: string;
  app_assignments: UserAssignment[];
};

type App = {
  id: string;
  app_name: string;
  app_display_name: string;
};

interface RolesUserViewProps {
  selectedUser: string;
  setSelectedUser: (val: string) => void;
  usersWithAssignments: UserWithAssignments[];
  apps: App[];
  assignmentRoles: Record<string, string>;
  setAssignmentRoles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isLoading: boolean;
  formatDate: (iso: string) => string;
  assignRole: (userId: string, appName: string, role: string) => void;
  revokeRole: (userId: string, appName: string) => void;
}

const RolesUserView: React.FC<RolesUserViewProps> = ({
  selectedUser,
  setSelectedUser,
  usersWithAssignments,
  apps,
  assignmentRoles,
  setAssignmentRoles,
  isLoading,
  formatDate,
  assignRole,
  revokeRole,
}) => {
  const user = usersWithAssignments.find(u => u.id === selectedUser);

  return (
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
          {usersWithAssignments.map(u => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {user ? (
        <div>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1.125rem' }}>
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
                <div style={{ color: '#6b7280' }}>{formatDate(assignment.granted_at)}</div>
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
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  This user has no app assignments yet
                </p>
              </div>
            )}

            <div style={{ padding: '1rem', borderTop: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                Assign to New Apps:
              </h4>
              {apps
                .filter(app => !user.app_assignments.some(a => a.app_name === app.app_name))
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
                      <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>({app.app_name})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={assignmentRoles[`user-${user.id}-app-${app.app_name}`] || ''}
                        onChange={(e) => setAssignmentRoles(prev => ({
                          ...prev,
                          [`user-${user.id}-app-${app.app_name}`]: e.target.value
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
                          const role = assignmentRoles[`user-${user.id}-app-${app.app_name}`];
                          if (role) {
                            assignRole(user.id, app.app_name, role);
                            setAssignmentRoles(prev => ({
                              ...prev,
                              [`user-${user.id}-app-${app.app_name}`]: ''
                            }));
                          }
                        }}
                        disabled={!assignmentRoles[`user-${user.id}-app-${app.app_name}`] || isLoading}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: assignmentRoles[`user-${user.id}-app-${app.app_name}`] && !isLoading ? '#10b981' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: assignmentRoles[`user-${user.id}-app-${app.app_name}`] && !isLoading ? 'pointer' : 'not-allowed'
                        }}
                      >
                        {isLoading ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
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
  );
};

export default RolesUserView;
