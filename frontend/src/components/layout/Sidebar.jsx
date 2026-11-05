import { NavLink } from 'react-router-dom';

export default function Sidebar({ userName, userEmail, onLogout, user = null }) {
  const isAdmin = user?.role === 'admin';
  const navItems = [
    { label: 'Overview', to: isAdmin ? '/admin/dashboard' : '/dashboard' },
    { label: 'Places', to: '/places' },
    { label: 'Favorites', to: '/favorites' },
    { label: 'Settings', to: '/settings' },
    ...(isAdmin ? [{ label: 'Admin', to: '/admin' }] : []),
  ];

  return (
    <aside className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:w-72 lg:w-80">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
          NP
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Nearby</p>
          <h2 className="text-lg font-bold text-slate-900">Places Finder</h2>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-500">Signed in</p>
        <p className="mt-2 text-base font-semibold text-slate-900">{userName}</p>
        <p className="text-sm text-slate-500">{userEmail}</p>
      </div>

      <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <span>{item.label}</span>
            <span className="text-xs text-slate-400">→</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
