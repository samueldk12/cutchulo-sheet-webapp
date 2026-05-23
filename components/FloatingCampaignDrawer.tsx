'use client';

import React, { useState, useEffect, useRef } from 'react';
import PDFViewerModule from './PDFViewerModule';

interface Spell {
  id: number;
  character_id: number;
  name: string;
  cost: string;
  casting_time: string;
  range: string;
  duration: string;
  description: string;
}

interface FloatingCampaignDrawerProps {
  character: any;
  currentUser: any;
  onRollClick: (name: string, value: number) => void;
}

export default function FloatingCampaignDrawer({
  character,
  currentUser,
  onRollClick
}: FloatingCampaignDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'spells' | 'library'>('chat');
  
  // Chat States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageIdRef = useRef<number | null>(null);
  const [whisperRecipientId, setWhisperRecipientId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  // Spells States
  const [spells, setSpells] = useState<Spell[]>([]);
  const [isAddingSpell, setIsAddingSpell] = useState(false);
  const [editingSpellId, setEditingSpellId] = useState<number | null>(null);
  
  // Spell Form fields
  const [spellName, setSpellName] = useState('');
  const [spellCost, setSpellCost] = useState('');
  const [spellCastingTime, setSpellCastingTime] = useState('');
  const [spellRange, setSpellRange] = useState('');
  const [spellDuration, setSpellDuration] = useState('');
  const [spellDescription, setSpellDescription] = useState('');

  // Active Toast State
  const [toasts, setToasts] = useState<any[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const sessionId = character?.session?.id;

  // Load Spells
  const loadSpells = async () => {
    if (!character?.id || character.id === -999) return;
    try {
      const res = await fetch(`/api/spells?character_id=${character.id}`);
      if (res.ok) {
        const data = await res.json();
        setSpells(data);
      }
    } catch (err) {
      console.error('Error loading spells:', err);
    }
  };

  useEffect(() => {
    if (character?.id && character.id !== -999) {
      loadSpells();
    }
  }, [character?.id]);

  // Load and Poll Chat Messages & Notifications
  useEffect(() => {
    if (!sessionId) {
      setChatMessages([]);
      return;
    }

    const fetchChat = async (isInitial = false) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(data);

          if (data.length > 0) {
            const latestMsg = data[data.length - 1];
            
            // Check for new messages since last fetch
            if (lastMessageIdRef.current !== null && latestMsg.id > lastMessageIdRef.current) {
              // Find all new messages
              const newMsgs = data.filter((m: any) => m.id > (lastMessageIdRef.current || 0));
              
              newMsgs.forEach((msg: any) => {
                // Ignore our own messages for notification toasts
                if (currentUser && msg.sender_id !== currentUser.id) {
                  // Increment unread count if drawer is closed
                  if (!isOpen) {
                    setUnreadCount(prev => prev + 1);
                  }

                  // Add notification toast
                  let toastTitle = `Mensagem de ${msg.sender_username}`;
                  let toastContent = msg.content;
                  let toastUrl = '';

                  if (msg.message_type === 'roll' && msg.roll_details) {
                    const d = msg.roll_details;
                    toastTitle = `🎲 Rolagem de ${d.characterName || msg.sender_username}`;
                    toastContent = `Rolou ${d.expression}: resultado ${d.total}`;
                  } else if (msg.content.includes('[Grimório]')) {
                    toastTitle = `🔮 Magia Conjurada!`;
                  } else if (msg.content.includes('[Roll20]')) {
                    toastTitle = `🌌 Convite para o Roll20!`;
                    toastContent = `O Mestre convoca todos para a mesa de combate!`;
                    const match = msg.content.match(/\((https?:\/\/[^\)]+)\)/);
                    if (match) {
                      toastUrl = match[1];
                    } else if (character?.session?.roll20_url) {
                      toastUrl = character.session.roll20_url;
                    }
                  }

                  const newToast = {
                    id: Date.now() + Math.random(),
                    title: toastTitle,
                    content: toastContent,
                    type: msg.message_type,
                    url: toastUrl
                  };

                  setToasts(prev => [...prev, newToast]);
                }
              });
            }
            
            // Update last message id ref
            lastMessageIdRef.current = latestMsg.id;
          }
        }
      } catch (err) {
        console.error('Error fetching campaign chat:', err);
      }
    };

    fetchChat(true);

    const interval = setInterval(() => {
      fetchChat(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, isOpen, currentUser]);

  // Scroll to bottom of chat when drawer opens or new message arrives
  useEffect(() => {
    if (isOpen && activeTab === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [isOpen, activeTab, chatMessages]);

  // Clear unread when drawer is opened to chat
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setUnreadCount(0);
    }
  }, [isOpen, activeTab]);

  // Load session participants (characters with their owners) for whispering
  const loadParticipants = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        // We only want actual player characters with active owner_id, excluding GM mock character
        const pcs = (data.characters || []).filter((c: any) => c.player !== 'NPC' && c.owner_id);
        setParticipants(pcs);
      }
    } catch (err) {
      console.error('Error loading session participants:', err);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId && character?.id === -999) {
      loadParticipants();
    }
  }, [isOpen, sessionId, character?.id]);

  if (!sessionId) return null;

  const parseAndExecuteChatRollCommand = async (text: string): Promise<{ handled: boolean; error?: string }> => {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    
    if (!['/roll', '/r', '/rolar', '/dado'].includes(command)) {
      return { handled: false };
    }

    const queryStr = parts.slice(1).join(' ').trim();
    if (!queryStr) {
      return { 
        handled: true, 
        error: character?.id === -999 
          ? 'Digite a expressão de dados. Ex: /r 3d6+4 ou /r d100' 
          : 'Digite a expressão de dados, atributo ou perícia. Ex: /r 3d6+4 ou /r força' 
      };
    }

    // 1. Check if the query is a direct dice expression (e.g. "3d6+4", "d100", "d20", "1d100")
    const isDiceExpression = /^\d*d\d+([+-]\d+)?$/i.test(queryStr);

    let resultExpression = '';
    let resultTotal = 0;
    let resultRolls: number[] = [];
    let resultBonusPenaltyRolls: number[] = [];
    let isCriticalSuccess = false;
    let isCriticalFail = false;
    let characterName = character ? character.name : 'Investigador';
    let contentText = '';

    if (isDiceExpression) {
      const expr = queryStr.toLowerCase();
      const match = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
      if (!match) return { handled: true, error: 'Expressão de dados inválida' };

      const count = parseInt(match[1] || '1', 10);
      const sides = parseInt(match[2], 10);
      const modifier = parseInt(match[3] || '0', 10);

      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const total = rolls.reduce((a, b) => a + b, 0) + modifier;

      resultExpression = `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`;
      resultTotal = total;
      resultRolls = rolls;
      isCriticalSuccess = sides === 100 && total === 1;
      isCriticalFail = sides === 100 && (total === 100 || total >= 96);
      contentText = `${characterName} rolou ${resultExpression}: ${resultTotal}`;
      } else {
        if (character?.id === -999) {
          return { 
            handled: true, 
            error: 'Como Mestre (GM), você deve especificar uma expressão numérica de dados (ex: /r 1d100 ou /r 3d6+4) ou utilizar o atalho nos cards dos investigadores.' 
          };
        }
        // 2. Check if the query is an attribute or skill of the active character
        const normQuery = queryStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const attributesMap: { [key: string]: { name: string; key: string } } = {
        'forca': { name: 'FOR (Força)', key: 'str' },
        'for': { name: 'FOR (Força)', key: 'str' },
        'destreza': { name: 'DES (Destreza)', key: 'dex' },
        'des': { name: 'DES (Destreza)', key: 'dex' },
        'dex': { name: 'DES (Destreza)', key: 'dex' },
        'inteligencia': { name: 'INT (Inteligência)', key: 'int_val' },
        'int': { name: 'INT (Inteligência)', key: 'int_val' },
        'constituicao': { name: 'CON (Constituição)', key: 'con' },
        'con': { name: 'CON (Constituição)', key: 'con' },
        'aparencia': { name: 'APA (Aparência)', key: 'app' },
        'apa': { name: 'APA (Aparência)', key: 'app' },
        'app': { name: 'APA (Aparência)', key: 'app' },
        'poder': { name: 'POD (Poder)', key: 'pow' },
        'pod': { name: 'POD (Poder)', key: 'pow' },
        'pow': { name: 'POD (Poder)', key: 'pow' },
        'tamanho': { name: 'TAM (Tamanho)', key: 'siz' },
        'tam': { name: 'TAM (Tamanho)', key: 'siz' },
        'siz': { name: 'TAM (Tamanho)', key: 'siz' },
        'educacao': { name: 'EDU (Educação)', key: 'edu' },
        'edu': { name: 'EDU (Educação)', key: 'edu' },
        'sorte': { name: 'SOR (Sorte)', key: 'luck' },
        'sor': { name: 'SOR (Sorte)', key: 'luck' },
        'luck': { name: 'SOR (Sorte)', key: 'luck' },
      };

      let targetValue = 0;
      let targetName = '';

      if (attributesMap[normQuery]) {
        const attr = attributesMap[normQuery];
        targetValue = character[attr.key] || 50;
        targetName = attr.name;
      } else {
        const matchedSkill = (character.skills || []).find((s: any) => {
          const normSkillName = s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return normSkillName.includes(normQuery);
        });

        if (matchedSkill) {
          targetValue = (matchedSkill.base_value || 0) + (matchedSkill.occ_points || 0) + (matchedSkill.int_points || 0) + (matchedSkill.game_points || 0);
          targetName = matchedSkill.name;
        }
      }

      if (targetValue > 0) {
        const tens = Math.floor(Math.random() * 10) * 10;
        const units = Math.floor(Math.random() * 10);
        let baseRoll = tens + units;
        if (baseRoll === 0) baseRoll = 100;

        resultExpression = '1d100';
        resultTotal = baseRoll;
        resultRolls = [baseRoll];
        isCriticalSuccess = baseRoll === 1;
        isCriticalFail = baseRoll === 100 || (targetValue < 50 && baseRoll >= 96);
        
        let level = '';
        if (baseRoll === 1) level = 'CRÍTICO! ⛧';
        else if (isCriticalFail) level = 'DESASTRE! 💀';
        else if (baseRoll <= Math.floor(targetValue / 5)) level = 'Extremo (1/5)';
        else if (baseRoll <= Math.floor(targetValue / 2)) level = 'Bom (1/2)';
        else if (baseRoll <= targetValue) level = 'Normal';
        else level = 'Fracasso';

        contentText = `${characterName} rolou ${targetName} (${targetValue}): resultado ${baseRoll} (${level})`;
      } else {
        return { handled: true, error: `Atributo ou Perícia "${queryStr}" não encontrado no seu investigador.` };
      }
    }

    try {
      await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentText,
          message_type: 'roll',
          roll_details: {
            expression: resultExpression,
            total: resultTotal,
            rolls: resultRolls,
            bonusPenaltyRolls: resultBonusPenaltyRolls,
            isCriticalSuccess,
            isCriticalFail,
            characterName
          }
        })
      });

      // Save to local dice history silently
      fetch('/api/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          expression: resultExpression,
          result: resultTotal,
          details: `Chat roll de ${queryStr}: ${contentText}`
        })
      }).catch(err => console.warn(err));

      return { handled: true };
    } catch (err) {
      console.error(err);
      return { handled: true, error: 'Falha ao transmitir rolagem' };
    }
  };

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = chatInput.trim();
    if (!input) return;

    // Check if it is a dice roll command starting with /
    if (input.startsWith('/')) {
      const rollRes = await parseAndExecuteChatRollCommand(input);
      if (rollRes.handled) {
        if (rollRes.error) {
          alert(rollRes.error);
        } else {
          setChatInput('');
        }
        return;
      }
    }

    try {
      const payload: any = {
        content: input,
        message_type: whisperRecipientId ? 'whisper' : 'chat'
      };
      if (whisperRecipientId) {
        payload.recipient_id = whisperRecipientId;
      }

      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput('');
        lastMessageIdRef.current = newMsg.id;
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Spell CRUD operations
  const handleSaveSpell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spellName.trim()) return;

    const payload = {
      character_id: character.id,
      name: spellName,
      cost: spellCost,
      casting_time: spellCastingTime,
      range: spellRange,
      duration: spellDuration,
      description: spellDescription
    };

    try {
      if (editingSpellId) {
        // Update
        const res = await fetch(`/api/spells/${editingSpellId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setEditingSpellId(null);
          loadSpells();
        }
      } else {
        // Create
        const res = await fetch('/api/spells', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setIsAddingSpell(false);
          loadSpells();
        }
      }

      // Reset form
      setSpellName('');
      setSpellCost('');
      setSpellCastingTime('');
      setSpellRange('');
      setSpellDuration('');
      setSpellDescription('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSpellClick = (spell: Spell) => {
    setEditingSpellId(spell.id);
    setSpellName(spell.name);
    setSpellCost(spell.cost);
    setSpellCastingTime(spell.casting_time);
    setSpellRange(spell.range);
    setSpellDuration(spell.duration);
    setSpellDescription(spell.description);
    setIsAddingSpell(true);
  };

  const handleDeleteSpell = async (spellId: number) => {
    if (!confirm('Deseja realmente desvanecer esta magia para o vácuo?')) return;
    try {
      const res = await fetch(`/api/spells/${spellId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadSpells();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Conjurar / Cast Spell into Chat
  const handleCastSpell = async (spell: Spell) => {
    try {
      const castMessage = `🔮 [Grimório] **${character.name}** conjura **${spell.name}**!\n- **Custo**: ${spell.cost || 'Nenhum'}\n- **Tempo**: ${spell.casting_time || 'Instantâneo'}\n- **Alcance**: ${spell.range || 'Contato'}\n- **Duração**: ${spell.duration || 'Imediato'}\n\n*Descrição:* ${spell.description}`;
      
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: castMessage,
          message_type: 'chat'
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        lastMessageIdRef.current = newMsg.id;
        setActiveTab('chat');
        alert(`Magia ${spell.name} anunciada no chat da sessão!`);
      }
    } catch (err) {
      console.error('Error casting spell:', err);
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
      <div className="chat-roll-card" style={{ marginTop: '0.4rem' }}>
        <span className="chat-roll-char-name">{characterName}</span>
        <span className="chat-roll-expr">Rolou {expression}</span>
        <div className="chat-roll-total-box" style={{ margin: '0.3rem 0' }}>
          <span className="chat-roll-total-value">{total}</span>
          {outcome && <span className={`dice-success-badge ${outcomeClass}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', border: 'none', marginLeft: '0.5rem' }}>{outcome}</span>}
        </div>
        <span className="chat-roll-details" style={{ fontSize: '0.65rem' }}>Resultados: [{rolls?.join(', ')}]</span>
      </div>
    );
  };

  // Drawer Width varies dynamically based on active tab: expandable when reading PDF
  const drawerWidth = activeTab === 'library' ? '860px' : '440px';

  const latestNotification = toasts[toasts.length - 1];
  const handleDismissNotification = () => {
    if (latestNotification) {
      setToasts(prev => prev.filter(t => t.id !== latestNotification.id));
    }
  };

  return (
    <>
      {/* Modal Notification Overlay */}
      {latestNotification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 5, 8, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 15000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'rgba(12, 12, 20, 0.98)',
              border: '1.5px solid var(--border-crimson)',
              boxShadow: '0 10px 45px rgba(0,0,0,0.85), 0 0 35px rgba(140,12,16,0.3)',
              borderRadius: '8px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              position: 'relative',
              textAlign: 'center'
            }}
          >
            {/* Glow Element */}
            <div style={{
              position: 'absolute',
              top: '-1px',
              left: '20%',
              right: '20%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, var(--primary-crimson), transparent)'
            }} />

            {/* Místico Header Icon */}
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'rgba(140, 12, 16, 0.1)',
              border: '1.5px solid var(--border-crimson)',
              boxShadow: '0 0 20px rgba(140, 12, 16, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem'
            }}>
              {latestNotification.title.includes('Rolagem') ? '🎲' : 
               latestNotification.title.includes('Roll20') ? '🌌' : 
               latestNotification.title.includes('Magia') ? '🔮' : '🤫'}
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className="gothic-label" style={{ fontSize: '0.75rem', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
                MANIFESTAÇÃO NA MESA
              </span>
              <h2 style={{
                fontFamily: 'var(--font-gothic)',
                color: 'var(--text-gold)',
                fontSize: '1.6rem',
                margin: 0,
                textShadow: '0 0 10px rgba(229,169,59,0.2)'
              }}>
                {latestNotification.title}
              </h2>
            </div>

            {/* Content Details */}
            <div style={{
              width: '100%',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '1.25rem 1.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {latestNotification.content}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
              {latestNotification.url ? (
                <>
                  <a
                    href={latestNotification.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-occult"
                    onClick={handleDismissNotification}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1.5rem',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #008b8b 100%)',
                      color: '#000',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      boxShadow: '0 0 15px rgba(0, 229, 255, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      fontFamily: 'var(--font-gothic)',
                      letterSpacing: '0.05em'
                    }}
                  >
                    ⚔️ ENTRAR NO ROLL20 ⚔️
                  </a>
                  <button
                    type="button"
                    className="btn-occult-secondary"
                    onClick={handleDismissNotification}
                    style={{
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.85rem',
                      borderRadius: '4px'
                    }}
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-occult"
                  onClick={handleDismissNotification}
                  style={{
                    width: '100%',
                    maxWidth: '220px',
                    padding: '0.65rem 2rem',
                    fontSize: '0.85rem',
                    justifyContent: 'center',
                    borderRadius: '4px'
                  }}
                >
                  Compreendido
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Campaign Button (bottom-right) */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="campaign-floating-btn"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-crimson) 0%, #4a0404 100%)',
          border: '2px solid var(--accent-gold)',
          color: '#fff',
          fontSize: '1.6rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(140, 12, 16, 0.6), 0 0 10px rgba(229, 169, 59, 0.3)',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: unreadCount > 0 ? 'pulseGlow 2s infinite' : 'none'
        }}
        title="Painel de Campanha (Chat, Grimório, Biblioteca)"
      >
        <span>🔮</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--text-crimson)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-darkest)',
            boxShadow: '0 0 8px var(--text-crimson)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Sliding Campaign Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: isOpen ? drawerWidth : 0,
        background: 'rgba(10, 10, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        borderLeft: isOpen ? '2px solid var(--border-crimson)' : 'none',
        boxShadow: isOpen ? '-10px 0 30px rgba(0,0,0,0.8)' : 'none',
        zIndex: 998,
        transition: 'width 0.3s ease, transform 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {isOpen && (
          <>
            {/* Drawer Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.4)'
            }}>
              <div>
                <h2 style={{ fontSize: '1rem', color: 'var(--text-gold)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: activeTab === 'library' ? '600px' : '280px' }}>
                  {character.session.name}
                </h2>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Código: <strong style={{ color: 'var(--text-crimson)' }}>{character.session.code}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {character.session.roll20_url && (
                  <a
                    href={character.session.roll20_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-occult"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', background: 'linear-gradient(135deg, var(--accent-gold) 0%, #b8860b 100%)', color: '#000', fontWeight: 'bold' }}
                  >
                    Roll20 🎲
                  </a>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0 0.5rem',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Tab Nav Controls */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-light)',
              background: 'rgba(5, 5, 10, 0.5)'
            }}>
              {[
                { label: '💬 Chat da Sessão', key: 'chat' },
                character?.id !== -999 && { label: '🔮 Grimório (Magias)', key: 'spells' },
                { label: '📚 Biblioteca', key: 'library' },
              ].filter(Boolean).map(t => (
                <button
                  key={(t as any).key}
                  onClick={() => setActiveTab((t as any).key as any)}
                  style={{
                    flex: 1,
                    padding: '0.9rem',
                    background: activeTab === (t as any).key ? 'rgba(140,12,16,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === (t as any).key ? '2px solid var(--primary-crimson)' : '2px solid transparent',
                    color: activeTab === (t as any).key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === (t as any).key ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {(t as any).label}
                </button>
              ))}
            </div>

            {/* Active Drawer View */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* === Chat Tab === */}
              {activeTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                  {/* Messages list */}
                  <div
                    ref={chatContainerRef}
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    {chatMessages.map(msg => {
                      const isMine = currentUser && msg.sender_id === currentUser.id;
                      const isRoll = msg.message_type === 'roll';
                      const isWhisper = msg.message_type === 'whisper';

                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isMine ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: isWhisper 
                              ? 'rgba(0, 229, 255, 0.07)'
                              : isMine 
                                ? 'rgba(140, 12, 16, 0.18)' 
                                : 'rgba(255,255,255,0.03)',
                            border: isWhisper
                              ? '1px dashed var(--accent-cyan)'
                              : isMine 
                                ? '1px solid rgba(140, 12, 16, 0.3)' 
                                : '1px solid var(--border-light)',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isWhisper ? '0 0 10px rgba(0, 229, 255, 0.05)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: isWhisper ? 'var(--accent-cyan)' : 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap' }}>
                              {msg.sender_username}
                              {isWhisper && (
                                <span style={{ fontStyle: 'italic', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                                  cochichou para {msg.recipient_username || 'Você'} 🤫
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {isRoll ? (
                            renderRollDetails(msg.roll_details)
                          ) : msg.content.includes('[Roll20]') ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                {msg.content.replace(/\[Mesa de Combate no Roll20\].*/g, '').trim()}
                              </span>
                              <a
                                href={character?.session?.roll20_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-occult"
                                style={{
                                  padding: '0.5rem 1rem',
                                  fontSize: '0.75rem',
                                  background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #008b8b 100%)',
                                  color: '#000',
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                  textDecoration: 'none',
                                  borderRadius: '4px',
                                  boxShadow: '0 0 12px rgba(0, 229, 255, 0.25)',
                                  justifyContent: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontFamily: 'var(--font-gothic)',
                                  letterSpacing: '0.05em'
                                }}
                              >
                                ⚔️ ACESSAR MESA ROLL20 ⚔️
                              </a>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: isWhisper ? 'var(--accent-cyan)' : 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                              {msg.content}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {chatMessages.length === 0 && (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>
                        Nenhuma manifestação no chat da sessão ainda...
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={handleSendMessage}
                    style={{
                      padding: '0.75rem 1rem',
                      borderTop: '1px solid var(--border-light)',
                      background: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    {character.id === -999 && (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.1rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>🤫 Cochichar com:</span>
                        <select
                          value={whisperRecipientId || ''}
                          onChange={(e) => setWhisperRecipientId(e.target.value ? parseInt(e.target.value, 10) : null)}
                          style={{
                            background: 'rgba(0,0,0,0.6)',
                            border: whisperRecipientId ? '1px solid var(--accent-cyan)' : '1px solid var(--border-light)',
                            borderRadius: '4px',
                            color: whisperRecipientId ? 'var(--accent-cyan)' : '#fff',
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.4rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="">📢 Todos na Mesa (Público)</option>
                          {participants.map((p: any) => (
                            <option key={p.owner_id} value={p.owner_id}>
                              👤 {p.name} ({p.owner_username})
                            </option>
                          ))}
                        </select>
                        {whisperRecipientId && (
                          <button
                            type="button"
                            onClick={() => setWhisperRecipientId(null)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-crimson)',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <input
                        type="text"
                        className="chat-input-field"
                        placeholder={whisperRecipientId ? "Cochichar em segredo..." : "Falar na sessão..."}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.4)',
                          border: whisperRecipientId ? '1px solid var(--accent-cyan)' : '1px solid var(--border-light)',
                          borderRadius: '4px',
                          padding: '0.5rem',
                          fontSize: '0.8rem',
                          color: '#fff'
                        }}
                      />
                      <button
                        type="submit"
                        className="btn-occult"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', minWidth: '70px', justifyContent: 'center' }}
                      >
                        Enviar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* === Grimório (Magias) Tab === */}
              {activeTab === 'spells' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                  
                  {isAddingSpell ? (
                    /* Add / Edit Form */
                    <form onSubmit={handleSaveSpell} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                      <h3 style={{ fontSize: '0.85rem', color: 'var(--text-gold)', borderBottom: '1px solid var(--border-crimson)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
                        {editingSpellId ? '⛧ Modificar Ritual / Magia' : '⛧ Invocar Novo Ritual/Magia'}
                      </h3>

                      <div className="gothic-input-group">
                        <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Nome da Magia</label>
                        <input
                          type="text"
                          className="gothic-input"
                          style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                          placeholder="Ex: Definhar, Olho da Luz Divina..."
                          value={spellName}
                          onChange={e => setSpellName(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="gothic-input-group">
                          <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Custo (SAD/PV/PM)</label>
                          <input
                            type="text"
                            className="gothic-input"
                            style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                            placeholder="Ex: 5 PM, 1d10 SAN"
                            value={spellCost}
                            onChange={e => setSpellCost(e.target.value)}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Tempo Conjuração</label>
                          <input
                            type="text"
                            className="gothic-input"
                            style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                            placeholder="Ex: 1 rodada, Instantâneo"
                            value={spellCastingTime}
                            onChange={e => setSpellCastingTime(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="gothic-input-group">
                          <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Alcance</label>
                          <input
                            type="text"
                            className="gothic-input"
                            style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                            placeholder="Ex: 10 metros, Toque"
                            value={spellRange}
                            onChange={e => setSpellRange(e.target.value)}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Duração</label>
                          <input
                            type="text"
                            className="gothic-input"
                            style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                            placeholder="Ex: Imediato, 1 hora"
                            value={spellDuration}
                            onChange={e => setSpellDuration(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="gothic-input-group">
                        <label className="gothic-label" style={{ fontSize: '0.65rem' }}>Efeito / Descrição do Feitiço</label>
                        <textarea
                          className="gothic-input"
                          style={{ padding: '0.4rem', fontSize: '0.8rem', minHeight: '80px', resize: 'vertical' }}
                          placeholder="Insira as consequências arcanas desta magia..."
                          value={spellDescription}
                          onChange={e => setSpellDescription(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button type="submit" className="btn-occult" style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}>
                          Gravar no Livro
                        </button>
                        <button
                          type="button"
                          className="btn-occult-secondary"
                          style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
                          onClick={() => {
                            setIsAddingSpell(false);
                            setEditingSpellId(null);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Spells List */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Grimório Oculto de Magias</span>
                        <button
                          type="button"
                          className="btn-occult"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                          onClick={() => setIsAddingSpell(true)}
                        >
                          + Adicionar Magia
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {spells.map(s => (
                          <div
                            key={s.id}
                            className="occult-card"
                            style={{
                              padding: '0.75rem',
                              border: '1px solid var(--border-crimson)',
                              background: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>
                              <h4 style={{ color: 'var(--text-gold)', fontSize: '0.85rem', margin: 0 }}>
                                {s.name}
                              </h4>
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <button
                                  type="button"
                                  className="btn-occult"
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.6rem', background: 'rgba(0, 229, 255, 0.1)', borderColor: 'var(--accent-cyan)' }}
                                  onClick={() => handleCastSpell(s)}
                                  title="Conjurar e compartilhar no chat"
                                >
                                  Conjurar ⛧
                                </button>
                                <button
                                  type="button"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.7rem' }}
                                  onClick={() => handleEditSpellClick(s)}
                                  title="Editar Magia"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-crimson)', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}
                                  onClick={() => handleDeleteSpell(s.id)}
                                  title="Excluir Magia"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Info Strip */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                              <span><strong>Custo</strong>: {s.cost || '-'}</span>
                              <span><strong>Tempo</strong>: {s.casting_time || '-'}</span>
                              <span><strong>Alcance</strong>: {s.range || '-'}</span>
                              <span><strong>Duração</strong>: {s.duration || '-'}</span>
                            </div>

                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.2rem 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                              {s.description}
                            </p>
                          </div>
                        ))}

                        {spells.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', border: '1px dashed var(--border-light)', borderRadius: '8px' }}>
                            Nenhum mistério arcanado ou magia neste grimório.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* === Biblioteca (PDFs) Tab === */}
              {activeTab === 'library' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1rem' }}>
                  <PDFViewerModule />
                </div>
              )}

            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulseGlow {
          0% {
            box-shadow: 0 4px 20px rgba(140, 12, 16, 0.6), 0 0 0 0px rgba(229, 169, 59, 0.5);
          }
          70% {
            box-shadow: 0 4px 20px rgba(140, 12, 16, 0.6), 0 0 0 10px rgba(229, 169, 59, 0);
          }
          100% {
            box-shadow: 0 4px 20px rgba(140, 12, 16, 0.6), 0 0 0 0px rgba(229, 169, 59, 0);
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
