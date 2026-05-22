import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/dice/history - Retrieve dice history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const characterId = searchParams.get('characterId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let result;
    if (characterId) {
      result = await query(
        'SELECT * FROM dice_history WHERE character_id = $1 ORDER BY rolled_at DESC LIMIT $2',
        [parseInt(characterId, 10), limit]
      );
    } else {
      result = await query(
        'SELECT * FROM dice_history ORDER BY rolled_at DESC LIMIT $1',
        [limit]
      );
    }

    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List dice history error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
