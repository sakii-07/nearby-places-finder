import Sidebar from './Sidebar';

export default function AppLayout({ title, subtitle, children, userName, userEmail, onLogout, user }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6 lg:flex-row">
        <Sidebar userName={userName} userEmail={userEmail} onLogout={onLogout} user={user} />

        <main className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <header className="mb-6 border-b border-slate-200 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
