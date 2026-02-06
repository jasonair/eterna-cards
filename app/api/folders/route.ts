import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const { data, error } = await supabase
      .from('folders')
      .select('id, parentid, name, description, sort_order, created_at, updated_at')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Get folders error:', error);
      return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Get folders error:', error);
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const body = await request.json();
    const rawName = (body?.name as string | undefined) ?? '';
    const name = rawName.trim();
    const parentId = (body?.parentId as string | null) ?? null;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)
      .ilike('name', name)
      .maybeSingle();

    if (existingError) {
      console.error('Check duplicate folder error:', existingError);
      return NextResponse.json({ error: 'Failed to validate folder name' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: 'A folder with that name already exists' }, { status: 400 });
    }

    const { data: folder, error } = await supabase
      .from('folders')
      .insert({
        name,
        parentid: parentId,
        user_id: user.id,
      })
      .select('id, parentid, name, description, sort_order, created_at, updated_at')
      .single();

    if (error || !folder) {
      console.error('Create folder error:', error);
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: folder });
  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const body = await request.json();
    const id = (body?.id as string | undefined) ?? undefined;
    const parentId = (body?.parentId as string | null | undefined) ?? null;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data: folder, error } = await supabase
      .from('folders')
      .update({
        parentid: parentId,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, parentid, name, description, sort_order, created_at, updated_at')
      .single();

    if (error || !folder) {
      console.error('Update folder error:', error);
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: folder });
  } catch (error) {
    console.error('Update folder error:', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase.from('folders').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.error('Delete folder error:', error);
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
