import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/npcs - List all NPCs owned by the user
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const result = await query(
      `SELECT id, name, type, description, hp_current, hp_max, mp_current, mp_max, san_current, san_max, armor, image, created_at
       FROM npcs
       WHERE user_id = $1
       ORDER BY type, name`,
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List NPCs error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/npcs - Create a new NPC
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    const hpMax = data.hp_max ?? Math.floor(((data.con || 50) + (data.siz || 50)) / 10);
    const mpMax = data.mp_max ?? Math.floor((data.pow || 50) / 5);
    const sanMax = data.san_max ?? (data.type === 'monster' ? 0 : (data.pow || 50) * 5);

    const result = await queryOne(
      `INSERT INTO npcs
        (user_id, name, type, description, str, dex, int_val, con, pow, siz,
         hp_current, hp_max, mp_current, mp_max, san_current, san_max,
         damage_bonus, build, armor, attacks, skills_text, special_abilities, notes, image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        userId,
        data.name || 'Novo NPC',
        data.type || 'npc',
        data.description || '',
        data.str || 50,
        data.dex || 50,
        data.int_val || 50,
        data.con || 50,
        data.pow || 50,
        data.siz || 50,
        data.hp_current ?? hpMax,
        hpMax,
        data.mp_current ?? mpMax,
        mpMax,
        data.san_current ?? sanMax,
        sanMax,
        data.damage_bonus || '',
        data.build || '',
        data.armor || 0,
        data.attacks || '[]',
        data.skills_text || '',
        data.special_abilities || '',
        data.notes || '',
        data.image || '',
      ]
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('Create NPC error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
