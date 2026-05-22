import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

// Cache the default weapons from the JSON file in memory
let cachedDefaultWeapons: any[] | null = null;

function loadDefaultWeapons(): any[] {
  if (cachedDefaultWeapons) return cachedDefaultWeapons;

  try {
    const filePath = join(process.cwd(), 'public', 'assets', 'weapons.json');
    const raw = readFileSync(filePath, 'utf-8');
    cachedDefaultWeapons = JSON.parse(raw);
    return cachedDefaultWeapons!;
  } catch (err) {
    console.error('Erro ao carregar catálogo padrão de armas:', err);
    return [];
  }
}

// GET /api/weapon-catalog - Retrieve weapon catalog (static JSON defaults + custom user DB items)
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);

    // 1. Load default weapons from public/assets/weapons.json
    const defaultWeapons = loadDefaultWeapons();

    // 2. Load custom user weapons from the database
    const userResult = await query(
      `SELECT * FROM weapon_catalog WHERE user_id = $1 ORDER BY category, name`,
      [userId]
    );

    // 3. Merge: defaults first, then user custom entries
    const combined = [
      ...defaultWeapons,
      ...userResult.rows,
    ];

    // Sort by category then name
    combined.sort((a, b) => {
      const catCompare = (a.category || '').localeCompare(b.category || '');
      if (catCompare !== 0) return catCompare;
      return (a.name || '').localeCompare(b.name || '');
    });

    return NextResponse.json(combined);
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
