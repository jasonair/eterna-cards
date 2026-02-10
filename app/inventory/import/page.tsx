'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';

type KnownField = 'name' | 'primarySku' | 'supplierSku' | 'category' | 'barcodes' | 'quantityOnHand' | 'quantityInTransit' | 'averageCostGBP' | 'supplier';

const FIELD_LABELS: Record<KnownField, string> = {
  name: 'Product Name',
  primarySku: 'Primary SKU',
  supplierSku: 'Supplier SKU',
  category: 'Category',
  barcodes: 'Barcodes',
  quantityOnHand: 'Qty On Hand',
  quantityInTransit: 'Qty In Transit',
  averageCostGBP: 'Avg Cost (GBP)',
  supplier: 'Supplier',
};

const ALL_FIELDS: KnownField[] = ['name', 'primarySku', 'supplierSku', 'category', 'barcodes', 'quantityOnHand', 'quantityInTransit', 'averageCostGBP', 'supplier'];

interface ImportRow {
  name: string;
  primarySku?: string | null;
  supplierSku?: string | null;
  category?: string | null;
  barcodes?: string[];
  quantityOnHand?: number;
  quantityInTransit?: number;
  averageCostGBP?: number;
  supplier?: string | null;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  if (!text.trim()) return { headers: [], rows: [] };

  // Parse character-by-character to correctly handle newlines inside quoted fields
  const allRows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Inside quotes: keep everything including newlines
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current.trim());
        current = '';
      } else if (char === '\r') {
        // Skip \r, handle \n next
        continue;
      } else if (char === '\n') {
        row.push(current.trim());
        current = '';
        if (row.some((cell) => cell.length > 0)) {
          allRows.push(row);
        }
        row = [];
      } else {
        current += char;
      }
    }
  }

  // Push final field and row
  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    allRows.push(row);
  }

  if (allRows.length === 0) return { headers: [], rows: [] };

  // Replace newlines in parsed values with spaces for cleaner display
  const cleanRow = (r: string[]) => r.map((cell) => cell.replace(/[\r\n]+/g, ' '));

  const headers = cleanRow(allRows[0]);
  const rows = allRows.slice(1).map(cleanRow);

  return { headers, rows };
}

