'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import NotificationBell from './NotificationBell';

const navItems = [
  { href: '/purchasing/view', label: 'Purchasing' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/orders', label: 'Orders' },
];

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/inventory') return pathname.startsWith('/inventory');
  if (href === '/purchasing/view') return pathname.startsWith('/purchasing/view');
  return pathname.startsWith(href + '/');
}

export default function DesktopNav() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className="hidden sm:block border-b border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <div className="px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/inventory" className="text-red-700 dark:text-red-400 font-black tracking-tight text-lg whitespace-nowrap">
            stocklane.ai
          </Link>
          <nav className="flex items-center gap-6 overflow-x-auto">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`pb-1 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${active ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:text-red-700 dark:hover:text-red-300'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell position="bottom-right" />
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-8 px-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-red-700 dark:hover:text-red-300"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <Link
            href="/account"
            className="h-8 px-2.5 inline-flex items-center text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-red-700 dark:hover:text-red-300"
          >
            Account
          </Link>
          <button
            onClick={() => signOut()}
            className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
          >
            Sign out
          </button>
          {user?.email && (
            <span className="max-w-[180px] truncate text-[11px] text-neutral-500">{user.email}</span>
          )}
        </div>
      </div>
    </header>
  );
}
