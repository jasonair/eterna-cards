import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for pdf-parse
export const runtime = 'nodejs';

// Function to get current exchange rates
async function getExchangeRates(): Promise<{ [key: string]: number }> {
  try {
    // Using exchangerate-api.com free tier (no API key needed for basic usage)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
    if (!response.ok) {
      console.warn('Failed to fetch exchange rates, using fallback rates');
      return getFallbackRates();
    }
    const data = await response.json();
    // Convert to rates FROM other currencies TO GBP
    const rates: { [key: string]: number } = {};
    for (const [currency, rate] of Object.entries(data.rates)) {
      rates[currency] = 1 / (rate as number);
    }
    return rates;
  } catch (error) {
    console.warn('Error fetching exchange rates, using fallback:', error);
    return getFallbackRates();
  }
}

// Fallback exchange rates (approximate, updated Nov 2024)
// These are rates TO convert TO GBP (multiply foreign currency by this rate)
function getFallbackRates(): { [key: string]: number } {
  return {
    'GBP': 1.0,
    'USD': 0.79,      // 1 USD = 0.79 GBP
    'EUR': 0.85,      // 1 EUR = 0.85 GBP
    'JPY': 0.00493,   // 1 JPY = 0.00493 GBP (667,996 JPY = ~3,290 GBP)
    'AUD': 0.52,      // 1 AUD = 0.52 GBP
    'CAD': 0.57,      // 1 CAD = 0.57 GBP
    'CHF': 0.90,      // 1 CHF = 0.90 GBP
    'CNY': 0.11,      // 1 CNY = 0.11 GBP
    'SEK': 0.075,     // 1 SEK = 0.075 GBP
    'NZD': 0.48,      // 1 NZD = 0.48 GBP
  };
}

// Gemini prompt for structured data extraction
function getExtractionPrompt(exchangeRates: { [key: string]: number }): string {
  const ratesList = Object.entries(exchangeRates)
    .slice(0, 10)
    .map(([curr, rate]) => `${curr}: ${rate.toFixed(4)}`)
    .join(', ');

  return `You are an expert at extracting structured data from invoices and delivery notes.

Extract the following information from the invoice/delivery note image(s) and return it as a JSON object:

{
  "supplier": {
    "name": "Company name",
    "address": "Full address",
    "email": "Email if present",
    "phone": "Phone if present",
    "vatNumber": "VAT/Tax number if present"
  },
  "purchaseOrder": {
    "invoiceNumber": "Invoice or delivery note number",
    "invoiceDate": "Date in YYYY-MM-DD format",
    "originalCurrency": "Original currency code on invoice (e.g., GBP, USD, EUR)",
    "paymentTerms": "Payment terms if mentioned"
  },
  "poLines": [
    {
      "description": "Item description",
      "supplierSku": "Item code/SKU (alphanumeric product code, NOT the quantity)",
      "quantity": number,
      "unitCostExVAT": number,
      "lineTotalExVAT": number
    }
  ],
  "totals": {
    "subtotal": number,
    "extras": number,
    "vat": number,
    "total": number
  }
}

**CURRENCY CONVERSION - CRITICAL - READ CAREFULLY:**

Exchange rates to convert TO GBP: ${ratesList}

**CURRENCY DETECTION:**
- Look for currency symbols: £ (GBP), $ (USD), € (EUR), ¥ (JPY/CNY), etc.
- Common currency indicators:
  * £ or GBP or "Pound" = GBP (no conversion needed)
  * $ or USD or "Dollar" = USD
  * € or EUR or "Euro" = EUR
  * ¥ or JPY or "Yen" = JPY (Japanese Yen)
  * ¥ or CNY or "Yuan" or "RMB" = CNY (Chinese Yuan)
- **IMPORTANT**: If you see ¥ symbol, check the supplier location/language:
  * Japanese text/supplier = JPY
  * Chinese text/supplier = CNY
- Store the ORIGINAL currency in "originalCurrency" field (e.g., "JPY", "USD", "EUR")

**CONVERSION TO GBP (MANDATORY):**
- **ALL monetary values MUST be converted to GBP** using the rates above
- To convert: ORIGINAL_AMOUNT × RATE = GBP_AMOUNT
- Example: 100 USD × 0.7900 = 79.00 GBP
- Example: 10000 JPY × 0.0049 = 49.00 GBP
- **NEVER output prices in USD, EUR, JPY, or any currency other than GBP**
- The "originalCurrency" field preserves what currency the invoice was in

**SKU/Item Code Extraction (VERY IMPORTANT):**
- Look for product codes in a dedicated column or field, often labeled: "SKU", "Item #", "Code", "Product Code", "Item Code", "Part #", "Ref", "Article No"
- SKUs are typically alphanumeric codes like: "TCG-001", "ABC123", "PROD-2024-001", "12345-A"
- SKUs are usually positioned BEFORE or AFTER the description, in their own column
- DO NOT extract the quantity as the SKU - quantity is always a simple number (1, 2, 10, etc.)
- DO NOT extract prices, dates, or invoice numbers as SKUs
- If you see a column with mixed alphanumeric codes next to descriptions, that's likely the SKU
- If no clear SKU column exists, leave supplierSku as empty string or null
- When in doubt, prefer leaving it empty rather than guessing incorrectly

**Other Important Rules:**
- If multiple files/pages are provided, they are ALL part of the SAME invoice/order - combine all data
- Extract ALL line items from ALL documents/pages
- **EXTRAS field**: Extract shipping, delivery, handling, freight charges (NOT part of line items). Set to 0 if none.
- **SUBTOTAL**: Sum of all line items BEFORE extras and VAT
- **TOTAL**: subtotal + extras + VAT
- If a field is not present, use null or empty string (use 0 for numeric fields like extras)
- Ensure all numbers are numeric values, not strings
- Combine line items from all pages into a single poLines array`;
}

