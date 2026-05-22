'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  loginAnonymously: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        const isAnon = typeof document !== 'undefined' && document.cookie.split('; ').find(row => row.startsWith('anonymous='))?.split('=')[1] === 'true';
        if (isAnon) {
          setUser({ id: -1, username: 'Investigador Anônimo' });
        } else {
          setUser(null);
          // If we are not on public pages or /login, redirect to /login
          if (pathname !== '/login' && !pathname.startsWith('/share/')) {
            router.push('/login');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, [pathname]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Clean anonymous cookie if logged in successfully
        document.cookie = "anonymous=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        setUser(data.user);
        router.push('/');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Erro desconhecido ao logar' };
      }
    } catch (err: any) {
      return { success: false, error: 'Falha na conexão com o servidor' };
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Log in immediately after successful registration
        return login(username, password);
      } else {
        return { success: false, error: data.error || 'Erro desconhecido ao registrar' };
      }
    } catch (err: any) {
      return { success: false, error: 'Falha na conexão com o servidor' };
    }
  };

  const loginAnonymously = () => {
    document.cookie = "anonymous=true; path=/; max-age=86400; SameSite=Strict";
    setUser({ id: -1, username: 'Investigador Anônimo' });
    router.push('/');
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
    // Clean cookies
    document.cookie = "anonymous=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkSession, loginAnonymously }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
