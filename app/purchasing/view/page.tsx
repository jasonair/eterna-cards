'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Supplier {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  invoiceNumber: string;
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

interface DatabaseData {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: POLine[];
}

export default function ViewDataPage() {
  const [data, setData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<string | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editFormData, setEditFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    currency: 'USD',
    paymentTerms: '',
  });
  const [editingLines, setEditingLines] = useState<POLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/purchasing/po/view');
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = data?.suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  };

  const getPOLines = (purchaseOrderId: string) => {
    return data?.poLines.filter(line => line.purchaseOrderId === purchaseOrderId) || [];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const groupPOsByMonth = () => {
    if (!data) return {};

    const grouped: { [key: string]: PurchaseOrder[] } = {};

    data.purchaseOrders.forEach(po => {
      const date = po.invoiceDate || po.createdAt;
      const monthYear = new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(po);
    });

    // Sort by date (most recent first)
    return Object.keys(grouped)
      .sort((a, b) => new Date(grouped[b][0].invoiceDate || grouped[b][0].createdAt).getTime() - 
                      new Date(grouped[a][0].invoiceDate || grouped[a][0].createdAt).getTime())
      .reduce((acc, key) => {
        acc[key] = grouped[key];
        return acc;
      }, {} as { [key: string]: PurchaseOrder[] });
  };

  const handleExportClick = () => {
    setShowExportModal(true);
    // Pre-select all months
    const allMonths = Object.keys(groupPOsByMonth());
    setSelectedMonths(allMonths);
  };

  const handleMonthToggle = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const handleSelectAllMonths = () => {
    const allMonths = Object.keys(groupPOsByMonth());
    setSelectedMonths(allMonths);
  };

  const handleDeselectAllMonths = () => {
    setSelectedMonths([]);
  };

  const exportToPDF = (monthsToExport?: string[]) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Purchase Orders Report', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    
    let yPosition = 35;

    const groupedPOs = groupPOsByMonth();
    const monthsToInclude = monthsToExport || Object.keys(groupedPOs);

    Object.entries(groupedPOs)
      .filter(([month]) => monthsToInclude.includes(month))
      .forEach(([month, pos]) => {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Month header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(month, 14, yPosition);
      yPosition += 8;

      // Prepare table data
      const tableData = pos.map(po => {
        const lines = getPOLines(po.id);
        const totalAmount = lines.reduce((sum, line) => sum + line.lineTotalExVAT, 0);
        
        return [
          po.invoiceNumber || 'N/A',
          getSupplierName(po.supplierId),
          formatDate(po.invoiceDate),
          po.currency,
          totalAmount.toFixed(2),
          lines.length.toString()
        ];
      });

      // Add table
      autoTable(doc, {
        startY: yPosition,
        head: [['Invoice #', 'Supplier', 'Date', 'Currency', 'Total (ex VAT)', 'Lines']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    });

    // Save the PDF
    doc.save(`purchase-orders-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleDelete = async (poId: string) => {
    if (!confirm('Are you sure you want to delete this purchase order? This will also delete all associated line items.')) {
      return;
    }

    setDeleting(poId);
    try {
      const response = await fetch(`/api/purchasing/po/delete?id=${poId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete purchase order');
      }

      // Refresh data after successful deletion
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    const poCount = data?.purchaseOrders.filter(po => po.supplierId === supplierId).length || 0;
    const message = poCount > 0
      ? `Are you sure you want to delete "${supplierName}"? This will also delete ${poCount} purchase order(s) and all associated line items.`
      : `Are you sure you want to delete "${supplierName}"?`;

    if (!confirm(message)) {
      return;
    }

    setDeletingSupplier(supplierId);
    try {
      const response = await fetch(`/api/suppliers/delete?id=${supplierId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete supplier');
      }

      // Refresh data after successful deletion
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
    } finally {
      setDeletingSupplier(null);
    }
  };

  const handleEdit = (po: PurchaseOrder) => {
    const poLines = data?.poLines.filter(line => line.purchaseOrderId === po.id) || [];
    setEditingPO(po);
    setEditingLines([...poLines]);
    setEditFormData({
      invoiceNumber: po.invoiceNumber || '',
      invoiceDate: po.invoiceDate || '',
      currency: po.currency,
      paymentTerms: po.paymentTerms || '',
    });
  };

  const handleSave = async () => {
    if (!editingPO) return;

    setSaving(true);
    try {
      // 1. Update the PO itself
      const poResponse = await fetch(`/api/purchasing/po/update?id=${editingPO.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      if (!poResponse.ok) {
        throw new Error('Failed to update purchase order');
      }

      // 2. Get original lines for comparison
      const originalLines = data?.poLines.filter(line => line.purchaseOrderId === editingPO.id) || [];

      // 3. Handle line item updates, additions, and deletions
      const originalLineIds = originalLines.map(line => line.id);
      const currentLineIds = editingLines.map(line => line.id);

      // Lines to delete (in original but not in current)
      const linesToDelete = originalLineIds.filter(id => !currentLineIds.includes(id));

      // Lines to add (in current but not in original)
      const linesToAdd = editingLines.filter(line => !originalLineIds.includes(line.id));

      // Lines to update (in both, but may have changes)
      const linesToUpdate = editingLines.filter(line => {
        const original = originalLines.find(ol => ol.id === line.id);
        if (!original) return false;
        return JSON.stringify(original) !== JSON.stringify(line);
      });

      // Delete removed lines
      for (const lineId of linesToDelete) {
        await fetch(`/api/purchasing/po/lines?id=${lineId}`, {
          method: 'DELETE',
        });
      }

      // Add new lines
      for (const line of linesToAdd) {
        await fetch('/api/purchasing/po/lines/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(line),
        });
      }

      // Update modified lines
      for (const line of linesToUpdate) {
        await fetch(`/api/purchasing/po/lines?id=${line.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: line.description,
            supplierSku: line.supplierSku,
            quantity: line.quantity,
            unitCostExVAT: line.unitCostExVAT,
            lineTotalExVAT: line.lineTotalExVAT,
          }),
        });
      }

      // Refresh data after successful update
      await fetchData();
      setEditingPO(null);
      setEditingLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLineItem = () => {
    const newLine: POLine = {
      id: `temp-${Date.now()}`, // Temporary ID for new lines
      purchaseOrderId: editingPO!.id,
      description: '',
      supplierSku: null,
      quantity: 1,
      unitCostExVAT: 0,
      lineTotalExVAT: 0,
    };
    setEditingLines(prev => [...prev, newLine]);
  };

  const handleRemoveLineItem = (lineId: string) => {
    setEditingLines(prev => prev.filter(line => line.id !== lineId));
  };

  const handleUpdateLineItem = (lineId: string, field: keyof POLine, value: any) => {
    setEditingLines(prev => prev.map(line => {
      if (line.id === lineId) {
        const updatedLine = { ...line, [field]: value };
        // Auto-calculate line total if quantity or unit cost changes
        if (field === 'quantity' || field === 'unitCostExVAT') {
          updatedLine.lineTotalExVAT = updatedLine.quantity * updatedLine.unitCostExVAT;
        }
        return updatedLine;
      }
      return line;
    }));
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !data || (data.suppliers.length === 0 && data.purchaseOrders.length === 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Purchase Orders Database
            </h1>
            <p className="text-gray-600">
              View all imported invoices and suppliers
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/purchasing/create"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New PO
            </a>
            <a
              href="/purchasing/import"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import from Invoice
            </a>
            <button
              onClick={handleExportClick}
              disabled={!data || data.purchaseOrders.length === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Suppliers</p>
                <p className="text-2xl font-bold text-gray-900">{data?.suppliers.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Purchase Orders</p>
                <p className="text-2xl font-bold text-gray-900">{data?.purchaseOrders.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Line Items</p>
                <p className="text-2xl font-bold text-gray-900">{data?.poLines.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No data yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload your first PDF invoice to see data here.
            </p>
            <div className="mt-6">
              <a
                href="/purchasing/import"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Upload Invoice
              </a>
            </div>
          </div>
        )}

        {/* Purchase Orders List - Grouped by Month */}
        {!isEmpty && (
          <div className="space-y-8">
            {Object.entries(groupPOsByMonth()).map(([month, pos]) => (
              <div key={month} className="space-y-4">
                {/* Month Header */}
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{month}</h2>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {pos.length} PO{pos.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* POs for this month */}
                <div className="space-y-6">
                  {pos.map((po) => {
                    const lines = getPOLines(po.id);
                    const totalAmount = lines.reduce((sum, line) => sum + line.lineTotalExVAT, 0);

                    return (
                      <div 
                        key={po.id} 
                        className="bg-white rounded-lg shadow overflow-hidden transition-all"
                      >
                  {/* PO Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">
                          {po.invoiceNumber}
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">
                          {getSupplierName(po.supplierId)}
                        </p>
                      </div>
                      <div className="text-right flex items-start gap-4">
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {formatCurrency(totalAmount, po.currency)}
                          </p>
                          <p className="text-blue-100 text-sm">ex VAT</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(po)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Edit Purchase Order"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(po.id)}
                            disabled={deleting === po.id}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Delete Purchase Order"
                          >
                            {deleting === po.id ? (
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PO Details */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {formatDate(po.invoiceDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Currency</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{po.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Terms</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {po.paymentTerms || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Line Items</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{lines.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              SKU
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unit Price
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {lines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 text-sm text-gray-900">
                                {line.description}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-500 font-mono">
                                {line.supplierSku || '-'}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-900 text-right">
                                {line.quantity}
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-900 text-right">
                                {formatCurrency(line.unitCostExVAT, po.currency)}
                              </td>
                              <td className="px-3 py-3 text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(line.lineTotalExVAT, po.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer with metadata */}
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Imported: {formatDate(po.createdAt)} • ID: {po.id}
                    </p>
                  </div>
                </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suppliers Section */}
        {data && data.suppliers.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Suppliers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.suppliers.map((supplier) => {
                const supplierPOCount = data.purchaseOrders.filter(po => po.supplierId === supplier.id).length;
                
                return (
                  <div key={supplier.id} className="bg-white rounded-lg shadow p-6 relative">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {supplier.name}
                      </h3>
                      <button
                        onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                        disabled={deletingSupplier === supplier.id}
                        className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete Supplier"
                      >
                        {deletingSupplier === supplier.id ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {supplierPOCount > 0 && (
                      <div className="mb-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {supplierPOCount} PO{supplierPOCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      {supplier.address && (
                        <p className="text-gray-600">
                          <span className="font-medium">Address:</span> {supplier.address}
                        </p>
                      )}
                      {supplier.email && (
                        <p className="text-gray-600">
                          <span className="font-medium">Email:</span> {supplier.email}
                        </p>
                      )}
                      {supplier.phone && (
                        <p className="text-gray-600">
                          <span className="font-medium">Phone:</span> {supplier.phone}
                        </p>
                      )}
                      {supplier.vatNumber && (
                        <p className="text-gray-600">
                          <span className="font-medium">VAT:</span> {supplier.vatNumber}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
                      Added: {formatDate(supplier.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit PO Modal */}
      {editingPO && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border max-w-6xl w-full shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-gray-900">Edit Purchase Order</h3>
                <button
                  onClick={() => {
                    setEditingPO(null);
                    setEditingLines([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* PO Header Fields */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Purchase Order Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={editFormData.invoiceNumber}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="Enter invoice number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={editFormData.invoiceDate}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={editFormData.currency}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms
                    </label>
                    <input
                      type="text"
                      value={editFormData.paymentTerms}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="e.g., Net 30, Due on Receipt"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Line Items</h4>
                  <button
                    onClick={handleAddLineItem}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Line Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {editingLines.map((line) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => handleUpdateLineItem(line.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={line.supplierSku || ''}
                              onChange={(e) => handleUpdateLineItem(line.id, 'supplierSku', e.target.value || null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
                              placeholder="SKU"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => handleUpdateLineItem(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
                              min="0"
                              step="1"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              value={line.unitCostExVAT}
                              onChange={(e) => handleUpdateLineItem(line.id, 'unitCostExVAT', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">
                            {editFormData.currency} {(line.lineTotalExVAT || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => handleRemoveLineItem(line.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              title="Remove line item"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editingLines.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No line items. Click "Add Line Item" to get started.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingPO(null);
                    setEditingLines([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Month Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Select Months to Export</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={handleSelectAllMonths}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllMonths}
                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100"
                >
                  Deselect All
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(groupPOsByMonth()).map(([month, pos]) => (
                  <label
                    key={month}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => handleMonthToggle(month)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <span className="text-sm font-medium text-gray-900">{month}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({pos.length} PO{pos.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedMonths.length > 0) {
                      exportToPDF(selectedMonths);
                      setShowExportModal(false);
                    }
                  }}
                  disabled={selectedMonths.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export {selectedMonths.length > 0 && `(${selectedMonths.length} month${selectedMonths.length !== 1 ? 's' : ''})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
