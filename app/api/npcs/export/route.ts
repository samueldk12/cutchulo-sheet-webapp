import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/npcs/export - Export all NPCs for user as JSON file
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    
    const result = await query('SELECT * FROM npcs WHERE user_id = $1 ORDER BY type, name', [userId]);
    const npcs = result.rows;

    return new NextResponse(
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), npcs }, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="npcs_export.json"',
        },
      }
    );
  } catch (e: any) {
    console.error('Export NPCs error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
