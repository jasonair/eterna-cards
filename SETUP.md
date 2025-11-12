# PDF Invoice Import Setup

This feature allows you to upload PDF invoices and extract structured data using Google Gemini AI.

## Prerequisites

1. **Google Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key for the next step

## Configuration

1. Create a `.env` file in the root directory (or `.env.local`):
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

2. Replace `your_api_key_here` with your actual Gemini API key

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/purchasing/import`

3. Upload a PDF invoice and click "Upload & Extract"

4. The extracted data will be:
   - Displayed on screen in JSON format
   - Saved to `data/db.json` with:
     - Supplier information
     - Purchase order details
     - Line items
     - Totals

## API Endpoint

**POST** `/api/purchasing/po/import`

- Accepts: `multipart/form-data` with a `file` field (PDF only)
- Returns: JSON with extracted invoice data

## Database

Data is stored in `data/db.json` with the following structure:

```json
{
  "suppliers": [
    {
      "id": "uuid",
      "name": "Supplier Name",
      "address": "Address",
      "email": "email@example.com",
      "phone": "+1234567890",
      "vatNumber": "VAT123",
      "createdAt": "ISO timestamp"
    }
  ],
  "purchaseOrders": [
    {
      "id": "uuid",
      "supplierId": "supplier-uuid",
      "invoiceNumber": "INV-001",
      "invoiceDate": "2024-01-01",
      "currency": "GBP",
      "paymentTerms": "Net 30",
      "createdAt": "ISO timestamp"
    }
  ],
  "poLines": [
    {
      "id": "uuid",
      "purchaseOrderId": "po-uuid",
      "description": "Product description",
      "supplierSku": "SKU-123",
      "quantity": 10,
      "unitCostExVAT": 50.00,
      "lineTotalExVAT": 500.00
    }
  ]
}
```

## Features

- ✅ PDF text extraction using `pdf-parse`
- ✅ AI-powered data extraction with Google Gemini 1.5 Pro
- ✅ Structured JSON output
- ✅ Local JSON database (lowdb)
- ✅ Automatic supplier deduplication
- ✅ UUID generation for all records
- ✅ Beautiful, responsive UI with loading states
- ✅ Error handling and validation

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Google Gemini API** (`@google/generative-ai`)
- **pdf-parse** (PDF text extraction)
- **lowdb** (JSON database)
- **Tailwind CSS** (styling)
