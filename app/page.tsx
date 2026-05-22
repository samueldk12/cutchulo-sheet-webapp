'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import InvestigatorGeneral from '../components/InvestigatorGeneral';
import InvestigatorSkills from '../components/InvestigatorSkills';
import InvestigatorCombat from '../components/InvestigatorCombat';
import InvestigatorBackstory from '../components/InvestigatorBackstory';
import PDFViewerModule from '../components/PDFViewerModule';
import NpcsEvidenceCampaigns from '../components/NpcsEvidenceCampaigns';
import DiceRollerModal from '../components/DiceRollerModal';
import Link from 'next/link';

export default function Dashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  
  // Dashboard Core State
  const [characters, setCharacters] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [character, setCharacter] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [loadingSheet, setLoadingSheet] = useState<boolean>(false);
  
  // Dice Roller Modal State
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [rollTargetName, setRollTargetName] = useState('');
  const [rollTargetValue, setRollTargetValue] = useState(0);

  // Hidden file input for JSON import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load characters and friends list
  const loadSidebarData = async () => {
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      }
      
      const resFriends = await fetch('/api/characters?friends=true');
      if (resFriends.ok) {
        const dataFriends = await resFriends.json();
        setFriends(dataFriends);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadSidebarData();
    }
  }, [user]);

  // Fetch full character sheet details when selected
  useEffect(() => {
    if (!selectedCharId) {
      setCharacter(null);
      return;
    }

    const fetchSheet = async () => {
      setLoadingSheet(true);
      try {
        const res = await fetch(`/api/characters/${selectedCharId}`);
        if (res.ok) {
          const data = await res.json();
          setCharacter(data);
        } else {
          console.error('Erro ao buscar detalhes da ficha');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSheet(false);
      }
    };

    fetchSheet();
  }, [selectedCharId]);

  // Polling Hook for live updates - Typing-safe check
  useEffect(() => {
    if (!selectedCharId) return;

    const interval = setInterval(() => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (isTyping) {
        // Pauses dynamic updates while fields are focused to prevent cursor jumping
        return;
      }

      fetch(`/api/characters/${selectedCharId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized or not found');
        })
        .then((data) => {
          // Only update if there are changes to avoid unnecessary re-renders
          setCharacter((prev: any) => {
            if (!prev) return data;
            // Check essential fields
            if (prev.updated_at !== data.updated_at) {
              return data;
            }
            return prev;
          });
        })
        .catch((err) => {
          console.error('Live sync error:', err);
        });
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedCharId]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-darkest)' }}>
        <div className="pulse-text" style={{ fontFamily: 'var(--font-gothic)', fontSize: '1.5rem', color: 'var(--text-crimson)' }}>
          CONVOCANDO PORTAL SOMBRIO...
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Actions: Character CRUD
  const handleCreateInvestigator = async () => {
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Novo Investigador',
          str: 50, dex: 50, int_val: 50, con: 50, app: 50, pow: 50, siz: 50, edu: 50, luck: 50
        })
      });
      if (res.ok) {
        const newChar = await res.json();
        await loadSidebarData();
        setSelectedCharId(newChar.id);
        setActiveTab('general');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInvestigator = async () => {
    if (!character) return;
    if (!confirm(`Deseja mesmo sacrificar o investigador ${character.name} para o abismo?`)) return;

    try {
      const res = await fetch(`/api/characters/${character.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedCharId(null);
        await loadSidebarData();
      } else {
        alert('Erro ao excluir investigador.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Field edit updates
  const handleFieldChange = async (field: string, value: any) => {
    if (!character) return;

    // Snappy UI local update
    const updated = { ...character, [field]: value };
    setCharacter(updated);

    try {
      await fetch(`/api/characters/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
    } catch (err) {
      console.error('Erro ao atualizar campo:', err);
    }
  };

  // Skill points modifications
  const handleSkillChange = async (skillId: number, field: string, value: number) => {
    if (!character) return;

    const updatedSkills = character.skills.map((s: any) => {
      if (s.id === skillId) {
        const updatedSkill = { ...s, [field]: value };
        if (field !== 'checked') {
          const base = s.base_value ?? 0;
          const occ = field === 'occ_points' ? value : (s.occ_points ?? 0);
          const int = field === 'int_points' ? value : (s.int_points ?? 0);
          const game = field === 'game_points' ? value : (s.game_points ?? 0);
          updatedSkill.value = base + occ + int + game;
          updatedSkill.is_occupation = occ > 0 ? 1 : 0;
          updatedSkill.is_interest = int > 0 ? 1 : 0;
        }
        return updatedSkill;
      }
      return s;
    });

    setCharacter({ ...character, skills: updatedSkills });

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
    } catch (err) {
      console.error('Erro ao atualizar perícia:', err);
    }
  };

  // Combat Tab Actions
  const handleAddWeapon = async (weaponData: any) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/characters/${character.id}/weapons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const newW = await res.json();
        await fetch(`/api/weapons/${newW.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(weaponData)
        });
        
        // Refresh character sheet
        const charRes = await fetch(`/api/characters/${character.id}`);
        const data = await charRes.json();
        setCharacter(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateWeapon = async (weaponId: number, field: string, value: any) => {
    if (!character) return;

    const updatedWeapons = character.weapons.map((w: any) => 
      w.id === weaponId ? { ...w, [field]: value } : w
    );
    setCharacter({ ...character, weapons: updatedWeapons });

    try {
      const w = updatedWeapons.find((x: any) => x.id === weaponId);
      await fetch(`/api/weapons/${weaponId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWeapon = async (weaponId: number) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/weapons/${weaponId}`, { method: 'DELETE' });
      if (res.ok) {
        const updatedWeapons = character.weapons.filter((w: any) => w.id !== weaponId);
        setCharacter({ ...character, weapons: updatedWeapons });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPossession = async (item: string) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/characters/${character.id}/possessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      if (res.ok) {
        const charRes = await fetch(`/api/characters/${character.id}`);
        const data = await charRes.json();
        setCharacter(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePossession = async (possessionId: number, item: string) => {
    if (!character) return;

    const updatedPoss = character.possessions.map((p: any) => 
      p.id === possessionId ? { ...p, item } : p
    );
    setCharacter({ ...character, possessions: updatedPoss });

    try {
      await fetch(`/api/possessions/${possessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePossession = async (possessionId: number) => {
    if (!character) return;
    try {
      const res = await fetch(`/api/possessions/${possessionId}`, { method: 'DELETE' });
      if (res.ok) {
        const updatedPoss = character.possessions.filter((p: any) => p.id !== possessionId);
        setCharacter({ ...character, possessions: updatedPoss });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dice Triggering
  const triggerDiceRoll = (name: string, value: number) => {
    setRollTargetName(name);
    setRollTargetValue(value);
    setIsDiceOpen(true);
  };

  const triggerDamageRoll = (expr: string, name: string) => {
    // Quick damage roller triggers custom expression
    setRollTargetName(`Dano de ${name}`);
    setRollTargetValue(0); // Damage roll doesn't test success against value
    setIsDiceOpen(true);
  };

  // JSON Import & Export Backup system
  const handleExportSheet = () => {
    if (!character) return;
    fetch(`/api/export/${character.id}`)
      .then((res) => res.json())
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ficha_${character.name.replace(/\s+/g, '_').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => console.error(err));
  };

  const handleImportSheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: json, isFriendExport: false })
        });
        if (res.ok) {
          const newChar = await res.json();
          alert('Grimório de Ficha importado com sucesso!');
          loadSidebarData();
          setSelectedCharId(newChar.id);
        } else {
          const err = await res.json();
          alert(`Erro na importação: ${err.error}`);
        }
      } catch (err) {
        alert('Erro ao decodificar JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Copy sharing public link
  const handleCopyPublicShareLink = async () => {
    if (!character) return;

    // Toggle public sharing true in database
    try {
      await fetch(`/api/characters/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: true })
      });
      
      const shareUrl = `${window.location.origin}/share/${character.uuid}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Link de compartilhamento público copiado! Seus amigos podem usar este link para ver sua ficha em tempo real e adicioná-lo aos amigos.');
      setCharacter((prev: any) => ({ ...prev, shared: true }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="monolith-wrapper">
      {/* Sidebar Navigation */}
      <aside className="monolith-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">Cutchulo RPG</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Grimório e Fichas CoC 7e</span>
        </div>

        <div className="sidebar-nav">
          <button type="button" className="btn-occult" style={{ padding: '0.75rem', fontSize: '0.8rem', textAlign: 'center', justifyContent: 'center' }} onClick={handleCreateInvestigator}>
            + Criar Investigador
          </button>
          
          <button type="button" className="btn-occult-secondary" style={{ padding: '0.6rem', fontSize: '0.75rem', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
            📥 Importar Ficha JSON
          </button>
          <input type="file" ref={fileInputRef} accept=".json" onChange={handleImportSheet} style={{ display: 'none' }} />

          <div className="sidebar-item-header">Seus Investigadores</div>
          {characters.map((c) => (
            <button
              key={c.id}
              className={`sidebar-btn ${selectedCharId === c.id ? 'active' : ''}`}
              onClick={() => { setSelectedCharId(c.id); setActiveTab('general'); }}
            >
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: '1px solid var(--border-crimson)',
                background: c.image ? `url(${c.image}) center/cover no-repeat` : 'rgba(0,0,0,0.5)',
                display: 'block'
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.occupation || 'Investigador'}</span>
              </div>
            </button>
          ))}
          {characters.length === 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Sem fichas invocadas</span>
          )}

          <div className="sidebar-item-header">Investigadores de Amigos</div>
          {friends.map((f) => (
            <button
              key={f.id}
              className={`sidebar-btn ${selectedCharId === f.id ? 'active' : ''}`}
              onClick={() => { setSelectedCharId(f.id); setActiveTab('general'); }}
            >
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: '1px solid var(--border-gold)',
                background: f.image ? `url(${f.image}) center/cover no-repeat` : 'rgba(0,0,0,0.5)',
                display: 'block'
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Jogador: {f.player || 'Desconhecido'}</span>
              </div>
            </button>
          ))}
          {friends.length === 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhum amigo adicionado</span>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">👤 {user.username}</span>
            <Link href="/gm" style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', textDecoration: 'underline', marginTop: '0.2rem' }}>
              Acessar Painel do Mestre (GM)
            </Link>
          </div>
          <button className="vital-btn" title="Banir Sessão (Logout)" onClick={logout} style={{ color: 'var(--text-crimson)' }}>
            🚪
          </button>
        </div>
      </aside>

      {/* Main Sheet Workspace */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-deep)' }}>
        {loadingSheet ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <span className="pulse-text" style={{ fontFamily: 'var(--font-gothic)', fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
              REUNINDO CICATRIZES MENTAIS DO INVESTIGADOR...
            </span>
          </div>
        ) : character ? (
          <>
            {/* Sheet Control Header */}
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {character.name}
                  {character.is_friend === 1 && <span style={{ fontSize: '0.75rem', background: 'rgba(229,169,59,0.15)', color: 'var(--text-gold)', border: '1px solid var(--border-gold)', borderRadius: '4px', padding: '0.1rem 0.5rem' }}>Ficha Compartilhada (Lida Apenas)</span>}
                </h1>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {character.occupation || 'Nenhuma Ocupação'} | {character.age} Anos
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-occult btn-cyan" onClick={handleCopyPublicShareLink}>
                  🔗 Compartilhar
                </button>
                <button type="button" className="btn-occult-secondary" onClick={handleExportSheet}>
                  💾 Exportar JSON
                </button>
                {character.is_friend !== 1 && (
                  <button type="button" className="btn-occult" style={{ background: 'var(--primary-crimson)', borderColor: 'var(--primary-crimson-glow)' }} onClick={handleDeleteInvestigator}>
                    Sacrificar (Deletar)
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Tabs Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '2px solid var(--border-crimson)', paddingBottom: '0.5rem' }}>
              {[
                { label: 'Geral', key: 'general' },
                { label: 'Perícias', key: 'skills' },
                { label: 'Combate & Equipamentos', key: 'combat' },
                { label: 'Histórico & Dossiê', key: 'backstory' },
                { label: 'Biblioteca (Grimórios)', key: 'books' },
                { label: 'Evidências & NPCs', key: 'npcs' },
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

            {/* Active Tab View */}
            <div className="tab-content-container" style={{ animation: 'fadeIn 0.3s ease' }}>
              {activeTab === 'general' && (
                <InvestigatorGeneral
                  character={character}
                  onChange={character.is_friend === 1 ? () => {} : handleFieldChange}
                  onRollClick={triggerDiceRoll}
                />
              )}
              {activeTab === 'skills' && (
                <InvestigatorSkills
                  skills={character.skills}
                  onSkillChange={character.is_friend === 1 ? () => {} : handleSkillChange}
                  onRollClick={triggerDiceRoll}
                />
              )}
              {activeTab === 'combat' && (
                <InvestigatorCombat
                  characterId={character.id}
                  weapons={character.weapons}
                  possessions={character.possessions}
                  skills={character.skills}
                  onAddWeapon={character.is_friend === 1 ? () => {} : handleAddWeapon}
                  onUpdateWeapon={character.is_friend === 1 ? () => {} : handleUpdateWeapon}
                  onDeleteWeapon={character.is_friend === 1 ? () => {} : handleDeleteWeapon}
                  onAddPossession={character.is_friend === 1 ? () => {} : handleAddPossession}
                  onUpdatePossession={character.is_friend === 1 ? () => {} : handleUpdatePossession}
                  onDeletePossession={character.is_friend === 1 ? () => {} : handleDeletePossession}
                  onRollClick={triggerDiceRoll}
                  onDamageRoll={triggerDamageRoll}
                />
              )}
              {activeTab === 'backstory' && (
                <InvestigatorBackstory
                  character={character}
                  onChange={character.is_friend === 1 ? () => {} : handleFieldChange}
                />
              )}
              {activeTab === 'books' && <PDFViewerModule />}
              {activeTab === 'npcs' && (
                <NpcsEvidenceCampaigns
                  characterId={character.id}
                  currentUser={user}
                  onRollClick={triggerDiceRoll}
                />
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '6rem', textShadow: 'var(--glow-crimson)', filter: 'drop-shadow(0 0 20px rgba(140,12,16,0.3))' }}>💀</span>
            <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.8rem', textAlign: 'center' }}>
              O ritual está pronto.
            </h2>
            <p style={{ maxWidth: '480px', textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              Selecione um investigador existente na barra lateral sinistra ou invoque um novo avatar criando do zero ou importando um arquivo JSON de backup.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn-occult" onClick={handleCreateInvestigator}>
                Invocação Rápida (+ Novo)
              </button>
              <button type="button" className="btn-occult-secondary" onClick={() => fileInputRef.current?.click()}>
                Importar Backup JSON
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Shared Dice Roller Modal */}
      <DiceRollerModal
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        characterId={character?.id}
        targetName={rollTargetName}
        targetValue={rollTargetValue}
      />
    </div>
  );
}
