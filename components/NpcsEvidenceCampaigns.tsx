'use client';

import React, { useState, useEffect } from 'react';

interface Npc {
  id: number;
  name: string;
  type: string; // 'npc' | 'monster'
  description: string;
  str: number;
  dex: number;
  int_val: number;
  con: number;
  pow: number;
  siz: number;
  hp_current: number;
  hp_max: number;
  mp_current: number;
  mp_max: number;
  san_current: number;
  san_max: number;
  damage_bonus: string;
  build: string;
  armor: number;
  attacks: string; // JSON string
  skills_text: string;
  special_abilities: string;
  notes: string;
  image: string;
}

interface Evidence {
  id: number;
  title: string;
  description: string;
  session_tag: string;
  image: string;
  created_at: string;
}

interface CampaignSession {
  id: number;
  code: string;
  name: string;
  notes: string;
  is_active: boolean;
  player_count?: number;
  gm_username?: string;
  roll20_url?: string;
}

interface NpcsEvidenceCampaignsProps {
  characterId?: number | null;
  onRollClick: (name: string, value: number) => void;
  currentUser?: any;
}

export default function NpcsEvidenceCampaigns({
  characterId = null,
  onRollClick,
  currentUser = null
}: NpcsEvidenceCampaignsProps) {
  const [subTab, setSubTab] = useState<'npcs' | 'evidence' | 'campaigns'>('npcs');
  
  // NPCs State
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<Npc | null>(null);
  
  // Evidence State
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [newEvTitle, setNewEvTitle] = useState('');
  const [newEvDesc, setNewEvDesc] = useState('');
  const [newEvTag, setNewEvTag] = useState('');
  
  // Campaign State
  const [gmSessions, setGmSessions] = useState<CampaignSession[]>([]);
  const [playerSessions, setPlayerSessions] = useState<CampaignSession[]>([]);
  const [activeSession, setActiveSession] = useState<CampaignSession | null>(null);
  const [detailedSession, setDetailedSession] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newSessionName, setNewSessionName] = useState('');

  // Load NPCs
  const loadNpcs = async () => {
    try {
      const res = await fetch('/api/npcs');
      if (res.ok) {
        const data = await res.json();
        setNpcs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Evidence
  const loadEvidence = async () => {
    try {
      const res = await fetch('/api/evidence');
      if (res.ok) {
        const data = await res.json();
        setEvidence(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Sessions
  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setGmSessions(data.gm || []);
        setPlayerSessions(data.player || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadNpcs();
    loadEvidence();
    loadSessions();
  }, []);

  // Fetch chat messages
  const loadChatMessages = async (sessId: number) => {
    try {
      const res = await fetch(`/api/sessions/${sessId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Error loading chat messages:', err);
    }
  };

  // Polling session details & chat room logs
  useEffect(() => {
    if (!activeSession) {
      setDetailedSession(null);
      setChatMessages([]);
      return;
    }

    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/sessions/${activeSession.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetailedSession(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchDetails();
    loadChatMessages(activeSession.id);

    const detailInterval = setInterval(fetchDetails, 6000);
    const chatInterval = setInterval(() => {
      loadChatMessages(activeSession.id);
    }, 3000);

    return () => {
      clearInterval(detailInterval);
      clearInterval(chatInterval);
    };
  }, [activeSession]);

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSession) return;

    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: chatInput.trim(),
          message_type: 'chat'
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput('');
        
        // Scroll chat container
        setTimeout(() => {
          const container = document.getElementById('chat-msg-container');
          if (container) container.scrollTop = container.scrollHeight;
        }, 50);
      }
    } catch (err) {
      console.error('Error sending campaign chat message:', err);
    }
  };

  // Render roll card helper
  const renderRollDetails = (rollDetails: any) => {
    if (!rollDetails) return null;
    const { expression, total, rolls, characterName, isCriticalSuccess, isCriticalFail } = rollDetails;
    
    let outcome = '';
    let outcomeClass = 'success-regular';
    if (isCriticalSuccess) {
      outcome = 'CRÍTICO! ⛧';
      outcomeClass = 'success-extreme';
    } else if (isCriticalFail) {
      outcome = 'DESASTRE! 💀';
      outcomeClass = 'success-fumble';
    }

    return (
      <div className="chat-roll-card">
        <span className="chat-roll-char-name">{characterName}</span>
        <span className="chat-roll-expr">Rolou {expression}</span>
        <div className="chat-roll-total-box">
          <span className="chat-roll-total-value">{total}</span>
          {outcome && <span className={`dice-success-badge ${outcomeClass}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: 'none' }}>{outcome}</span>}
        </div>
        <span className="chat-roll-details">Resultados: [{rolls?.join(', ')}]</span>
      </div>
    );
  };

  // Join Campaign
  const handleJoinCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !characterId) {
      alert('Selecione um investigador primeiro.');
      return;
    }

    try {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim(), characterId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Sucesso: Entrou na campanha ${data.name}!`);
        setJoinCode('');
        loadSessions();
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Campaign (as GM)
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName.trim() })
      });
      if (res.ok) {
        setNewSessionName('');
        loadSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Evidence
  const handleCreateEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvTitle.trim()) return;

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEvTitle.trim(),
          description: newEvDesc,
          session_tag: newEvTag
        })
      });
      if (res.ok) {
        setNewEvTitle('');
        setNewEvDesc('');
        setNewEvTag('');
        loadEvidence();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create NPC
  const handleCreateNpc = async () => {
    try {
      const res = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Novo Aliado ou Monstro',
          type: 'npc',
          description: 'Insira a descrição...'
        })
      });
      if (res.ok) {
        const data = await res.json();
        await loadNpcs();
        setSelectedNpc(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update NPC
  const handleUpdateNpc = async (field: keyof Npc, val: any) => {
    if (!selectedNpc) return;
    const updated = { ...selectedNpc, [field]: val };
    setSelectedNpc(updated);

    try {
      await fetch(`/api/npcs/${selectedNpc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
      setNpcs(npcs.map(n => n.id === selectedNpc.id ? updated : n));
    } catch (err) {
      console.error(err);
    }
  };

  // Delete NPC
  const handleDeleteNpc = async (id: number) => {
    if (!confirm('Banir este NPC da campanha?')) return;
    try {
      const res = await fetch(`/api/npcs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNpcs(npcs.filter(n => n.id !== id));
        if (selectedNpc?.id === id) setSelectedNpc(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dynamic sub tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
        {[
          { label: 'Aliados & Monstros (NPCs)', key: 'npcs' },
          { label: 'Evidências & Pistas', key: 'evidence' },
          { label: 'Campanhas do Investigador', key: 'campaigns' },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${subTab === t.key ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            onClick={() => setSubTab(t.key as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- NPCs Tab --- */}
      {subTab === 'npcs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
          {/* NPC List Sidebar */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.8rem', color: 'var(--text-gold)' }}>Lista de NPCs</h3>
              <button type="button" className="btn-occult" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }} onClick={handleCreateNpc}>
                + Criar NPC
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '400px', overflowY: 'auto' }}>
              {npcs.map(npc => (
                <div
                  key={npc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: selectedNpc?.id === npc.id ? 'rgba(140,12,16,0.15)' : 'rgba(0,0,0,0.2)',
                    borderColor: selectedNpc?.id === npc.id ? 'var(--border-crimson)' : 'transparent',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedNpc(npc)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{npc.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{npc.type === 'monster' ? '👻 Monstro' : '👤 Aliado'}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteNpc(npc.id); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-crimson)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {npcs.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Nenhum NPC criado.</span>}
            </div>
          </div>

          {/* NPC Card View & Editor */}
          {selectedNpc ? (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="gothic-input-group">
                  <label className="gothic-label">Nome do Personagem</label>
                  <input
                    type="text"
                    className="gothic-input"
                    value={selectedNpc.name || ''}
                    onChange={(e) => handleUpdateNpc('name', e.target.value)}
                  />
                </div>
                <div className="gothic-input-group">
                  <label className="gothic-label">Tipo</label>
                  <select
                    className="gothic-select"
                    style={{ padding: '0.65rem' }}
                    value={selectedNpc.type}
                    onChange={(e) => handleUpdateNpc('type', e.target.value)}
                  >
                    <option value="npc">👤 Aliado (Humano)</option>
                    <option value="monster">👻 Monstro / Entidade</option>
                  </select>
                </div>
              </div>

              {/* Statistics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                {[
                  { label: 'FOR', key: 'str' },
                  { label: 'DES', key: 'dex' },
                  { label: 'INT', key: 'int_val' },
                  { label: 'CON', key: 'con' },
                  { label: 'POD', key: 'pow' },
                  { label: 'TAM', key: 'siz' },
                ].map(attr => (
                  <div key={attr.key} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '0.4rem', textAlign: 'center' }}>
                    <span 
                      style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', cursor: 'pointer' }}
                      onClick={() => onRollClick(attr.label, selectedNpc[attr.key as keyof Npc] as number)}
                    >
                      {attr.label} 🎲
                    </span>
                    <input
                      type="number"
                      style={{ background: 'transparent', border: 'none', textAlign: 'center', fontWeight: 'bold', width: '100%', fontSize: '1rem', color: 'var(--text-gold)' }}
                      value={selectedNpc[attr.key as keyof Npc] as number || 0}
                      onChange={(e) => handleUpdateNpc(attr.key as keyof Npc, parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                ))}
              </div>

              {/* Vitals & Defense */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="gothic-input-group">
                  <label className="gothic-label">Vida Atual / Max</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" className="gothic-input" value={selectedNpc.hp_current} onChange={(e) => handleUpdateNpc('hp_current', parseInt(e.target.value, 10) || 0)} />
                    <input type="number" className="gothic-input" value={selectedNpc.hp_max} onChange={(e) => handleUpdateNpc('hp_max', parseInt(e.target.value, 10) || 0)} />
                  </div>
                </div>
                <div className="gothic-input-group">
                  <label className="gothic-label">Sanidade Atual / Max</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" className="gothic-input" value={selectedNpc.san_current} onChange={(e) => handleUpdateNpc('san_current', parseInt(e.target.value, 10) || 0)} />
                    <input type="number" className="gothic-input" value={selectedNpc.san_max} onChange={(e) => handleUpdateNpc('san_max', parseInt(e.target.value, 10) || 0)} />
                  </div>
                </div>
                <div className="gothic-input-group">
                  <label className="gothic-label">Armadura</label>
                  <input type="number" className="gothic-input" value={selectedNpc.armor} onChange={(e) => handleUpdateNpc('armor', parseInt(e.target.value, 10) || 0)} />
                </div>
              </div>

              {/* Notes and Specials */}
              <div className="gothic-input-group">
                <label className="gothic-label">Habilidades Especiais & Ataques</label>
                <textarea
                  className="gothic-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Garras (40%, Dano 1d6), Presença Sinistra..."
                  value={selectedNpc.special_abilities || ''}
                  onChange={(e) => handleUpdateNpc('special_abilities', e.target.value)}
                />
              </div>

              <div className="gothic-input-group">
                <label className="gothic-label">Descrição & Lore</label>
                <textarea
                  className="gothic-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="Histórico, aparência física, perigosidade..."
                  value={selectedNpc.description || ''}
                  onChange={(e) => handleUpdateNpc('description', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Selecione um NPC na barra lateral para abrir a necro-folha de detalhes.
            </div>
          )}
        </div>
      )}

      {/* --- Evidence Tab --- */}
      {subTab === 'evidence' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem' }}>
          {/* Create Evidence Form */}
          <form onSubmit={handleCreateEvidence} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-crimson)', borderBottom: '1px solid var(--border-crimson)', paddingBottom: '0.25rem' }}>
              Registrar Nova Pista/Evidência
            </h3>

            <div className="gothic-input-group">
              <label className="gothic-label">Título da Evidência</label>
              <input
                type="text"
                className="gothic-input"
                placeholder="Ex: Foto borrada da criatura..."
                value={newEvTitle}
                onChange={(e) => setNewEvTitle(e.target.value)}
              />
            </div>

            <div className="gothic-input-group">
              <label className="gothic-label">Tag da Campanha / Caso</label>
              <input
                type="text"
                className="gothic-input"
                placeholder="Ex: Boston 1920"
                value={newEvTag}
                onChange={(e) => setNewEvTag(e.target.value)}
              />
            </div>

            <div className="gothic-input-group">
              <label className="gothic-label">Descrição da Evidência</label>
              <textarea
                className="gothic-input"
                style={{ minHeight: '120px' }}
                placeholder="Insira os fatos revelados, localização ou quem entregou..."
                value={newEvDesc}
                onChange={(e) => setNewEvDesc(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-occult" style={{ width: '100%' }}>
              Registrar no Dossiê
            </button>
          </form>

          {/* Evidence Grid list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
            {evidence.map(ev => (
              <div key={ev.id} className="occult-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                  <h4 style={{ color: 'var(--text-gold)', fontSize: '0.9rem' }}>{ev.title}</h4>
                  {ev.session_tag && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      🏷️ {ev.session_tag}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {ev.description}
                </p>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Registrado em: {new Date(ev.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
            {evidence.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', border: '1px dashed var(--border-light)', borderRadius: '8px' }}>
                Nenhuma pista catalogada neste caso ainda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Campaigns Tab --- */}
      {subTab === 'campaigns' && (
        <div style={{ display: 'grid', gridTemplateColumns: activeSession ? '300px 1fr' : '1.2fr 1.8fr', gap: '1.5rem' }}>
          
          {/* Left Column: Forms and Campaigns List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!activeSession && (
              <>
                {/* Join Form */}
                <form onSubmit={handleJoinCampaign} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Participar de uma Campanha</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Seu mestre (GM) gerará um código de convite alfanumérico (ex: C98A2F). Insira-o abaixo para conectar seu investigador ativo!
                  </p>
                  <div className="gothic-input-group">
                    <input
                      type="text"
                      className="gothic-input"
                      placeholder="Ex: CUTH42"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-occult btn-cyan" style={{ width: '100%' }}>
                    Vincular Ficha ao Mestre
                  </button>
                </form>

                {/* Create Campaign (as GM) */}
                <form onSubmit={handleCreateCampaign} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-crimson)' }}>Iniciar Campanha como Mestre (GM)</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Deseja mestrar? Crie uma campanha para obter seu Código de Convite de 6 caracteres e gerenciar fichas ao vivo.
                  </p>
                  <div className="gothic-input-group">
                    <input
                      type="text"
                      className="gothic-input"
                      placeholder="Nome do Caso..."
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-occult" style={{ width: '100%' }}>
                    Iniciar Ritual de Campanha
                  </button>
                </form>
              </>
            )}

            {/* Campaign Selection List */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-gold)' }}>Campanhas Vinculadas</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '400px', overflowY: 'auto' }}>
                {/* GM Sessions */}
                {gmSessions.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-crimson)', marginBottom: '0.4rem' }}>Como Mestre (GM)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {gmSessions.map(sess => (
                        <div
                          key={sess.id}
                          className={`occult-card ${activeSession?.id === sess.id ? 'active' : ''}`}
                          style={{
                            padding: '0.6rem 0.8rem',
                            cursor: 'pointer',
                            borderColor: activeSession?.id === sess.id ? 'var(--accent-gold)' : 'var(--border-crimson)',
                            boxShadow: activeSession?.id === sess.id ? 'var(--glow-gold)' : 'none'
                          }}
                          onClick={() => setActiveSession(sess)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{sess.name}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{sess.code}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Player Sessions */}
                {playerSessions.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '0.4rem' }}>Como Jogador</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {playerSessions.map(sess => (
                        <div
                          key={sess.id}
                          className={`occult-card ${activeSession?.id === sess.id ? 'active' : ''}`}
                          style={{
                            padding: '0.6rem 0.8rem',
                            cursor: 'pointer',
                            borderColor: activeSession?.id === sess.id ? 'var(--accent-gold)' : 'var(--border-light)',
                            boxShadow: activeSession?.id === sess.id ? 'var(--glow-gold)' : 'none'
                          }}
                          onClick={() => setActiveSession(sess)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{sess.name}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{sess.code}</span>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Mestre: {sess.gm_username || 'Desconhecido'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gmSessions.length === 0 && playerSessions.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                    Nenhuma campanha encontrada.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Session View / Chat Room + Companions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '450px' }}>
            {activeSession ? (
              <>
                {/* Header info */}
                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem 1rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--text-gold)', fontSize: '1.1rem' }}>{activeSession.name}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Código: <strong style={{ color: 'var(--text-crimson)' }}>{activeSession.code}</strong> 
                      {activeSession.gm_username && ` | Mestre: ${activeSession.gm_username}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {detailedSession?.roll20_url ? (
                      <a href={detailedSession.roll20_url} target="_blank" rel="noopener noreferrer" className="roll20-portal">
                        Portal Roll20
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem portal Roll20</span>
                    )}
                    <button className="btn-occult-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => setActiveSession(null)}>
                      Sair da Sessão
                    </button>
                  </div>
                </div>

                {/* Chat + Companions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem', flex: 1 }}>
                  {/* Chat Panel */}
                  <div className="chat-panel" style={{ margin: 0, height: '400px' }}>
                    <div className="chat-header">
                      <span className="chat-header-title">Chat ao Vivo</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>Sinc. 3s</span>
                    </div>

                    <div id="chat-msg-container" className="chat-messages">
                      {chatMessages.map((msg) => {
                        const isMine = currentUser && msg.sender_id === currentUser.id;
                        const isWhisper = msg.message_type === 'whisper';
                        const isRoll = msg.message_type === 'roll';
                        
                        let msgClass = 'chat-msg';
                        if (isMine) msgClass += ' mine';
                        if (isWhisper) msgClass += ' whisper';
                        if (isRoll) msgClass += ' roll';

                        return (
                          <div key={msg.id} className={msgClass}>
                            <div className="chat-msg-meta">
                              <span className="chat-msg-sender">
                                {isWhisper ? (
                                  <>
                                    sussurro {isMine ? `para ${msg.recipient_username}` : `de ${msg.sender_username}`}
                                  </>
                                ) : (
                                  msg.sender_username
                                )}
                              </span>
                              <span className="chat-msg-time">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            {isRoll ? (
                              renderRollDetails(msg.roll_details)
                            ) : (
                              <span className="chat-msg-content">{msg.content}</span>
                            )}
                          </div>
                        );
                      })}
                      {chatMessages.length === 0 && (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Nenhuma mensagem enviada nesta sessão.
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendMessage} className="chat-input-area">
                      <div className="chat-input-row">
                        <input
                          type="text"
                          className="chat-input-field"
                          placeholder="Digite sua mensagem..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                        />
                        <button type="submit" className="btn-occult" style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
                          Enviar
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Companions Panel (Amigos / Party Members) */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', height: '400px', overflowY: 'auto' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--text-gold)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem', margin: 0 }}>
                      Companheiros
                    </h4>
                    {(() => {
                      const companions = (detailedSession?.characters || []).filter(
                        (c: any) => c.id !== characterId && c.player !== 'NPC'
                      );
                      if (companions.length === 0) {
                        return (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                            Nenhum companheiro na sessão.
                          </span>
                        );
                      }
                      return companions.map((comp: any) => {
                        const hpPercent = comp.hp_max > 0 ? Math.min(100, (comp.hp_current / comp.hp_max) * 100) : 0;
                        const hpColor = hpPercent > 60 ? '#4caf50' : hpPercent > 30 ? '#ff9800' : '#f44336';
                        return (
                          <div
                            key={comp.id}
                            style={{
                              display: 'flex',
                              gap: '0.6rem',
                              alignItems: 'center',
                              background: 'rgba(0,0,0,0.25)',
                              border: '1px solid var(--border-light)',
                              borderRadius: '6px',
                              padding: '0.5rem',
                            }}
                          >
                            {/* Companion Avatar */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-gold)',
                              background: comp.image ? `url(${comp.image}) center/cover no-repeat` : 'rgba(0,0,0,0.5)',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {!comp.image && <span style={{ fontSize: '0.9rem', opacity: 0.3 }}>👤</span>}
                            </div>
                            {/* Companion Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {comp.name}
                                </span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.3rem' }}>
                                  {comp.age} anos
                                </span>
                              </div>
                              {/* HP Bar */}
                              <div style={{ marginTop: '0.3rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                                  <span>PV</span>
                                  <span style={{ color: hpColor, fontWeight: 'bold' }}>{comp.hp_current}/{comp.hp_max}</span>
                                </div>
                                <div style={{
                                  height: '4px',
                                  background: 'rgba(255,255,255,0.08)',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${hpPercent}%`,
                                    height: '100%',
                                    background: hpColor,
                                    borderRadius: '2px',
                                    transition: 'width 0.5s ease, background 0.5s ease',
                                    boxShadow: `0 0 6px ${hpColor}`,
                                  }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '1rem', textAlign: 'center', padding: '2rem', minHeight: '450px' }}>
                <span style={{ fontSize: '3rem' }}>🔮</span>
                <p style={{ fontSize: '0.85rem', maxWidth: '320px', lineHeight: '1.5' }}>
                  Selecione uma das campanhas vinculadas para abrir o chat e ver seus companheiros.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
