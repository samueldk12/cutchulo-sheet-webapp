import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkPossessionAuth(possessionId: number, userId: number): Promise<boolean> {
  const char = await queryOne(`
    SELECT c.user_id, c.id
    FROM possessions p
    JOIN characters c ON p.character_id = c.id
    WHERE p.id = $1
  `, [possessionId]);
  if (!char) return false;
  if (char.user_id === userId) return true;

  const isGm = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN sessions s ON sc.session_id = s.id
    WHERE sc.character_id = $1 AND s.user_id = $2
  `, [char.id, userId]);
  return !!isGm;
}

// PUT /api/possessions/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const possessionId = parseInt(paramId, 10);
    const data = await request.json();

    const authorized = await checkPossessionAuth(possessionId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou item não encontrado' }, { status: 403 });
    }

    await query(
      `UPDATE possessions 
       SET item = $1
       WHERE id = $2`,
      [data.item || '', possessionId]
    );

    // Touch character updated_at
    await query(
      `UPDATE characters 
       SET updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT character_id FROM possessions WHERE id = $1)`,
      [possessionId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update possession error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/possessions/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const possessionId = parseInt(paramId, 10);

    const authorized = await checkPossessionAuth(possessionId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou item não encontrado' }, { status: 403 });
    }

    const possession = await queryOne('SELECT character_id FROM possessions WHERE id = $1', [possessionId]);

    await query('DELETE FROM possessions WHERE id = $1', [possessionId]);

    if (possession) {
      await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [possession.character_id]);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Delete possession error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