export default function ImportInventoryPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSV data
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string>('');

  // Column mapping
  const [mapping, setMapping] = useState<Record<string, KnownField | null>>({});
  const [mappingMethod, setMappingMethod] = useState<'local' | 'ai' | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);

  // Preview
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: KnownField } | null>(null);

  // Import result
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors?: string[];
  } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      setError('Please upload a CSV file (.csv or .txt)');
      return;
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (headers.length === 0) {
      setError('Could not parse any headers from the file');
      return;
    }

    if (rows.length === 0) {
      setError('File contains headers but no data rows');
      return;
    }

    setCsvHeaders(headers);
    setCsvRows(rows);
    setFileName(file.name);

    // Auto-map columns
    setMappingLoading(true);
    setStep('mapping');

    try {
      const res = await authenticatedFetch('/api/inventory/import/map-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          sampleRows: rows.slice(0, 3),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMapping(json.data.mapping);
        setMappingMethod(json.data.method);
      } else {
        // Initialize empty mapping
        const emptyMapping: Record<string, KnownField | null> = {};
        headers.forEach((h) => { emptyMapping[h] = null; });
        setMapping(emptyMapping);
      }
    } catch (err) {
      // Initialize empty mapping on error
      const emptyMapping: Record<string, KnownField | null> = {};
      headers.forEach((h) => { emptyMapping[h] = null; });
      setMapping(emptyMapping);
    } finally {
      setMappingLoading(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleMappingChange = (header: string, field: KnownField | '') => {
    setMapping((prev) => {
      const next = { ...prev };
      // If this field is already assigned to another header, unassign it
      if (field) {
        for (const key of Object.keys(next)) {
          if (next[key] === field) {
            next[key] = null;
          }
        }
      }
      next[header] = field === '' ? null : field;
      return next;
    });
  };

  const hasNameMapping = useMemo(
    () => Object.values(mapping).includes('name'),
    [mapping],
  );

  const applyMapping = () => {
    if (!hasNameMapping) {
      setError('You must map at least one column to "Product Name"');
      return;
    }
    setError(null);

    // Build a reverse mapping: field -> header
    const fieldToHeader: Partial<Record<KnownField, string>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field) fieldToHeader[field] = header;
    }

    const rows: ImportRow[] = csvRows.map((row) => {
      const getValue = (field: KnownField): string => {
        const header = fieldToHeader[field];
        if (!header) return '';
        const idx = csvHeaders.indexOf(header);
        return idx >= 0 ? (row[idx] || '').trim() : '';
      };

      const parseNumber = (val: string): number => {
        // Strip currency symbols and commas
        const cleaned = val.replace(/[£$€,]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      const barcodeStr = getValue('barcodes');
      const barcodes = barcodeStr
        ? barcodeStr.split(/[;|]/).map((b) => b.trim()).filter((b) => b.length > 0)
        : [];

      return {
        name: getValue('name'),
        primarySku: getValue('primarySku') || null,
        supplierSku: getValue('supplierSku') || null,
        category: getValue('category') || null,
        barcodes,
        quantityOnHand: parseNumber(getValue('quantityOnHand')),
        quantityInTransit: parseNumber(getValue('quantityInTransit')),
        averageCostGBP: parseNumber(getValue('averageCostGBP')),
        supplier: getValue('supplier') || null,
      };
    }).filter((row) => row.name.length > 0);

    setPreviewRows(rows);
    setStep('preview');
  };

  const updatePreviewRow = (rowIndex: number, field: KnownField, value: string) => {
    setPreviewRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      if (field === 'name' || field === 'primarySku' || field === 'supplierSku' || field === 'category' || field === 'supplier') {
        (row as any)[field] = value || null;
      } else if (field === 'barcodes') {
        row.barcodes = value ? value.split(/[;|,]/).map((b) => b.trim()).filter((b) => b.length > 0) : [];
      } else if (field === 'quantityOnHand' || field === 'quantityInTransit' || field === 'averageCostGBP') {
        const num = parseFloat(value.replace(/[£$€,]/g, ''));
        (row as any)[field] = isNaN(num) ? 0 : num;
      }
      next[rowIndex] = row;
      return next;
    });
  };

  const removePreviewRow = (rowIndex: number) => {
    setPreviewRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleImport = async () => {
    if (previewRows.length === 0) return;

    setStep('importing');
    setError(null);

    try {
      const res = await authenticatedFetch('/api/inventory/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewRows }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to import inventory');
      }

      setImportResult(json.data);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import inventory');
      setStep('preview');
    }
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Primary SKU', 'Supplier SKU', 'Category', 'Barcodes', 'Qty On Hand', 'Avg Cost (GBP)'];
    const sampleRow = ['Pokemon 151 Booster Box', 'PKM-151-BB', 'SUP-PKM-151', 'Pokemon', '4521329401423', '50', '85.00'];
    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push('/inventory')}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#ff6b35] mb-2"
            >
              <span>←</span>
              <span>Back to inventory</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 truncate">Import Inventory</h1>
            <p className="text-xs text-gray-400 mt-1">
              Upload a CSV file with your existing inventory. We&apos;ll auto-detect your columns.
            </p>
          </div>
          {step === 'upload' && (
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-4 py-2 rounded-md border border-[#3a3a3a] text-gray-100 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-xs sm:text-sm font-medium"
            >
              Download Template
            </button>
          )}
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs">
          {(['upload', 'mapping', 'preview', 'done'] as const).map((s, i) => {
            const labels = ['Upload', 'Map Columns', 'Review', 'Done'];
            const isActive = step === s || (step === 'importing' && s === 'done');
            const isPast =
              (s === 'upload' && ['mapping', 'preview', 'importing', 'done'].includes(step)) ||
              (s === 'mapping' && ['preview', 'importing', 'done'].includes(step)) ||
              (s === 'preview' && ['importing', 'done'].includes(step));
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isPast ? 'bg-[#ff6b35]' : 'bg-[#3a3a3a]'}`} />}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    isActive
                      ? 'border-[#ff6b35] bg-[#ff6b35]/10 text-[#ff6b35]'
                      : isPast
                        ? 'border-[#ff6b35]/50 text-[#ff6b35]/70'
                        : 'border-[#3a3a3a] text-gray-500'
                  }`}
                >
                  {isPast ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-mono">{i + 1}</span>
                  )}
                  <span className="font-medium">{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#3a2a2a] border border-red-500 rounded-md px-3 py-2 text-[11px] text-red-200">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? 'border-[#ff6b35] bg-[#ff6b35]/5'
                  : 'border-[#3a3a3a] hover:border-[#ff6b35]/50'
              }`}
            >
              <svg className="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-300 text-sm font-medium mb-1">
                Drag & drop your CSV file here
              </p>
              <p className="text-gray-500 text-xs mb-4">
                or click below to browse
              </p>
              <label className="inline-flex items-center px-4 py-2 rounded-md bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#ff8c42] cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>

            <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
              <h3 className="text-sm font-semibold text-gray-100 mb-2">Accepted formats</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• <strong className="text-gray-300">CSV files</strong> — comma-separated values (.csv)</li>
                <li>• Column headers can use <strong className="text-gray-300">any names</strong> — our AI will auto-detect what each column means</li>
                <li>• If barcodes have multiple values, separate them with semicolons (;)</li>
                <li>• Currency symbols (£, $, €) are automatically stripped from cost values</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            {mappingLoading ? (
              <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-8 text-center">
                <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-300">Analyzing your columns...</p>
                <p className="text-xs text-gray-500 mt-1">Using {mappingMethod === 'ai' ? 'AI' : 'auto-detection'} to map columns</p>
              </div>
            ) : (
              <>
                <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-100">Column Mapping</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        File: <span className="text-gray-300">{fileName}</span> — {csvRows.length} rows detected
                        {mappingMethod && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#ff6b35]/10 text-[#ff6b35]">
                            {mappingMethod === 'ai' ? 'AI mapped' : 'Auto-detected'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {csvHeaders.map((header) => (
                      <div key={header} className="flex items-center gap-3 py-2 px-3 rounded-md bg-[#1a1a1a] border border-[#333333]">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-gray-300 font-mono truncate block">{header}</span>
                          {csvRows[0] && (
                            <span className="text-[10px] text-gray-500 truncate block mt-0.5">
                              e.g. &quot;{csvRows[0][csvHeaders.indexOf(header)] || ''}&quot;
                            </span>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <select
                          value={mapping[header] || ''}
                          onChange={(e) => handleMappingChange(header, e.target.value as KnownField | '')}
                          className={`w-48 rounded-md border text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff6b35] ${
                            mapping[header]
                              ? 'bg-[#ff6b35]/10 border-[#ff6b35]/30 text-[#ff6b35]'
                              : 'bg-[#1a1a1a] border-[#3a3a3a] text-gray-400'
                          }`}
                        >
                          <option value="">— Skip this column —</option>
                          {ALL_FIELDS.map((field) => {
                            const isUsedElsewhere = Object.entries(mapping).some(
                              ([h, f]) => f === field && h !== header,
                            );
                            return (
                              <option key={field} value={field} disabled={isUsedElsewhere}>
                                {FIELD_LABELS[field]}{isUsedElsewhere ? ' (already mapped)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {!hasNameMapping && (
                  <div className="bg-[#3a2a2a] border border-yellow-600/50 rounded-md px-3 py-2 text-[11px] text-yellow-200">
                    You must map at least one column to &quot;Product Name&quot; to continue.
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('upload');
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setMapping({});
                      setFileName('');
                    }}
                    className="px-4 py-2 rounded-md border border-[#3a3a3a] text-gray-300 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={applyMapping}
                    disabled={!hasNameMapping}
                    className="px-4 py-2 rounded-md bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#ff8c42] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Review
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">Review Import</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {previewRows.length} products ready to import. Click any cell to edit.
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {previewRows.filter((r) => (r.quantityOnHand || 0) > 0).length} with stock
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#3a3a3a]">
                      <th className="text-left py-2 px-2 text-gray-400 font-medium w-8">#</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">Name</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">SKU</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">Category</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">Supplier</th>
                      <th className="text-left py-2 px-2 text-gray-400 font-medium">Barcodes</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-medium">On Hand</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-medium">In Transit</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-medium">Cost (GBP)</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-medium">Total Value</th>
                      <th className="text-right py-2 px-2 text-gray-400 font-medium w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-[#333333] hover:bg-[#333333]/30">
                        <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
                        <td className="py-1.5 px-2">
                          {editingCell?.row === i && editingCell?.field === 'name' ? (
                            <input
                              autoFocus
                              defaultValue={row.name}
                              onBlur={(e) => { updatePreviewRow(i, 'name', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'name', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-full bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'name' })}
                              className="text-gray-100 cursor-pointer hover:text-[#ff6b35] block truncate max-w-[300px]"
                            >
                              {row.name || <span className="text-red-400">Missing</span>}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {editingCell?.row === i && editingCell?.field === 'primarySku' ? (
                            <input
                              autoFocus
                              defaultValue={row.primarySku || ''}
                              onBlur={(e) => { updatePreviewRow(i, 'primarySku', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'primarySku', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-full bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs font-mono focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'primarySku' })}
                              className="text-gray-400 cursor-pointer hover:text-[#ff6b35] font-mono"
                            >
                              {row.primarySku || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {editingCell?.row === i && editingCell?.field === 'category' ? (
                            <input
                              autoFocus
                              defaultValue={row.category || ''}
                              onBlur={(e) => { updatePreviewRow(i, 'category', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'category', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-full bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'category' })}
                              className="text-gray-400 cursor-pointer hover:text-[#ff6b35]"
                            >
                              {row.category || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {editingCell?.row === i && editingCell?.field === 'supplier' ? (
                            <input
                              autoFocus
                              defaultValue={row.supplier || ''}
                              onBlur={(e) => { updatePreviewRow(i, 'supplier', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'supplier', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-full bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'supplier' })}
                              className="text-gray-400 cursor-pointer hover:text-[#ff6b35]"
                            >
                              {row.supplier || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-gray-400 font-mono text-[10px]">
                            {(row.barcodes || []).join('; ') || '—'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {editingCell?.row === i && editingCell?.field === 'quantityOnHand' ? (
                            <input
                              autoFocus
                              type="number"
                              defaultValue={row.quantityOnHand || 0}
                              onBlur={(e) => { updatePreviewRow(i, 'quantityOnHand', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'quantityOnHand', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-20 bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs text-right focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'quantityOnHand' })}
                              className={`cursor-pointer hover:text-[#ff6b35] ${(row.quantityOnHand || 0) > 0 ? 'text-gray-100' : 'text-gray-500'}`}
                            >
                              {row.quantityOnHand || 0}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {editingCell?.row === i && editingCell?.field === 'quantityInTransit' ? (
                            <input
                              autoFocus
                              type="number"
                              defaultValue={row.quantityInTransit || 0}
                              onBlur={(e) => { updatePreviewRow(i, 'quantityInTransit', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'quantityInTransit', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-20 bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs text-right focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'quantityInTransit' })}
                              className={`cursor-pointer hover:text-[#ff6b35] ${(row.quantityInTransit || 0) > 0 ? 'text-blue-400' : 'text-gray-500'}`}
                            >
                              {row.quantityInTransit || 0}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {editingCell?.row === i && editingCell?.field === 'averageCostGBP' ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              defaultValue={row.averageCostGBP || 0}
                              onBlur={(e) => { updatePreviewRow(i, 'averageCostGBP', e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updatePreviewRow(i, 'averageCostGBP', (e.target as HTMLInputElement).value); setEditingCell(null); } }}
                              className="w-24 bg-[#1a1a1a] border border-[#ff6b35] rounded px-1 py-0.5 text-gray-100 text-xs text-right focus:outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ row: i, field: 'averageCostGBP' })}
                              className={`cursor-pointer hover:text-[#ff6b35] ${(row.averageCostGBP || 0) > 0 ? 'text-gray-100' : 'text-gray-500'}`}
                            >
                              £{(row.averageCostGBP || 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <span className={`${((row.quantityOnHand || 0) + (row.quantityInTransit || 0)) * (row.averageCostGBP || 0) > 0 ? 'text-gray-100' : 'text-gray-500'}`}>
                            £{(((row.quantityOnHand || 0) + (row.quantityInTransit || 0)) * (row.averageCostGBP || 0)).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => removePreviewRow(i)}
                            className="text-gray-500 hover:text-red-400 text-xs"
                            title="Remove row"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-4">
              <h3 className="text-sm font-semibold text-gray-100 mb-2">Import Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-gray-400">Total products</p>
                  <p className="text-lg font-semibold text-gray-100">{previewRows.length}</p>
                </div>
                <div>
                  <p className="text-gray-400">With stock</p>
                  <p className="text-lg font-semibold text-gray-100">
                    {previewRows.filter((r) => ((r.quantityOnHand || 0) + (r.quantityInTransit || 0)) > 0).length}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Total units</p>
                  <p className="text-lg font-semibold text-gray-100">
                    {previewRows.reduce((sum, r) => sum + (r.quantityOnHand || 0) + (r.quantityInTransit || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Total value</p>
                  <p className="text-lg font-semibold text-gray-100">
                    £{previewRows.reduce((sum, r) => sum + ((r.quantityOnHand || 0) + (r.quantityInTransit || 0)) * (r.averageCostGBP || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="px-4 py-2 rounded-md border border-[#3a3a3a] text-gray-300 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={previewRows.length === 0}
                className="px-6 py-2 rounded-md bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#ff8c42] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {previewRows.length} Products
              </button>
            </div>
          </div>
        )}

        {/* Step 3.5: Importing */}
        {step === 'importing' && (
          <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] p-8 text-center">
            <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-300">Importing {previewRows.length} products...</p>
            <p className="text-xs text-gray-500 mt-1">This may take a moment for large imports</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-4">
            <div className="bg-[#1a2a1a] border border-green-600/50 rounded-lg p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">Import Complete</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4 max-w-md mx-auto">
                <div>
                  <p className="text-gray-400">Total</p>
                  <p className="text-xl font-semibold text-gray-100">{importResult.total}</p>
                </div>
                <div>
                  <p className="text-gray-400">Created</p>
                  <p className="text-xl font-semibold text-green-400">{importResult.created}</p>
                </div>
                <div>
                  <p className="text-gray-400">Updated</p>
                  <p className="text-xl font-semibold text-blue-400">{importResult.updated}</p>
                </div>
                <div>
                  <p className="text-gray-400">Skipped</p>
                  <p className="text-xl font-semibold text-yellow-400">{importResult.skipped}</p>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4 text-left bg-[#2a2a2a] rounded-md p-3 max-w-lg mx-auto">
                  <p className="text-xs font-medium text-yellow-300 mb-1">Warnings:</p>
                  <ul className="text-[10px] text-gray-400 space-y-0.5">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...and {importResult.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/inventory')}
                className="px-6 py-2 rounded-md bg-[#ff6b35] text-white text-sm font-medium hover:bg-[#ff8c42]"
              >
                Go to Inventory
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setCsvHeaders([]);
                  setCsvRows([]);
                  setMapping({});
                  setPreviewRows([]);
                  setImportResult(null);
                  setFileName('');
                  setError(null);
                }}
                className="px-4 py-2 rounded-md border border-[#3a3a3a] text-gray-300 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-sm"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
