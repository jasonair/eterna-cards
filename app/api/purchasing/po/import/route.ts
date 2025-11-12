import { NextRequest, NextResponse } from 'next/server';
import {
  findOrCreateSupplier,
  createPurchaseOrder,
  createPOLines,
  type Totals,
} from '@/lib/db';

// Force Node.js runtime to support pdf-parse
export const runtime = 'nodejs';

// Gemini prompt for structured data extraction
const EXTRACTION_PROMPT = `You are running inside the Google Gemini API.
Input: an invoice (PDF text). Output: a single valid JSON object in this schema:

{
  "supplier": {
    "name": "string",
    "address": "string | null",
    "email": "string | null",
    "phone": "string | null",
    "vatNumber": "string | null"
  },
  "purchaseOrder": {
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD | null",
    "originalCurrency": "ISO code (GBP, EUR, USD, etc.) - the currency shown on the invoice",
    "paymentTerms": "string | null"
  },
  "poLines": [
    {
      "description": "string",
      "supplierSku": "string | null",
      "quantity": number,
      "unitCostExVAT": number,
      "lineTotalExVAT": number
    }
  ],
  "totals": {
    "subTotalExVAT": number | null,
    "vatTotal": number | null,
    "grandTotal": number | null
  }
}

Rules:
- Return valid JSON only, no commentary.
- Convert all prices to numeric values.
- **CRITICAL: If the invoice is NOT in GBP, you MUST convert ALL monetary values (unitCostExVAT, lineTotalExVAT, subTotalExVAT, vatTotal, grandTotal) to GBP using current exchange rates.**
- Store the original currency in "originalCurrency" field.
- After conversion, all prices should be in GBP.
- If a field is missing, return null.
- Merge lines across multiple pages.

Here is the invoice text:

`;

interface ExtractedData {
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
    originalCurrency: string;
    paymentTerms: string | null;
  };
  poLines: Array<{
    description: string;
    supplierSku: string | null;
    quantity: number;
    unitCostExVAT: number;
    lineTotalExVAT: number;
  }>;
  totals: Totals;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured in environment variables' },
        { status: 500 }
      );
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - images or PDF
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (!isImage && !isPDF) {
      return NextResponse.json(
        { error: 'Please upload an image file (PNG, JPG) or PDF.' },
        { status: 400 }
      );
    }

    // 3. Prepare file for Gemini
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    
    // Determine MIME type
    let mimeType = file.type;
    if (isPDF && !mimeType) {
      mimeType = 'application/pdf';
    }

    // 4. Send to Gemini API v1 endpoint directly (bypass SDK)
    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const prompt = EXTRACTION_PROMPT + `\n\nPlease analyze this invoice ${isPDF ? 'PDF' : 'image'} and extract the data.`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          filePart
        ]
      }]
    };

    let text;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        return NextResponse.json(
          { error: `Gemini API error: ${response.status} ${response.statusText}`, details: errorText },
          { status: 500 }
        );
      }

      const data = await response.json();
      text = data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API error:', error);
      return NextResponse.json(
        { error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 5. Parse JSON response from Gemini
    let extractedData: ExtractedData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanedText);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Raw response:', text);
      return NextResponse.json(
        { 
          error: 'Failed to parse Gemini response as JSON',
          rawResponse: text 
        },
        { status: 500 }
      );
    }

    // 6. Validate extracted data
    if (!extractedData.supplier?.name) {
      return NextResponse.json(
        { 
          error: 'Failed to extract supplier name from invoice. Please ensure the image is clear and contains supplier information.',
          extractedData 
        },
        { status: 400 }
      );
    }

    // 7. Save to lowdb database
    try {
      // Create or find supplier
      const supplierId = await findOrCreateSupplier({
        name: extractedData.supplier.name,
        address: extractedData.supplier.address,
        email: extractedData.supplier.email,
        phone: extractedData.supplier.phone,
        vatNumber: extractedData.supplier.vatNumber,
      });

      // Create purchase order (always store as GBP since AI converts)
      const purchaseOrderId = await createPurchaseOrder({
        supplierId,
        invoiceNumber: extractedData.purchaseOrder.invoiceNumber,
        invoiceDate: extractedData.purchaseOrder.invoiceDate,
        currency: 'GBP', // All prices are converted to GBP by AI
        paymentTerms: extractedData.purchaseOrder.paymentTerms,
      });

      // Create PO lines
      const poLines = await createPOLines(
        extractedData.poLines.map((line) => ({
          purchaseOrderId,
          description: line.description,
          supplierSku: line.supplierSku,
          quantity: line.quantity,
          unitCostExVAT: line.unitCostExVAT,
          lineTotalExVAT: line.lineTotalExVAT,
        }))
      );

      // 8. Return success response with all data
      return NextResponse.json({
        success: true,
        data: {
          supplierId,
          purchaseOrderId,
          supplier: extractedData.supplier,
          purchaseOrder: {
            ...extractedData.purchaseOrder,
            currency: 'GBP', // Confirm all values are in GBP
          },
          poLines: extractedData.poLines,
          totals: extractedData.totals,
          savedLines: poLines.length,
          originalCurrency: extractedData.purchaseOrder.originalCurrency,
        },
      });
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save data to database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
