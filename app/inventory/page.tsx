'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

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
  imageUrl: string | null;
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
  created_at: string;
  completed_at: string | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const MobileBarcodeScanner = dynamic(
  () => import('@/components/MobileBarcodeScanner'),
  { ssr: false },
);

export default function InventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'onHand' | 'inTransit'>('all');
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [barcodeProductId, setBarcodeProductId] = useState<string | null>(null);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [customFolders, setCustomFolders] = useState<
    { id: string; name: string; dbId?: string; parentId?: string | null }[]
  >([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.completed),
    [tasks],
  );

  const handleScannedBarcode = (code: string) => {
    const raw = (code || '').trim();
    if (!raw) {
      setScannerOpen(false);
      return;
    }

    const normalized = raw.toLowerCase();

    const matched = items.find((row) => {
      const product = row.product;
      const barcodes = Array.isArray(product.barcodes) ? product.barcodes : [];
      if (barcodes.some((b) => b.toLowerCase() === normalized)) return true;
      if (product.primarySku && product.primarySku.toLowerCase() === normalized) return true;
      if (product.supplierSku && product.supplierSku.toLowerCase() === normalized) return true;
      return false;
    });

    setScannerOpen(false);

    if (matched) {
      router.push(`/inventory/${matched.product.id}`);
      return;
    }

    setSearch(raw);
    showToast('No product found for scanned code. Showing search results instead.');
  };

  const recentCompletedTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.completed || !t.completed_at) return false;
        const ts = new Date(t.completed_at).getTime();
        if (Number.isNaN(ts)) return false;
        return Date.now() - ts <= ONE_DAY_MS;
      }),
    [tasks],
  );

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

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const res = await fetch('/api/folders');
        const json = await res.json();
        if (!res.ok || !json.success) {
          // eslint-disable-next-line no-console
          console.error('Failed to load folders', json.error);
          return;
        }
        const rawFolders = (json.data || []) as {
          id: string;
          name: string;
          parentid: string | null;
        }[];
        setCustomFolders(
          rawFolders.map((f) => ({
            id: f.name,
            name: f.name,
            dbId: f.id,
            parentId: f.parentid,
          })),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load folders', err);
      }
    };

    loadFolders();
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

  const folders = useMemo(
    () => {
      const categories = new Set<string>();
      items.forEach((row) => {
        if (row.product.category) {
          categories.add(row.product.category);
        }
      });

      const categoryFolders = Array.from(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, name }))
        .filter((folder) => !customFolders.some((f) => f.id === folder.id));

      return [...categoryFolders, ...customFolders];
    },
    [items, customFolders],
  );

  const folderTree = useMemo(
    () => {
      type TreeNode = {
        id: string;
        name: string;
        dbId?: string;
        depth: number;
        isCustom: boolean;
        parentId: string | null;
      };

      const categoryNodes: TreeNode[] = [];
      const categories = new Set<string>();
      items.forEach((row) => {
        if (row.product.category) {
          categories.add(row.product.category);
        }
      });

      Array.from(categories)
        .sort((a, b) => a.localeCompare(b))
        .forEach((name) => {
          if (!customFolders.some((f) => f.id === name)) {
            categoryNodes.push({ id: name, name, depth: 0, isCustom: false, parentId: null });
          }
        });

      const childrenByParent = new Map<string | null, typeof customFolders>();
      const byDbId = new Map<string, (typeof customFolders)[number]>();
      customFolders.forEach((folder) => {
        if (folder.dbId) {
          byDbId.set(folder.dbId, folder);
        }
        const key = folder.parentId ?? null;
        const arr = childrenByParent.get(key) ?? [];
        arr.push(folder);
        childrenByParent.set(key, arr);
      });

      const result: TreeNode[] = [...categoryNodes];
      const visited = new Set<string>();

      const visit = (
        folder: (typeof customFolders)[number],
        depth: number,
        parentId: string | null,
      ) => {
        const key = folder.dbId ?? folder.id;
        if (visited.has(key)) return;
        visited.add(key);

        result.push({
          id: folder.id,
          name: folder.name,
          dbId: folder.dbId,
          depth,
          isCustom: true,
          parentId,
        });

        const children = (childrenByParent.get(folder.dbId ?? null) ?? []).slice();
        children.sort((a, b) => a.name.localeCompare(b.name));
        children.forEach((child) => visit(child, depth + 1, folder.id));
      };

      const roots = customFolders.filter((folder) => {
        if (!folder.parentId) return true;
        return !byDbId.has(folder.parentId);
      });

      if (roots.length > 0) {
        roots
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((root) => visit(root, 0, null));
      } else {
        customFolders
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((folder) => visit(folder, 0, null));
      }

      return result;
    },
    [items, customFolders],
  );

  const folderParentById = useMemo(
    () => {
      const map = new Map<string, string | null>();
      folderTree.forEach((node) => {
        map.set(node.id, node.parentId ?? null);
      });
      return map;
    },
    [folderTree],
  );

  const activeFolderPath = useMemo(
    () => {
      if (activeFolderId === 'all') return [];

      const path: { id: string; name: string }[] = [];
      let currentId: string | null = activeFolderId;
      const safetyLimit = 50;

      while (currentId && currentId !== 'all' && path.length < safetyLimit) {
        const folder = folders.find((f) => f.id === currentId);
        if (!folder) break;

        path.unshift({ id: folder.id, name: folder.name });

        const parentId: string | null = folderParentById.get(currentId) ?? null;
        if (!parentId || parentId === currentId) break;
        currentId = parentId;
      }

      return path;
    },
    [activeFolderId, folders, folderParentById],
  );

  const toggleFolderCollapsed = (id: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const hasCollapsedAncestor = (id: string): boolean => {
    let parentId = folderParentById.get(id) ?? null;
    while (parentId) {
      if (collapsedFolders[parentId]) return true;
      parentId = folderParentById.get(parentId) ?? null;
    }
    return false;
  };

  const visibleItems = useMemo(
    () => {
      // Only show products that have stock in hand or quantity in transit
      let nonZeroStock = filteredItems.filter((row) => {
        const onHand = row.inventory?.quantityOnHand ?? 0;
        const inTransit = row.quantityInTransit ?? 0;
        return onHand > 0 || inTransit > 0;
      });

      if (stockFilter === 'onHand') {
        nonZeroStock = nonZeroStock.filter((row) => {
          const onHand = row.inventory?.quantityOnHand ?? 0;
          return onHand > 0;
        });
      } else if (stockFilter === 'inTransit') {
        nonZeroStock = nonZeroStock.filter((row) => {
          const inTransit = row.quantityInTransit ?? 0;
          return inTransit > 0;
        });
      }

      if (activeFolderId === 'all') return nonZeroStock;

      return nonZeroStock.filter((row) => row.product.category === activeFolderId);
    },
    [filteredItems, activeFolderId, stockFilter],
  );

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

  const showToast = (message: string) => {
    setToastMessage(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setToastMessage((current) => (current === message ? null : current));
      }, 2500);
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '£0.00 GBP';
    return `£${amount.toFixed(2)} GBP`;
  };

  const handleStartNewFolder = () => {
    let parentId: string | null = null;
    if (activeFolderId !== 'all') {
      const activeCustomFolder = customFolders.find((f) => f.id === activeFolderId);
      if (activeCustomFolder && activeCustomFolder.dbId) {
        parentId = activeCustomFolder.dbId;
      }
    }
    setCreateFolderParentId(parentId);
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const handleCancelNewFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setCreateFolderParentId(null);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      const exists = customFolders.some(
        (f) => f.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (exists) {
        // eslint-disable-next-line no-alert
        alert('A folder with that name already exists. Please choose a different name.');
        return;
      }

      const parentId = createFolderParentId;
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // eslint-disable-next-line no-alert
        alert(json.error || 'Failed to create folder');
        return;
      }

      const folder = json.data as { id: string; name: string; parentid?: string | null };
      const viewFolder = {
        id: folder.name,
        name: folder.name,
        dbId: folder.id,
        parentId: folder.parentid ?? parentId ?? null,
      };
      setCustomFolders((prev) => [...prev, viewFolder]);
      setActiveFolderId(viewFolder.id);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setCreateFolderParentId(null);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Do not allow deleting the synthetic "all" folder or category-based folders
    const folder = customFolders.find((f) => f.id === folderId);
    if (!folder) return;

    // eslint-disable-next-line no-alert
    const confirmed = window.confirm('Delete this folder? This cannot be undone.');
    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/folders?id=${encodeURIComponent(folder.dbId || folderId)}`,
        {
          method: 'DELETE',
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json && (json as any).success === false)) {
        // eslint-disable-next-line no-alert
        alert(((json as any) && (json as any).error) || 'Failed to delete folder');
        return;
      }

      setCustomFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (activeFolderId === folderId) {
        setActiveFolderId('all');
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const handleProductDragStart = (
    e: DragEvent<HTMLDivElement>,
    product: Product,
  ) => {
    e.dataTransfer.setData('application/x-product-id', product.id);
    e.dataTransfer.effectAllowed = 'move';

    if (typeof document === 'undefined') return;

    const preview = document.createElement('div');
    preview.textContent = product.name || 'Product';
    preview.style.position = 'absolute';
    preview.style.top = '-1000px';
    preview.style.left = '-1000px';
    preview.style.padding = '4px 8px';
    preview.style.maxWidth = '220px';
    preview.style.backgroundColor = '#2a2a2a';
    preview.style.color = '#f5f5f5';
    preview.style.borderRadius = '999px';
    preview.style.fontSize = '11px';
    preview.style.fontWeight = '600';
    preview.style.whiteSpace = 'nowrap';
    preview.style.overflow = 'hidden';
    preview.style.textOverflow = 'ellipsis';

    document.body.appendChild(preview);
    const rect = preview.getBoundingClientRect();
    e.dataTransfer.setDragImage(preview, rect.width / 2, rect.height / 2);

    window.setTimeout(() => {
      if (preview.parentNode) {
        preview.parentNode.removeChild(preview);
      }
    }, 0);
  };

  const handleFolderDragStart = (
    e: DragEvent<HTMLDivElement>,
    folder: { id: string; name: string; dbId?: string; parentId?: string | null },
  ) => {
    if (!folder.dbId) return;
    e.dataTransfer.setData('application/x-folder-id', folder.dbId);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingFolder(true);
  };

  const handleAssignProductToFolder = async (productId: string, folderId: string) => {
    try {
      const targetCategory = folderId === 'all' ? '' : folderId;
      const res = await fetch(
        `/api/inventory/product?id=${encodeURIComponent(productId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: targetCategory }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        // eslint-disable-next-line no-alert
        alert(json.error || 'Failed to move product to folder');
        return;
      }

      const updated = json.data.product as Product;
      setItems((prev) =>
        prev.map((row) =>
          row.product.id === updated.id
            ? { ...row, product: { ...row.product, category: updated.category } }
            : row,
        ),
      );

      const destinationName = folderId === 'all'
        ? 'All items'
        : folders.find((f) => f.id === folderId)?.name || folderId;
      showToast(`Moved to "${destinationName}"`);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Failed to move product to folder');
    }
  };

  const handleMoveFolder = async (folderDbId: string, targetFolderDbId: string | null) => {
    if (!folderDbId || folderDbId === targetFolderDbId) return;

    if (targetFolderDbId) {
      const mapByDbId = new Map<string, { dbId?: string; parentId?: string | null }>();
      customFolders.forEach((f) => {
        if (f.dbId) {
          mapByDbId.set(f.dbId, { dbId: f.dbId, parentId: f.parentId ?? null });
        }
      });

      let current: string | null = targetFolderDbId;
      while (current) {
        if (current === folderDbId) {
          return;
        }
        const node = mapByDbId.get(current);
        if (!node || !node.parentId) break;
        current = node.parentId;
      }
    }

    try {
      const res = await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderDbId, parentId: targetFolderDbId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // eslint-disable-next-line no-alert
        alert(json.error || 'Failed to move folder');
        return;
      }

      const updated = json.data as { id: string; parentid: string | null };
      setCustomFolders((prev) =>
        prev.map((f) => (f.dbId === updated.id ? { ...f, parentId: updated.parentid } : f)),
      );
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err instanceof Error ? err.message : 'Failed to move folder');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-4 sm:py-6 pr-3 sm:pr-4 lg:pr-6 pl-3 sm:pl-4 lg:pl-6 md:pl-0">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Inventory</h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
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
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="bg-[#3a2a2a] border border-red-500 rounded-lg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Top controls: checklist + search/stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Checklist */}
          <div className="lg:col-span-1 bg-[#191919] rounded-xl border border-[#3a3a3a] p-3 sm:p-4 flex flex-col max-h-60 sm:max-h-80 shadow-sm shadow-black/30">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#333333]">
              <h2 className="text-xs sm:text-[13px] font-semibold tracking-wide text-gray-200 uppercase">
                Warehouse Checklist
              </h2>
              {tasksLoading && (
                <span className="text-[11px] text-gray-500">Loading…</span>
              )}
            </div>

            <div className="flex mb-3 gap-2">
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
                className="flex-1 rounded-md bg-[#101010] border border-[#333333] text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={handleCreateTask}
                className="px-3.5 py-2 text-xs font-semibold rounded-md bg-[#ff6b35] text-white hover:bg-[#ff8c42] shadow-sm shadow-black/40"
              >
                Add
              </button>
            </div>

            {taskError && (
              <div className="text-xs text-red-300 mb-1">{taskError}</div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {activeTasks.length === 0 && recentCompletedTasks.length === 0 && !tasksLoading && (
                <p className="text-xs text-gray-400">No tasks yet. Add your first task above.</p>
              )}

              {activeTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-2 text-xs text-gray-100 cursor-pointer group px-2 py-1 rounded-md hover:bg-[#222222]"
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

              {recentCompletedTasks.length > 0 && (
                <>
                  <div className="mt-2 pt-2 border-t border-[#3a3a3a] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-200">Done (last 24 hours)</span>
                    <span className="text-[10px] text-gray-500">Auto-clears after 24h</span>
                  </div>
                  {recentCompletedTasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer group px-2 py-1 rounded-md hover:bg-[#222222]"
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                        className="h-3 w-3 rounded border-[#3a3a3a] bg-[#1a1a1a] text-[#ff6b35] focus:ring-[#ff6b35]"
                      />
                      <span
                        className={`flex-1 truncate group-hover:text-gray-200 ${
                          task.completed ? 'line-through text-gray-500' : ''
                        }`}
                      >
                        {task.title}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Search & stats */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Scan barcode or search by name / SKU
                </label>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Scan barcode here or type to search..."
                    className="w-full rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-gray-100 text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute inset-y-0 right-2 my-auto inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] text-gray-400 hover:text-gray-100 hover:bg-[#3a3a3a]"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-[#ff6b35] text-white text-xs font-medium hover:bg-[#ff8c42] focus:outline-none focus:ring-2 focus:ring-[#ff6b35] sm:hidden mt-5"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7h3M4 17h3M17 7h3M17 17h3M9 7h6M9 17h6M7 9v6M17 9v6"
                  />
                </svg>
                Scan
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`flex flex-col justify-between bg-[#222222] rounded-xl border p-3 sm:p-4 text-left transition-all shadow-sm ${
                  stockFilter === 'all'
                    ? 'border-[#ff6b35] bg-[#333333] shadow-md shadow-black/40 scale-[1.02]'
                    : 'border-[#3a3a3a] hover:border-[#ff6b35]/70 hover:shadow-md hover:shadow-black/30'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-medium tracking-wide text-gray-300 uppercase">Products</p>
                {loading ? (
                  <div className="h-6 sm:h-7 w-12 bg-[#3a3a3a] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg sm:text-xl font-semibold text-gray-50 mt-1">{items.length.toLocaleString()}</p>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('onHand')}
                className={`flex flex-col justify-between bg-[#222222] rounded-xl border p-3 sm:p-4 text-left transition-all shadow-sm ${
                  stockFilter === 'onHand'
                    ? 'border-[#ff6b35] bg-[#333333] shadow-md shadow-black/40 scale-[1.02]'
                    : 'border-[#3a3a3a] hover:border-[#ff6b35]/70 hover:shadow-md hover:shadow-black/30'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-medium tracking-wide text-gray-300 uppercase">In Hand</p>
                {loading ? (
                  <div className="h-6 sm:h-7 w-12 bg-[#3a3a3a] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg sm:text-xl font-semibold text-gray-50 mt-1">
                    £{items.reduce(
                      (sum, row) => sum + ((row.inventory?.quantityOnHand || 0) * (row.inventory?.averageCostGBP || 0)),
                      0
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('inTransit')}
                className={`flex flex-col justify-between bg-[#222222] rounded-xl border p-3 sm:p-4 text-left transition-all shadow-sm ${
                  stockFilter === 'inTransit'
                    ? 'border-[#ff6b35] bg-[#333333] shadow-md shadow-black/40 scale-[1.02]'
                    : 'border-[#3a3a3a] hover:border-[#ff6b35]/70 hover:shadow-md hover:shadow-black/30'
                }`}
              >
                <p className="text-[10px] sm:text-xs font-medium tracking-wide text-gray-300 uppercase">In Transit</p>
                {loading ? (
                  <div className="h-6 sm:h-7 w-12 bg-[#3a3a3a] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg sm:text-xl font-semibold text-gray-50 mt-1">
                    £{items.reduce((sum, row) => sum + ((row.quantityInTransit || 0) * (row.inventory?.averageCostGBP || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </button>
              <div className="flex flex-col justify-between bg-[#222222] rounded-xl border border-[#3a3a3a] p-3 sm:p-4 text-left shadow-sm">
                <p className="text-[10px] sm:text-xs font-medium tracking-wide text-gray-300 uppercase">Total Value</p>
                {loading ? (
                  <div className="h-6 sm:h-7 w-24 bg-[#3a3a3a] rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg sm:text-xl font-semibold text-gray-50 mt-1">
                    £{items.reduce(
                      (sum, row) => sum + (((row.inventory?.quantityOnHand || 0) + (row.quantityInTransit || 0)) * (row.inventory?.averageCostGBP || 0)),
                      0
                    ).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory list */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Folders sidebar (Sortly-style drawer) */}
          <div className="md:col-span-1 bg-[#141414] border-r border-[#2a2a2a] rounded-none overflow-hidden flex flex-col max-h-[640px]">
            {/* Drawer header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between bg-[#191919]">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-gray-200 uppercase tracking-wide">
                  Available inventory
                </span>
                <span className="text-[10px] text-gray-500">Browse locations & folders</span>
              </div>
              <button
                type="button"
                onClick={handleStartNewFolder}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-[#3a3a3a] text-gray-200 bg-[#1f1f1f] hover:bg-[#333333] text-xs"
              >
                +
              </button>
            </div>

            {/* Folder tree */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
              {isCreatingFolder && (
                <div className="px-3 pb-2 flex items-center gap-2">
                  <input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateFolder();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelNewFolder();
                      }
                    }}
                    placeholder="New folder name"
                    className="flex-1 rounded-md bg-[#1a1a1a] border border-[#3a3a3a] text-[11px] text-gray-100 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    className="px-2 py-1 text-[11px] rounded-md bg-[#ff6b35] text-white hover:bg-[#ff8c42]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelNewFolder}
                    className="px-1.5 py-1 text-[11px] rounded-md text-gray-300 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveFolderId('all')}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverFolderId('all');
                }}
                onDragEnter={() => setDragOverFolderId('all')}
                onDragLeave={() => {
                  setDragOverFolderId((prev) => (prev === 'all' ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const folderDbId = e.dataTransfer.getData('application/x-folder-id');
                  const productId =
                    e.dataTransfer.getData('application/x-product-id') ||
                    e.dataTransfer.getData('text/plain');

                  if (folderDbId) {
                    handleMoveFolder(folderDbId, null);
                  } else if (productId) {
                    handleAssignProductToFolder(productId, 'all');
                  }
                  setDragOverFolderId(null);
                }}
                className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium border-l-2 transition-colors transition-transform duration-150 ${
                  activeFolderId === 'all' || dragOverFolderId === 'all'
                    ? 'border-[#ff6b35] bg-[#222222] text-gray-100 translate-x-0.5 shadow-md shadow-black/40 ring-1 ring-[#ff6b35]/60'
                    : isDraggingFolder
                      ? 'border-[#555555] bg-[#1f1f1f] text-gray-100'
                      : 'border-transparent text-gray-200 hover:bg-[#222222]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    {/* Folder icon */}
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 7.5C4 6.67157 4.67157 6 5.5 6H9l2 2h7.5C19.3284 8 20 8.67157 20 9.5V16.5C20 17.3284 19.3284 18 18.5 18H5.5C4.67157 18 4 17.3284 4 16.5V7.5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>All items</span>
                </span>
                {dragOverFolderId === 'all' ? (
                  <span className="ml-2 text-[10px] text-[#ffb68a]">Drop to move folder to top level</span>
                ) : isDraggingFolder ? (
                  <span className="ml-2 text-[10px] text-gray-400">Drag here to move folder to top level</span>
                ) : null}
              </button>

              <div className="mt-1 space-y-0 text-sm">
                {folderTree.length === 0 ? (
                  <p className="text-[11px] text-gray-500 px-4 pt-1">
                    No folders yet. Products will appear here once categories are added.
                  </p>
                ) : (
                  folderTree.map((folder) => {
                    const isCustom = folder.isCustom;
                    const paddingLeft = 20 + folder.depth * 14;
                    const hasChildren = folderTree.some((f) => f.parentId === folder.id);

                    if (hasCollapsedAncestor(folder.id)) {
                      return null;
                    }

                    return (
                      <div
                        key={`${folder.id}-${folder.depth}`}
                        draggable={isCustom}
                        onDragStart={(e) => {
                          if (!isCustom) return;
                          const customFolder = customFolders.find((f) => f.id === folder.id);
                          if (!customFolder) return;
                          handleFolderDragStart(e, customFolder);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverFolderId(folder.id);
                        }}
                        onDragEnter={() => setDragOverFolderId(folder.id)}
                        onDragLeave={() => {
                          setDragOverFolderId((prev) => (prev === folder.id ? null : prev));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const folderDbId = e.dataTransfer.getData('application/x-folder-id');
                          const productId =
                            e.dataTransfer.getData('application/x-product-id') ||
                            e.dataTransfer.getData('text/plain');

                          if (folderDbId && isCustom) {
                            const targetCustom = customFolders.find((f) => f.id === folder.id);
                            if (targetCustom && targetCustom.dbId && targetCustom.dbId !== folderDbId) {
                              handleMoveFolder(folderDbId, targetCustom.dbId);
                            }
                          } else if (productId) {
                            handleAssignProductToFolder(productId, folder.id);
                          }
                          setDragOverFolderId(null);
                          setIsDraggingFolder(false);
                        }}
                        onDragEnd={() => {
                          setDragOverFolderId((prev) => (prev === folder.id ? null : prev));
                          setIsDraggingFolder(false);
                        }}
                        className={`flex items-center justify-between w-full py-2.5 border-l-2 transition-colors transition-transform duration-150 ${
                          activeFolderId === folder.id || dragOverFolderId === folder.id
                            ? 'border-[#ff6b35] bg-[#202020] text-gray-100 translate-x-0.5 shadow-md shadow-black/40 ring-1 ring-[#ff6b35]/60'
                            : 'border-transparent text-gray-300 hover:bg-[#202020]'
                        } ${isCustom ? 'cursor-move' : ''}`}
                        style={{ paddingLeft }}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveFolderId(folder.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          {folder.depth > 0 && (
                            <span
                              className="self-stretch border-l border-[#333333] mr-1"
                              aria-hidden="true"
                            />
                          )}
                          <span className="inline-flex h-5 w-5 items-center justify-center text-gray-300">
                            {/* Nested folder icon */}
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M4.5 8.5C4.5 7.67157 5.17157 7 6 7H9.5L11 8.5H18C18.8284 8.5 19.5 9.17157 19.5 10V16C19.5 16.8284 18.8284 17.5 18 17.5H6C5.17157 17.5 4.5 16.8284 4.5 16V8.5Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="truncate">{folder.name}</span>
                        </button>

                        <div className="flex items-center gap-1 text-[10px] text-gray-300 pr-2">
                          {isCustom && hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderCollapsed(folder.id);
                              }}
                              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-[#333333] focus:outline-none"
                              aria-label={collapsedFolders[folder.id] ? 'Expand folder' : 'Collapse folder'}
                            >
                              <svg
                                className={`h-3 w-3 transform transition-transform ${
                                  collapsedFolders[folder.id] ? '' : 'rotate-90'
                                }`}
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M7 5L12 10L7 15"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          )}
                          {dragOverFolderId === folder.id && (
                            <span className="px-2 py-0.5 rounded-full bg-[#ff6b35]/15 text-[#ffb68a] border border-[#ff6b35]/40">
                              Drop to move here
                            </span>
                          )}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs text-gray-300 hover:text-white hover:bg-red-600/60"
                              aria-label="Delete folder"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Main grid and toolbar */}
          <div className="md:col-span-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span className="uppercase tracking-wide text-[10px] text-gray-500">Location</span>
                <span className="text-gray-500">/</span>
                <button
                  type="button"
                  onClick={() => setActiveFolderId('all')}
                  className={`px-2 py-0.5 rounded-md ${
                    activeFolderId === 'all'
                      ? 'bg-[#ff6b35] text-white'
                      : 'text-gray-200 hover:bg-[#252525]'
                  }`}
                >
                  All items
                </button>
                {activeFolderPath.map((segment, index) => (
                  <span key={segment.id} className="flex items-center gap-2">
                    <span className="text-gray-500">/</span>
                    {index === activeFolderPath.length - 1 ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#ff6b35] text-white font-semibold">
                        {segment.name}
                      </span>
                    ) : (
                      <span className="text-gray-300">{segment.name}</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="inline-flex rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[#ff6b35] text-white'
                        : 'text-gray-300 hover:text-white hover:bg-[#3a3a3a]'
                    }`}
                    title="Grid view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'table'
                        ? 'bg-[#ff6b35] text-white'
                        : 'text-gray-300 hover:text-white hover:bg-[#3a3a3a]'
                    }`}
                    title="Table view"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/inventory/new')}
                  className="px-3 py-1.5 rounded-md border border-[#3a3a3a] bg-[#2a2a2a] text-gray-100 hover:bg-[#3a3a3a]"
                >
                  New item
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff6b35]"></div>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-8 text-center text-sm text-gray-300">
                No products match this search or folder.
              </div>
            ) : viewMode === 'table' ? (
              <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#3a3a3a]">
                    <thead className="bg-[#1a1a1a]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Supplier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          In Hand
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          In Transit
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Avg Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Total Value
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3a3a3a]">
                      {visibleItems.map((row) => {
                        const totalQty = (row.inventory?.quantityOnHand || 0) + (row.quantityInTransit || 0);
                        const totalValue = totalQty * (row.inventory?.averageCostGBP || 0);
                        return (
                          <tr
                            key={row.product.id}
                            className="hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                            onClick={() => router.push(`/inventory/${row.product.id}`)}
                          >
                            <td className="px-4 py-3 text-sm text-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md bg-gradient-to-br from-[#292929] to-[#3a3a3a] flex items-center justify-center text-xs font-bold text-gray-200 uppercase flex-shrink-0">
                                  {row.product.name
                                    .split(' ')
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((word) => word[0])
                                    .join('')
                                    .toUpperCase() || 'PR'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-100 truncate">{row.product.name}</div>
                                  {row.product.category && (
                                    <div className="text-xs text-gray-400">{row.product.category}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {row.supplier?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                              {row.product.primarySku || row.product.supplierSku || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#1f2a1f] text-green-300 border border-green-500/40">
                                {row.inventory?.quantityOnHand || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#1f1f1f] text-gray-200 border border-[#3a3a3a]">
                                {row.quantityInTransit || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-100 text-right font-mono">
                              £{(row.inventory?.averageCostGBP || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-100 text-right font-mono">
                              £{totalValue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(row.product);
                                }}
                                disabled={deletingProductId === row.product.id}
                                className="inline-flex items-center justify-center p-1.5 rounded-md text-red-300 hover:bg-[#3a1f1f] disabled:opacity-50"
                                aria-label="Delete product"
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {visibleItems.map((row) => {
                  const hasOnHand = !!row.inventory && row.inventory.quantityOnHand > 0;
                  const isAddingBarcode = barcodeProductId === row.product.id;

                  const initials = row.product.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join('')
                    .toUpperCase();
                  const isLongName = (row.product.name || '').length > 40;
                  return (
                    <div
                      key={row.product.id}
                      className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-4 flex flex-col gap-3 cursor-pointer hover:border-[#ff6b35] transition-colors"
                      onClick={() => router.push(`/inventory/${row.product.id}`)}
                      draggable
                      onDragStart={(e) => handleProductDragStart(e, row.product)}
                    >
                      <div className="relative">
                        <div className="h-24 sm:h-28 rounded-md bg-gradient-to-br from-[#292929] to-[#3a3a3a] flex items-center justify-center text-lg sm:text-xl font-bold text-gray-200 uppercase">
                          {initials || 'PR'}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="block">
                          <h3
                            className={`font-semibold text-gray-100 break-words ${
                              isLongName ? 'text-xs leading-snug' : 'text-sm'
                            }`}
                          >
                            {row.product.name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">
                            {row.supplier?.name || 'Unknown supplier'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm mt-2">
                        <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1 rounded-full bg-[#1f2a1f] text-green-300 border border-green-500/40 font-medium tracking-tight">
                            In hand: {row.inventory?.quantityOnHand || 0}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-[#1f1f1f] text-gray-200 border border-[#3a3a3a] font-medium tracking-tight">
                            Transit: {row.quantityInTransit}
                          </span>
                        </div>
                      </div>

                      {/* Actions (barcode controls temporarily hidden) */}
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-end gap-2 mt-1">
                          {hasOnHand && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a3a1a] text-green-300">
                              In stock
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(row.product);
                          }}
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
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-xs px-3 py-2 rounded-md bg-[#222222] border border-[#3a3a3a] text-xs text-gray-100 shadow-lg shadow-black/40">
          {toastMessage}
        </div>
      )}

      {scannerOpen && (
        <MobileBarcodeScanner
          onScan={handleScannedBarcode}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
