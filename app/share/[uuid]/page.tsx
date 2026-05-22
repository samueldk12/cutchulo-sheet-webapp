'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import InvestigatorGeneral from '../../../components/InvestigatorGeneral';
import InvestigatorSkills from '../../../components/InvestigatorSkills';
import InvestigatorCombat from '../../../components/InvestigatorCombat';
import InvestigatorBackstory from '../../../components/InvestigatorBackstory';
import DiceRollerModal from '../../../components/DiceRollerModal';

export default function ShareSheetPage() {
  const { uuid } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [rollTargetName, setRollTargetName] = useState('');
  const [rollTargetValue, setRollTargetValue] = useState(0);
  const [addingFriend, setAddingFriend] = useState(false);

  // Fetch shared character details
  const fetchSharedCharacter = async () => {
    try {
      const res = await fetch(`/api/share/${uuid}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Falha ao buscar ficha compartilhada');
      }
      const data = await res.json();
      setCharacter(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar a ficha pública');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uuid) {
      fetchSharedCharacter();
    }
  }, [uuid]);

  // Real-time synchronization polling (every 4 seconds)
  useEffect(() => {
    if (!character || error) return;

    const interval = setInterval(() => {
      fetch(`/api/share/${uuid}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Sync failed');
        })
        .then((data) => {
          setCharacter((prev: any) => {
            if (!prev) return data;
            if (prev.updated_at !== data.updated_at) {
              return data;
            }
            return prev;
          });
        })
        .catch((err) => console.warn('Public sync error:', err));
    }, 4000);

    return () => clearInterval(interval);
  }, [character, error, uuid]);

  const handleAddFriend = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setAddingFriend(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Investigador adicionado aos seus amigos!');
      } else {
        alert(data.error || 'Erro ao adicionar aos amigos');
      }
    } catch (err) {
      alert('Falha de conexão com o servidor');
    } finally {
      setAddingFriend(false);
    }
  };

  const triggerDiceRoll = (name: string, value: number) => {
    setRollTargetName(name);
    setRollTargetValue(value);
    setIsDiceOpen(true);
  };

  const triggerDamageRoll = (expr: string, name: string) => {
    setRollTargetName(`Dano de ${name}`);
    setRollTargetValue(0);
    setIsDiceOpen(true);
  };

  if (loading || authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-darkest)' }}>
        <div className="pulse-text" style={{ fontFamily: 'var(--font-gothic)', fontSize: '1.5rem', color: 'var(--accent-gold)' }}>
          DECIFRANDO GRIMÓRIO DE FICHA...
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-darkest)', padding: '2rem', gap: '1.5rem' }}>
        <span style={{ fontSize: '5rem', textShadow: 'var(--glow-crimson)' }}>⚠️</span>
        <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-crimson)', fontSize: '1.8rem' }}>Mente Rompida / Acesso Negado</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', textAlign: 'center', fontSize: '0.95rem' }}>
          {error || 'Esta ficha não está marcada como pública ou o ritual de invocação falhou.'}
        </p>
        <button className="btn-occult" onClick={() => router.push('/')}>Voltar para o Painel</button>
      </div>
    );
  }

  const isOwnSheet = user && character.user_id === user.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Banner / Social Action Header */}
      <header className="glass-panel" style={{ margin: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-crimson)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-cyan)' }}>Ficha Pública de Investigador</span>
          <h1 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.6rem', margin: 0 }}>
            {character.name}
          </h1>
        </div>

        <div>
          {user ? (
            isOwnSheet ? (
              <button className="btn-occult-secondary" disabled style={{ opacity: 0.6 }}>
                Sua Própria Ficha
              </button>
            ) : (
              <button className="btn-occult btn-cyan" onClick={handleAddFriend} disabled={addingFriend}>
                {addingFriend ? 'Adicionando...' : '+ Adicionar aos Amigos'}
              </button>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Faça login para salvar na sua sidebar</span>
              <button className="btn-occult" onClick={() => router.push('/login')}>Fazer Login</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Sheet Grid Container */}
      <main style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Vitals Summary Strip */}
        <div className="vitals-grid" style={{ pointerEvents: 'none' }}>
          <div className="vital-card hp occult-card">
            <div className="vital-title">Pontos de Vida (PV)</div>
            <div className="vital-value">{character.hp_current} / {character.hp_max}</div>
            <div className="vital-bar-container">
              <div className="vital-bar" style={{ width: `${((character.hp_current || 10) / (character.hp_max || 10)) * 100}%` }}></div>
            </div>
          </div>
          <div className="vital-card mp occult-card">
            <div className="vital-title">Pontos de Magia (PM)</div>
            <div className="vital-value">{character.mp_current} / {character.mp_max}</div>
            <div className="vital-bar-container">
              <div className="vital-bar" style={{ width: `${((character.mp_current || 10) / (character.mp_max || 10)) * 100}%` }}></div>
            </div>
          </div>
          <div className="vital-card san occult-card">
            <div className="vital-title">Sanidade (SAN)</div>
            <div className="vital-value">{character.san_current} / {character.san_max}</div>
            <div className="vital-bar-container">
              <div className="vital-bar" style={{ width: `${((character.san_current || 50) / (character.san_max || 99)) * 100}%` }}></div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '2px solid var(--border-crimson)', paddingBottom: '0.5rem' }}>
          {[
            { label: 'Geral', key: 'general' },
            { label: 'Perícias', key: 'skills' },
            { label: 'Combate & Equipamentos', key: 'combat' },
            { label: 'Histórico & Dossiê', key: 'backstory' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Read-Only Sheet Content wrapper */}
        <div className="sheet-read-only" style={{ flex: 1 }}>
          {activeTab === 'general' && (
            <InvestigatorGeneral
              character={character}
              onChange={() => {}}
              onRollClick={triggerDiceRoll}
            />
          )}
          {activeTab === 'skills' && (
            <InvestigatorSkills
              skills={character.skills}
              onSkillChange={() => {}}
              onRollClick={triggerDiceRoll}
            />
          )}
          {activeTab === 'combat' && (
            <InvestigatorCombat
              characterId={character.id}
              weapons={character.weapons}
              possessions={character.possessions}
              skills={character.skills}
              onAddWeapon={() => {}}
              onUpdateWeapon={() => {}}
              onDeleteWeapon={() => {}}
              onAddPossession={() => {}}
              onUpdatePossession={() => {}}
              onDeletePossession={() => {}}
              onRollClick={triggerDiceRoll}
              onDamageRoll={triggerDamageRoll}
            />
          )}
          {activeTab === 'backstory' && (
            <InvestigatorBackstory
              character={character}
              onChange={() => {}}
            />
          )}
        </div>
      </main>

      {/* Embedded Dice Roller Modal */}
      <DiceRollerModal
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        targetName={rollTargetName}
        targetValue={rollTargetValue}
      />
    </div>
  );
}
