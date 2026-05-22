import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkSkillAuth(skillId: number, userId: number): Promise<boolean> {
  const char = await queryOne(`
    SELECT c.user_id, c.id
    FROM skills s
    JOIN characters c ON s.character_id = c.id
    WHERE s.id = $1
  `, [skillId]);
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

// PUT /api/skills/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const skillId = parseInt(paramId, 10);
    const data = await request.json();

    const authorized = await checkSkillAuth(skillId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou habilidade não encontrada' }, { status: 403 });
    }

    if (data.occ_points !== undefined || data.int_points !== undefined || data.game_points !== undefined) {
      const skill = await queryOne('SELECT base_value, occ_points, int_points, game_points FROM skills WHERE id = $1', [skillId]);
      if (!skill) {
        return NextResponse.json({ error: 'Habilidade não encontrada' }, { status: 404 });
      }

      const base = skill.base_value ?? 0;
      const occ = data.occ_points !== undefined ? data.occ_points : (skill.occ_points ?? 0);
      const intVal = data.int_points !== undefined ? data.int_points : (skill.int_points ?? 0);
      const game = data.game_points !== undefined ? data.game_points : (skill.game_points ?? 0);
      const total = base + occ + intVal + game;

      await query(
        `UPDATE skills 
         SET occ_points = $1, int_points = $2, game_points = $3, value = $4, is_occupation = $5, is_interest = $6 
         WHERE id = $7`,
        [occ, intVal, game, total, occ > 0 ? 1 : 0, intVal > 0 ? 1 : 0, skillId]
      );
    } else {
      await query(
        `UPDATE skills 
         SET value = $1, is_occupation = $2, is_interest = $3 
         WHERE id = $4`,
        [data.value, data.is_occupation ? 1 : 0, data.is_interest ? 1 : 0, skillId]
      );
    }

    // Touch character updated_at
    await query(
      `UPDATE characters 
       SET updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT character_id FROM skills WHERE id = $1)`,
      [skillId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update skill error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
