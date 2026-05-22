import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// POST /api/npcs/import - Bulk import NPCs from JSON
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    const list = data.npcs || (data.npc ? [data.npc] : null);
    if (!Array.isArray(list)) {
      return NextResponse.json({ error: 'Formato inválido: esperado { npcs: [...] }' }, { status: 400 });
    }

    const insertedIds: number[] = [];
    for (const n of list) {
      const hpMax = n.hp_max ?? Math.floor(((n.con || 50) + (n.siz || 50)) / 10);
      const mpMax = n.mp_max ?? Math.floor((n.pow || 50) / 5);
      const sanMax = n.san_max ?? (n.type === 'monster' ? 0 : (n.pow || 50) * 5);

      const result = await queryOne(
        `INSERT INTO npcs
          (user_id, name, type, description, str, dex, int_val, con, pow, siz,
           hp_current, hp_max, mp_current, mp_max, san_current, san_max,
           damage_bonus, build, armor, attacks, skills_text, special_abilities, notes, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING id`,
        [
          userId,
          n.name || 'NPC Importado',
          n.type || 'npc',
          n.description || '',
          n.str || 50,
          n.dex || 50,
          n.int_val || 50,
          n.con || 50,
          n.pow || 50,
          n.siz || 50,
          n.hp_current ?? hpMax,
          hpMax,
          n.mp_current ?? mpMax,
          mpMax,
          n.san_current ?? sanMax,
          sanMax,
          n.damage_bonus || '',
          n.build || '',
          n.armor || 0,
          typeof n.attacks === 'object' ? JSON.stringify(n.attacks) : (n.attacks || '[]'),
          n.skills_text || '',
          n.special_abilities || '',
          n.notes || '',
          n.image || '',
        ]
      );
      insertedIds.push(result.id);
    }

    return NextResponse.json({ success: true, count: insertedIds.length, ids: insertedIds }, { status: 201 });
  } catch (e: any) {
    console.error('Import NPCs error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
