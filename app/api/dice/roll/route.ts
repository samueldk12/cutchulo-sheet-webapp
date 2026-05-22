import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

interface RollResult {
  expression: string;
  rolls: number[];
  bonusPenaltyRolls: number[];
  modifier: number;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFail: boolean;
}

function rollDice(expression: string, bonus: number = 0, penalty: number = 0): RollResult {
  const expr = expression.toLowerCase().trim();
  const match = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Expressão de dados inválida: ${expression}`);

  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  const modifier = parseInt(match[3] || '0', 10);
  
  if (count < 1 || count > 100) throw new Error('Quantidade de dados deve ser entre 1 e 100');
  if (sides < 2 || sides > 1000) throw new Error('Lados do dado deve ser entre 2 e 1000');

  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  let total = rolls.reduce((a, b) => a + b, 0) + modifier;
  let bonusPenaltyRolls: number[] = [];

  if (sides === 100 && (bonus > 0 || penalty > 0)) {
    const units = (rolls[0] - 1) % 10;
    const tens = Math.floor((rolls[0] - 1) / 10) * 10;
    
    // Generate extra tens rolls (0, 10, 20, ..., 90)
    const extraTens = Array.from({ length: Math.max(bonus, penalty) }, () => Math.floor(Math.random() * 10) * 10);
    bonusPenaltyRolls = extraTens;
    
    const allTens = [tens, ...extraTens];
    const chosenTens = bonus > 0 ? Math.min(...allTens) : Math.max(...allTens);
    
    // Call of Cthulhu 100 representation (00 + 0 = 100)
    total = chosenTens + units + 1;
    if (total > 100) total = 100;
    total = Math.max(1, total);
  }

  return {
    expression: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}${bonus > 0 ? ` (+${bonus}b)` : ''}${penalty > 0 ? ` (-${penalty}p)` : ''}`,
    rolls,
    bonusPenaltyRolls,
    modifier,
    total,
    isCriticalSuccess: sides === 100 && total === 1,
    isCriticalFail: sides === 100 && (total === 100 || total >= 96),
  };
}

// POST /api/dice/roll - Roll standard or campaign dice
export async function POST(request: NextRequest) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { expression, characterId, bonus, penalty } = await request.json();

    if (!expression) {
      return NextResponse.json({ error: 'Expressão de dados é obrigatória' }, { status: 400 });
    }

    const result = rollDice(expression, bonus || 0, penalty || 0);

    // Save to history
    await query(
      `INSERT INTO dice_history (character_id, expression, result, details) 
       VALUES ($1, $2, $3, $4)`,
      [
        characterId || null,
        result.expression,
        result.total,
        JSON.stringify({ rolls: result.rolls, bonusPenaltyRolls: result.bonusPenaltyRolls, isCriticalSuccess: result.isCriticalSuccess, isCriticalFail: result.isCriticalFail }),
      ]
    );

    // If character is connected to an active campaign, automatically broadcast the roll to session chat
    if (characterId) {
      try {
        const activeSession = await queryOne(
          `SELECT session_id FROM session_characters WHERE character_id = $1`,
          [characterId]
        );
        if (activeSession) {
          const charInfo = await queryOne('SELECT name FROM characters WHERE id = $1', [characterId]);
          const characterName = charInfo?.name || 'Investigador';
          
          await query(
            `INSERT INTO session_messages (session_id, sender_id, message_type, content, roll_details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              activeSession.session_id,
              userId,
              'roll',
              `${characterName} rolou ${result.expression}: ${result.total}`,
              JSON.stringify({
                expression: result.expression,
                total: result.total,
                rolls: result.rolls,
                bonusPenaltyRolls: result.bonusPenaltyRolls,
                isCriticalSuccess: result.isCriticalSuccess,
                isCriticalFail: result.isCriticalFail,
                characterName
              })
            ]
          );
        }
      } catch (err) {
        console.error('Error broadcasting dice roll to session chat:', err);
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
