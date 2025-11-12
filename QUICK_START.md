# 🚀 Quick Start Guide

## Step 1: Get Your Gemini API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

## Step 2: Configure Environment

Create a `.env` or `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_actual_api_key_here
```

## Step 3: Start the Server

```bash
npm run dev
```

## Step 4: Test the Feature

1. Open: http://localhost:3000/purchasing/import
2. Click "Choose File" and select a PDF or image invoice (JPG, PNG)
3. Click "Upload & Extract"
4. Watch the AI extract structured data! 🎉

## Step 5: Check the Database

After a successful upload, check `data/db.json` to see the saved records.

---

## 🧪 Testing Without a Real Invoice

If you don't have a PDF invoice handy, you can:

1. Create a simple test PDF with invoice-like content
2. Use any PDF with text (the AI will try to extract what it can)
3. Download a sample invoice PDF from the internet

---

## 📍 Important URLs

- **Upload Page**: http://localhost:3000/purchasing/import
- **View All Data**: http://localhost:3000/purchasing/view
- **API Endpoint**: http://localhost:3000/api/purchasing/po/import
- **Database File**: `data/db.json`

---

## ⚠️ Troubleshooting

### "GEMINI_API_KEY not configured"
- Make sure you created `.env` or `.env.local` file
- Restart the dev server after adding the key

### "Failed to parse PDF file"
- Ensure the file is a valid PDF
- Some PDFs with only images may not extract text

### "Failed to process with Gemini API"
- Check your API key is valid
- Ensure you have API quota remaining
- Check your internet connection

---

## 🎯 What Gets Extracted

The AI will attempt to extract:

- **Supplier Info**: Name, address, email, phone, VAT number
- **Invoice Details**: Number, date, currency, payment terms
- **Line Items**: Description, SKU, quantity, unit price, total
- **Totals**: Subtotal, VAT, grand total

All data is saved to the local JSON database automatically!
