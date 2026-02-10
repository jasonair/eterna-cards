import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

const KNOWN_FIELDS = [
  'name',
  'primarySku',
  'supplierSku',
  'category',
  'barcodes',
  'quantityOnHand',
  'quantityInTransit',
  'averageCostGBP',
  'supplier',
] as const;

type KnownField = (typeof KNOWN_FIELDS)[number];

// Common aliases for automatic matching (no AI needed)
const COLUMN_ALIASES: Record<string, KnownField> = {
  'name': 'name',
  'product': 'name',
  'product name': 'name',
  'item': 'name',
  'item name': 'name',
  'description': 'name',
  'title': 'name',
  'sku': 'primarySku',
  'primary sku': 'primarySku',
  'item code': 'primarySku',
  'product code': 'primarySku',
  'part number': 'primarySku',
  'part #': 'primarySku',
  'ref': 'primarySku',
  'reference': 'primarySku',
  'supplier sku': 'supplierSku',
  'supplier code': 'supplierSku',
  'vendor sku': 'supplierSku',
  'category': 'category',
  'folder': 'category',
  'group': 'category',
  'type': 'category',
  'barcode': 'barcodes',
  'barcodes': 'barcodes',
  'ean': 'barcodes',
  'upc': 'barcodes',
  'gtin': 'barcodes',
  'quantity': 'quantityOnHand',
  'qty': 'quantityOnHand',
  'qty on hand': 'quantityOnHand',
  'quantity on hand': 'quantityOnHand',
  'stock': 'quantityOnHand',
  'stock level': 'quantityOnHand',
  'on hand': 'quantityOnHand',
  'in stock': 'quantityOnHand',
  'count': 'quantityOnHand',
  'qty in transit': 'quantityInTransit',
  'quantity in transit': 'quantityInTransit',
  'in transit': 'quantityInTransit',
  'transit': 'quantityInTransit',
  'cost': 'averageCostGBP',
  'avg cost': 'averageCostGBP',
  'average cost': 'averageCostGBP',
  'unit cost': 'averageCostGBP',
  'price': 'averageCostGBP',
  'cost price': 'averageCostGBP',
  'buy price': 'averageCostGBP',
  'purchase price': 'averageCostGBP',
  'avg cost (gbp)': 'averageCostGBP',
  'cost (gbp)': 'averageCostGBP',
  'unit cost (gbp)': 'averageCostGBP',
  'supplier': 'supplier',
  'supplier name': 'supplier',
  'vendor': 'supplier',
  'vendor name': 'supplier',
};

function tryLocalMapping(headers: string[]): Record<string, KnownField | null> {
  const mapping: Record<string, KnownField | null> = {};
  const usedFields = new Set<KnownField>();

  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    const match = COLUMN_ALIASES[normalized];
    if (match && !usedFields.has(match)) {
      mapping[header] = match;
      usedFields.add(match);
    } else {
      mapping[header] = null;
    }
  }

  return mapping;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const headers: string[] = body.headers;
    const sampleRows: string[][] = body.sampleRows;

    if (!Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json(
        { error: 'No headers provided' },
        { status: 400 },
      );
    }

    // Step 1: Try local matching first
    const localMapping = tryLocalMapping(headers);
    const unmappedHeaders = headers.filter((h) => localMapping[h] === null);
    const hasName = Object.values(localMapping).includes('name');

    // If all important columns are mapped (at least name + one numeric), skip AI
    if (hasName && unmappedHeaders.length <= Math.floor(headers.length / 2)) {
      return NextResponse.json({
        success: true,
        data: {
          mapping: localMapping,
          method: 'local',
        },
      });
    }

    // Step 2: Fall back to Gemini for unmapped columns
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // No API key - return local mapping as-is
      return NextResponse.json({
        success: true,
        data: {
          mapping: localMapping,
          method: 'local',
          warning: 'Some columns could not be auto-mapped. Gemini API key not configured for AI mapping.',
        },
      });
    }

    const prompt = `You are mapping CSV column headers to a product inventory schema.

The target fields are:
- name (required): Product name / description
- primarySku: SKU, item code, product code
- supplierSku: Supplier-specific SKU
- category: Product category, folder, group
- barcodes: Barcode, EAN, UPC, GTIN
- quantityOnHand: Quantity in stock, count
- quantityInTransit: Quantity in transit, not yet received
- averageCostGBP: Unit cost, purchase price (in GBP)
- supplier: Supplier or vendor name

The CSV has these headers: ${JSON.stringify(headers)}

${sampleRows && sampleRows.length > 0 ? `Here are the first ${sampleRows.length} sample data rows for context:\n${sampleRows.map((row) => JSON.stringify(row)).join('\n')}` : ''}

Return a JSON object mapping each CSV header to one of the target fields above, or null if it doesn't match any field.
Each target field should only be used ONCE (pick the best match).
"name" MUST be mapped to exactly one column.

Example output:
{"Product Name": "name", "SKU": "primarySku", "Stock": "quantityOnHand", "Notes": null}

Return ONLY the JSON object, no commentary.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) {
        console.error('Gemini API error:', await response.text());
        // Fall back to local mapping
        return NextResponse.json({
          success: true,
          data: {
            mapping: localMapping,
            method: 'local',
            warning: 'AI mapping failed, using best-effort local mapping.',
          },
        });
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const aiMapping: Record<string, string | null> = JSON.parse(cleanedText);

      // Validate AI mapping: only allow known fields
      const validatedMapping: Record<string, KnownField | null> = {};
      const usedFields = new Set<KnownField>();

      for (const header of headers) {
        const aiField = aiMapping[header];
        if (aiField && KNOWN_FIELDS.includes(aiField as KnownField) && !usedFields.has(aiField as KnownField)) {
          validatedMapping[header] = aiField as KnownField;
          usedFields.add(aiField as KnownField);
        } else if (localMapping[header]) {
          validatedMapping[header] = localMapping[header];
          if (localMapping[header]) usedFields.add(localMapping[header]!);
        } else {
          validatedMapping[header] = null;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          mapping: validatedMapping,
          method: 'ai',
        },
      });
    } catch (aiError) {
      console.error('AI mapping error:', aiError);
      return NextResponse.json({
        success: true,
        data: {
          mapping: localMapping,
          method: 'local',
          warning: 'AI mapping failed, using best-effort local mapping.',
        },
      });
    }
  } catch (error) {
    console.error('Map columns error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to map columns' },
      { status: 500 },
    );
  }
}
