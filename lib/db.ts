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
  invoiceNumber: string;
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
