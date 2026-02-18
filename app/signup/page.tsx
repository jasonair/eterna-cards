'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const { error } = await signUp(email, password, fullName);

    if (error) {
      setError(error.message || 'Failed to create account');
      setLoading(false);
    } else {
      setSuccess('Account created successfully! Check your email to verify your account.');
      setLoading(false);
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f8] dark:bg-stone-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900 dark:text-stone-100">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">
            Start managing your inventory and purchase orders
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Full Name / Company Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 placeholder-stone-400 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 rounded-md focus:outline-none focus:ring-amber-600 focus:border-amber-600 focus:z-10 sm:text-sm"
                placeholder="Enter your company name"
              />
            </div>
            
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 placeholder-stone-400 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 rounded-md focus:outline-none focus:ring-amber-600 focus:border-amber-600 focus:z-10 sm:text-sm"
                placeholder="Create a password (min. 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-stone-300 dark:border-stone-600 placeholder-stone-400 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 rounded-md focus:outline-none focus:ring-amber-600 focus:border-amber-600 focus:z-10 sm:text-sm"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-stone-500 dark:text-stone-400">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-amber-600 hover:text-amber-700">
                Sign in here
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
