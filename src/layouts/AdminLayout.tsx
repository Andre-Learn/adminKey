import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MonitorSmartphone,
  ScrollText,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/generate', label: 'Generate License', icon: KeyRound, end: false },
  { to: '/admin/licenses', label: 'License List', icon: ListChecks, end: false },
  { to: '/admin/devices', label: 'User Devices', icon: MonitorSmartphone, end: false },
  { to: '/admin/logs', label: 'License Logs', icon: ScrollText, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">E</span>
      <span className="text-base font-semibold tracking-tight">Epen License</span>
    </div>
  );
}

export function AdminLayout() {
  const { admin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (open) setOpen(false);
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Brand />
        <button type="button" className="btn btn-ghost p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Menu admin">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/15 text-accent-soft' : 'text-muted hover:bg-raised hover:text-ink'
              }`
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <p className="truncate px-3 pb-2 text-xs text-muted" title={admin?.email ?? undefined}>
          {admin?.email}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-bad/10 hover:text-bad"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">{sidebar}</aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <button type="button" className="btn btn-ghost p-2" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Brand />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
