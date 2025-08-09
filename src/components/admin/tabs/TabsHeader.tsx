import React from 'react';

export type AdminTab = 'apps' | 'users' | 'roles' | 'messaging';

interface TabsHeaderProps {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const btnStyle = (active: boolean) => ({
  padding: '0.5rem 0.75rem',
  border: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  background: 'transparent',
  color: active ? '#1f2937' : '#6b7280',
  fontWeight: 600 as const,
  cursor: 'pointer'
});

const TabsHeader: React.FC<TabsHeaderProps> = ({ activeTab, onChange }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1rem',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '0.5rem'
    }}>
      <button onClick={() => onChange('apps')} style={btnStyle(activeTab === 'apps')}>📱 Apps</button>
      <button onClick={() => onChange('users')} style={btnStyle(activeTab === 'users')}>👤 Users</button>
      <button onClick={() => onChange('roles')} style={btnStyle(activeTab === 'roles')}>🔐 Roles</button>
      <button onClick={() => onChange('messaging')} style={btnStyle(activeTab === 'messaging')}>✉️ Messaging</button>
    </div>
  );
};

export default TabsHeader;
