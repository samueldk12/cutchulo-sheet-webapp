import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkWeaponAuth(weaponId: number, userId: number): Promise<boolean> {
  const char = await queryOne(`
    SELECT c.user_id, c.id
    FROM weapons w
    JOIN characters c ON w.character_id = c.id
    WHERE w.id = $1
  `, [weaponId]);
  if (!char) return false;
  if (char.user_id === userId) return true;

  const isGm = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN sessions s ON sc.session_id = s.id
    WHERE sc.character_id = $1 AND s.user_id = $2
  `, [char.id, userId]);
  return !!isGm;
}

// PUT /api/weapons/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const weaponId = parseInt(paramId, 10);
    const data = await request.json();

    const authorized = await checkWeaponAuth(weaponId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou arma não encontrada' }, { status: 403 });
    }

    await query(
      `UPDATE weapons 
       SET name = $1, skill = $2, damage = $3, range = $4, attacks_per_round = $5, ammo = $6, malfunction = $7
       WHERE id = $8`,
      [
        data.name || '',
        data.skill || '',
        data.damage || '',
        data.range || '',
        data.attacks_per_round || '1',
        data.ammo || 0,
        data.malfunction || 100,
        weaponId,
      ]
    );

    // Touch character updated_at
    await query(
      `UPDATE characters 
       SET updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT character_id FROM weapons WHERE id = $1)`,
      [weaponId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update weapon error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/weapons/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const weaponId = parseInt(paramId, 10);

    const authorized = await checkWeaponAuth(weaponId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou arma não encontrada' }, { status: 403 });
    }

    // Capture character id before delete to touch timestamp
    const weapon = await queryOne('SELECT character_id FROM weapons WHERE id = $1', [weaponId]);
    
    await query('DELETE FROM weapons WHERE id = $1', [weaponId]);

    if (weapon) {
      await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [weapon.character_id]);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Delete weapon error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
