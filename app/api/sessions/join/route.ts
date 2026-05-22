import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// POST /api/sessions/join - Players join a session using code
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { code, characterId } = await request.json();

    if (!code || !characterId) {
      return NextResponse.json({ error: 'Código e Personagem são obrigatórios' }, { status: 400 });
    }

    const session = await queryOne('SELECT * FROM sessions WHERE code = $1', [code.toUpperCase().trim()]);
    if (!session) {
      return NextResponse.json({ error: 'Campanha não encontrada com este código' }, { status: 404 });
    }

    const character = await queryOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    if (!character) {
      return NextResponse.json({ error: 'Investigador não encontrado' }, { status: 404 });
    }

    if (character.user_id !== userId) {
      return NextResponse.json({ error: 'Você só pode adicionar seus próprios investigadores à campanha' }, { status: 403 });
    }

    // Check if already in the session
    const existingParticipation = await queryOne(
      'SELECT id FROM session_characters WHERE session_id = $1 AND character_id = $2',
      [session.id, characterId]
    );

    if (existingParticipation) {
      return NextResponse.json({ success: true, message: 'Investigador já faz parte desta campanha', session });
    }

    await query(
      'INSERT INTO session_characters (session_id, character_id) VALUES ($1, $2)',
      [session.id, characterId]
    );

    // Touch both character and campaign session updated timestamps
    await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [characterId]);
    await query('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [session.id]);

    return NextResponse.json({
      success: true,
      message: 'Investigador entrou com sucesso na campanha!',
      session,
    });
  } catch (e: any) {
    console.error('Join session error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
