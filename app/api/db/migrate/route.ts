import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { runDatabaseMigration } from '@/lib/migrate-db';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de Segurança
    const authHeader = req.headers.get('Authorization');
    const apiKeyParam = req.nextUrl.searchParams.get('apiKey');
    const secret = process.env.JWT_SECRET || 'a_deep_lovecraftian_secret_key_1234_cthulhu_fhtagn';
    
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
    // O chamador deve enviar o JWT_SECRET no Header de Autorização ou como Query Param 'apiKey'
    if (token !== secret && apiKeyParam !== secret) {
      return NextResponse.json(
        { error: 'Não autorizado. Forneça o JWT_SECRET correto no cabeçalho Authorization ou query param apiKey.' },
        { status: 401 }
      );
    }

    // 2. Executar a migração e o seeder
    const result = await runDatabaseMigration(pool);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Banco de dados PostgreSQL migrado com sucesso via API First!',
        logs: result.logs
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Falha durante a migração do banco de dados via API.',
        error: result.message,
        logs: result.logs
      }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: 'Erro interno ao processar a rota de migração.',
      error: err.message
    }, { status: 500 });
  }
}
