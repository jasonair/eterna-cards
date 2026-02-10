'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const mainNav: NavItem[] = [
  {
    href: '/purchasing/import',
    label: 'Import invoice',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/purchasing/view',
    label: 'Purchase orders',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7 8h10M7 12h6M7 16h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="4"
          y="4"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <rect
          x="13"
          y="4"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <rect
          x="4"
          y="13"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <rect
          x="13"
          y="13"
          width="7"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === '/inventory') {
    // Treat inventory detail pages as active
    return pathname.startsWith('/inventory');
  }
  return pathname.startsWith(href + '/');
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <aside
      className={`hidden sm:flex sm:fixed sm:inset-y-0 sm:left-0 flex-col bg-[#141414] border-r border-[#2a2a2a] text-gray-400 z-30 transition-[width] duration-200 ${
        collapsed ? 'w-24' : 'w-48 lg:w-56'
      }`}
    >
      <div className="relative flex flex-col items-center justify-between flex-1 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="hidden sm:flex absolute top-1/2 -right-4 h-8 w-8 -translate-y-1/2 transform items-center justify-center rounded-full border border-[#2a2a2a] bg-[#1b1b1b] hover:bg-[#222222] text-gray-300 shadow-md transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <svg
            className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14.5 6l-5 6 5 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {/* Top: toggle + logo + main navigation */}
        <div className="flex flex-col items-start gap-4 w-full">
          <div className="w-full flex items-start justify-center px-3">
            <div
              className={`rounded-full bg-[#ff6b35] overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 ${
                collapsed ? 'h-10 w-10' : 'h-16 w-16'
              }`}
            >
              <span className="text-white font-bold text-lg">SL</span>
            </div>
          </div>
          <nav className="flex flex-col items-start gap-2 mt-2 w-full">
            {mainNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center transition-all duration-200 ${
                    collapsed ? 'justify-center px-0 gap-0' : 'justify-start px-4 gap-2'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center transition-colors ${
                      collapsed ? 'w-9 h-9 rounded-full' : 'w-10 h-10 rounded-xl'
                    } ${
                      active
                        ? 'bg-[#ff6b35] text-white shadow-md'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-[#242424]'
                    }`}
                  >
                    <span className="sr-only">{item.label}</span>
                    {item.icon}
                  </div>
                  <span
                    className={`text-sm font-semibold tracking-tight whitespace-nowrap transition-all duration-150 ${
                      active ? 'text-gray-100' : 'text-gray-500'
                    } ${collapsed ? 'hidden' : 'block'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: User profile */}
        <div className="flex flex-col items-center w-full px-3">
          <div className="w-full border-t border-[#2a2a2a] pt-4">
            {user && (
              <div className="flex flex-col items-center gap-2">
                {!collapsed && (
                  <div className="text-center">
                    <p className="text-xs text-gray-400 truncate max-w-[160px]">
                      {user.email}
                    </p>
                  </div>
                )}
                <Link
                  href="/account"
                  className={`flex items-center justify-center transition-colors ${
                    collapsed ? 'w-9 h-9 rounded-full' : 'w-full px-3 py-2 rounded-xl gap-2'
                  } ${
                    isActivePath(pathname, '/account')
                      ? 'bg-[#ff6b35] text-white'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#242424]'
                  }`}
                  title="Account settings"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {!collapsed && (
                    <span className="text-sm font-medium">Account</span>
                  )}
                </Link>
                <button
                  onClick={handleSignOut}
                  className={`flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-[#242424] transition-colors ${
                    collapsed ? 'w-9 h-9 rounded-full' : 'w-full px-3 py-2 rounded-xl gap-2'
                  }`}
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {!collapsed && (
                    <span className="text-sm font-medium">Sign out</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
