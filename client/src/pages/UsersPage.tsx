import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { User, UserRole } from '../types';
import { format } from 'date-fns';
import { Trash2, Shield, ShieldCheck, UserCog } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const { user: currentUser } = useAuthStore();

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingRole(userId);
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      await fetchUsers();
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await api.delete(`/users/${id}`);
      setUsers(users.filter((u) => u.id !== id));
      setDeleteId(null);
    } catch (error: any) {
      alert(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return <ShieldCheck size={16} className="text-purple-500" />;
      case 'admin':
        return <Shield size={16} className="text-blue-500" />;
      default:
        return <UserCog size={16} className="text-gray-400" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'Staff';
    }
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-700';
      case 'admin':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const canChangeRole = (targetUser: User) => {
    if (!currentUser) return false;
    if (targetUser.id === currentUser.id) return false;

    // Super admin can change anyone's role except their own
    if (currentUser.role === 'superadmin') return true;

    // Admin can only change staff roles
    if (currentUser.role === 'admin') {
      return targetUser.role === 'staff';
    }

    return false;
  };

  const canDeleteUser = (targetUser: User) => {
    if (!currentUser) return false;
    if (targetUser.id === currentUser.id) return false;

    // Super admin can delete anyone except themselves
    if (currentUser.role === 'superadmin') {
      // But cannot delete the only super admin
      if (targetUser.role === 'superadmin') {
        const superAdminCount = users.filter((u) => u.role === 'superadmin').length;
        return superAdminCount > 1;
      }
      return true;
    }

    // Admin can only delete staff
    if (currentUser.role === 'admin') {
      return targetUser.role === 'staff';
    }

    return false;
  };

  const getAvailableRoles = (targetUser: User): UserRole[] => {
    if (!currentUser) return [];

    if (currentUser.role === 'superadmin') {
      return ['staff', 'admin', 'superadmin'];
    }

    if (currentUser.role === 'admin' && targetUser.role === 'staff') {
      return ['staff']; // Admin cannot promote to admin
    }

    return [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500">
            {users.length} total user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                  User
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden sm:table-cell">
                  Joined
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-openserve-green rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-gray-400">(you)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {canChangeRole(user) ? (
                      <div className="relative">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as UserRole)
                          }
                          disabled={updatingRole === user.id}
                          className={`appearance-none pl-8 pr-8 py-1.5 rounded-lg border text-sm font-medium cursor-pointer ${getRoleBadgeClass(
                            user.role
                          )} border-transparent focus:outline-none focus:ring-2 focus:ring-openserve-green`}
                        >
                          {getAvailableRoles(user).map((role) => (
                            <option key={role} value={role}>
                              {getRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          {updatingRole === user.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            getRoleIcon(user.role)
                          )}
                        </div>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {getRoleIcon(user.role)}
                        {getRoleLabel(user.role)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {format(new Date(user.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {canDeleteUser(user) ? (
                        <button
                          onClick={() => setDeleteId(user.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <div className="w-10" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Delete User?
            </h3>
            <p className="text-gray-500 mb-6">
              This action cannot be undone. The user will be permanently removed
              from the system.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
