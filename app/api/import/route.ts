import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, createDefaultSkills } from '@/lib/db';
import { randomUUID } from 'crypto';

// POST /api/import - Import investigator from JSON
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const body = await request.json();
    const isFriendExport = body.isFriendExport;

    // Recursive helper to safely unpack the character from any nested structure
    const extractCharacter = (obj: any): any => {
      if (!obj) return null;
      if (obj.character && typeof obj.character === 'object') {
        const inner = extractCharacter(obj.character);
        if (inner && inner.name) return inner;
      }
      if (obj.name) return obj;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = extractCharacter(item);
          if (found) return found;
        }
      }
      for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object') {
          const found = extractCharacter(obj[key]);
          if (found && found.name) return found;
        }
      }
      return null;
    };

    let character = extractCharacter(body);

    if (!character || !character.name) {
      return NextResponse.json({ error: 'JSON inválido: campo "character" ou "name" obrigatório no arquivo JSON' }, { status: 400 });
    }

    let uuid = character.uuid || randomUUID();
    let existingId: number | null = null;
    let wasUpdated = false;

    // Check if character with this UUID already exists
    if (character.uuid) {
      const existing = await queryOne('SELECT id, user_id FROM characters WHERE uuid = $1', [character.uuid]);
      if (existing) {
        if (existing.user_id === userId) {
          // Exists and owned by user -> update
          existingId = existing.id;
          wasUpdated = true;
        } else {
          // Exists but owned by another user -> generate new uuid and insert to avoid hijacking
          uuid = randomUUID();
        }
      }
    }

    const hpMax = character.hp_max ?? Math.floor(((character.con || 50) + (character.siz || 50)) / 10);
    const mpMax = character.mp_current ?? Math.floor((character.pow || 50) / 5);
    const sanVal = character.san_max ?? (character.pow || 50) * 5;

    let importedCharacterId: number;

    if (existingId) {
      // Update existing character
      await query(
        `UPDATE characters SET
           name = $1, player = $2, occupation = $3, age = $4, gender = $5, residence = $6, birthplace = $7,
           str = $8, dex = $9, int_val = $10, con = $11, app = $12, pow = $13, siz = $14, edu = $15, luck = $16,
           hp_current = $17, hp_max = $18, mp_current = $19, mp_max = $20, san_current = $21, san_max = $22,
           appearance_desc = $23, ideology = $24, significant_people = $25, meaningful_locations = $26,
           treasured_possessions = $27, traits = $28, injuries_scars = $29, phobias_manias = $30,
           arcane_tomes = $31, backstory = $32, notes = $33, image = $34, cash = $35, assets = $36,
           spending_level = $37, updated_at = CURRENT_TIMESTAMP
         WHERE id = $38`,
        [
          character.name, character.player || '', character.occupation || '', character.age || 25,
          character.gender || '', character.residence || '', character.birthplace || '',
          character.str || 50, character.dex || 50, character.int_val || 50, character.con || 50,
          character.app || 50, character.pow || 50, character.siz || 50, character.edu || 50, character.luck || 50,
          character.hp_current ?? hpMax, hpMax, character.mp_current ?? mpMax, mpMax,
          character.san_current ?? sanVal, sanVal,
          character.appearance_desc || '', character.ideology || '', character.significant_people || '',
          character.meaningful_locations || '', character.treasured_possessions || '', character.traits || '',
          character.injuries_scars || '', character.phobias_manias || '', character.arcane_tomes || '',
          character.backstory || '', character.notes || '', character.image || '',
          character.cash || '', character.assets || '', character.spending_level || '',
          existingId
        ]
      );
      importedCharacterId = existingId;
    } else {
      // Insert brand new character
      const insertResult = await queryOne(
        `INSERT INTO characters
          (user_id, uuid, name, player, occupation, age, gender, residence, birthplace,
           str, dex, int_val, con, app, pow, siz, edu, luck,
           hp_current, hp_max, mp_current, mp_max, san_current, san_max,
           appearance_desc, ideology, significant_people, meaningful_locations,
           treasured_possessions, traits, injuries_scars, phobias_manias,
           arcane_tomes, backstory, notes, image, cash, assets, spending_level, is_friend)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40)
         RETURNING id`,
        [
          userId, uuid, character.name, character.player || '', character.occupation || '', character.age || 25,
          character.gender || '', character.residence || '', character.birthplace || '',
          character.str || 50, character.dex || 50, character.int_val || 50, character.con || 50,
          character.app || 50, character.pow || 50, character.siz || 50, character.edu || 50, character.luck || 50,
          character.hp_current ?? hpMax, hpMax, character.mp_current ?? mpMax, mpMax,
          character.san_current ?? sanVal, sanVal,
          character.appearance_desc || '', character.ideology || '', character.significant_people || '',
          character.meaningful_locations || '', character.treasured_possessions || '', character.traits || '',
          character.injuries_scars || '', character.phobias_manias || '', character.arcane_tomes || '',
          character.backstory || '', character.notes || '', character.image || '',
          character.cash || '', character.assets || '', character.spending_level || '',
          isFriendExport ? 1 : 0
        ]
      );
      importedCharacterId = insertResult.id;
    }

    // Restore Skills
    await query('DELETE FROM skills WHERE character_id = $1', [importedCharacterId]);
    if (character.skills && character.skills.length > 0) {
      for (const s of character.skills) {
        await query(
          `INSERT INTO skills 
            (character_id, name, base_value, value, is_occupation, is_interest, occ_points, int_points, game_points) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            importedCharacterId, s.name, s.base_value || 0, s.value || 0,
            s.is_occupation || 0, s.is_interest || 0, s.occ_points || 0, s.int_points || 0, s.game_points || 0
          ]
        );
      }
    } else {
      await createDefaultSkills(importedCharacterId, character.dex || 50, character.edu || 50);
    }

    // Restore Weapons
    await query('DELETE FROM weapons WHERE character_id = $1', [importedCharacterId]);
    if (character.weapons && character.weapons.length > 0) {
      for (const w of character.weapons) {
        await query(
          `INSERT INTO weapons 
            (character_id, name, skill, damage, range, attacks_per_round, ammo, malfunction) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            importedCharacterId, w.name || '', w.skill || '', w.damage || '', w.range || '',
            w.attacks_per_round || '1', w.ammo || 0, w.malfunction || 100
          ]
        );
      }
    }

    // Restore Possessions
    await query('DELETE FROM possessions WHERE character_id = $1', [importedCharacterId]);
    if (character.possessions && character.possessions.length > 0) {
      for (const p of character.possessions) {
        await query(
          'INSERT INTO possessions (character_id, item) VALUES ($1, $2)',
          [importedCharacterId, p.item || '']
        );
      }
    }

    // Fetch fully updated investigator details
    const result = await queryOne('SELECT * FROM characters WHERE id = $1', [importedCharacterId]);
    const skills = await query('SELECT * FROM skills WHERE character_id = $1 ORDER BY name', [importedCharacterId]);
    const weapons = await query('SELECT * FROM weapons WHERE character_id = $1', [importedCharacterId]);
    const possessions = await query('SELECT * FROM possessions WHERE character_id = $1', [importedCharacterId]);

    return NextResponse.json({
      ...result,
      skills: skills.rows,
      weapons: weapons.rows,
      possessions: possessions.rows,
      wasUpdated,
      isFriend: !!isFriendExport,
    }, { status: 201 });
  } catch (e: any) {
    console.error('Import investigator error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
