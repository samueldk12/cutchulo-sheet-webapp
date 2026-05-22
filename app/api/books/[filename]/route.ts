import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const BOOKS_DIR = path.join(process.cwd(), 'books');

// GET /api/books/[filename] - Serve dynamic PDF file natively
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: encodedFilename } = await params;
    const filename = decodeURIComponent(encodedFilename);
    const safeFilename = path.basename(filename);
    const filePath = path.join(BOOKS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(safeFilename)}"`,
      },
    });
  } catch (e: any) {
    console.error('Serve book error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/books/[filename] - Delete PDF book file
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: encodedFilename } = await params;
    const filename = decodeURIComponent(encodedFilename);
    const safeFilename = path.basename(filename);
    const filePath = path.join(BOOKS_DIR, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true, message: 'Livro excluído com sucesso' });
    }

    return NextResponse.json({ error: 'Livro não encontrado' }, { status: 404 });
  } catch (e: any) {
    console.error('Delete book error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
