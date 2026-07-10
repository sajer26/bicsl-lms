import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/hospitals', label: 'Hospitals' },
  { to: '/admin/learners', label: 'Learners' },
  { to: '/admin/modules', label: 'Modules' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit-log', label: 'Audit Log' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-brand-50">
      <AppHeader />
      <div className="max-w-6xl mx-auto flex gap-6 px-4 py-6">
        <aside className="w-48 shrink-0 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-500 text-white' : 'text-brand-700 hover:bg-brand-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
