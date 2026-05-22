import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// POST /api/friends - Link a shared character to user's friends list
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { uuid } = await request.json();

    if (!uuid) {
      return NextResponse.json({ error: 'UUID do investigador é obrigatório' }, { status: 400 });
    }

    const character = await queryOne('SELECT * FROM characters WHERE uuid = $1', [uuid]);
    if (!character) {
      return NextResponse.json({ error: 'Investigador não encontrado' }, { status: 404 });
    }

    if (!character.shared) {
      return NextResponse.json({ error: 'Ficha não está ativa para compartilhamento público' }, { status: 403 });
    }

    if (character.user_id === userId) {
      return NextResponse.json({ error: 'Você não pode adicionar sua própria ficha aos amigos' }, { status: 400 });
    }

    // Insert relationship
    await query(
      `INSERT INTO friends (user_id, character_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, character_id) DO NOTHING`,
      [userId, character.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Investigador adicionado com sucesso à sua lista de amigos!',
      character: {
        id: character.id,
        uuid: character.uuid,
        name: character.name,
        player: character.player,
        occupation: character.occupation,
      },
    });
  } catch (e: any) {
    console.error('Add friend character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
