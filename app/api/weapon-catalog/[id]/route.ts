import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkCatalogAuth(itemId: number, userId: number): Promise<boolean> {
  const item = await queryOne('SELECT user_id FROM weapon_catalog WHERE id = $1', [itemId]);
  return item && item.user_id === userId;
}

// PUT /api/weapon-catalog/[id] - Update custom weapon catalog entry
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const itemId = parseInt(paramId, 10);
    const data = await request.json();

    const isAuthorized = await checkCatalogAuth(itemId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado: Você só pode modificar seus próprios itens customizados' }, { status: 403 });
    }

    await query(
      `UPDATE weapon_catalog 
       SET name = $1, skill = $2, damage = $3, range = $4, attacks_per_round = $5, ammo = $6, malfunction = $7, category = $8, notes = $9
       WHERE id = $10`,
      [
        data.name,
        data.skill || '',
        data.damage || '',
        data.range || '',
        data.attacks_per_round || '1',
        data.ammo || 0,
        data.malfunction || 100,
        data.category || 'other',
        data.notes || '',
        itemId
      ]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update catalog item error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/weapon-catalog/[id] - Delete custom weapon catalog entry
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const itemId = parseInt(paramId, 10);

    const isAuthorized = await checkCatalogAuth(itemId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado: Você só pode excluir seus próprios itens customizados' }, { status: 403 });
    }

    await query('DELETE FROM weapon_catalog WHERE id = $1', [itemId]);

    return NextResponse.json({ success: true, message: 'Item excluído com sucesso do catálogo' });
  } catch (e: any) {
    console.error('Delete catalog item error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