interface ExtractedData {
  supplier: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
    vatNumber?: string;
  };
  purchaseOrder: {
    invoiceNumber: string;
    invoiceDate: string;
    originalCurrency: string;
    paymentTerms?: string;
  };
  poLines: Array<{
    description: string;
    supplierSku?: string;
    quantity: number;
    unitCostExVAT: number;
    lineTotalExVAT: number;
  }>;
  totals: {
    subtotal: number;
    extras: number;
    vat: number;
    total: number;
  };
}

// POST endpoint to extract data from invoice (without saving)
export async function POST(request: NextRequest) {
  try {
    // 1. Get API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // 2. Get uploaded files
    const formData = await request.formData();
    const fileCount = parseInt(formData.get('fileCount') as string || '1');
    
    const files: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;
      if (file) {
        files.push(file);
      }
    }

    // Fallback to single file if fileCount not provided
    if (files.length === 0) {
      const singleFile = formData.get('file') as File;
      if (singleFile) {
        files.push(singleFile);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    // 3. Get current exchange rates
    const exchangeRates = await getExchangeRates();
    console.log('Using exchange rates:', exchangeRates);

    // 4. Prepare all files for Gemini
    const fileParts = [];
    for (const file of files) {
      // Validate file type - images or PDF
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      if (!isImage && !isPDF) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Please upload image files (PNG, JPG) or PDFs.` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      
      // Determine MIME type
      let mimeType = file.type;
      if (isPDF && !mimeType) {
        mimeType = 'application/pdf';
      }

      fileParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      });
    }

    // 5. Send to Gemini API v1 endpoint directly (bypass SDK)
    const extractionPrompt = getExtractionPrompt(exchangeRates);
    const prompt = extractionPrompt + `\n\nPlease analyze ${files.length === 1 ? 'this invoice document' : `these ${files.length} invoice documents (they are all part of the same order)`} and extract the data.`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          ...fileParts
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
        { error: `Failed to process files: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 5. Parse JSON response from Gemini
    let extractedData: ExtractedData;
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanedText);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Raw response:', text);
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response as JSON',
          rawResponse: text 
        },
        { status: 500 }
      );
    }

    // 6. Return extracted data WITHOUT saving to database
    // Note: We allow incomplete data - user can fill in missing fields in the UI
    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
