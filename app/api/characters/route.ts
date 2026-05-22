import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, createDefaultSkills } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/characters - List user's characters (and friends if specified)
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const searchParams = request.nextUrl.searchParams;
    const includeFriends = searchParams.get('friends') === 'true';

    if (includeFriends) {
      // List shared sheets added to friends list
      const friendsResult = await query(
        `SELECT c.id, c.uuid, c.name, c.player, c.occupation, c.age, c.updated_at, c.image
         FROM characters c
         JOIN friends f ON f.character_id = c.id
         WHERE f.user_id = $1
         ORDER BY c.updated_at DESC`,
        [userId]
      );
      return NextResponse.json(friendsResult.rows);
    }

    // List user's own characters
    const result = await query(
      `SELECT id, uuid, name, player, occupation, age, updated_at, image, is_friend
       FROM characters 
       WHERE user_id = $1 AND (is_friend = 0 OR is_friend IS NULL)
       ORDER BY updated_at DESC`,
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List characters error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/characters - Create a new investigator
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    const hpMax = data.hp_max ?? Math.floor(((data.con || 50) + (data.siz || 50)) / 10);
    const mpMax = data.mp_max ?? Math.floor((data.pow || 50) / 5);
    const sanVal = data.san_max ?? (data.pow || 50) * 5;
    const uuid = data.uuid || randomUUID();

    const insertResult = await queryOne(
      `INSERT INTO characters
        (user_id, uuid, name, player, occupation, age, gender, residence, birthplace,
         str, dex, int_val, con, app, pow, siz, edu, luck,
         hp_current, hp_max, mp_current, mp_max, san_current, san_max)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        userId,
        uuid,
        data.name || 'Novo Investigador',
        data.player || '',
        data.occupation || '',
        data.age || 25,
        data.gender || '',
        data.residence || '',
        data.birthplace || '',
        data.str || 50,
        data.dex || 50,
        data.int_val || 50,
        data.con || 50,
        data.app || 50,
        data.pow || 50,
        data.siz || 50,
        data.edu || 50,
        data.luck || 50,
        data.hp_current ?? hpMax,
        hpMax,
        data.mp_current ?? mpMax,
        mpMax,
        data.san_current ?? sanVal,
        sanVal,
      ]
    );

    const characterId = insertResult.id;
    await createDefaultSkills(characterId, data.dex || 50, data.edu || 50);

    // Fetch and return the fully populated new character
    const char = await queryOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [characterId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [characterId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [characterId]);

    return NextResponse.json(
      { ...char, skills: skills.rows, weapons: weapons.rows, possessions: possessions.rows },
      { status: 201 }
    );
  } catch (e: any) {
    console.error('Create character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
