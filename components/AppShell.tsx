'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#1a1a1a]">
      <MobileNav />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
      />
      <main
        className={`flex-1 pb-20 sm:pb-0 pt-16 sm:pt-0 transition-[margin-left] duration-200 overflow-x-hidden min-w-0 ${
          collapsed ? 'sm:ml-24' : 'sm:ml-48 lg:ml-56'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
