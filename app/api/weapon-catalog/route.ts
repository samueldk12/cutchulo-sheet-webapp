import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/weapon-catalog - Retrieve weapon catalog (custom user items + default catalog items)
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const result = await query(
      `SELECT * FROM weapon_catalog 
       WHERE user_id = $1 OR user_id IS NULL 
       ORDER BY category, name`,
      [userId]
    );
    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('List weapon catalog error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/weapon-catalog - Add weapon to custom catalog
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const data = await request.json();

    if (!data.name) {
      return NextResponse.json({ error: 'Nome do item é obrigatório' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO weapon_catalog 
        (user_id, name, skill, damage, range, attacks_per_round, ammo, malfunction, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        data.name,
        data.skill || '',
        data.damage || '',
        data.range || '',
        data.attacks_per_round || '1',
        data.ammo || 0,
        data.malfunction || 100,
        data.category || 'other',
        data.notes || '',
      ]
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('Create weapon catalog item error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
