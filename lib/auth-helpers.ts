import { serverSupabase } from './supabase-server';
import { NextRequest } from 'next/server';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Get the authenticated user from a Next.js API route
 * Returns null if user is not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    
    const {
      data: { user },
      error,
    } = await serverSupabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Verify user is authenticated and return user info + supabase client
 * Throws error if user is not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser; supabase: typeof serverSupabase }> {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return { user, supabase: serverSupabase };
}

/**
 * Create a standardized auth error response
 */
export function createAuthErrorResponse() {
  return new Response(
    JSON.stringify({ error: 'Authentication required' }),
    { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
