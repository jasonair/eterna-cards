'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

interface AccountSettings {
  shopifyStoreDomain: string | null;
  shopifyConnected: boolean;
  shopifyConnectedAt: string | null;
}

export default function AccountPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Shopify form
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifySaving, setShopifySaving] = useState(false);
  const [shopifyMessage, setShopifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();

    // Check for OAuth callback params
    const shopifyStatus = searchParams.get('shopify');
    if (shopifyStatus === 'connected') {
      setShopifyMessage({ type: 'success', text: 'Shopify account connected successfully!' });
    } else if (shopifyStatus === 'error') {
      const msg = searchParams.get('message') || 'Failed to connect Shopify';
      setShopifyMessage({ type: 'error', text: msg });
    }
  }, [searchParams]);

  const loadSettings = async () => {
    try {
      const res = await authenticatedFetch('/api/account');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data.settings);
        if (data.data.settings.shopifyStoreDomain) {
          setShopifyDomain(data.data.settings.shopifyStoreDomain);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setEmailSaving(true);
    setEmailMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

      if (!error) {
        setEmailMessage({ type: 'success', text: 'A confirmation link has been sent to your new email address. Please click it to complete the change.' });
        setNewEmail('');
      } else {
        setEmailMessage({ type: 'error', text: error.message || 'Failed to update email' });
      }
    } catch (err) {
      setEmailMessage({ type: 'error', text: 'Failed to update email' });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleConnectShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDomain.trim()) return;

    setShopifyConnecting(true);
    setShopifyMessage(null);

    try {
      // Call our OAuth initiation endpoint to get the Shopify auth URL
      const res = await authenticatedFetch(
        `/api/auth/shopify?shop=${encodeURIComponent(shopifyDomain.trim())}`
      );
      const data = await res.json();

      if (data.success && data.authUrl) {
        // Redirect to Shopify's OAuth consent screen
        window.location.href = data.authUrl;
      } else {
        setShopifyMessage({ type: 'error', text: data.error || 'Failed to start Shopify connection' });
        setShopifyConnecting(false);
      }
    } catch (err) {
      setShopifyMessage({ type: 'error', text: 'Failed to connect to Shopify' });
      setShopifyConnecting(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!confirm('Are you sure you want to disconnect your Shopify account?')) return;

    setShopifySaving(true);
    setShopifyMessage(null);

    try {
      const res = await authenticatedFetch('/api/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_shopify' }),
      });
      const data = await res.json();

      if (data.success) {
        setShopifyMessage({ type: 'success', text: data.message });
        setSettings({
          shopifyStoreDomain: null,
          shopifyConnected: false,
          shopifyConnectedAt: null,
        });
        setShopifyDomain('');
      } else {
        setShopifyMessage({ type: 'error', text: data.error || 'Failed to disconnect' });
      }
    } catch (err) {
      setShopifyMessage({ type: 'error', text: 'Failed to disconnect Shopify' });
    } finally {
      setShopifySaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b35]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-8">Account Settings</h1>

      {/* Email Section */}
      <section className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Email Address</h2>
        <p className="text-sm text-gray-500 mb-4">
          Current email: <span className="text-gray-300">{user?.email}</span>
        </p>

        <form onSubmit={handleUpdateEmail} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium text-gray-400 mb-1">
              New email address
            </label>
            <input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className="w-full px-3 py-2 bg-[#141414] border border-[#3a3a3a] rounded-lg text-gray-100 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent"
              required
            />
          </div>

          {emailMessage && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                emailMessage.type === 'success'
                  ? 'bg-green-900/30 text-green-400 border border-green-800'
                  : 'bg-red-900/30 text-red-400 border border-red-800'
              }`}
            >
              {emailMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={emailSaving || !newEmail.trim()}
            className="px-4 py-2 bg-[#ff6b35] text-white text-sm font-medium rounded-lg hover:bg-[#ff8c42] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {emailSaving ? 'Updating...' : 'Update Email'}
          </button>
        </form>
      </section>

      {/* Shopify Section */}
      <section className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <img src="/Shopify_icon.svg" alt="Shopify" className="w-6 h-6" />
          <h2 className="text-lg font-semibold text-gray-100">Shopify Integration</h2>
          {settings?.shopifyConnected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Connected
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Link your Shopify store to sync orders and inventory.
        </p>

        {settings?.shopifyConnected ? (
          <div className="space-y-4">
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    {settings.shopifyStoreDomain}
                  </p>
                  {settings.shopifyConnectedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Connected {new Date(settings.shopifyConnectedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <img src="/Shopify_icon.svg" alt="Shopify" className="w-8 h-8" />
              </div>
            </div>

            {shopifyMessage && (
              <div
                className={`text-sm px-3 py-2 rounded-lg ${
                  shopifyMessage.type === 'success'
                    ? 'bg-green-900/30 text-green-400 border border-green-800'
                    : 'bg-red-900/30 text-red-400 border border-red-800'
                }`}
              >
                {shopifyMessage.text}
              </div>
            )}

            <button
              onClick={handleDisconnectShopify}
              disabled={shopifySaving}
              className="px-4 py-2 bg-[#2a2a2a] text-red-400 text-sm font-medium rounded-lg hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#3a3a3a]"
            >
              {shopifySaving ? 'Disconnecting...' : 'Disconnect Shopify'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnectShopify} className="space-y-4">
            <div>
              <label htmlFor="shopifyDomain" className="block text-sm font-medium text-gray-400 mb-1">
                Store domain
              </label>
              <input
                id="shopifyDomain"
                type="text"
                value={shopifyDomain}
                onChange={(e) => setShopifyDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="w-full px-3 py-2 bg-[#141414] border border-[#3a3a3a] rounded-lg text-gray-100 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                e.g. your-store.myshopify.com
              </p>
            </div>

            {shopifyMessage && (
              <div
                className={`text-sm px-3 py-2 rounded-lg ${
                  shopifyMessage.type === 'success'
                    ? 'bg-green-900/30 text-green-400 border border-green-800'
                    : 'bg-red-900/30 text-red-400 border border-red-800'
                }`}
              >
                {shopifyMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={shopifyConnecting || !shopifyDomain.trim()}
              className="px-4 py-2 bg-[#96bf48] text-white text-sm font-medium rounded-lg hover:bg-[#a8d14f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              <img src="/Shopify_icon.svg" alt="Shopify" className="w-4 h-4" />
              {shopifyConnecting ? 'Redirecting to Shopify...' : 'Connect with Shopify'}
            </button>
            <p className="text-xs text-gray-600">
              You&apos;ll be redirected to Shopify to authorize access to your store.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
