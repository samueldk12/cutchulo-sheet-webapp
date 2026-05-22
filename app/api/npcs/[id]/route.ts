import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkNpcAuth(npcId: number, userId: number): Promise<boolean> {
  const npc = await queryOne('SELECT user_id FROM npcs WHERE id = $1', [npcId]);
  return npc && npc.user_id === userId;
}

// GET /api/npcs/[id] - Fetch single NPC details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const npcId = parseInt(paramId, 10);

    const isAuthorized = await checkNpcAuth(npcId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou NPC não encontrado' }, { status: 403 });
    }

    const npc = await queryOne('SELECT * FROM npcs WHERE id = $1', [npcId]);
    return NextResponse.json(npc);
  } catch (e: any) {
    console.error('Fetch NPC details error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/npcs/[id] - Update single NPC stats
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const npcId = parseInt(paramId, 10);
    const data = await request.json();

    const isAuthorized = await checkNpcAuth(npcId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou NPC não encontrado' }, { status: 403 });
    }

    const allowedFields = [
      'name', 'type', 'description', 'str', 'dex', 'int_val', 'con', 'pow', 'siz',
      'hp_current', 'hp_max', 'mp_current', 'mp_max', 'san_current', 'san_max',
      'damage_bonus', 'build', 'armor', 'attacks', 'skills_text', 'special_abilities', 'notes', 'image'
    ];

    const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));

    if (fieldsToUpdate.length > 0) {
      const setClause = fieldsToUpdate.map((field, idx) => `"${field}" = $${idx + 2}`).join(', ');
      const values = fieldsToUpdate.map(field => {
        if (field === 'attacks' && typeof data[field] === 'object') {
          return JSON.stringify(data[field]);
        }
        return data[field];
      });

      await query(
        `UPDATE npcs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [npcId, ...values]
      );
    }

    const updatedNpc = await queryOne('SELECT * FROM npcs WHERE id = $1', [npcId]);
    return NextResponse.json(updatedNpc);
  } catch (e: any) {
    console.error('Update NPC error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/npcs/[id] - Delete specific NPC
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const npcId = parseInt(paramId, 10);

    const isAuthorized = await checkNpcAuth(npcId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou NPC não encontrado' }, { status: 403 });
    }

    await query('DELETE FROM npcs WHERE id = $1', [npcId]);
    return NextResponse.json({ success: true, message: 'NPC excluído com sucesso' });
  } catch (e: any) {
    console.error('Delete NPC error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
