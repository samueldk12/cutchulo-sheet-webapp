'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/AuthProvider';
import InvestigatorGeneral from '../../components/InvestigatorGeneral';
import InvestigatorSkills from '../../components/InvestigatorSkills';
import InvestigatorCombat from '../../components/InvestigatorCombat';
import InvestigatorBackstory from '../../components/InvestigatorBackstory';
import DiceRollerModal from '../../components/DiceRollerModal';
import Link from 'next/link';

export default function GmPanel() {
  const { user, loading: authLoading } = useAuth();

  // Sessions and Active campaign state
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any | null>(null);
  
  // Controls
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [newLogContent, setNewLogContent] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Modal State
  const [editingChar, setEditingChar] = useState<any | null>(null);
  const [gmActiveTab, setGmActiveTab] = useState<string>('general');
  const [isEditOpen, setIsEditOpen] = useState(false);

  // GM Dice Roller Modal State
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [rollTargetName, setRollTargetName] = useState('');
  const [rollTargetValue, setRollTargetValue] = useState(0);
  const [rollDiceType, setRollDiceType] = useState<any>('d100');

  // Terminal Auto Scroll
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Live Chat Room State
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [whisperTarget, setWhisperTarget] = useState<string>('all');
  const [roll20Input, setRoll20Input] = useState('');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load list of sessions
  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.gm || []);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  // Load detailed campaign session
  const fetchSessionDetails = async (id: number, silent = false) => {
    if (!silent) setLoadingDetails(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data);
        
        // Auto update the character being edited if open
        if (editingChar) {
          const matching = data.characters?.find((c: any) => c.id === editingChar.id);
          if (matching) {
            setEditingChar(matching);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    } else {
      setSessionDetails(null);
    }
  }, [selectedSessionId]);

  // Live polling (every 4 seconds) for active campaign and rolls
  useEffect(() => {
    if (!selectedSessionId) return;

    const interval = setInterval(() => {
      // Pause polling if the GM is typing in any fields to prevent resetting cursor
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (isTyping) return;

      fetchSessionDetails(selectedSessionId, true);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedSessionId, editingChar]);

  // Auto-scroll the green terminal when logs load
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [sessionDetails?.logs]);

  // Synchronize Roll20 URL state with incoming campaign updates
  useEffect(() => {
    if (sessionDetails) {
      setRoll20Input(prev => prev || sessionDetails.roll20_url || '');
    }
  }, [sessionDetails]);

  // Load chat messages
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

  // Poll Chat Messages every 3 seconds
  useEffect(() => {
    if (!selectedSessionId) {
      setChatMessages([]);
      return;
    }

    loadChatMessages(selectedSessionId);

    const chatInterval = setInterval(() => {
      loadChatMessages(selectedSessionId);
    }, 3000);

    return () => clearInterval(chatInterval);
  }, [selectedSessionId]);

  // Auto-scroll the live campaign chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Update Roll20 URL
  const handleUpdateRoll20Url = async () => {
    if (!selectedSessionId || !sessionDetails) return;
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionDetails.name,
          notes: sessionDetails.notes,
          roll20_url: roll20Input,
          is_active: sessionDetails.is_active
        })
      });
      if (res.ok) {
        alert('Ritual de Portal Roll20 Sintonizado!');
        fetchSessionDetails(selectedSessionId, true);
      } else {
        alert('Falha ao sintonizar Portal Roll20.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const parseAndExecuteGmRollCommand = async (text: string): Promise<{ handled: boolean; error?: string }> => {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    
    if (!['/roll', '/r', '/rolar', '/dado'].includes(command)) {
      return { handled: false };
    }

    const queryStr = parts.slice(1).join(' ').trim();
    if (!queryStr) {
      return { handled: true, error: 'Digite a expressão de dados. Ex: /r 3d6+4 ou /r 1d100' };
    }

    const isDiceExpression = /^\d*d\d+([+-]\d+)?$/i.test(queryStr);
    if (!isDiceExpression) {
      return { handled: true, error: 'Como Mestre, você deve especificar uma expressão de dados numérica. Ex: /r 3d6+4 ou /r 1d100' };
    }

    const expr = queryStr.toLowerCase();
    const match = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) return { handled: true, error: 'Expressão de dados inválida' };

    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modifier = parseInt(match[3] || '0', 10);

    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    const resultExpression = `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`;
    const resultTotal = total;
    const resultRolls = rolls;
    const isCriticalSuccess = sides === 100 && total === 1;
    const isCriticalFail = sides === 100 && (total === 100 || total >= 96);
    const characterName = 'Mestre (GM)';
    const contentText = `${characterName} rolou ${resultExpression}: ${resultTotal}`;

    try {
      await fetch(`/api/sessions/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentText,
          message_type: 'roll',
          roll_details: {
            expression: resultExpression,
            total: resultTotal,
            rolls: resultRolls,
            bonusPenaltyRolls: [],
            isCriticalSuccess,
            isCriticalFail,
            characterName
          }
        })
      });

      // Post GM roll directly to campaign log as well
      await fetch(`/api/sessions/${selectedSessionId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `[Mestre Rolou ${resultExpression}] Resultado: ${resultTotal} | [${resultRolls.join(', ')}]` }),
      });

      return { handled: true };
    } catch (err) {
      console.error(err);
      return { handled: true, error: 'Falha ao transmitir rolagem do mestre' };
    }
  };

  // Send Live Chat Message / Whisper
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = chatInput.trim();
    if (!input || !selectedSessionId) return;

    // Check if it's a dice roll command starting with /
    if (input.startsWith('/')) {
      const rollRes = await parseAndExecuteGmRollCommand(input);
      if (rollRes.handled) {
        if (rollRes.error) {
          alert(rollRes.error);
        } else {
          setChatInput('');
        }
        return;
      }
    }

    const isWhisper = whisperTarget !== 'all';
    const payload = {
      content: input,
      message_type: isWhisper ? 'whisper' : 'chat',
      recipient_id: isWhisper ? parseInt(whisperTarget, 10) : null
    };

    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput('');
      }
    } catch (err) {
      console.error('Error sending GM chat message:', err);
    }
  };

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

  if (authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-darkest)' }}>
        <div className="pulse-text" style={{ fontFamily: 'var(--font-gothic)', fontSize: '1.5rem', color: 'var(--accent-gold)' }}>
          DECIFRANDO RITUAIS DO GM...
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Actions
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName, notes: newSessionNotes }),
      });
      if (res.ok) {
        const newS = await res.json();
        setNewSessionName('');
        setNewSessionNotes('');
        await loadSessions();
        setSelectedSessionId(newS.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm('Deseja mesmo banir esta campanha do plano terrestre? Todos os diários de logs serão destruídos.')) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedSessionId(null);
        await loadSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogContent.trim() || !selectedSessionId) return;

    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `[Mestre] ${newLogContent}` }),
      });
      if (res.ok) {
        setNewLogContent('');
        fetchSessionDetails(selectedSessionId, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Vitals direct adjustments by GM
  const handleAdjustVitalDirect = async (charId: number, field: string, delta: number, maxField: string) => {
    const char = sessionDetails?.characters?.find((c: any) => c.id === charId);
    if (!char) return;

    const current = char[field] || 0;
    const max = char[maxField] || 99;
    const nextVal = Math.max(0, Math.min(max, current + delta));

    // Optimistic local UI state update
    const updatedCharacters = sessionDetails.characters.map((c: any) =>
      c.id === charId ? { ...c, [field]: nextVal } : c
    );
    setSessionDetails({ ...sessionDetails, characters: updatedCharacters });

    try {
      await fetch(`/api/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextVal }),
      });
    } catch (err) {
      console.error('GM direct vital adjustment error:', err);
    }
  };

  // Mestre Mode character sheets manipulations
  const handleOpenEditSheet = (char: any) => {
    setEditingChar(char);
    setGmActiveTab('general');
    setIsEditOpen(true);
  };

  const handleGmFieldChange = async (field: string, value: any) => {
    if (!editingChar) return;

    const updated = { ...editingChar, [field]: value };
    setEditingChar(updated);

    try {
      await fetch(`/api/characters/${editingChar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      // Silent refresh session stats
      fetchSessionDetails(selectedSessionId!, true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmSkillChange = async (skillId: number, field: string, value: number) => {
    if (!editingChar) return;

    const updatedSkills = editingChar.skills.map((s: any) => {
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

    setEditingChar({ ...editingChar, skills: updatedSkills });

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmAddWeapon = async (weaponData: any) => {
    if (!editingChar) return;
    try {
      const res = await fetch(`/api/characters/${editingChar.id}/weapons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const newW = await res.json();
        await fetch(`/api/weapons/${newW.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(weaponData),
        });
        
        // Refresh editing character
        const charRes = await fetch(`/api/characters/${editingChar.id}`);
        const data = await charRes.json();
        setEditingChar(data);
        fetchSessionDetails(selectedSessionId!, true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmUpdateWeapon = async (weaponId: number, field: string, value: any) => {
    if (!editingChar) return;

    const updatedWeapons = editingChar.weapons.map((w: any) => 
      w.id === weaponId ? { ...w, [field]: value } : w
    );
    setEditingChar({ ...editingChar, weapons: updatedWeapons });

    try {
      const w = updatedWeapons.find((x: any) => x.id === weaponId);
      await fetch(`/api/weapons/${weaponId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmDeleteWeapon = async (weaponId: number) => {
    if (!editingChar) return;
    try {
      const res = await fetch(`/api/weapons/${weaponId}`, { method: 'DELETE' });
      if (res.ok) {
        const updatedWeapons = editingChar.weapons.filter((w: any) => w.id !== weaponId);
        setEditingChar({ ...editingChar, weapons: updatedWeapons });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmAddPossession = async (item: string) => {
    if (!editingChar) return;
    try {
      const res = await fetch(`/api/characters/${editingChar.id}/possessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      if (res.ok) {
        const charRes = await fetch(`/api/characters/${editingChar.id}`);
        const data = await charRes.json();
        setEditingChar(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmUpdatePossession = async (possessionId: number, item: string) => {
    if (!editingChar) return;

    const updatedPoss = editingChar.possessions.map((p: any) => 
      p.id === possessionId ? { ...p, item } : p
    );
    setEditingChar({ ...editingChar, possessions: updatedPoss });

    try {
      await fetch(`/api/possessions/${possessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGmDeletePossession = async (possessionId: number) => {
    if (!editingChar) return;
    try {
      const res = await fetch(`/api/possessions/${possessionId}`, { method: 'DELETE' });
      if (res.ok) {
        const updatedPoss = editingChar.possessions.filter((p: any) => p.id !== possessionId);
        setEditingChar({ ...editingChar, possessions: updatedPoss });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dice Triggering
  const triggerDiceRoll = (name: string, value: number, defaultType: any = 'd100') => {
    setRollTargetName(name);
    setRollTargetValue(value);
    setRollDiceType(defaultType);
    setIsDiceOpen(true);
  };

  const triggerDamageRoll = (expr: string, name: string) => {
    setRollTargetName(`Dano de ${name}`);
    setRollTargetValue(0);
    setRollDiceType('custom');
    setIsDiceOpen(true);
  };

  // Callback to append GM rolls directly to campaign log
  const handleRollComplete = async (roll: any) => {
    if (!selectedSessionId) return;
    try {
      await fetch(`/api/sessions/${selectedSessionId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `[Mestre Rolou ${roll.expression}] Resultado: ${roll.result} | ${roll.details}` }),
      });
      fetchSessionDetails(selectedSessionId, true);
    } catch (err) {
      console.warn('GM log roll error:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-deep)' }}>
      
      {/* Sidebar: GM Campaigns Lists */}
      <aside className="monolith-sidebar" style={{ borderRight: '1px solid var(--border-crimson)' }}>
        <div className="sidebar-header">
          <span className="sidebar-logo">PAINEL DO MESTRE</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Mestrando Campanhas Cutchulo</span>
        </div>

        <div className="sidebar-nav">
          {selectedSessionId && sessionDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '0 0.5rem 1.5rem 0.5rem' }}>
              {/* Button to Exit Campaign */}
              <button
                type="button"
                className="btn-occult"
                style={{
                  background: 'var(--bg-crimson)',
                  color: '#fff',
                  border: '1px solid var(--border-crimson)',
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  boxShadow: 'none'
                }}
                onClick={() => setSelectedSessionId(null)}
              >
                🚪 Sair da Campanha
              </button>

              {/* Glowing Join Code Box */}
              <div style={{
                background: 'rgba(0, 243, 255, 0.05)',
                border: '2px dashed var(--accent-cyan)',
                borderRadius: '8px',
                padding: '0.8rem',
                textAlign: 'center',
                boxShadow: 'inset 0 0 10px rgba(0, 243, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                marginTop: '0.5rem'
              }}>
                <span className="gothic-label" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>CÓDIGO DE ENTRADA</span>
                <span style={{
                  fontSize: '1.8rem',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                  color: 'var(--accent-cyan)',
                  textShadow: 'var(--glow-cyan)',
                  lineHeight: '1.1'
                }}>
                  {sessionDetails.code}
                </span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Código para jogadores entrarem</span>
              </div>

              {/* Roll20 Setup Portal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                <span className="sidebar-item-header" style={{ margin: 0, fontSize: '0.7rem' }}>Sintonizar Roll20</span>
                <input
                  type="text"
                  className="gothic-input"
                  placeholder="URL do Portal Roll20..."
                  value={roll20Input}
                  onChange={(e) => setRoll20Input(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                />
                <button
                  type="button"
                  className="btn-occult"
                  onClick={handleUpdateRoll20Url}
                  style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
                >
                  🌌 Sintonizar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0 0.5rem 1.5rem 0.5rem' }}>
              <span className="sidebar-item-header" style={{ margin: 0 }}>Nova Campanha</span>
              <input
                type="text"
                className="gothic-input"
                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                placeholder="Nome da Campanha..."
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
              />
              <input
                type="text"
                className="gothic-input"
                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                placeholder="Notas/Descrição..."
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
              />
              <button type="submit" className="btn-occult" style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}>
                + Evocar Campanha
              </button>
            </form>
          )}

          <div className="sidebar-item-header">Suas Campanhas Ativas</div>
          <div className="gm-session-list">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`gm-session-card glass-panel ${selectedSessionId === s.id ? 'active' : ''}`}
                style={{ padding: '0.75rem', border: '1px solid var(--border-light)' }}
                onClick={() => setSelectedSessionId(s.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{s.name}</span>
                  <span className="gothic-label" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    {s.code}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Jogadores: {s.player_count}</span>
                  <button
                    type="button"
                    className="vital-btn"
                    style={{ color: 'var(--text-crimson)', padding: 0, fontSize: '0.75rem' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                  >
                    sacrificar
                  </button>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                Nenhuma campanha ativa sob seu selo.
              </span>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">👤 GM {user.username}</span>
            <Link href="/" style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', textDecoration: 'underline', marginTop: '0.2rem' }}>
              Voltar ao Dashboard Jogador
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Campaign workspace */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {loadingDetails ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <span className="pulse-text" style={{ fontFamily: 'var(--font-gothic)', fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
              ABRINDO PORTAL DA CAMPANHA...
            </span>
          </div>
        ) : sessionDetails ? (
          <>
            {/* Header section with session name, description, and dynamic Roll20 launcher */}
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <h1 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.8rem', margin: 0 }}>
                  {sessionDetails.name}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  {sessionDetails.notes || 'Nenhuma descrição adicionada.'}
                </p>
              </div>

              {sessionDetails.roll20_url && (
                <a
                  href={sessionDetails.roll20_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-occult"
                  style={{
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, var(--accent-gold) 0%, #b8860b 100%)',
                    color: '#000',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(229, 169, 59, 0.3)',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ⚔️ Abrir Mesa Roll20 ↗
                </a>
              )}
            </div>

            {/* Live Campaign Grid (3 Columns: Players List, Live Room Chat & Mono Terminal Log) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '1.5rem', alignItems: 'start' }} className="gm-campaign-grid-three-col">
              
              {/* Left: joined player investigator cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-crimson)', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Investigadores
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                    Qtd: {sessionDetails.characters?.length || 0}
                  </span>
                </h2>

                <div className="gm-player-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sessionDetails.characters?.map((c: any) => (
                    <div key={c.id} className="gm-player-card" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      
                      {/* Investigator Info & Header */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-gold)',
                          background: c.image ? `url(${c.image}) center/cover no-repeat` : 'rgba(0,0,0,0.5)',
                          display: 'block'
                        }} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-gold)' }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Jogador: <strong style={{ color: '#fff' }}>{c.owner_username}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Vitals adjusting console */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        
                        {/* HP */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PV: <strong>{c.hp_current}/{c.hp_max}</strong></span>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'hp_current', -1, 'hp_max')}>-1</button>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'hp_current', 1, 'hp_max')}>+1</button>
                          </div>
                        </div>

                        {/* MP */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PM: <strong>{c.mp_current}/{c.mp_max}</strong></span>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'mp_current', -1, 'mp_max')}>-1</button>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'mp_current', 1, 'mp_max')}>+1</button>
                          </div>
                        </div>

                        {/* SANITY */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SAN: <strong>{c.san_current}/{c.san_max}</strong></span>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'san_current', -1, 'san_max')}>-1</button>
                            <button type="button" className="vital-btn" style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }} onClick={() => handleAdjustVitalDirect(c.id, 'san_current', 1, 'san_max')}>+1</button>
                          </div>
                        </div>

                      </div>

                      {/* Sheet Edit & Roll quick buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                        <button type="button" className="btn-occult" style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem', justifyContent: 'center' }} onClick={() => handleOpenEditSheet(c)}>
                          📝 Editar Ficha
                        </button>
                        <button type="button" className="btn-occult-secondary" style={{ padding: '0.35rem', fontSize: '0.75rem' }} onClick={() => triggerDiceRoll(`Percepção de ${c.name}`, c.skills?.find((s: any) => s.name.includes('Spot Hidden'))?.value || 25)} title="Rolar Percepção Ocular">
                          👁️
                        </button>
                      </div>

                    </div>
                  ))}

                  {(!sessionDetails.characters || sessionDetails.characters.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border-light)', borderRadius: '8px', fontSize: '0.8rem' }}>
                      Nenhum investigador conectado.
                    </div>
                  )}
                </div>
              </div>

              {/* Middle: Live Room Chat Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>
                  Chat da Sessão
                </h2>
                
                <div className="chat-panel" style={{ margin: 0, height: '380px', background: 'rgba(10, 10, 15, 0.95)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
                  <div className="chat-header" style={{ borderBottomColor: 'rgba(255,255,255,0.05)', padding: '0.5rem' }}>
                    <span className="chat-header-title" style={{ fontSize: '0.8rem' }}>⛧ Sala de Transmissão</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)' }}>Live 3s</span>
                  </div>

                  <div ref={chatContainerRef} className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chatMessages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
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
                                  💬 sussurro {isMine ? `para ${msg.recipient_username}` : `de ${msg.sender_username}`}
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
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Sem rituais falados nesta sala.
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="chat-input-area" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <select
                          className="gothic-select"
                          value={whisperTarget}
                          onChange={(e) => setWhisperTarget(e.target.value)}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', width: '110px', flexShrink: 0, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-crimson)', borderRadius: '4px' }}
                        >
                          <option value="all">📢 Geral</option>
                          {sessionDetails.characters?.map((c: any) => (
                            <option key={c.id} value={c.user_id}>
                              💬 Sussurro: {c.owner_username}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="chat-input-field"
                          placeholder="Comunicar com a sessão..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-crimson)', color: '#fff', borderRadius: '4px' }}
                        />
                      </div>
                      <button type="submit" className="btn-occult" style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', justifyContent: 'center' }}>
                        Transmitir Ritual ⛧
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: Monospace Gothic log terminal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-gold)', fontSize: '1.2rem' }}>Grimório (Logs)</h2>
                
                {/* Quick Dice Roll Buttons Bar */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1.5px solid var(--border-light)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 'bold', fontFamily: 'var(--font-gothic)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    🎲 Rolar Dado Rápido:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                    {[
                      { type: 'd100', label: 'D100' },
                      { type: 'd20', label: 'D20' },
                      { type: 'd12', label: 'D12' },
                      { type: 'd10', label: 'D10' },
                      { type: 'd8', label: 'D8' },
                      { type: 'd6', label: 'D6' },
                      { type: 'd4', label: 'D4' },
                      { type: 'custom', label: 'Custom' }
                    ].map(die => (
                      <button
                        key={die.type}
                        type="button"
                        className="vital-btn"
                        style={{
                          padding: '0.4rem 0.25rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-light)',
                          color: '#fff',
                          fontWeight: 'bold',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onClick={() => triggerDiceRoll(`Rápido ${die.label}`, 0, die.type)}
                      >
                        {die.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gm-log-box" ref={logTerminalRef} style={{
                  height: '320px',
                  background: 'rgba(5, 5, 8, 0.95)',
                  border: '1.5px solid var(--border-gold)',
                  boxShadow: '0 0 15px rgba(229,169,59,0.05)',
                  color: '#4af626',
                  fontFamily: 'monospace',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  overflowY: 'auto'
                }}>
                  {sessionDetails.logs?.map((l: any) => (
                    <div key={l.id} style={{ marginBottom: '0.4rem', wordBreak: 'break-word', borderBottom: '1px solid rgba(74, 246, 38, 0.05)', paddingBottom: '0.2rem' }}>
                      <span style={{ color: '#00d0ff', marginRight: '0.4rem' }}>[{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                      <span>{l.content}</span>
                    </div>
                  ))}
                  {(!sessionDetails.logs || sessionDetails.logs.length === 0) && (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '3rem' }}>* Grimório aguardando rituais *</div>
                  )}
                </div>

                {/* Quick log entry console */}
                <form onSubmit={handlePostLog} style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    className="gothic-input"
                    placeholder="Escriba de evento..."
                    value={newLogContent}
                    onChange={(e) => setNewLogContent(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  />
                  <button type="submit" className="btn-occult" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Escriba</button>
                </form>
              </div>

            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '1.5rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '6rem', textShadow: 'var(--glow-cyan)' }}>🔮</span>
            <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.8rem', textAlign: 'center' }}>
              Trono do Mestre da Campanha
            </h2>
            <p style={{ maxWidth: '480px', textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              Selecione uma campanha existente na barra sinistra ou invoque uma nova preenchendo o formulário. O código de entrada permitirá que seus jogadores participem da sessão.
            </p>
          </div>
        )}
      </main>

      {/* MESTRE MODE FULL-SHEET EDIT MODAL */}
      {isEditOpen && editingChar && (
        <div className="occult-modal-overlay">
          <div className="occult-modal" style={{ maxWidth: '1000px', width: '95%' }}>
            
            {/* Modal Header */}
            <div className="occult-modal-header" style={{ borderBottomColor: 'var(--border-gold)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>Modo Mestre - Editando Ficha Alheia</span>
                <h3 style={{ margin: 0, color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✏️ {editingChar.name}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsEditOpen(false)}>×</button>
            </div>

            {/* Modal Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '1rem 1.5rem 0.5rem 1.5rem', borderBottom: '1px dashed var(--border-light)' }}>
              {[
                { label: 'Geral', key: 'general' },
                { label: 'Perícias', key: 'skills' },
                { label: 'Combate & Pertences', key: 'combat' },
                { label: 'Histórico & Dossiê', key: 'backstory' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-btn ${gmActiveTab === tab.key ? 'active' : ''}`}
                  onClick={() => setGmActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div className="occult-modal-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {gmActiveTab === 'general' && (
                <InvestigatorGeneral
                  character={editingChar}
                  onChange={handleGmFieldChange}
                  onRollClick={triggerDiceRoll}
                />
              )}
              {gmActiveTab === 'skills' && (
                <InvestigatorSkills
                  skills={editingChar.skills}
                  onSkillChange={handleGmSkillChange}
                  onRollClick={triggerDiceRoll}
                />
              )}
              {gmActiveTab === 'combat' && (
                <InvestigatorCombat
                  characterId={editingChar.id}
                  weapons={editingChar.weapons}
                  possessions={editingChar.possessions}
                  skills={editingChar.skills}
                  onAddWeapon={handleGmAddWeapon}
                  onUpdateWeapon={handleGmUpdateWeapon}
                  onDeleteWeapon={handleGmDeleteWeapon}
                  onAddPossession={handleGmAddPossession}
                  onUpdatePossession={handleGmUpdatePossession}
                  onDeletePossession={handleGmDeletePossession}
                  onRollClick={triggerDiceRoll}
                  onDamageRoll={triggerDamageRoll}
                />
              )}
              {gmActiveTab === 'backstory' && (
                <InvestigatorBackstory
                  character={editingChar}
                  onChange={handleGmFieldChange}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="occult-modal-footer">
              <button className="btn-occult" onClick={() => setIsEditOpen(false)}>Concluir Edições</button>
            </div>

          </div>
        </div>
      )}

      {/* GM dice roller modal */}
      <DiceRollerModal
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        targetName={rollTargetName}
        targetValue={rollTargetValue}
        defaultDiceType={rollDiceType}
        onRollComplete={handleRollComplete}
      />
    </div>
  );
}
