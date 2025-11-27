import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id as string | undefined;
    const explicitCompleted = body?.completed as boolean | undefined;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const newCompleted =
      typeof explicitCompleted === 'boolean' ? explicitCompleted : !existingTask.completed;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? now : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Toggle task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
