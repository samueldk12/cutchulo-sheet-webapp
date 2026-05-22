import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const BOOKS_DIR = path.join(process.cwd(), 'books');

function ensureBooksDir() {
  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  }
}

// GET /api/books - List all uploaded PDF books
export async function GET() {
  try {
    ensureBooksDir();
    const files = fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    
    const books = files.map(f => {
      const stat = fs.statSync(path.join(BOOKS_DIR, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    });

    return NextResponse.json(books);
  } catch (e: any) {
    console.error('List books error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/books - Upload a PDF book
export async function POST(request: NextRequest) {
  try {
    ensureBooksDir();
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo PDF necessário' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'O arquivo deve ser um PDF' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F ]/g, '_');
    const filePath = path.join(BOOKS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      name: safeName,
      size: file.size,
    });
  } catch (e: any) {
    console.error('Upload book error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
