import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// GET endpoint to retrieve all database data
export async function GET() {
  try {
    // Get the database instance
    const db = await getDb();
    
    // Read the latest data
    await db.read();
    
    // Return all data
    return NextResponse.json(db.data);
  } catch (error) {
    console.error('Database read error:', error);
    return NextResponse.json(
      { error: 'Failed to read database' },
      { status: 500 }
    );
  }
}
