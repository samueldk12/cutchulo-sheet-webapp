import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/share/[uuid] - Public sheet retrieval (no auth required)
export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;

    const char = await queryOne('SELECT * FROM characters WHERE uuid = $1', [uuid]);
    if (!char) {
      return NextResponse.json({ error: 'Personagem não encontrado' }, { status: 404 });
    }

    if (!char.shared) {
      return NextResponse.json({ error: 'Ficha não compartilhada pelo jogador' }, { status: 403 });
    }

    // Retrieve weapons and possessions
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [char.id]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [char.id]);

    let returnedChar = { ...char };
    // Redact sensitive attributes and vitals in public links as well
    const sensitiveFields = [
      'str', 'dex', 'int_val', 'con', 'app', 'pow', 'siz', 'edu', 'luck', 
      'hp_current', 'hp_max', 'mp_current', 'mp_max', 'san_current', 'san_max'
    ];
    sensitiveFields.forEach(field => {
      returnedChar[field] = 0;
    });

    return NextResponse.json({
      ...returnedChar,
      skills: [],
      weapons: weapons.rows,
      possessions: possessions.rows,
    });
  } catch (e: any) {
    console.error('Fetch public share character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
