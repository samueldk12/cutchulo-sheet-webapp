import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkSpellAuth(spellId: number, userId: number): Promise<boolean> {
  const char = await queryOne(`
    SELECT c.user_id, c.id
    FROM spells s
    JOIN characters c ON s.character_id = c.id
    WHERE s.id = $1
  `, [spellId]);
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

// PUT /api/spells/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const spellId = parseInt(paramId, 10);
    const data = await request.json();
    const { name, cost, casting_time, range, duration, description } = data;

    const authorized = await checkSpellAuth(spellId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou magia não encontrada' }, { status: 403 });
    }

    const updatedSpell = await queryOne(
      `UPDATE spells 
       SET name = $1, cost = $2, casting_time = $3, range = $4, duration = $5, description = $6
       WHERE id = $7
       RETURNING *`,
      [
        name || '',
        cost || '',
        casting_time || '',
        range || '',
        duration || '',
        description || '',
        spellId
      ]
    );

    // Touch character updated_at
    if (updatedSpell) {
      await query(
        `UPDATE characters 
         SET updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [updatedSpell.character_id]
      );
    }

    return NextResponse.json(updatedSpell);
  } catch (e: any) {
    console.error('Update spell error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/spells/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const spellId = parseInt(paramId, 10);

    const authorized = await checkSpellAuth(spellId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou magia não encontrada' }, { status: 403 });
    }

    const spell = await queryOne('SELECT character_id FROM spells WHERE id = $1', [spellId]);

    await query('DELETE FROM spells WHERE id = $1', [spellId]);

    if (spell) {
      await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [spell.character_id]);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Delete spell error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
