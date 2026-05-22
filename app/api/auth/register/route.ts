import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ error: 'Usuário deve ter entre 3 e 50 caracteres' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser) {
      return NextResponse.json({ error: 'Este nome de usuário já está em uso' }, { status: 400 });
    }

    // Hash password and insert
    const passwordHash = hashPassword(password);
    const result = await queryOne(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, passwordHash]
    );

    return NextResponse.json({ success: true, user: result }, { status: 201 });
  } catch (e: any) {
    console.error('Registration error:', e);
    return NextResponse.json({ error: 'Erro interno ao registrar usuário' }, { status: 500 });
  }
}
