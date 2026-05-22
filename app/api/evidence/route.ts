import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/evidence - List all evidence owned by user
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const result = await query(
      'SELECT * FROM evidence WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List evidence error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/evidence - Create a new evidence card
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    const result = await queryOne(
      `INSERT INTO evidence (user_id, title, description, session_tag, image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        data.title || 'Nova Evidência',
        data.description || '',
        data.session_tag || '',
        data.image || '',
      ]
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('Create evidence error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
