import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkCharacterAuth(characterId: number, userId: number): Promise<boolean> {
  const character = await queryOne('SELECT user_id FROM characters WHERE id = $1', [characterId]);
  if (!character) return false;
  if (character.user_id === userId) return true;

  const isGmOfCharacter = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN sessions s ON sc.session_id = s.id
    WHERE sc.character_id = $1 AND s.user_id = $2
  `, [characterId, userId]);

  return !!isGmOfCharacter;
}

// GET /api/spells?character_id=...
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { searchParams } = new URL(request.url);
    const characterIdStr = searchParams.get('character_id');
    
    if (!characterIdStr) {
      return NextResponse.json({ error: 'character_id é obrigatório' }, { status: 400 });
    }
    const characterId = parseInt(characterIdStr, 10);

    const authorized = await checkCharacterAuth(characterId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const spells = await query('SELECT * FROM spells WHERE character_id = $1 ORDER BY name', [characterId]);
    return NextResponse.json(spells.rows);
  } catch (e: any) {
    console.error('List spells error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/spells
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();
    const { character_id, name, cost, casting_time, range, duration, description } = data;

    if (!character_id) {
      return NextResponse.json({ error: 'character_id é obrigatório' }, { status: 400 });
    }
    const characterId = parseInt(character_id, 10);

    const authorized = await checkCharacterAuth(characterId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const spell = await queryOne(
      `INSERT INTO spells (character_id, name, cost, casting_time, range, duration, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        characterId,
        name || 'Nova Magia',
        cost || '',
        casting_time || '',
        range || '',
        duration || '',
        description || ''
      ]
    );

    // Touch character updated_at
    await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [characterId]);

    return NextResponse.json(spell, { status: 201 });
  } catch (e: any) {
    console.error('Create spell error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
