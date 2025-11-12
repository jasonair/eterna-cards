'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface UploadResponse {
  success: boolean;
  data?: {
    supplierId: string;
    purchaseOrderId: string;
    supplier: {
      name: string;
      address: string | null;
      email: string | null;
      phone: string | null;
      vatNumber: string | null;
    };
    purchaseOrder: {
      invoiceNumber: string;
      invoiceDate: string | null;
      currency: string;
      paymentTerms: string | null;
    };
    poLines: Array<{
      description: string;
      supplierSku: string | null;
      quantity: number;
      unitCostExVAT: number;
      lineTotalExVAT: number;
    }>;
    totals: {
      subTotalExVAT: number | null;
      vatTotal: number | null;
      grandTotal: number | null;
    };
    savedLines: number;
  };
  error?: string;
  rawResponse?: string;
}

interface FileUploadResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  data?: UploadResponse;
  error?: string;
  matchGroup?: number; // Group ID for matched documents
}

interface MatchedGroup {
  groupId: number;
  files: File[];
  results: FileUploadResult[];
  matchReason: string;
  confidence: 'high' | 'medium';
}

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedGroups, setMatchedGroups] = useState<MatchedGroup[]>([]);
  const [showMatchReview, setShowMatchReview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

  const navigateToView = () => {
    router.push('/purchasing/view');
  };

  // Conservative matching logic - only matches if highly confident
  const findMatchingDocuments = (results: FileUploadResult[]): MatchedGroup[] => {
    const groups: MatchedGroup[] = [];
    const processed = new Set<number>();
    let groupId = 0;

    results.forEach((result, index) => {
      if (processed.has(index) || result.status !== 'success' || !result.data?.success) return;

      const matches: number[] = [index];
      const currentData = result.data.data;

      // Look for matches in remaining results
      results.forEach((otherResult, otherIndex) => {
        if (
          otherIndex <= index ||
          processed.has(otherIndex) ||
          otherResult.status !== 'success' ||
          !otherResult.data?.success
        ) return;

        const otherData = otherResult.data.data;
        
        // CONSERVATIVE MATCHING CRITERIA - ALL must match
        const sameSupplier = currentData?.supplier.name === otherData?.supplier.name;
        const sameInvoiceNumber = currentData?.purchaseOrder.invoiceNumber === otherData?.purchaseOrder.invoiceNumber;
        const sameDate = currentData?.purchaseOrder.invoiceDate === otherData?.purchaseOrder.invoiceDate;
        const sameCurrency = currentData?.purchaseOrder.currency === otherData?.purchaseOrder.currency;
        
        // HIGH CONFIDENCE: Invoice number + supplier + date all match
        if (sameSupplier && sameInvoiceNumber && sameDate && currentData?.purchaseOrder.invoiceNumber && currentData.purchaseOrder.invoiceNumber.trim() !== '') {
          matches.push(otherIndex);
          processed.add(otherIndex);
        }
        // MEDIUM CONFIDENCE: Same supplier + same date + same currency (but no invoice number)
        else if (
          sameSupplier && 
          sameDate && 
          sameCurrency && 
          (!currentData?.purchaseOrder.invoiceNumber || currentData.purchaseOrder.invoiceNumber.trim() === '') &&
          (!otherData?.purchaseOrder.invoiceNumber || otherData.purchaseOrder.invoiceNumber.trim() === '')
        ) {
          // Only match if uploaded within 1 second of each other (same batch)
          const timeDiff = Math.abs(index - otherIndex);
          if (timeDiff <= 5) { // Adjacent or very close in upload order
            matches.push(otherIndex);
            processed.add(otherIndex);
          }
        }
      });

      if (matches.length > 1) {
        processed.add(index);
        const matchedResults = matches.map(i => results[i]);
        const firstData = matchedResults[0].data?.data;
        
        let matchReason = '';
        let confidence: 'high' | 'medium' = 'high';
        
        if (firstData?.purchaseOrder.invoiceNumber && firstData.purchaseOrder.invoiceNumber.trim() !== '') {
          matchReason = `Same invoice number (${firstData.purchaseOrder.invoiceNumber}), supplier, and date`;
          confidence = 'high';
        } else {
          matchReason = `Same supplier (${firstData?.supplier.name}), date, and currency - uploaded together`;
          confidence = 'medium';
        }

        groups.push({
          groupId: groupId++,
          files: matches.map(i => results[i].file),
          results: matchedResults,
          matchReason,
          confidence,
        });
      }
    });

    return groups;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setUploadResults([]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (loading) return;

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      return isImage || isPDF;
    });

    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      setUploadResults([]);
      setError(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadResults(prev => prev.filter((_, i) => i !== index));
  };

  const handleMergeMatches = async () => {
    setShowMatchReview(false);
    
    // Merge each group
    for (const group of matchedGroups) {
      if (group.results.length < 2) continue;

      try {
        // Use the first PO as the target, merge others into it
        const targetPOId = group.results[0].data?.data?.purchaseOrderId;
        
        for (let i = 1; i < group.results.length; i++) {
          const sourcePOId = group.results[i].data?.data?.purchaseOrderId;
          
          if (targetPOId && sourcePOId) {
            await fetch('/api/purchasing/po/merge', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sourcePOId,
                targetPOId,
              }),
            });
          }
        }
      } catch (err) {
        console.error('Error merging matched documents:', err);
      }
    }

    // Clear state and navigate
    setMatchedGroups([]);
    setTimeout(() => navigateToView(), 500);
  };

  const handleSkipMerge = () => {
    setShowMatchReview(false);
    setMatchedGroups([]);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    setError(null);

    // Initialize results for all files
    const initialResults: FileUploadResult[] = files.map(file => ({
      file,
      status: 'pending' as const,
    }));
    setUploadResults(initialResults);

    // Process files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update status to processing
      setUploadResults(prev => prev.map((result, idx) => 
        idx === i ? { ...result, status: 'processing' as const } : result
      ));

      try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Send to API
        const response = await fetch('/api/purchasing/po/import', {
          method: 'POST',
          body: formData,
        });

        const data: UploadResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        // Update with success
        setUploadResults(prev => prev.map((result, idx) => 
          idx === i ? { ...result, status: 'success' as const, data } : result
        ));
      } catch (err) {
        // Update with error
        setUploadResults(prev => prev.map((result, idx) => 
          idx === i ? { 
            ...result, 
            status: 'error' as const, 
            error: err instanceof Error ? err.message : 'An error occurred' 
          } : result
        ));
      }
    }

    // After all files are processed, check for matches
    // Need to get the final state after all updates
    setTimeout(() => {
      setLoading(false);
      
      setUploadResults(currentResults => {
        const successResults = currentResults.filter(r => r.status === 'success');
        if (successResults.length > 1) {
          const groups = findMatchingDocuments(successResults);
          if (groups.length > 0) {
            setMatchedGroups(groups);
            setShowMatchReview(true);
          }
        }
        return currentResults;
      });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Purchase Order Import
            </h1>
            <p className="text-gray-600">
              Upload invoice files (PNG, JPG, or PDF) to extract structured data using AI
            </p>
            <p className="text-sm text-gray-500 mt-2">
              💡 Tip: You can select multiple files at once for batch processing
            </p>
          </div>
          <button
            onClick={navigateToView}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View All Purchase Orders
          </button>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Upload Invoice Files (PNG, JPG, or PDF)
              </label>
              
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.pdf,application/pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                
                <div className="py-12 px-6 text-center">
                  <svg
                    className={`mx-auto h-16 w-16 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                    <span className="font-semibold text-blue-600 hover:text-blue-500">
                      Click to upload
                    </span>
                    <span className="pl-1">or drag and drop</span>
                  </div>
                  <p className="text-xs leading-5 text-gray-600 mt-2">
                    PNG, JPG, or PDF files (multiple files supported)
                  </p>
                </div>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {files.length} file{files.length > 1 ? 's' : ''} selected:
                  </p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{file.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({(file.size / 1024).toFixed(2)} KB)</span>
                        </div>
                      </div>
                      {!loading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={files.length === 0 || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                  Processing {uploadResults.filter(r => r.status === 'processing').length > 0 ? `(${uploadResults.filter(r => r.status === 'success').length + uploadResults.filter(r => r.status === 'error').length}/${files.length})` : '...'}
                </span>
              ) : (
                'Upload & Extract'
              )}
            </button>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Results Display */}
        {uploadResults.length > 0 && (
          <div className="space-y-4">
            {uploadResults.map((result, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && (
                      <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {result.status === 'error' && (
                      <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {result.status === 'processing' && (
                      <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {result.status === 'pending' && (
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">{result.file.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    result.status === 'success' ? 'bg-green-100 text-green-800' :
                    result.status === 'error' ? 'bg-red-100 text-red-800' :
                    result.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </span>
                </div>

                {result.status === 'success' && result.data?.success && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Supplier</p>
                      <p className="text-sm font-medium text-gray-900">{result.data.data?.supplier.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Invoice #</p>
                      <p className="text-sm font-medium text-gray-900">{result.data.data?.purchaseOrder.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lines</p>
                      <p className="text-sm font-medium text-gray-900">{result.data.data?.savedLines}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-sm font-medium text-gray-900">
                        {result.data.data?.purchaseOrder.currency} {result.data.data?.totals.grandTotal?.toFixed(2) || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {result.status === 'error' && (
                  <div className="text-sm text-red-700">
                    <p className="font-medium">Error:</p>
                    <p>{result.error}</p>
                  </div>
                )}

                {result.status === 'processing' && (
                  <p className="text-sm text-gray-600">Processing file...</p>
                )}
              </div>
            ))}

            {uploadResults.some(r => r.status === 'success') && !loading && (
              <div className="pt-4">
                <button
                  onClick={navigateToView}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View All Purchase Orders
                </button>
              </div>
            )}
          </div>
        )}

        {/* Match Review Modal */}
        {showMatchReview && matchedGroups.length > 0 && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Matching Documents Detected
                  </h3>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">Smart Matching</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        The AI detected {matchedGroups.length} group{matchedGroups.length !== 1 ? 's' : ''} of documents that appear to be from the same order. 
                        Would you like to automatically combine them into single purchase orders?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {matchedGroups.map((group) => (
                    <div key={group.groupId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            group.confidence === 'high' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {group.confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {group.files.length} documents
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        <strong>Match Reason:</strong> {group.matchReason}
                      </p>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">Files to be merged:</p>
                        {group.files.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({group.results[idx].data?.data?.savedLines || 0} lines)
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          <strong>Result:</strong> Will create 1 purchase order with {' '}
                          {group.results.reduce((sum, r) => sum + (r.data?.data?.savedLines || 0), 0)} total line items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleSkipMerge}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Keep Separate
                  </button>
                  <button
                    onClick={handleMergeMatches}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Merge Matched Documents
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
