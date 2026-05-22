import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-user-username');

  if (!userId || !username) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: parseInt(userId, 10),
      username,
    },
  });
}
