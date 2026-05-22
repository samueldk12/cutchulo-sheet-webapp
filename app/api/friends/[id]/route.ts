import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// DELETE /api/friends/[id] - Remove linked friend character from list (id is character_id)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);

    await query('DELETE FROM friends WHERE user_id = $1 AND character_id = $2', [userId, characterId]);

    return NextResponse.json({ success: true, message: 'Ficha removida da lista de amigos' });
  } catch (e: any) {
    console.error('Remove friend error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
