import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/sessions/[id]/messages - Retrieve visible persistent chat history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);

    // Verify session exists
    const session = await queryOne('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (!session) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    const isGm = session.user_id === userId;

    // Verify user is GM or has a character joined
    if (!isGm) {
      const playerParticipation = await queryOne(`
        SELECT sc.id 
        FROM session_characters sc
        JOIN characters c ON sc.character_id = c.id
        WHERE sc.session_id = $1 AND c.user_id = $2
      `, [sessionId, userId]);

      if (!playerParticipation) {
        return NextResponse.json({ error: 'Acesso negado: Você não participa desta campanha' }, { status: 403 });
      }
    }

    // Retrieve chat history, applying privacy visibility rules
    // GM sees everything; players see global messages, what they sent, and whispers sent to them
    const messages = await query(
      `SELECT m.*, u.username as sender_username, r.username as recipient_username
       FROM session_messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN users r ON m.recipient_id = r.id
       WHERE m.session_id = $1 AND (
         m.recipient_id IS NULL OR
         m.sender_id = $2 OR
         m.recipient_id = $2 OR
         (SELECT user_id FROM sessions WHERE id = $1) = $2
       )
       ORDER BY m.created_at ASC
       LIMIT 150`,
      [sessionId, userId]
    );

    return NextResponse.json(messages.rows);
  } catch (e: any) {
    console.error('Fetch session messages error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/sessions/[id]/messages - Send a message, roll, or whisper in the campaign room
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);
    const data = await request.json();

    const { content, recipient_id, message_type, roll_details } = data;

    // Verify session exists
    const session = await queryOne('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (!session) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    const isGm = session.user_id === userId;

    // Verify sender belongs to session
    if (!isGm) {
      const playerParticipation = await queryOne(`
        SELECT sc.id 
        FROM session_characters sc
        JOIN characters c ON sc.character_id = c.id
        WHERE sc.session_id = $1 AND c.user_id = $2
      `, [sessionId, userId]);

      if (!playerParticipation) {
        return NextResponse.json({ error: 'Acesso negado: Você não participa desta campanha' }, { status: 403 });
      }
    }

    // If it's a whisper, verify recipient exists
    let verifiedRecipientId = null;
    if (recipient_id) {
      const recipient = await queryOne('SELECT id FROM users WHERE id = $1', [recipient_id]);
      if (recipient) {
        verifiedRecipientId = recipient.id;
      }
    }

    const typeStr = message_type || 'chat'; // 'chat', 'roll', 'whisper'

    const inserted = await queryOne(
      `INSERT INTO session_messages (session_id, sender_id, recipient_id, message_type, content, roll_details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        sessionId,
        userId,
        verifiedRecipientId,
        typeStr,
        content || '',
        roll_details ? JSON.stringify(roll_details) : null
      ]
    );

    // Retrieve full sender info for client use
    const fullMessage = await queryOne(
      `SELECT m.*, u.username as sender_username, r.username as recipient_username
       FROM session_messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN users r ON m.recipient_id = r.id
       WHERE m.id = $1`,
      [inserted.id]
    );

    return NextResponse.json(fullMessage, { status: 201 });
  } catch (e: any) {
    console.error('Send message error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
