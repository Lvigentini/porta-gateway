import React, { useState } from 'react';

export type NewUserPayload = {
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'viewer' | 'editor' | 'reviewer';
  send_welcome_email: boolean;
};

interface UsersAddFormProps {
  isLoading: boolean;
  onCreateUser: (payload: NewUserPayload) => Promise<boolean> | boolean;
}

const UsersAddForm: React.FC<UsersAddFormProps> = ({ isLoading, onCreateUser }) => {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer' | 'editor' | 'reviewer'>('viewer');
  const [sendWelcome, setSendWelcome] = useState(true);

  const handleCreate = async () => {
    const ok = await onCreateUser({
      email: email.trim(),
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      role,
      send_welcome_email: sendWelcome,
    });
    if (ok) {
      setShow(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('viewer');
      setSendWelcome(true);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Users</h2>
        <button
          onClick={() => setShow(v => !v)}
          style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >{show ? 'Cancel' : 'Add User'}</button>
      </div>

      {show && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as any)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem', background: 'white' }}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Optional"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Optional"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.5rem' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input id="welcomeEmail" type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)} />
              <label htmlFor="welcomeEmail" style={{ fontSize: '0.875rem', color: '#374151' }}>Send welcome email</label>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >Create User</button>
            <button onClick={() => setShow(false)} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersAddForm;
