import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/pdf-annotations - List annotations for a book
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'filename required' }, { status: 400 });
    }

    const result = await query(
      'SELECT * FROM pdf_annotations WHERE user_id = $1 AND filename = $2 ORDER BY page ASC, created_at DESC',
      [userId, filename]
    );

    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List PDF annotations error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/pdf-annotations - Create a new PDF page annotation
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    if (!data.filename) {
      return NextResponse.json({ error: 'filename required' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO pdf_annotations (user_id, filename, page, note, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        data.filename,
        data.page || 1,
        data.note || '',
        data.color || 'yellow',
      ]
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('Create PDF annotation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
