'use client';

import React, { useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

export default function LoginPage() {
  const { login, register, loginAnonymously } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const result = await register(username, password);
        if (!result.success) {
          setError(result.error || 'Erro ao criar conta.');
        }
      } else {
        const result = await login(username, password);
        if (!result.success) {
          setError(result.error || 'Usuário ou senha incorretos.');
        }
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem',
      position: 'relative'
    }}>
      {/* Background Occult Overlay Circle */}
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(140, 12, 16, 0.15) 0%, transparent 70%)',
        zIndex: 0,
        filter: 'blur(30px)'
      }}></div>

      <div className="occult-card" style={{
        width: '100%',
        maxWidth: '420px',
        zIndex: 1,
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', color: 'var(--text-crimson)', textShadow: 'var(--glow-crimson)', marginBottom: '0.5rem' }}>
            Cutchulo
          </h1>
          <p style={{ fontFamily: 'var(--font-gothic)', fontSize: '0.8rem', color: 'var(--text-gold)', letterSpacing: '0.15em' }}>
            Portal dos Investigadores
          </p>
        </div>

        {error && (
          <div className="occult-alert" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', padding: '0.75rem 1rem' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="gothic-input-group">
            <label className="gothic-label">Usuário</label>
            <input
              type="text"
              className="gothic-input"
              placeholder="Digite seu usuário..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Senha</label>
            <input
              type="password"
              className="gothic-input"
              placeholder="Digite sua senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div className="gothic-input-group">
              <label className="gothic-label">Confirmar Senha</label>
              <input
                type="password"
                className="gothic-input"
                placeholder="Confirme sua senha..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn-occult"
            style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Invocando...' : isRegister ? 'Registrar Ritual' : 'Entrar no Portal'}
          </button>
        </form>

        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-occult-secondary"
            onClick={loginAnonymously}
            style={{ width: '100%', padding: '0.9rem', borderColor: 'var(--accent-gold)', textShadow: 'var(--glow-gold)', fontSize: '0.85rem' }}
          >
            👁️ Jogar de Forma Anônima (Sem Conta)
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="btn-occult-secondary"
            style={{ background: 'transparent', border: 'none', padding: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {isRegister ? 'Já tem um ritual iniciado? Entre aqui' : 'Iniciar novo ritual (Criar Conta)'}
          </button>
        </div>
      </div>
    </div>
  );
}
