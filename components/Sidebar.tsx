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

const secondaryNav: NavItem[] = [
  {
    href: '#',
    label: 'Notifications',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3a4 4 0 0 0-4 4v2.586c0 .53-.211 1.039-.586 1.414L6 12.414V14h12v-1.586l-1.414-1.414A2 2 0 0 1 16 9.586V7a4 4 0 0 0-4-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 17a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '#',
    label: 'Settings',
    icon: (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 9a1 1 0 0 0 .2-1.1l-1.2-2.1a1 1 0 0 0-1.1-.5l-1.5.4a1 1 0 0 1-1.1-.4L13 3.7a1 1 0 0 0-1-.7h-2a1 1 0 0 0-1 .7L8.3 5.3a1 1 0 0 1-1.1.4L5.7 5.3a1 1 0 0 0-1.1.5L3.4 7.9A1 1 0 0 0 3.6 9l1.2 1.3a1 1 0 0 1 .2 1v1.4a1 1 0 0 1-.2 1l-1.2 1.3a1 1 0 0 0-.2 1.1l1.2 2.1a1 1 0 0 0 1.1.5l1.5-.4a1 1 0 0 1 1.1.4L9 20.3a1 1 0 0 0 1 .7h2a1 1 0 0 0 1-.7l.7-1.6a1 1 0 0 1 1.1-.4l1.5.4a1 1 0 0 0 1.1-.5l1.2-2.1a1 1 0 0 0-.2-1.1l-1.2-1.3a1 1 0 0 1-.2-1v-1.4a1 1 0 0 1 .2-1L19.4 9Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === '/inventory') {
    // Treat inventory detail pages as active
    return pathname.startsWith('/inventory');
  }
  return pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden sm:flex flex-col w-48 lg:w-56 bg-[#141414] border-r border-[#2a2a2a] text-gray-400">
      <div className="flex flex-col items-center justify-between flex-1 py-4">
        {/* Top: logo + main navigation */}
        <div className="flex flex-col items-start gap-4 w-full">
          <div className="w-full flex justify-center">
            <div className="h-16 w-16 rounded-full bg-[#ff6b35] overflow-hidden flex items-center justify-center shadow-lg">
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
                  className="w-full flex items-center justify-start gap-2 px-4"
                >
                  <div
                    className={`flex items-center justify-center rounded-xl w-10 h-10 transition-colors ${
                      active
                        ? 'bg-[#ff6b35] text-white shadow-md'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-[#242424]'
                    }`}
                  >
                    <span className="sr-only">{item.label}</span>
                    {item.icon}
                  </div>
                  <span
                    className={`text-sm font-semibold tracking-tight whitespace-nowrap ${
                      active ? 'text-gray-100' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: secondary navigation */}
        <nav className="flex flex-col items-center gap-2 w-full">
          {secondaryNav.map((item) => (
            <button
              key={item.label}
              type="button"
              className="w-full flex items-center justify-center text-gray-500 hover:text-gray-100 hover:bg-[#242424] rounded-xl h-9 transition-colors"
              aria-label={item.label}
            >
              {item.icon}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
