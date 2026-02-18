'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { signIn, resetPassword, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message || 'Failed to sign in');
      setLoading(false);
    } else {
      // Redirect will happen automatically due to auth state change
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setError('');
    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message || 'Failed to send reset email');
    } else {
      setResetEmailSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f8] dark:bg-stone-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900 dark:text-stone-100">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">
            Access your inventory and purchase orders
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 placeholder-stone-400 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 rounded-md focus:outline-none focus:ring-amber-600 focus:border-amber-600 focus:z-10 sm:text-sm"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 placeholder-stone-400 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 rounded-md focus:outline-none focus:ring-amber-600 focus:border-amber-600 focus:z-10 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {resetEmailSent && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3">
              <div className="text-sm text-green-700">
                Password reset email sent! Check your inbox.
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-sm text-amber-600 hover:text-amber-700"
            >
              Forgot your password?
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-stone-500 dark:text-stone-400">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-700">
                Sign up here
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
