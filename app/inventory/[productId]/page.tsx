'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams, useRouter } from 'next/navigation';

interface Supplier {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  primarySku: string | null;
  supplierSku: string | null;
  barcodes: string[];
  aliases: string[];
  supplierId: string | null;
  category: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface InventoryRecord {
  id: string;
  productId: string;
  quantityOnHand: number;
  averageCostGBP: number;
  lastUpdated: string;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  paymentTerms: string | null;
  createdAt: string;
}

interface POLine {
  id: string;
  purchaseOrderId: string;
  description: string;
  supplierSku: string | null;
  quantity: number;
  unitCostExVAT: number;
  lineTotalExVAT: number;
}

interface TransitRecord {
  id: string;
  productId: string;
  purchaseOrderId: string;
  poLineId: string;
  supplierId: string;
  quantity: number;
  remainingQuantity: number;
  unitCostGBP: number;
  status: 'in_transit' | 'partially_received' | 'received';
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  createdAt: string;
}

interface TransitWithContext {
  transit: TransitRecord;
  poLine: POLine | null;
  purchaseOrder: PurchaseOrder | null;
  invoice: Invoice | null;
}

interface ProductHistoryResponse {
  product: Product;
  inventory: InventoryRecord | null;
  supplier: Supplier | null;
  transit: TransitWithContext[];
}

export default function ProductHistoryPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const productId = params.productId;

  const [data, setData] = useState<ProductHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    category: '',
    barcodes: '',
    tags: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (!productId) return;
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/inventory/product?id=${encodeURIComponent(productId)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load product history');
        }
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product history');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [productId]);

