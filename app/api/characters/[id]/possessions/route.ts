import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkAuth(characterId: number, userId: number): Promise<boolean> {
  const character = await queryOne('SELECT user_id FROM characters WHERE id = $1', [characterId]);
  if (!character) return false;
  if (character.user_id === userId) return true;

  const isGm = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN sessions s ON sc.session_id = s.id
    WHERE sc.character_id = $1 AND s.user_id = $2
  `, [characterId, userId]);
  return !!isGm;
}

// POST /api/characters/[id]/possessions - Add a new possession item to a character
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);
    const data = await request.json();

    const authorized = await checkAuth(characterId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou personagem não encontrado' }, { status: 403 });
    }

    const result = await queryOne(
      'INSERT INTO possessions (character_id, item) VALUES ($1, $2) RETURNING id',
      [characterId, data.item || '']
    );

    // Touch character updated_at
    await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [characterId]);

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (e: any) {
    console.error('Create possession error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
