'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
              <img
                src="/eterna-cards-logo-2.jpg"
                alt="Profile"
                className="h-full w-full object-cover"
              />
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
      </div>
    </aside>
  );
}
