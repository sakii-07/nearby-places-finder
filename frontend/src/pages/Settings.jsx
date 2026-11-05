import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import { useAuth } from '../context/useAuth';
import { favoritesApi } from '../services/api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [favoriteState, setFavoriteState] = useState({ count: 0, error: '' });

  useEffect(() => {
    let active = true;
    favoritesApi
      .list()
      .then((items) => {
        if (active) setFavoriteState({ count: items.length, error: '' });
      })
      .catch((error) => {
        if (active) setFavoriteState({ count: 0, error: error.message || 'Unable to load favorites.' });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppLayout
      title="Settings"
      subtitle="Manage your account and saved-place preferences."
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      onLogout={logout}
      user={user}
    >
      <div className="max-w-2xl space-y-5">
        {favoriteState.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {favoriteState.error}
          </div>
        ) : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="account-settings">
          <h2 id="account-settings" className="text-lg font-semibold text-slate-900">Account</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            <div className="py-3 sm:flex sm:justify-between sm:gap-4">
              <dt className="text-sm text-slate-500">Name</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800 sm:mt-0">{user?.name || 'Not provided'}</dd>
            </div>
            <div className="py-3 sm:flex sm:justify-between sm:gap-4">
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="mt-1 break-all text-sm font-medium text-slate-800 sm:mt-0">{user?.email || 'Not available'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="saved-places-settings">
          <h2 id="saved-places-settings" className="text-lg font-semibold text-slate-900">Saved places</h2>
          <p className="mt-2 text-sm text-slate-600">
            {favoriteState.count} {favoriteState.count === 1 ? 'favorite is' : 'favorites are'} saved in this browser.
          </p>
          <Link to="/favorites" className="mt-4 inline-block">
            <Button variant="secondary">View favorites</Button>
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}
