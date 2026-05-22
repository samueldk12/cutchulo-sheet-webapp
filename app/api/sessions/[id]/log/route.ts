import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkSessionParticipant(sessionId: number, userId: number): Promise<boolean> {
  const session = await queryOne('SELECT user_id FROM sessions WHERE id = $1', [sessionId]);
  if (!session) return false;
  if (session.user_id === userId) return true;

  const isPlayer = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN characters c ON sc.character_id = c.id
    WHERE sc.session_id = $1 AND c.user_id = $2
  `, [sessionId, userId]);
  return !!isPlayer;
}

// POST /api/sessions/[id]/log - Create session log entries (accessible to GM and players)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);
    const { content } = await request.json();

    const authorized = await checkSessionParticipant(sessionId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou campanha não encontrada' }, { status: 403 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Conteúdo do log é obrigatório' }, { status: 400 });
    }

    const logEntry = await queryOne(
      `INSERT INTO session_log_entries (session_id, content) 
       VALUES ($1, $2) 
       RETURNING *`,
      [sessionId, content]
    );

    // Touch session timestamp
    await query('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [sessionId]);

    return NextResponse.json(logEntry, { status: 201 });
  } catch (e: any) {
    console.error('Create log entry error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
