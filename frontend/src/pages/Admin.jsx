import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import FormInput from '../components/common/FormInput';
import { useAuth } from '../context/useAuth';
import { authApi } from '../services/api';

const EMPTY_USER_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'user',
};

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    let active = true;
    authApi
      .listUsers()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message || 'Unable to load users.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password || !newUser.confirmPassword) {
      setErrorMessage('Please complete all required fields.');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      setErrorMessage('Password and Confirm Password must match.');
      return;
    }

    setIsCreating(true);
    try {
      const createdUser = await authApi.createUser({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      });
      setSuccessMessage(`${createdUser.name} was added successfully.`);
      setIsFormOpen(false);
      setNewUser(EMPTY_USER_FORM);
      try {
        setUsers(await authApi.listUsers());
      } catch (error) {
        setErrorMessage(`User was created, but the list could not be refreshed: ${error.message}`);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to create the user.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!editUser?.name.trim() || !editUser.email.trim()) {
      setErrorMessage('Full Name and Email are required.');
      return;
    }

    setIsUpdating(true);
    try {
      const updatedUser = await authApi.updateUser(editingUser.id, {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
      });
      setSuccessMessage(`${updatedUser.name} was updated successfully.`);
      setEditingUser(null);
      setEditUser(null);
      try {
        setUsers(await authApi.listUsers());
      } catch (error) {
        setErrorMessage(`User was updated, but the list could not be refreshed: ${error.message}`);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to update the user.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (person) => {
    if (person.id === user?.id) return;
    if (!window.confirm(`Delete "${person.name}"? This cannot be undone.`)) return;

    setErrorMessage('');
    setSuccessMessage('');
    setDeletingUserId(person.id);
    try {
      await authApi.deleteUser(person.id);
      setSuccessMessage(`${person.name} was deleted successfully.`);
      try {
        setUsers(await authApi.listUsers());
      } catch (error) {
        setErrorMessage(`User was deleted, but the list could not be refreshed: ${error.message}`);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete the user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <AppLayout
      title="Admin"
      subtitle="Manage access, roles, and user accounts."
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      onLogout={logout}
      user={user}
    >
      <section className="space-y-4" aria-label="Admin dashboard">
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {successMessage}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Role</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 capitalize">{user?.role || 'user'}</p>
            </div>
            <Button variant="secondary" type="button" onClick={() => window.history.back()}>
              Back
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Registered users</h2>
            <Button
              type="button"
              onClick={() => {
                setIsFormOpen((isOpen) => !isOpen);
                setEditingUser(null);
                setEditUser(null);
                setErrorMessage('');
                setSuccessMessage('');
              }}
            >
              + Add New User
            </Button>
          </div>

          {isFormOpen ? (
            <form className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2" onSubmit={handleCreateUser}>
              <FormInput
                id="new-user-name"
                label="Full Name"
                value={newUser.name}
                onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                autoComplete="name"
                required
              />
              <FormInput
                id="new-user-email"
                label="Email"
                type="email"
                value={newUser.email}
                onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                required
              />
              <FormInput
                id="new-user-password"
                label="Password"
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                autoComplete="new-password"
                required
              />
              <FormInput
                id="new-user-confirm-password"
                label="Confirm Password"
                type="password"
                value={newUser.confirmPassword}
                onChange={(event) => setNewUser((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
                required
              />
              <label className="space-y-2 text-sm font-medium text-slate-700" htmlFor="new-user-role">
                Role
                <select
                  id="new-user-role"
                  value={newUser.role}
                  onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create User'}
                </Button>
                <Button
                  type="button"
                  className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                  disabled={isCreating}
                  onClick={() => {
                    setIsFormOpen(false);
                    setNewUser(EMPTY_USER_FORM);
                    setErrorMessage('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {editingUser && editUser ? (
            <form
              className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
              onSubmit={handleUpdateUser}
            >
              <FormInput
                id="edit-user-name"
                label="Full Name"
                value={editUser.name}
                onChange={(event) => setEditUser((current) => ({ ...current, name: event.target.value }))}
                autoComplete="name"
                required
              />
              <FormInput
                id="edit-user-email"
                label="Email"
                type="email"
                value={editUser.email}
                onChange={(event) => setEditUser((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                required
              />
              <label className="space-y-2 text-sm font-medium text-slate-700" htmlFor="edit-user-role">
                Role
                <select
                  id="edit-user-role"
                  value={editUser.role}
                  onChange={(event) => setEditUser((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Updating…' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isUpdating}
                  onClick={() => {
                    setEditingUser(null);
                    setEditUser(null);
                    setErrorMessage('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500" role="status">Loading users…</p>
          ) : users.length ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((person) => (
                    <tr key={person.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{person.name}</td>
                      <td className="px-3 py-2 text-slate-600">{person.email}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold capitalize text-blue-700">
                          {person.role}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="enabled:!bg-[#2563EB] enabled:!text-white enabled:hover:!bg-[#1D4ED8]"
                            disabled={isUpdating || deletingUserId !== null}
                            onClick={() => {
                              setIsFormOpen(false);
                              setEditingUser(person);
                              setEditUser({
                                name: person.name,
                                email: person.email,
                                role: person.role,
                              });
                              setErrorMessage('');
                              setSuccessMessage('');
                            }}
                          >
                            Update
                          </Button>
                          <Button
                            type="button"
                            className="enabled:!bg-[#DC2626] enabled:!text-white enabled:hover:!bg-[#B91C1C]"
                            variant="primary"
                            disabled={person.id === user?.id || deletingUserId !== null || isUpdating}
                            title={person.id === user?.id ? 'You cannot delete your own account.' : undefined}
                            onClick={() => handleDeleteUser(person)}
                          >
                            {deletingUserId === person.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No users found.</p>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
