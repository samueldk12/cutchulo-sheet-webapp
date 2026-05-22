import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

async function checkAnnotationAuth(annotationId: number, userId: number): Promise<boolean> {
  const item = await queryOne('SELECT user_id FROM pdf_annotations WHERE id = $1', [annotationId]);
  return item && item.user_id === userId;
}

// PUT /api/pdf-annotations/[id] - Update specific PDF page annotation
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const annotationId = parseInt(paramId, 10);
    const data = await request.json();

    const isAuthorized = await checkAnnotationAuth(annotationId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou anotação não encontrada' }, { status: 403 });
    }

    await query(
      `UPDATE pdf_annotations 
       SET note = $1, color = $2 
       WHERE id = $3`,
      [data.note || '', data.color || 'yellow', annotationId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update PDF annotation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/pdf-annotations/[id] - Delete specific PDF page annotation
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = parseInt(request.headers.get('x-user-id')!, 10);
    const { id: paramId } = await params;
    const annotationId = parseInt(paramId, 10);

    const isAuthorized = await checkAnnotationAuth(annotationId, userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso negado ou anotação não encontrada' }, { status: 403 });
    }

    await query('DELETE FROM pdf_annotations WHERE id = $1', [annotationId]);

    return NextResponse.json({ success: true, message: 'Anotação excluída com sucesso' });
  } catch (e: any) {
    console.error('Delete PDF annotation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
