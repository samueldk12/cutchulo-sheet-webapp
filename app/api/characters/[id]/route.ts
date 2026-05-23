import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkAuth(characterId: number, userId: number): Promise<boolean> {
  const character = await queryOne('SELECT user_id FROM characters WHERE id = $1', [characterId]);
  if (!character) return false;
  if (character.user_id === userId) return true;

  // Check if user is the GM of an active session where this character is participating
  const isGmOfCharacter = await queryOne(`
    SELECT sc.id 
    FROM session_characters sc
    JOIN sessions s ON sc.session_id = s.id
    WHERE sc.character_id = $1 AND s.user_id = $2
  `, [characterId, userId]);

  return !!isGmOfCharacter;
}

// GET /api/characters/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);

    const authorized = await checkAuth(characterId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou personagem não encontrado' }, { status: 403 });
    }

    const char = await queryOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    if (!char) {
      return NextResponse.json({ error: 'Personagem não encontrado' }, { status: 404 });
    }

    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [characterId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [characterId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [characterId]);
    const spells = await query('SELECT * FROM spells WHERE character_id = $1 ORDER BY name', [characterId]);

    // Look up any campaign session this character is linked to
    const sessionInfo = await queryOne(`
      SELECT s.id, s.name, s.code, s.roll20_url, u.username as gm_username
      FROM sessions s
      JOIN session_characters sc ON sc.session_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sc.character_id = $1
      LIMIT 1
    `, [characterId]);

    return NextResponse.json({
      ...char,
      skills: skills.rows,
      weapons: weapons.rows,
      possessions: possessions.rows,
      spells: spells.rows,
      session: sessionInfo || null,
    });
  } catch (e: any) {
    console.error('Get character details error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/characters/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);
    const data = await request.json();

    const authorized = await checkAuth(characterId, userId);
    if (!authorized) {
      return NextResponse.json({ error: 'Acesso negado ou personagem não encontrado' }, { status: 403 });
    }

    // Auto recalculations for Dodge and Language base
    if (data.dex !== undefined) {
      const dodgeBase = Math.floor(data.dex / 2);
      await query(
        "UPDATE skills SET base_value = $1, value = base_value + occ_points + int_points + game_points WHERE character_id = $2 AND name LIKE '%Dodge%'",
        [dodgeBase, characterId]
      );
    }
    if (data.edu !== undefined) {
      await query(
        "UPDATE skills SET base_value = $1, value = base_value + occ_points + int_points + game_points WHERE character_id = $2 AND name LIKE '%Language (Own)%'",
        [data.edu, characterId]
      );
    }

    // Standard columns that can be updated directly
    const allowedFields = [
      'name', 'player', 'occupation', 'age', 'gender', 'residence', 'birthplace',
      'str', 'dex', 'int_val', 'con', 'app', 'pow', 'siz', 'edu', 'luck',
      'hp_current', 'hp_max', 'mp_current', 'mp_max', 'san_current', 'san_max',
      'temporary_insanity', 'indefinite_insanity',
      'appearance_desc', 'ideology', 'significant_people', 'meaningful_locations',
      'treasured_possessions', 'traits', 'injuries_scars', 'phobias_manias',
      'arcane_tomes', 'backstory', 'notes', 'image',
      'cash', 'assets', 'spending_level', 'shared'
    ];

    const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));

    if (fieldsToUpdate.length > 0) {
      const setClause = fieldsToUpdate.map((field, idx) => `"${field}" = $${idx + 2}`).join(', ');
      const values = fieldsToUpdate.map(field => data[field]);
      
      await query(
        `UPDATE characters SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [characterId, ...values]
      );
    } else {
      // Just touch updated_at
      await query('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [characterId]);
    }

    // Return the updated character details
    const char = await queryOne('SELECT * FROM characters WHERE id = $1', [characterId]);
    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [characterId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [characterId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [characterId]);
    const spells = await query('SELECT * FROM spells WHERE character_id = $1 ORDER BY name', [characterId]);

    return NextResponse.json({
      ...char,
      skills: skills.rows,
      weapons: weapons.rows,
      possessions: possessions.rows,
      spells: spells.rows,
    });
  } catch (e: any) {
    console.error('Update character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/characters/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const characterId = parseInt(paramId, 10);

    const character = await queryOne('SELECT user_id FROM characters WHERE id = $1', [characterId]);
    if (!character) {
      return NextResponse.json({ error: 'Personagem não encontrado' }, { status: 404 });
    }

    // Only actual owners can delete their investigators
    if (character.user_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado: Somente proprietários podem deletar' }, { status: 403 });
    }

    await query('DELETE FROM characters WHERE id = $1', [characterId]);
    return NextResponse.json({ success: true, message: 'Personagem excluído com sucesso' });
  } catch (e: any) {
    console.error('Delete character error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
