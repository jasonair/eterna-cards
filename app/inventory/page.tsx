'use client';

import { useEffect, useMemo, useState } from 'react';

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

interface InventoryRow {
  product: Product;
  inventory: InventoryRecord | null;
  quantityInTransit: number;
  supplier: Supplier | null;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [barcodeProductId, setBarcodeProductId] = useState<string | null>(null);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/inventory/snapshot');
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load inventory');
        }
        setItems(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setTasksLoading(true);
        setTaskError(null);
        const res = await fetch('/api/tasks');
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load tasks');
        }
        setTasks(json.data || []);
      } catch (err) {
        setTaskError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setTasksLoading(false);
      }
    };

    loadTasks();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter(({ product }) => {
      const tokens: string[] = [];
      if (product.name) tokens.push(product.name.toLowerCase());
      if (product.primarySku) tokens.push(product.primarySku.toLowerCase());
      if (product.supplierSku) tokens.push(product.supplierSku.toLowerCase());
      if (Array.isArray(product.aliases)) {
        product.aliases.forEach((a) => tokens.push(a.toLowerCase()));
      }
      if (Array.isArray(product.barcodes)) {
        product.barcodes.forEach((b) => tokens.push(b.toLowerCase()));
      }

      return tokens.some((t) => t.includes(term));
    });
  }, [items, search]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/inventory/snapshot');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load inventory');
      }
      setItems(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBarcode = async () => {
    if (!barcodeProductId) return;
    const code = barcodeValue.trim();
    if (!code) {
      alert('Please enter a barcode value');
      return;
    }

    try {
      setBarcodeLoading(true);
      const res = await fetch('/api/inventory/add-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: barcodeProductId, barcode: code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to add barcode');
      }
      setBarcodeProductId(null);
      setBarcodeValue('');
      await handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add barcode');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (
      !window.confirm(
        `Delete "${product.name}" from inventory? This will also remove any on-hand and in-transit records for this product.`,
      )
    ) {
      return;
    }

    try {
      setDeletingProductId(product.id);
      const res = await fetch(
        `/api/inventory/product?id=${encodeURIComponent(product.id)}`,
        {
          method: 'DELETE',
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete product');
      }
      await handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleCreateTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;

    try {
      setTaskError(null);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create task');
      }
      setTasks((prev) => [json.data, ...prev]);
      setNewTaskTitle('');
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      setTaskError(null);
      const res = await fetch('/api/tasks/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update task');
      }
      const updated: Task = json.data;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '£0.00 GBP';
    return `£${amount.toFixed(2)} GBP`;
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-1">Inventory</h1>
            <p className="text-gray-300 text-sm">
              Live view of products, on-hand stock, and in-transit quantities.
            </p>
            <p className="text-xs text-[#ff6b35] mt-2">
              Scan a barcode into the search box below or search by name / SKU.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/purchasing/import"
              className="inline-flex items-center px-4 py-2 border border-[#3a3a3a] text-sm font-medium rounded-md text-gray-100 bg-[#2a2a2a] hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6b35] transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Import Invoice
            </a>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#ff6b35] hover:bg-[#ff8c42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff6b35] transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
            <div className="inline-flex rounded-md border border-[#3a3a3a] bg-[#2a2a2a] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#ff6b35] text-white'
                    : 'text-gray-300 hover:bg-[#3a3a3a]'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 font-medium border-l border-[#3a3a3a] transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#ff6b35] text-white'
                    : 'text-gray-300 hover:bg-[#3a3a3a]'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="bg-[#3a2a2a] border border-red-500 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Top controls: search + stats + checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Search & stats */}
          <div className="lg:col-span-2 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Scan barcode or search by name / SKU
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Scan barcode here or type to search..."
                className="w-full rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
                <p className="text-xs text-gray-400">Products</p>
                <p className="text-xl font-semibold text-gray-100 mt-1">{items.length}</p>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
                <p className="text-xs text-gray-400">On Hand (units)</p>
                <p className="text-xl font-semibold text-gray-100 mt-1">
                  {items.reduce(
                    (sum, row) => sum + (row.inventory?.quantityOnHand || 0),
                    0
                  )}
                </p>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
                <p className="text-xs text-gray-400">In Transit (units)</p>
                <p className="text-xl font-semibold text-gray-100 mt-1">
                  {items.reduce((sum, row) => sum + (row.quantityInTransit || 0), 0)}
                </p>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-3">
                <p className="text-xs text-gray-400">Tracked Suppliers</p>
                <p className="text-xl font-semibold text-gray-100 mt-1">
                  {new Set(items.map((row) => row.supplier?.id).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4 flex flex-col max-h-80">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-100">Warehouse Checklist</h2>
              {tasksLoading && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            <div className="flex mb-2 gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTask();
                  }
                }}
                placeholder="Add a task (e.g. 'Receive Korean shipment')"
                className="flex-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
              />
              <button
                type="button"
                onClick={handleCreateTask}
                className="px-3 py-1.5 text-xs rounded-md bg-[#ff6b35] text-white hover:bg-[#ff8c42]"
              >
                Add
              </button>
            </div>

            {taskError && (
              <div className="text-xs text-red-300 mb-1">{taskError}</div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {tasks.length === 0 && !tasksLoading && (
                <p className="text-xs text-gray-400">No tasks yet. Add your first task above.</p>
              )}
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-2 text-xs text-gray-100 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => handleToggleTask(task)}
                    className="h-3 w-3 rounded border-[#3a3a3a] bg-[#1a1a1a] text-[#ff6b35] focus:ring-[#ff6b35]"
                  />
                  <span
                    className={`flex-1 truncate group-hover:text-gray-50 ${
                      task.completed ? 'line-through text-gray-500' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory list */}
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff6b35]"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-8 text-center text-sm text-gray-300">
              No products match this search.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((row) => {
                const hasOnHand = !!row.inventory && row.inventory.quantityOnHand > 0;
                const isAddingBarcode = barcodeProductId === row.product.id;

                const initials = row.product.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={row.product.id}
                    className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md bg-gradient-to-br from-[#ff6b35] to-[#ff8c42] flex items-center justify-center text-xs font-bold text-white uppercase flex-shrink-0">
                        {initials || 'PR'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={`/inventory/${row.product.id}`} className="block">
                          <h3 className="text-sm font-semibold text-gray-100 truncate">
                            {row.product.name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {row.supplier?.name || 'Unknown supplier'}
                          </p>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#1f2a1f] text-green-300">
                          On hand: {row.inventory?.quantityOnHand || 0}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#2a1f1f] text-orange-200">
                          Transit: {row.quantityInTransit}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBarcodeProductId(row.product.id);
                            setBarcodeValue('');
                          }}
                          className="text-[11px] text-[#ff6b35] hover:text-[#ff8c42]"
                        >
                          {row.product.barcodes?.length ? 'Add another barcode' : 'Add barcode'}
                        </button>
                        {hasOnHand && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a3a1a] text-green-300">
                            In stock
                          </span>
                        )}
                      </div>

                      {isAddingBarcode && (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            value={barcodeValue}
                            onChange={(e) => setBarcodeValue(e.target.value)}
                            placeholder="Scan or enter barcode"
                            className="flex-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                          />
                          <button
                            type="button"
                            onClick={handleAddBarcode}
                            disabled={barcodeLoading}
                            className="px-3 py-1.5 text-xs rounded-md bg-[#ff6b35] text-white hover:bg-[#ff8c42] disabled:opacity-50"
                          >
                            {barcodeLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBarcodeProductId(null);
                              setBarcodeValue('');
                            }}
                            className="px-2 py-1.5 text-xs rounded-md bg-transparent text-gray-300 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(row.product)}
                        disabled={deletingProductId === row.product.id}
                        className="mt-1 inline-flex items-center justify-center px-2.5 py-1.5 rounded-md bg-[#3a1f1f] text-red-200 hover:bg-[#4a2323] disabled:opacity-50"
                        aria-label={deletingProductId === row.product.id ? 'Deleting product' : 'Delete product'}
                      >
                        {deletingProductId === row.product.id ? (
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg overflow-hidden">
              <div>
                <table className="w-full divide-y divide-[#3a3a3a] text-sm">
                  <thead className="bg-[#1a1a1a]">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        On hand
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Transit
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3a3a3a]">
                    {filteredItems.map((row) => {
                      const hasOnHand = !!row.inventory && row.inventory.quantityOnHand > 0;
                      const isAddingBarcode = barcodeProductId === row.product.id;
                      const onHand = row.inventory?.quantityOnHand || 0;

                      return (
                        <tr key={row.product.id} className="hover:bg-[#1a1a1a]">
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col">
                              <a
                                href={`/inventory/${row.product.id}`}
                                className="text-gray-100 font-medium hover:text-white"
                              >
                                {row.product.name}
                              </a>
                              <span className="text-xs text-gray-400 truncate">
                                {row.product.primarySku || row.product.supplierSku || 'No SKU'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-300 truncate">
                            {row.supplier?.name || 'Unknown supplier'}
                          </td>
                          <td className="px-4 py-3 align-top text-right text-gray-100">
                            {onHand}
                          </td>
                          <td className="px-4 py-3 align-top text-right text-gray-100">
                            {row.quantityInTransit}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex flex-col items-end gap-2 w-full max-w-xs ml-auto">
                              <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBarcodeProductId(row.product.id);
                                    setBarcodeValue('');
                                  }}
                                  className="px-2 py-1 text-[11px] rounded-md border border-[#3a3a3a] text-[#ff6b35] hover:bg-[#3a3a3a] whitespace-nowrap"
                                >
                                  {row.product.barcodes?.length ? 'Add barcode' : 'Add barcode'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(row.product)}
                                  disabled={deletingProductId === row.product.id}
                                  className="px-2.5 py-1 text-[11px] rounded-md bg-[#3a1f1f] text-red-200 hover:bg-[#4a2323] disabled:opacity-50"
                                  aria-label={deletingProductId === row.product.id ? 'Deleting product' : 'Delete product'}
                                >
                                  {deletingProductId === row.product.id ? (
                                    <svg
                                      className="animate-spin h-3.5 w-3.5"
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      ></circle>
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      ></path>
                                    </svg>
                                  ) : (
                                    <svg
                                      className="h-3.5 w-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  )}
                                </button>
                                {hasOnHand && (
                                  <span className="px-2 py-1 text-[10px] rounded-full bg-[#1a3a1a] text-green-300 whitespace-nowrap">
                                    In stock
                                  </span>
                                )}
                              </div>
                              {isAddingBarcode && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full mt-1">
                                  <input
                                    value={barcodeValue}
                                    onChange={(e) => setBarcodeValue(e.target.value)}
                                    placeholder="Scan or enter barcode"
                                    className="w-full sm:w-48 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddBarcode}
                                    disabled={barcodeLoading}
                                    className="px-3 py-1.5 text-xs rounded-md bg-[#ff6b35] text-white hover:bg-[#ff8c42] disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {barcodeLoading ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBarcodeProductId(null);
                                      setBarcodeValue('');
                                    }}
                                    className="px-2 py-1.5 text-xs rounded-md bg-transparent text-gray-300 hover:text-white whitespace-nowrap"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
