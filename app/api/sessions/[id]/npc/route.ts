import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, createDefaultSkills } from '@/lib/db';
import { randomUUID } from 'crypto';

async function checkSessionGm(sessionId: number, userId: number): Promise<boolean> {
  const session = await queryOne('SELECT user_id FROM sessions WHERE id = $1', [sessionId]);
  return session && session.user_id === userId;
}

// POST /api/sessions/[id]/npc - GM adds a new NPC to the campaign
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const sessionId = parseInt(paramId, 10);

    const isGm = await checkSessionGm(sessionId, userId);
    if (!isGm) {
      return NextResponse.json({ error: 'Acesso negado: Apenas o Mestre pode adicionar NPCs' }, { status: 403 });
    }

    const data = await request.json();
    const npcName = data.name || 'Novo NPC';

    const uuid = randomUUID();
    const dex = 50;
    const edu = 50;
    const con = 50;
    const siz = 50;
    const pow = 50;

    const hpMax = Math.floor((con + siz) / 10);
    const mpMax = Math.floor(pow / 5);
    const sanMax = pow * 5;

    // Create NPC investigator character owned by GM user
    const insertResult = await queryOne(
      `INSERT INTO characters
        (user_id, uuid, name, player, occupation, age, gender, residence, birthplace,
         str, dex, int_val, con, app, pow, siz, edu, luck,
         hp_current, hp_max, mp_current, mp_max, san_current, san_max, is_friend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING id`,
      [
        userId, uuid, npcName, 'NPC', 'NPC', 35, 'Indeterminado', 'Campanha', 'Desconhecido',
        50, dex, 50, con, 50, pow, siz, edu, 50,
        hpMax, hpMax, mpMax, mpMax, sanMax, sanMax,
        0
      ]
    );

    const npcCharId = insertResult.id;

    // Link NPC to the campaign session
    await query(
      `INSERT INTO session_characters (session_id, character_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [sessionId, npcCharId]
    );

    // Create default skills
    await createDefaultSkills(npcCharId, dex, edu);

    // Fetch the fully populated character
    const char = await queryOne('SELECT * FROM characters WHERE id = $1', [npcCharId]);
    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [npcCharId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [npcCharId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [npcCharId]);

    return NextResponse.json({
      ...char,
      skills: skills.rows,
      weapons: weapons.rows,
      possessions: possessions.rows,
    }, { status: 201 });
  } catch (e: any) {
    console.error('Create NPC error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
