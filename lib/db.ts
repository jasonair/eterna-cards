import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Define the database schema types
export interface Supplier {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  paymentTerms: string | null;
  createdAt: string;
}

export interface POLine {
  id: string;
  purchaseOrderId: string;
  description: string;
  supplierSku: string | null;
  quantity: number;
  unitCostExVAT: number;
  lineTotalExVAT: number;
}

export interface Totals {
  subTotalExVAT: number | null;
  vatTotal: number | null;
  grandTotal: number | null;
}

export interface DatabaseSchema {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  poLines: POLine[];
}

// Database file path
const dbPath = path.join(process.cwd(), 'data', 'db.json');

// Ensure the data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Initialize the database
let db: Low<DatabaseSchema> | null = null;

export async function getDb(): Promise<Low<DatabaseSchema>> {
  if (db) return db;

  ensureDataDirectory();

  // Create adapter and database instance
  const adapter = new JSONFile<DatabaseSchema>(dbPath);
  db = new Low<DatabaseSchema>(adapter, { suppliers: [], purchaseOrders: [], poLines: [] });

  // Read data from JSON file (or use default if file doesn't exist)
  await db.read();

  // Initialize with default data if empty
  if (!db.data) {
    db.data = { suppliers: [], purchaseOrders: [], poLines: [] };
    await db.write();
  }

  return db;
}

// Helper function to find or create a supplier
export async function findOrCreateSupplier(
  supplierData: Omit<Supplier, 'id' | 'createdAt'>
): Promise<string> {
  const database = await getDb();

  // Validate that supplier name is not null or empty
  if (!supplierData.name || supplierData.name.trim() === '') {
    throw new Error('Supplier name is required');
  }

  // Try to find existing supplier by name (case-insensitive)
  const existing = database.data.suppliers.find(
    (s) => s.name?.toLowerCase() === supplierData.name?.toLowerCase()
  );

  if (existing) {
    return existing.id;
  }

  // Create new supplier
  const newSupplier: Supplier = {
    id: crypto.randomUUID(),
    ...supplierData,
    createdAt: new Date().toISOString(),
  };

  database.data.suppliers.push(newSupplier);
  await database.write();

  return newSupplier.id;
}

// Helper function to create a purchase order
export async function createPurchaseOrder(
  poData: Omit<PurchaseOrder, 'id' | 'createdAt'>
): Promise<string> {
  const database = await getDb();

  const newPO: PurchaseOrder = {
    id: crypto.randomUUID(),
    ...poData,
    createdAt: new Date().toISOString(),
  };

  database.data.purchaseOrders.push(newPO);
  await database.write();

  return newPO.id;
}

// Helper function to update a purchase order
export async function updatePurchaseOrder(
  poId: string,
  updates: Partial<Omit<PurchaseOrder, 'id' | 'createdAt'>>
): Promise<PurchaseOrder | null> {
  const database = await getDb();

  const poIndex = database.data.purchaseOrders.findIndex(po => po.id === poId);
  if (poIndex === -1) {
    return null;
  }

  // Update the PO with the provided fields
  database.data.purchaseOrders[poIndex] = {
    ...database.data.purchaseOrders[poIndex],
    ...updates,
  };

  await database.write();
  return database.data.purchaseOrders[poIndex];
}

// Helper function to create PO lines
export async function createPOLines(
  lines: Omit<POLine, 'id'>[]
): Promise<POLine[]> {
  const database = await getDb();

  const newLines: POLine[] = lines.map((line) => ({
    id: crypto.randomUUID(),
    ...line,
  }));

  database.data.poLines.push(...newLines);
  await database.write();

  return newLines;
}

// Helper function to update a line item
export async function updatePOLine(
  lineId: string,
  updates: Partial<Omit<POLine, 'id' | 'purchaseOrderId'>>
): Promise<POLine | null> {
  const database = await getDb();

  const lineIndex = database.data.poLines.findIndex(line => line.id === lineId);
  if (lineIndex === -1) {
    return null;
  }

  // Update the line item with the provided fields
  database.data.poLines[lineIndex] = {
    ...database.data.poLines[lineIndex],
    ...updates,
  };

  await database.write();
  return database.data.poLines[lineIndex];
}

// Helper function to delete a line item
export async function deletePOLine(lineId: string): Promise<boolean> {
  const database = await getDb();

  const lineIndex = database.data.poLines.findIndex(line => line.id === lineId);
  if (lineIndex === -1) {
    return false;
  }

  database.data.poLines.splice(lineIndex, 1);
  await database.write();
  return true;
}

