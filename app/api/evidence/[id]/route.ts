import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkEvidenceAuth(evidenceId: number, userId: number): Promise<boolean> {
  const item = await queryOne('SELECT user_id FROM evidence WHERE id = $1', [evidenceId]);
  return item && item.user_id === userId;
}

// GET /api/evidence/[id] - Fetch specific evidence details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const evidenceId = parseInt(paramId, 10);

    const isAuthorized = await checkEvidenceAuth(evidenceId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou evidência não encontrada' }, { status: 403 });
    }

    const item = await queryOne('SELECT * FROM evidence WHERE id = $1', [evidenceId]);
    return NextResponse.json(item);
  } catch (e: any) {
    console.error('Fetch evidence details error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/evidence/[id] - Update specific evidence card
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const evidenceId = parseInt(paramId, 10);
    const data = await request.json();

    const isAuthorized = await checkEvidenceAuth(evidenceId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou evidência não encontrada' }, { status: 403 });
    }

    const allowedFields = ['title', 'description', 'session_tag', 'image'];
    const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));

    if (fieldsToUpdate.length > 0) {
      const setClause = fieldsToUpdate.map((field, idx) => `"${field}" = $${idx + 2}`).join(', ');
      const values = fieldsToUpdate.map(field => data[field]);
      
      await query(
        `UPDATE evidence SET ${setClause} WHERE id = $1`,
        [evidenceId, ...values]
      );
    }

    const updated = await queryOne('SELECT * FROM evidence WHERE id = $1', [evidenceId]);
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('Update evidence error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/evidence/[id] - Delete specific evidence card
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const evidenceId = parseInt(paramId, 10);

    const isAuthorized = await checkEvidenceAuth(evidenceId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou evidência não encontrada' }, { status: 403 });
    }

    await query('DELETE FROM evidence WHERE id = $1', [evidenceId]);

    return NextResponse.json({ success: true, message: 'Evidência excluída com sucesso' });
  } catch (e: any) {
    console.error('Delete evidence error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
