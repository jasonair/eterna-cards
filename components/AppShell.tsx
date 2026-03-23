'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MobileNav from '@/components/MobileNav';
import DesktopNav from '@/components/DesktopNav';
import { useAuth } from '@/contexts/AuthContext';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const publicRoutes = ['/login', '/signup', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900 px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">stocklane.ai</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-8">Sign in to continue to your dashboard.</p>
          <div className="space-y-3">
            <a
              href="/login"
              className="block w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="block w-full py-2.5 px-4 border border-stone-200 dark:border-neutral-600 text-sm font-medium rounded-lg text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 hover:bg-white dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
      <MobileNav />
      <DesktopNav />
      <main className="flex-1 pb-20 sm:pb-0 pt-14 sm:pt-0 overflow-hidden min-w-0 flex flex-col">
        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
