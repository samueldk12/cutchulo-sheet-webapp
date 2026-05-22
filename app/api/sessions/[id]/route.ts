import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkSessionGm(sessionId: number, userId: number): Promise<boolean> {
  const session = await queryOne('SELECT user_id FROM sessions WHERE id = $1', [sessionId]);
  return session && session.user_id === userId;
}

// GET /api/sessions/[id] - Fetch detailed campaign session (including live investigator sheets if GM/Player)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);

    const session = await queryOne('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (!session) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    // Verify user participates either as GM or as a player with a joined character
    const isGm = session.user_id === userId;
    const isPlayer = await queryOne(`
      SELECT sc.id 
      FROM session_characters sc
      JOIN characters c ON sc.character_id = c.id
      WHERE sc.session_id = $1 AND c.user_id = $2
    `, [sessionId, userId]);

    if (!isGm && !isPlayer) {
      return NextResponse.json({ error: 'Acesso negado a esta campanha' }, { status: 403 });
    }

    // Retrieve participating character details
    const charactersResult = await query(
      `SELECT c.*, u.username as owner_username
       FROM characters c
       JOIN session_characters sc ON sc.character_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE sc.session_id = $1
       ORDER BY c.updated_at DESC`,
      [sessionId]
    );

    const characters = [];
    for (const char of charactersResult.rows) {
      const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [char.id]);
      const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [char.id]);
      const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [char.id]);
      characters.push({
        ...char,
        skills: skills.rows,
        weapons: weapons.rows,
        possessions: possessions.rows,
      });
    }

    // Fetch session log entries
    const logs = await query(
      'SELECT * FROM session_log_entries WHERE session_id = $1 ORDER BY created_at DESC LIMIT 50',
      [sessionId]
    );

    return NextResponse.json({
      ...session,
      isGm,
      characters,
      logs: logs.rows,
    });
  } catch (e: any) {
    console.error('Fetch session details error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/sessions/[id] - Update session settings (GM only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);
    const data = await request.json();

    const isGm = await checkSessionGm(sessionId, userId);
    if (!isGm) {
      return NextResponse.json({ error: 'Acesso negado: Apenas o Mestre pode modificar a campanha' }, { status: 403 });
    }

    const session = await queryOne(
      `UPDATE sessions 
       SET name = $1, notes = $2, roll20_url = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5
       RETURNING *`,
      [data.name || 'Nova Campanha', data.notes || '', data.roll20_url || '', data.is_active ?? true, sessionId]
    );

    return NextResponse.json(session);
  } catch (e: any) {
    console.error('Update session error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Terminate campaign session (GM only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);

    const isGm = await checkSessionGm(sessionId, userId);
    if (!isGm) {
      return NextResponse.json({ error: 'Acesso negado: Apenas o Mestre pode excluir a campanha' }, { status: 403 });
    }

    await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return NextResponse.json({ success: true, message: 'Campanha excluída com sucesso' });
  } catch (e: any) {
    console.error('Delete session error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
