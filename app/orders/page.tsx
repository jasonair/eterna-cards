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
        <svg className="w-5 h-5 text-[#96bf48]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.337 3.415c-.165-.07-.345-.085-.505-.04-.16.045-.295.145-.38.28l-1.12 1.73c-.19-.53-.495-1.025-.895-1.43-.815-.83-1.9-1.205-2.98-1.205-2.24 0-4.2 1.97-4.71 4.88-.54 3.08.89 5.16 3.08 5.86l-.4 1.51c-.15.555-.355 1.205-.355 1.205-.035.14-.02.29.045.42.065.13.175.23.31.28l1.34.53c.19.075.4.03.55-.115s.2-.36.14-.56l-.28-1.01 1.76-6.69c.055-.205.005-.42-.13-.58-.135-.16-.345-.24-.555-.215-.21.025-.395.145-.5.325l-.27.445c-.2-.365-.5-.66-.865-.85.315-1.205.915-2.145 1.695-2.145.575 0 .955.39 1.195.97.1.245.175.51.22.79.045.28.06.565.045.85-.045.795-.27 1.56-.645 2.25-.375.685-.895 1.27-1.515 1.705-.305.215-.43.61-.305.96.125.35.48.56.855.51.88-.12 1.71-.5 2.39-1.085.68-.585 1.19-1.345 1.47-2.195.28-.85.32-1.765.12-2.635-.2-.87-.62-1.665-1.215-2.3-.06-.065-.13-.12-.2-.17l1.36-2.1c.135-.21.15-.475.04-.695-.11-.22-.33-.36-.575-.37z"/>
        </svg>
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
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
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

    loadOrders();
  }, []);

  const handleRefresh = async () => {
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

        {/* Channel Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="font-medium text-gray-300">Channels:</span>
          <div className="flex items-center gap-1.5">
            <ChannelIcon channel="shopify" />
            <span>Shopify</span>
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
              <p className="text-xs text-gray-500 mt-1">Orders will appear here when synced from Shopify</p>
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
                            {formatDate(order.created_at)}
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
