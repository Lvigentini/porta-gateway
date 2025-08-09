import UsersList from '../shared/UsersList';

export interface UsersTabProps {
  users: Array<{
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    role: string;
    created_at: string;
    updated_at: string;
    last_login_at?: string;
  }>;
  editingUser: string | null;
  editingRole: string;
  isLoading: boolean;
  formatDate: (dateString?: string) => string;
  onStartEdit: (userId: string, currentRole: string) => void;
  onCancelEdit: () => void;
  onChangeRole: (role: string) => void;
  onConfirmRole: (userId: string, newRole: string) => void;
  onDelete: (userId: string) => void;
}

export default function UsersTab(props: UsersTabProps) {
  const {
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
  } = props;

  return (
    <div>
      <UsersList
        users={users}
        editingUser={editingUser}
        editingRole={editingRole}
        isLoading={isLoading}
        formatDate={formatDate}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onChangeRole={onChangeRole}
        onConfirmRole={onConfirmRole}
        onDelete={onDelete}
      />
    </div>
  );
}