  useEffect(() => {
    if (data?.product) {
      setEditForm({
        name: data.product.name || '',
        sku: data.product.primarySku || data.product.supplierSku || '',
        category: data.product.category || '',
        barcodes: (data.product.barcodes || []).join(', '),
        tags: (data.product.tags || []).join(', '),
      });
    }
  }, [data]);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '£0.00 GBP';
    return `£${amount.toFixed(2)} GBP`;
  };

  const handleEditFieldChange = (field: keyof typeof editForm, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProduct = async () => {
    if (!data) return;

    try {
      setSaving(true);
      setError(null);

      const normalizeList = (input: string): string[] =>
        input
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);

      const sku = editForm.sku.trim();

      const payload = {
        name: editForm.name.trim() || data.product.name,
        primarySku: sku || null,
        supplierSku: sku || null,
        category: editForm.category.trim() || null,
        barcodes: normalizeList(editForm.barcodes),
        tags: normalizeList(editForm.tags),
      };

      const res = await fetch(
        `/api/inventory/product?id=${encodeURIComponent(data.product.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update product');
      }

      const updated: Product = json.data.product;
      setData((prev) => (prev ? { ...prev, product: updated } : prev));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-300 text-sm">Loading product history...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 text-sm text-[#ff6b35] hover:text-[#ff8c42]"
          >
            ← Back
          </button>
          <div className="bg-[#3a2a2a] border border-red-500 rounded-lg p-4 text-sm text-red-200">
            {error || 'Product not found'}
          </div>
        </div>
      </div>
    );
  }

  const { product, inventory, supplier, transit } = data;

  const totalOrdered = transit.reduce((sum, t) => sum + (t.transit.quantity || 0), 0);
  const totalReceived = transit.reduce(
    (sum, t) => sum + (t.transit.quantity - (t.transit.remainingQuantity || 0)),
    0
  );

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-xs text-[#ff6b35] hover:text-[#ff8c42] mb-2"
            >
              ← Back to inventory
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 truncate">
              {product.name}
            </h1>
            <p className="text-xs text-gray-400 mt-1 truncate">
              {supplier?.name || 'Unknown supplier'}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-xs text-gray-400">
            <span>Product ID: {product.id}</span>
            <span>Created: {formatDate(product.createdAt)}</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
            <p className="text-xs text-gray-400">On hand</p>
            <p className="text-xl font-semibold text-gray-100 mt-1">
              {inventory?.quantityOnHand || 0}
            </p>
          </div>
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
            <p className="text-xs text-gray-400">In transit</p>
            <p className="text-xl font-semibold text-gray-100 mt-1">
              {transit.reduce((sum, t) => sum + (t.transit.remainingQuantity || 0), 0)}
            </p>
          </div>
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
            <p className="text-xs text-gray-400">Avg cost</p>
            <p className="text-sm font-semibold text-gray-100 mt-1">
              {formatCurrency(inventory?.averageCostGBP)}
            </p>
          </div>
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
            <p className="text-xs text-gray-400">Ordered / Received</p>
            <p className="text-sm font-semibold text-gray-100 mt-1">
              {totalReceived}/{totalOrdered}
            </p>
          </div>
        </div>

        {/* Identity section */}
        <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Identity</p>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      if (data?.product) {
                        setEditForm({
                          name: data.product.name || '',
                          sku: data.product.primarySku || data.product.supplierSku || '',
                          category: data.product.category || '',
                          barcodes: (data.product.barcodes || []).join(', '),
                          tags: (data.product.tags || []).join(', '),
                        });
                      }
                    }}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-md border border-[#3a3a3a] text-[11px] text-gray-300 hover:bg-[#3a3a3a] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProduct}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-md bg-[#ff6b35] text-white text-[11px] hover:bg-[#ff8c42] disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-md border border-[#3a3a3a] text-[11px] text-gray-300 hover:bg-[#3a3a3a]"
                >
                  Edit product
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400">Name</p>
              {editing ? (
                <input
                  value={editForm.name}
                  onChange={(e) => handleEditFieldChange('name', e.target.value)}
                  className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                />
              ) : (
                <p className="text-gray-100">{product.name}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400">SKU</p>
              {editing ? (
                <input
                  value={editForm.sku}
                  onChange={(e) => handleEditFieldChange('sku', e.target.value)}
                  className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] font-mono"
                />
              ) : (
                <p className="text-gray-100 font-mono">
                  {product.primarySku || product.supplierSku || '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-400">Barcodes</p>
              {editing ? (
                <input
                  value={editForm.barcodes}
                  onChange={(e) => handleEditFieldChange('barcodes', e.target.value)}
                  placeholder="Comma-separated"
                  className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] font-mono"
                />
              ) : (
                <p className="text-gray-100 font-mono truncate">
                  {product.barcodes && product.barcodes.length
                    ? product.barcodes.join(', ')
                    : '-'}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-400">Category</p>
              {editing ? (
                <input
                  value={editForm.category}
                  onChange={(e) => handleEditFieldChange('category', e.target.value)}
                  className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                />
              ) : (
                <p className="text-gray-100">{product.category || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400">Tags</p>
              {editing ? (
                <input
                  value={editForm.tags}
                  onChange={(e) => handleEditFieldChange('tags', e.target.value)}
                  placeholder="Comma-separated"
                  className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                />
              ) : (
                <p className="text-gray-100 truncate">
                  {product.tags && product.tags.length ? product.tags.join(', ') : '-'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Transit & invoice history */}
        <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
          <h2 className="text-sm font-semibold text-gray-100 mb-3">
            Purchase orders & shipments
          </h2>

          {transit.length === 0 ? (
            <p className="text-xs text-gray-400">No shipments recorded for this product yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs divide-y divide-[#3a3a3a]">
                <thead className="bg-[#1a1a1a]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-400">PO / Invoice</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-400">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-400">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-400">Received</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-400">Remaining</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-400">Unit price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-400">Line total</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3a3a3a]">
                  {transit.map((row) => {
                    const ordered = row.transit.quantity || 0;
                    const remaining = row.transit.remainingQuantity || 0;
                    const received = ordered - remaining;
                    const po = row.purchaseOrder;
                    const invoice = row.invoice;

                    return (
                      <tr key={row.transit.id} className="hover:bg-[#1a1a1a]">
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-100 font-medium">
                              {po?.invoiceNumber || 'PO ' + (po?.id ?? '').slice(0, 8)}
                            </span>
                            {invoice && (
                              <span className="text-gray-400">
                                Inv: {invoice.invoiceNumber || '-'}
                              </span>
                            )}
                            {po && (
                              <span className="text-gray-500">
                                Date: {formatDate(po.invoiceDate || po.createdAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top max-w-xs">
                          <p className="text-gray-100 truncate">
                            {row.poLine?.description || '-'}
                          </p>
                          {row.poLine?.supplierSku && (
                            <p className="text-gray-400 font-mono truncate">
                              {row.poLine.supplierSku}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-gray-100">
                          {ordered}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-gray-100">
                          {received}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-gray-100">
                          {remaining}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-gray-100">
                          {formatCurrency(row.poLine?.unitCostExVAT ?? row.transit.unitCostGBP)}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-gray-100">
                          {formatCurrency(
                            row.poLine?.lineTotalExVAT ??
                              (row.poLine?.unitCostExVAT ?? row.transit.unitCostGBP) * ordered,
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              row.transit.status === 'received'
                                ? 'bg-[#1a3a1a] text-green-300'
                                : row.transit.status === 'partially_received'
                                ? 'bg-[#3a2a1a] text-[#ffdd8a]'
                                : 'bg-[#3a3a1a] text-gray-200'
                            }`}
                          >
                            {row.transit.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
