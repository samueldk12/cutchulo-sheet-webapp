import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'a_deep_lovecraftian_secret_key_1234_cthulhu_fhtagn';

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: { userId: number; username: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
  } catch {
    return null;
  }
}

// Edge-compatible verification helper using Web Crypto API (perfect for Next.js Middleware)
export async function verifyTokenEdge(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);
    const keyData = encoder.encode(JWT_SECRET);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBytes = base64UrlDecode(signature);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as any, data);
    
    if (!isValid) return null;
    
    const decodedPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    
    // Check expiration
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
      return null;
    }
    
    return decodedPayload;
  } catch (err) {
    return null;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
