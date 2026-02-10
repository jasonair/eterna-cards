'use client';

import { Fragment, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';

interface LineItem {
  variant_id: number;
  sku: string | null;
  title: string;
  quantity: number;
  price: string;
}

interface InventoryEffect {
  product_id: string;
  quantity_change: number;
  product_name?: string;
}

interface Order {
  id: string;
  shopify_order_id: string;
  order_number: string;
  channel: string;
  status: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer_email: string | null;
  customer_name: string | null;
  total_price: number;
  currency: string;
  line_items: LineItem[];
  processed_at: string | null;
  created_at: string;
  inventory_effects: InventoryEffect[];
}

const ChannelIcon = ({ channel }: { channel: string }) => {
  switch (channel) {
    case 'shopify':
      return (
        <img src="/Shopify_icon.svg" alt="Shopify" className="w-5 h-5" />
      );
    case 'ebay':
      return (
        <svg className="w-5 h-5 text-[#e53238]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.457 6.75c-2.583 0-4.457 1.545-4.457 4.134 0 2.01 1.158 4.116 4.66 4.116.842 0 1.683-.123 2.463-.37v.87c0 1.33-.746 1.793-2.258 1.793-.905 0-1.79-.175-2.595-.497l-.493 1.73c.994.37 2.05.545 3.13.545 2.627 0 4.27-1.05 4.27-3.578v-8.49h-1.914l-.175.68c-.69-.545-1.587-.933-2.63-.933zm.287 1.778c1.357 0 2.195.82 2.195 2.35 0 1.545-.838 2.365-2.175 2.365-1.397 0-2.237-.765-2.237-2.33 0-1.545.82-2.385 2.217-2.385z"/>
        </svg>
      );
    case 'amazon':
      return (
        <svg className="w-5 h-5 text-[#ff9900]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/>
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
  }
};

const StatusBadge = ({ status, type }: { status: string | null; type: 'financial' | 'fulfillment' }) => {
  if (!status) return <span className="text-xs text-gray-500">—</span>;

  const colors: Record<string, string> = {
    paid: 'bg-green-900/50 text-green-300 border-green-700',
    pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    refunded: 'bg-red-900/50 text-red-300 border-red-700',
    fulfilled: 'bg-blue-900/50 text-blue-300 border-blue-700',
    unfulfilled: 'bg-gray-800 text-gray-300 border-gray-600',
    partial: 'bg-orange-900/50 text-orange-300 border-orange-700',
  };

  const color = colors[status.toLowerCase()] || 'bg-gray-800 text-gray-300 border-gray-600';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {status}
    </span>
  );
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkShopifyStatus();
    loadOrders();
  }, []);

  const checkShopifyStatus = async () => {
    try {
      const res = await authenticatedFetch('/api/account');
      const json = await res.json();
      if (json.success) {
        setShopifyConnected(json.data.settings.shopifyConnected);
      }
    } catch {
      // Silently fail - non-critical
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authenticatedFetch('/api/orders');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load orders');
      }
      setOrders(json.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSyncMessage(null);
      const res = await authenticatedFetch('/api/orders/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to sync orders');
      }
      setSyncMessage(json.message);
      // Reload orders after sync
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync orders');
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    await loadOrders();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
    return `${symbol}${amount.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-4 sm:py-6 px-3 sm:px-4 lg:px-6 md:pl-0">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Orders</h1>
            <p className="text-sm text-gray-400 mt-1">
              Orders synced from sales channels
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {shopifyConnected && (
              <button
                onClick={handleSync}
                disabled={syncing || loading}
                className="inline-flex items-center px-4 py-2 border border-[#96bf48] text-sm font-medium rounded-md text-[#96bf48] bg-transparent hover:bg-[#96bf48]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#96bf48] transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? 'Syncing...' : 'Sync Shopify'}
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#ff6b35] hover:bg-[#ff8c42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6b35] transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Shopify Connection Banner */}
        {shopifyConnected === false && (
          <div className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#96bf48]/10 flex items-center justify-center">
                <ChannelIcon channel="shopify" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">Connect your Shopify store</p>
                <p className="text-xs text-gray-500">Link your Shopify account to sync orders automatically</p>
              </div>
            </div>
            <a
              href="/account"
              className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-[#96bf48] text-white hover:bg-[#a8d14f] transition-colors"
            >
              Connect
            </a>
          </div>
        )}

        {/* Sync Message */}
        {syncMessage && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-sm text-green-300 flex items-center justify-between">
            <span>{syncMessage}</span>
            <button onClick={() => setSyncMessage(null)} className="text-green-500 hover:text-green-300 ml-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Channel Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="font-medium text-gray-300">Channels:</span>
          <div className="flex items-center gap-1.5">
            <ChannelIcon channel="shopify" />
            <span>Shopify{shopifyConnected ? '' : ' (not connected)'}</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
            <ChannelIcon channel="ebay" />
            <span>eBay (coming)</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
            <ChannelIcon channel="amazon" />
            <span>Amazon (coming)</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#3a2a2a] border border-red-500 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-[#191919] rounded-xl border border-[#3a3a3a] overflow-hidden shadow-sm shadow-black/30">
          {loading && orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm">No orders yet</p>
              {shopifyConnected ? (
                <>
                  <p className="text-xs text-gray-500 mt-1">Click &quot;Sync Shopify&quot; to pull your latest orders</p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-[#96bf48] hover:bg-[#a8d14f] transition-colors disabled:opacity-50"
                  >
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mt-1">Connect your Shopify store to start syncing orders</p>
                  <a
                    href="/account"
                    className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-[#96bf48] hover:bg-[#a8d14f] transition-colors"
                  >
                    Connect Shopify
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#3a3a3a]">
                <thead className="bg-[#222222]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-10">
                      Ch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Fulfillment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Inventory
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {orders.map((order) => (
                    <Fragment key={order.id}>
                      <tr
                        className="hover:bg-[#222222] cursor-pointer transition-colors"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        <td className="px-4 py-3">
                          <ChannelIcon channel={order.channel} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-100">
                            #{order.order_number}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-100">{order.customer_name || '—'}</div>
                          <div className="text-xs text-gray-500">{order.customer_email || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-100">
                            {formatCurrency(order.total_price, order.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.financial_status} type="financial" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.fulfillment_status} type="fulfillment" />
                        </td>
                        <td className="px-4 py-3">
                          {order.inventory_effects.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-400">
                                -{order.inventory_effects.reduce((sum, e) => sum + Math.abs(e.quantity_change), 0)}
                              </span>
                              <span className="text-xs text-gray-500">units</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-400">
                            {formatDate(order.processed_at || order.created_at)}
                          </div>
                        </td>
                      </tr>
                      {expandedOrderId === order.id && (
                        <tr key={`${order.id}-details`} className="bg-[#1f1f1f]">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Line Items */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-300 uppercase mb-2">Line Items</h4>
                                <div className="space-y-1">
                                  {order.line_items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm bg-[#2a2a2a] rounded px-3 py-2">
                                      <span className="text-gray-200 truncate flex-1">{item.title}</span>
                                      <span className="text-gray-400 ml-2">×{item.quantity}</span>
                                      <span className="text-gray-300 ml-3">{formatCurrency(parseFloat(item.price), order.currency)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Inventory Effects */}
                              <div>
                                <h4 className="text-xs font-semibold text-gray-300 uppercase mb-2">Inventory Changes</h4>
                                {order.inventory_effects.length > 0 ? (
                                  <div className="space-y-1">
                                    {order.inventory_effects.map((effect, idx) => (
                                      <div key={idx} className="flex justify-between text-sm bg-[#2a2a2a] rounded px-3 py-2">
                                        <span className="text-gray-200 truncate flex-1">
                                          {effect.product_name || effect.product_id.slice(0, 8)}
                                        </span>
                                        <span className={`font-medium ${effect.quantity_change < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                          {effect.quantity_change > 0 ? '+' : ''}{effect.quantity_change}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500">No inventory changes recorded</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
