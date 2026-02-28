// frontend/components/Layout.js
// Shared dark sidebar layout for all authenticated pages

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { LayoutDashboard, Bot, ScrollText, Users, LogOut, Shield } from 'lucide-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/logs', icon: ScrollText, label: 'Logs' },
];

const adminItems = [
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/audit', icon: Shield, label: 'Audit' },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-dark-500 flex flex-col shrink-0 h-screen sticky top-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-dark-600">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent/10 border border-accent/30 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <span className="font-display font-semibold text-white text-sm">WA Panel</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-sans transition-all
                ${router.pathname === href
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-600'}`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="px-3 pt-4 pb-1">
                <span className="text-xs font-sans uppercase tracking-widest text-dark-400">Admin</span>
              </div>
              {adminItems.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-sans transition-all
                    ${router.pathname === href
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-gray-400 hover:text-white hover:bg-dark-600'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-dark-600">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate font-sans">{user?.email}</p>
              <p className="text-xs text-dark-400">{user?.role}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-danger transition-colors w-full px-1 py-1 font-sans">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-dark-900/80 backdrop-blur border-b border-dark-600 px-6 py-4">
          <h1 className="font-display text-lg font-semibold text-white">{title}</h1>
        </div>
        <div className="p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
