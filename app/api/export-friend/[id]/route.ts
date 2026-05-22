import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/export-friend/[id] - Friend character sheet JSON export (strips lore/backstory narrative fields)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);

    const c = await queryOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    if (!c) {
      return NextResponse.json({ error: 'Personagem não encontrado' }, { status: 404 });
    }

    if (c.user_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado: Somente proprietários podem exportar' }, { status: 403 });
    }

    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [characterId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [characterId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [characterId]);

    const fullChar = {
      ...c,
      skills: skills.rows,
      weapons: weapons.rows,
      possessions: possessions.rows,
    };

    // Remove narrative/lore fields from friend export
    const loreFields = [
      'appearance_desc', 'ideology', 'significant_people', 'meaningful_locations',
      'treasured_possessions', 'traits', 'injuries_scars', 'phobias_manias',
      'arcane_tomes', 'backstory', 'notes',
    ];
    loreFields.forEach(field => delete fullChar[field]);

    const safeName = (c.name || 'personagem').replace(/[^a-z0-9_\-\s]/gi, '_');

    return new NextResponse(
      JSON.stringify(
        { version: 3, exportedAt: new Date().toISOString(), isFriendExport: true, character: fullChar },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${safeName}_amigo.json"`,
        },
      }
    );
  } catch (e: any) {
    console.error('Export friend character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
