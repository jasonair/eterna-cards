'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NewProductForm {
  name: string;
  primarySku: string;
  supplierSku: string;
  category: string;
  barcodes: string;
  tags: string;
  aliases: string;
  imageUrl: string;
}

export default function NewProductPage() {
  const router = useRouter();

  const [form, setForm] = useState<NewProductForm>({
    name: '',
    primarySku: '',
    supplierSku: '',
    category: '',
    barcodes: '',
    tags: '',
    aliases: '',
    imageUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof NewProductForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const parseList = (value: string): string[] =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name,
        primarySku: form.primarySku.trim() || null,
        supplierSku: form.supplierSku.trim() || null,
        category: form.category.trim() || null,
        barcodes: parseList(form.barcodes),
        tags: parseList(form.tags),
        aliases: parseList(form.aliases),
        imageUrl: form.imageUrl.trim() || null,
      };

      const res = await fetch('/api/inventory/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create product');
      }

      const productId: string | undefined = json.data?.product?.id;
      if (productId) {
        router.push(`/inventory/${productId}`);
      } else {
        router.push('/inventory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-xs text-[#ff6b35] hover:text-[#ff8c42] mb-2"
            >
              Back to inventory
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 truncate">New product</h1>
            <p className="text-xs text-gray-400 mt-1 truncate">
              Create a standalone product that can receive stock later from purchase orders or manual receipts.
            </p>
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4 text-xs space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Identity</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-[#ff6b35] text-white text-[11px] hover:bg-[#ff8c42] disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create product'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#3a2a2a] border border-red-500 rounded-md px-3 py-2 text-[11px] text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400">Name</p>
              <input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
            </div>
            <div>
              <p className="text-gray-400">Primary SKU</p>
              <input
                value={form.primarySku}
                onChange={(e) => handleChange('primarySku', e.target.value)}
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] font-mono"
              />
            </div>
            <div>
              <p className="text-gray-400">Supplier SKU</p>
              <input
                value={form.supplierSku}
                onChange={(e) => handleChange('supplierSku', e.target.value)}
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] font-mono"
              />
            </div>
            <div>
              <p className="text-gray-400">Category</p>
              <input
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
            </div>
            <div>
              <p className="text-gray-400">Barcodes</p>
              <input
                value={form.barcodes}
                onChange={(e) => handleChange('barcodes', e.target.value)}
                placeholder="Comma-separated"
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] font-mono"
              />
            </div>
            <div>
              <p className="text-gray-400">Tags</p>
              <input
                value={form.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                placeholder="Comma-separated"
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-400">Aliases</p>
              <input
                value={form.aliases}
                onChange={(e) => handleChange('aliases', e.target.value)}
                placeholder="Comma-separated alternative names used on invoices, etc."
                className="w-full mt-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-400">Image</p>
              <div className="mt-1 space-y-2">
                <input
                  value={form.imageUrl}
                  onChange={(e) => handleChange('imageUrl', e.target.value)}
                  placeholder="Paste image URL (e.g. from Supabase storage)"
                  className="w-full rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                />
                {form.imageUrl.trim() && (
                  <div className="inline-flex items-center gap-2 rounded-md border border-[#3a3a3a] bg-[#111111] px-2 py-1">
                    <div className="relative h-12 w-12 overflow-hidden rounded">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.imageUrl}
                        alt={form.name || 'Product image'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] text-gray-300 truncate max-w-[200px]">
                      Preview
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
