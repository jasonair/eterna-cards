'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabaseClient';

export default function AccountPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setEmailSaving(true);
    setEmailMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

      if (!error) {
        setEmailMessage({ type: 'success', text: 'A confirmation link has been sent to your new email address.' });
        setNewEmail('');
      } else {
        setEmailMessage({ type: 'error', text: error.message || 'Failed to update email' });
      }
    } catch {
      setEmailMessage({ type: 'error', text: 'Failed to update email' });
    } finally {
      setEmailSaving(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-8">Account Settings</h1>

        <section className="bg-white dark:bg-neutral-800 border border-red-200/80 dark:border-neutral-700 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Appearance</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">Select your preferred look.</p>
          <div className="flex gap-2 flex-wrap">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'border-red-100 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-red-50 dark:hover:bg-neutral-700'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-neutral-800 border border-red-200/80 dark:border-neutral-700 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Email Address</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
            Current email: <span className="text-neutral-800 dark:text-neutral-100">{user?.email}</span>
          </p>

          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                New email address
              </label>
              <input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-red-200 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            {emailMessage && (
              <div className={`text-sm px-3 py-2 rounded-lg ${emailMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {emailMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={emailSaving || !newEmail.trim()}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {emailSaving ? 'Updating...' : 'Update Email'}
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-neutral-800 border border-red-200/80 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Integrations</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Integration controls are temporarily hidden while the rebuilt account experience is finalized.
          </p>
        </section>
      </div>
    </div>
  );
}
