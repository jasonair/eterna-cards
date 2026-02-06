'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/contexts/AuthContext';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on public route, show login prompt
  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111] px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-100 mb-4">Welcome to Eterna Cards</h1>
          <p className="text-gray-400 mb-8">Please sign in to access your inventory and purchase orders</p>
          <div className="space-y-4">
            <a
              href="/login"
              className="block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#ff6b35] hover:bg-[#ff8c42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6b35]"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="block w-full py-2 px-4 border border-[#3a3a3a] text-sm font-medium rounded-md text-gray-100 bg-[#2a2a2a] hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6b35]"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If on public route, render without shell
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Authenticated user - show full app shell
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
