import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) {
      return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 400 });
    }

    const isMatch = comparePassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 400 });
    }

    const token = signToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (e: any) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Erro interno ao realizar login' }, { status: 500 });
  }
}