// Helper function to delete a supplier
export async function deleteSupplier(supplierId: string): Promise<{
  success: boolean;
  deletedPurchaseOrders: number;
  deletedLines: number;
}> {
  const database = await getDb();

  // Find all purchase orders for this supplier
  const supplierPOs = database.data.purchaseOrders.filter(
    (po) => po.supplierId === supplierId
  );
  const poIds = supplierPOs.map((po) => po.id);

  // Delete all line items for these purchase orders
  const linesBefore = database.data.poLines.length;
  database.data.poLines = database.data.poLines.filter(
    (line) => !poIds.includes(line.purchaseOrderId)
  );
  const deletedLines = linesBefore - database.data.poLines.length;

  // Delete all purchase orders for this supplier
  database.data.purchaseOrders = database.data.purchaseOrders.filter(
    (po) => po.supplierId !== supplierId
  );

  // Delete the supplier
  database.data.suppliers = database.data.suppliers.filter(
    (s) => s.id !== supplierId
  );

  await database.write();

  return {
    success: true,
    deletedPurchaseOrders: supplierPOs.length,
    deletedLines,
  };
}

// Interface for duplicate detection result
export interface DuplicateMatch {
  purchaseOrder: PurchaseOrder;
  supplier: Supplier;
  matchScore: number;
  matchReasons: string[];
  lineCount: number;
}

// Helper function to detect duplicate purchase orders
export async function findDuplicatePurchaseOrders(
  supplierName: string,
  invoiceNumber: string | null,
  invoiceDate: string | null,
  poLines: Array<{ description: string; quantity: number; unitCostExVAT: number }>
): Promise<DuplicateMatch[]> {
  const database = await getDb();
  const duplicates: DuplicateMatch[] = [];

  // Find supplier by name (case-insensitive)
  const supplier = database.data.suppliers.find(
    (s) => s.name?.toLowerCase() === supplierName?.toLowerCase()
  );

  if (!supplier) {
    // No supplier found, so no duplicates possible
    return [];
  }

  // Get all purchase orders for this supplier
  const supplierPOs = database.data.purchaseOrders.filter(
    (po) => po.supplierId === supplier.id
  );

  for (const po of supplierPOs) {
    const matchReasons: string[] = [];
    let matchScore = 0;

    // Check invoice number match (strong indicator)
    if (invoiceNumber && po.invoiceNumber && 
        invoiceNumber.toLowerCase() === po.invoiceNumber.toLowerCase()) {
      matchReasons.push('Same invoice number');
      matchScore += 50;
    }

    // Check invoice date match
    if (invoiceDate && po.invoiceDate && invoiceDate === po.invoiceDate) {
      matchReasons.push('Same invoice date');
      matchScore += 20;
    }

    // Get line items for this PO
    const existingLines = database.data.poLines.filter(
      (line) => line.purchaseOrderId === po.id
    );

    // Check if line items are similar
    if (existingLines.length === poLines.length && poLines.length > 0) {
      matchReasons.push('Same number of line items');
      matchScore += 10;

      // Check for matching line items
      let matchingLines = 0;
      for (const newLine of poLines) {
        const similarLine = existingLines.find(
          (existingLine) =>
            existingLine.description.toLowerCase().includes(newLine.description.toLowerCase().substring(0, 20)) ||
            newLine.description.toLowerCase().includes(existingLine.description.toLowerCase().substring(0, 20)) ||
            (Math.abs(existingLine.unitCostExVAT - newLine.unitCostExVAT) < 0.01 &&
             existingLine.quantity === newLine.quantity)
        );
        if (similarLine) {
          matchingLines++;
        }
      }

      if (matchingLines > 0) {
        const matchPercentage = (matchingLines / poLines.length) * 100;
        matchReasons.push(`${matchingLines}/${poLines.length} similar line items`);
        matchScore += matchPercentage * 0.2; // Up to 20 points for 100% match
      }
    }

    // If match score is significant, add to duplicates
    if (matchScore >= 30) {
      duplicates.push({
        purchaseOrder: po,
        supplier,
        matchScore,
        matchReasons,
        lineCount: existingLines.length,
      });
    }
  }

  // Sort by match score (highest first)
  duplicates.sort((a, b) => b.matchScore - a.matchScore);

  return duplicates;
}
