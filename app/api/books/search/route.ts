import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = ((pdfParseModule as any).default || pdfParseModule) as any;

const BOOKS_DIR = path.join(process.cwd(), 'books');

interface PdfTextIndex {
  text: string;
  pages: number;
  pageStarts: number[];
}

// Global text cache in development to persist parses across compilation cycles
const globalCache = global as any;
if (!globalCache.pdfTextCache) {
  globalCache.pdfTextCache = new Map<string, PdfTextIndex>();
}
const pdfTextCache: Map<string, PdfTextIndex> = globalCache.pdfTextCache;

async function extractPdfText(filename: string): Promise<PdfTextIndex> {
  const fp = path.join(BOOKS_DIR, filename);
  const stat = fs.statSync(fp);
  const cacheKey = `${filename}:${stat.mtime.getTime()}`;

  if (pdfTextCache.has(cacheKey)) {
    return pdfTextCache.get(cacheKey)!;
  }

  const pageStarts: number[] = [];
  let accumulated = '';

  const options = {
    pagerender: async (pageData: any) => {
      pageStarts.push(accumulated.length);
      const tc = await pageData.getTextContent();
      const str = tc.items.map((i: any) => i.str).join('') + '\n';
      accumulated += str;
      return str;
    }
  };

  const buf = fs.readFileSync(fp);
  await pdfParse(buf, options);

  const result = {
    text: accumulated,
    pages: pageStarts.length,
    pageStarts
  };

  pdfTextCache.set(cacheKey, result);
  return result;
}

// Returns 1-based page number for a character index pos
function getPage(pos: number, pageStarts: number[]): number {
  let lo = 0;
  let hi = pageStarts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (pageStarts[mid] <= pos) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1;
}

// GET /api/books/search - Search across PDF text content
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryStr = (searchParams.get('q') || '').trim();
    const useRegex = searchParams.get('regex') === 'true';

    if (!queryStr || queryStr.length < 2) {
      return NextResponse.json([]);
    }

    let pattern: RegExp;
    if (useRegex) {
      try {
        pattern = new RegExp(queryStr, 'gi');
      } catch (e: any) {
        return NextResponse.json({ error: `Expressão regular inválida: ${e.message}` }, { status: 400 });
      }
    } else {
      const escaped = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, 'gi');
    }

    if (!fs.existsSync(BOOKS_DIR)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(BOOKS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    const results: any[] = [];

    for (const file of files) {
      try {
        const { text, pageStarts } = await extractPdfText(file);
        const matches: any[] = [];
        let m: RegExpExecArray | null;

        pattern.lastIndex = 0;
        
        // Return up to 10 context matches per book
        while ((m = pattern.exec(text)) !== null && matches.length < 10) {
          const idx = m.index;
          const start = Math.max(0, idx - 120);
          const end = Math.min(text.length, idx + m[0].length + 120);
          const page = getPage(idx, pageStarts);

          matches.push({
            context: text.slice(start, end).replace(/\s+/g, ' ').trim(),
            pos: idx,
            page,
            matchText: m[0],
          });
        }

        if (matches.length > 0) {
          results.push({ book: file, matches });
        }
      } catch (err) {
        console.warn(`Could not parse PDF book text for searching: ${file}`);
        // Skip unreadable PDF
      }
    }

    return NextResponse.json(results);
  } catch (e: any) {
    console.error('Book text search error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
