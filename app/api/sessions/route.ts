import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'C'; // Start with C for Cthulhu
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/sessions - List GM sessions and joined campaign sessions
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);

    // Sessions where the user is GM
    const gmSessions = await query(
      `SELECT s.*, (SELECT COUNT(*) FROM session_characters WHERE session_id = s.id) as player_count
       FROM sessions s
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC`,
      [userId]
    );

    // Sessions where the user is a participating player (joined via one of their characters)
    const playerSessions = await query(
      `SELECT DISTINCT s.*, u.username as gm_username
       FROM sessions s
       JOIN session_characters sc ON sc.session_id = s.id
       JOIN characters c ON sc.character_id = c.id
       JOIN users u ON s.user_id = u.id
       WHERE c.user_id = $1
       ORDER BY s.updated_at DESC`,
      [userId]
    );

    return NextResponse.json({
      gm: gmSessions.rows,
      player: playerSessions.rows,
    });
  } catch (e: any) {
    console.error('List sessions error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/sessions - Create a campaign (as GM)
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    // Ensure code uniqueness
    let code = generateJoinCode();
    let codeExists = true;
    let attempts = 0;
    while (codeExists && attempts < 10) {
      const existing = await queryOne('SELECT id FROM sessions WHERE code = $1', [code]);
      if (!existing) {
        codeExists = false;
      } else {
        code = generateJoinCode();
      }
      attempts++;
    }

    const session = await queryOne(
      `INSERT INTO sessions (user_id, code, name, notes, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, code, data.name || 'Nova Campanha', data.notes || '', true]
    );

    return NextResponse.json(session, { status: 201 });
  } catch (e: any) {
    console.error('Create session error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
