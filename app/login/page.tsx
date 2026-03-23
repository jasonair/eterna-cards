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
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-red-50" />
      <div className="relative max-w-md w-full">
        <div className="rounded-3xl border border-red-200 bg-white p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">stocklane.ai</p>
            <h2 className="mt-2 text-3xl font-bold text-neutral-900">Sign in to your account</h2>
            <p className="mt-2 text-sm text-neutral-600">Access inventory and purchasing workflows.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 border border-red-200 placeholder-neutral-400 text-neutral-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Enter your email address"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 border border-red-200 placeholder-neutral-400 text-neutral-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
            )}

            {resetEmailSent && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Password reset email sent. Check your inbox.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="flex items-center justify-between">
              <button type="button" onClick={handleResetPassword} className="text-sm text-red-600 hover:text-red-700 font-medium">
                Forgot your password?
              </button>
            </div>

            <div className="text-center text-sm text-neutral-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-red-600 hover:text-red-700">
                Sign up here
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
