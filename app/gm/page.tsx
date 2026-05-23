'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/AuthProvider';
import InvestigatorGeneral from '../../components/InvestigatorGeneral';
import InvestigatorSkills from '../../components/InvestigatorSkills';
import InvestigatorCombat from '../../components/InvestigatorCombat';
import InvestigatorBackstory from '../../components/InvestigatorBackstory';
import DiceRollerModal from '../../components/DiceRollerModal';
import FloatingCampaignDrawer from '../../components/FloatingCampaignDrawer';
import Link from 'next/link';

export default function GmPanel() {
  const { user, loading: authLoading } = useAuth();

  // Sessions and Active campaign state
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any | null>(null);
  
  // Lobby Navigation Tab: sessions vs npcs bestiary library
  const [lobbyTab, setLobbyTab] = useState<'sessions' | 'npcs'>('sessions');

  // Permanent NPC/Monsters bestiary library state
  const [libraryNpcs, setLibraryNpcs] = useState<any[]>([]);
  const [selectedLibraryNpc, setSelectedLibraryNpc] = useState<any | null>(null);

  // Controls
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [newLogContent, setNewLogContent] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Spawner and Tracker state
  const [newNpcName, setNewNpcName] = useState('');
  const [sortByDex, setSortByDex] = useState(true);
  const [activeTurnCharId, setActiveTurnCharId] = useState<number | null>(null);
  const [notesText, setNotesText] = useState('');

  // Edit Modal State
  const [editingChar, setEditingChar] = useState<any | null>(null);
  const [gmActiveTab, setGmActiveTab] = useState<string>('general');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBestiaryOpen, setIsBestiaryOpen] = useState(false);

  // GM Dice Roller Modal State
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [rollTargetName, setRollTargetName] = useState('');
  const [rollTargetValue, setRollTargetValue] = useState(0);
  const [rollDiceType, setRollDiceType] = useState<any>('d100');

  // Terminal Auto Scroll
  const logTerminalRef = useRef<HTMLDivElement>(null);
  const [roll20Input, setRoll20Input] = useState('');

  // Load GM notepad notes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cutchulo_gm_notes');
      if (saved) setNotesText(saved);
    }
  }, []);

  const handleNotesChange = (text: string) => {
    setNotesText(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cutchulo_gm_notes', text);
    }
  };

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

  // Load permanent library NPCs bestiary
  const loadLibraryNpcs = async () => {
    try {
      const res = await fetch('/api/npcs');
      if (res.ok) {
        const data = await res.json();
        setLibraryNpcs(data);
        if (data.length > 0 && !selectedLibraryNpc) {
          setSelectedLibraryNpc(data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading library NPCs:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
      loadLibraryNpcs();
    }
  }, [user]);

  useEffect(() => {
    if (user && lobbyTab === 'npcs') {
      loadLibraryNpcs();
    }
  }, [user, lobbyTab]);

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

  // Synchronize Roll20 URL state
  useEffect(() => {
    if (sessionDetails) {
      setRoll20Input(prev => prev || sessionDetails.roll20_url || '');
    }
  }, [sessionDetails]);

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

  const handleCallToRoll20 = async () => {
    if (!selectedSessionId || !sessionDetails || !sessionDetails.roll20_url) {
      alert('Sintonize a URL do Roll20 primeiro na barra lateral!');
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🌌 [Roll20] **O Mestre convoca a todos para o combate!**\n\nClique no botão "Roll20" no painel de campanha ou acesse diretamente pelo portal: [Mesa de Combate no Roll20](${sessionDetails.roll20_url})`,
          message_type: 'chat'
        })
      });

      if (res.ok) {
        alert('Convocação enviada com sucesso no chat e notificações dos jogadores!');
      } else {
        alert('Falha ao enviar convocação.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar convocação.');
    }
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

  // Actions for campaign session management
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

  // Vital direct edits via input change (auto save)
  const handleVitalInputChange = async (charId: number, field: string, valStr: string, maxField: string) => {
    const char = sessionDetails?.characters?.find((x: any) => x.id === charId);
    if (!char) return;
    let val = parseInt(valStr, 10);
    if (isNaN(val)) return;
    const max = char[maxField] || 99;
    val = Math.max(0, Math.min(max, val));

    // Optimistic local UI state update
    const updatedCharacters = sessionDetails.characters.map((c: any) =>
      c.id === charId ? { ...c, [field]: val } : c
    );
    setSessionDetails({ ...sessionDetails, characters: updatedCharacters });

    try {
      await fetch(`/api/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val }),
      });
    } catch (err) {
      console.error('GM vital input change error:', err);
    }
  };

  // Vital adjustments via simple increment/decrement buttons
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

  // Toggle insanity statuses on/off
  const handleToggleInsanity = async (charId: number, field: string) => {
    const char = sessionDetails?.characters?.find((x: any) => x.id === charId);
    if (!char) return;
    const nextVal = char[field] === 1 ? 0 : 1;

    // Optimistic local update
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
      console.error('GM toggle insanity error:', err);
    }
  };

  // Fast spawn NPCs/Monsters directly in the active campaign session
  const handleSpawnNpcDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNpcName.trim() || !selectedSessionId) return;

    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/npc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNpcName }),
      });
      if (res.ok) {
        setNewNpcName('');
        fetchSessionDetails(selectedSessionId, true);
      } else {
        alert('Falha ao evocar NPC.');
      }
    } catch (err) {
      console.error('Error spawning NPC:', err);
    }
  };

  // Fully import custom NPC or Creature from the permanent bestiary library into the active session
  const handleImportNpcFromLibrary = async (libraryNpc: any) => {
    if (!selectedSessionId) return;
    try {
      const response = await fetch(`/api/sessions/${selectedSessionId}/npc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: libraryNpc.name })
      });
      if (response.ok) {
        const newSessionChar = await response.json();
        // Fully populate character stats copied from library NPC
        await fetch(`/api/characters/${newSessionChar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: libraryNpc.name,
            occupation: libraryNpc.type === 'monster' ? 'Monstro' : 'NPC',
            player: 'NPC',
            image: libraryNpc.image,
            str: libraryNpc.str,
            dex: libraryNpc.dex,
            int_val: libraryNpc.int_val,
            con: libraryNpc.con,
            pow: libraryNpc.pow,
            siz: libraryNpc.siz,
            hp_current: libraryNpc.hp_current,
            hp_max: libraryNpc.hp_max,
            mp_current: libraryNpc.mp_current,
            mp_max: libraryNpc.mp_max,
            san_current: libraryNpc.san_current,
            san_max: libraryNpc.san_max,
            notes: `[Biblioteca de NPC]\n${libraryNpc.description || 'Nenhuma descrição.'}\n\nHabilidades & Ataques:\n${libraryNpc.special_abilities || 'Sem habilidades especiais.'}\n\nNotas do Escriba:\n${libraryNpc.notes || 'Sem anotações.'}\n\nArmadura: ${libraryNpc.armor || 0}`
          })
        });
        fetchSessionDetails(selectedSessionId, true);
      }
    } catch (err) {
      console.error('Error importing NPC from library:', err);
    }
  };

  // Sacrificar NPC (delete)
  const handleSacrificeNpc = async (charId: number) => {
    if (!confirm('Deseja mesmo sacrificar esta criatura/NPC? A ficha será apagada para sempre.')) return;
    try {
      const res = await fetch(`/api/characters/${charId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSessionDetails(selectedSessionId!, true);
      }
    } catch (err) {
      console.error('Error sacrificing NPC:', err);
    }
  };

  // Permanent Bestiary Library actions
  const handleCreateLibraryNpc = async () => {
    try {
      const res = await fetch('/api/npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Novo Monstro/NPC',
          type: 'npc',
          description: 'Nova descrição arcanas...',
          str: 50,
          dex: 50,
          int_val: 50,
          con: 50,
          pow: 50,
          siz: 50
        })
      });
      if (res.ok) {
        const newNpc = await res.json();
        await loadLibraryNpcs();
        setSelectedLibraryNpc(newNpc);
      }
    } catch (err) {
      console.error('Error creating library NPC:', err);
    }
  };

  const handleUpdateLibraryNpc = async (field: string, value: any) => {
    if (!selectedLibraryNpc) return;
    const updated = { ...selectedLibraryNpc, [field]: value };
    setSelectedLibraryNpc(updated);

    // Update in local list optimistically
    setLibraryNpcs(prev => prev.map(n => n.id === selectedLibraryNpc.id ? updated : n));

    try {
      await fetch(`/api/npcs/${selectedLibraryNpc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
    } catch (err) {
      console.error('Error updating library NPC:', err);
    }
  };

  const handleDeleteLibraryNpc = async (id: number) => {
    if (!confirm('Deseja mesmo sacrificar este NPC de forma permanente na sua biblioteca? Ele desaparecerá das opções de spawn.')) return;
    try {
      const res = await fetch(`/api/npcs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedLibraryNpc?.id === id) {
          setSelectedLibraryNpc(null);
        }
        await loadLibraryNpcs();
      }
    } catch (err) {
      console.error('Error deleting library NPC:', err);
    }
  };

  const handleImportNpcsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        const res = await fetch('/api/npcs/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });

        if (res.ok) {
          const result = await res.json();
          alert(`Sucesso! ${result.count} NPCs/Monstros importados para a biblioteca.`);
          await loadLibraryNpcs();
        } else {
          const err = await res.json();
          alert(`Falha na importação: ${err.error || 'Erro desconhecido'}`);
        }
      } catch (err: any) {
        console.error('Import error:', err);
        alert('Erro ao ler JSON: verifique a formatação do arquivo.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportNpc = (npc: any) => {
    if (!npc) return;
    const blob = new Blob([JSON.stringify(npc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestiario_${npc.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllNpcs = () => {
    if (libraryNpcs.length === 0) {
      alert('Sua mente está vazia! Não há monstros/NPCs para exportar.');
      return;
    }
    const blob = new Blob([JSON.stringify(libraryNpcs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestiario_completo_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Callback to append GM rolls directly to campaign log AND session live chat
  const handleRollComplete = async (roll: any) => {
    if (!selectedSessionId) return;

    const isCriticalSuccess = roll.expression === '1d100' && roll.result === 1;
    const isCriticalFail = roll.expression === '1d100' && (roll.result === 100 || roll.result >= 96);
    const characterName = 'Mestre (GM)';
    const contentText = `${characterName} rolou ${roll.expression}: ${roll.result} (${roll.details})`;

    try {
      // 1. Post to live chat messages
      await fetch(`/api/sessions/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentText,
          message_type: 'roll',
          roll_details: {
            expression: roll.expression,
            total: roll.result,
            rolls: roll.rolls || [roll.result],
            bonusPenaltyRolls: [],
            isCriticalSuccess,
            isCriticalFail,
            characterName
          }
        })
      });

      // 2. Post to campaign log terminal
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

  // Handle clicking on the access code to instantly copy it
  const handleCopyAccessCode = () => {
    if (sessionDetails?.code) {
      navigator.clipboard.writeText(sessionDetails.code);
      alert(`Código de Entrada "${sessionDetails.code}" copiado!`);
    }
  };

  // Mock character for GM Floating Campaign Drawer
  const gmCharacterMock = sessionDetails ? {
    id: -999,
    name: 'Mestre (GM)',
    session: {
      id: sessionDetails.id
    }
  } : null;

  // Process characters list (PCs + NPCs) with custom order (DEX or name)
  const processCharacters = () => {
    if (!sessionDetails?.characters) return [];
    
    const list = [...sessionDetails.characters];
    if (sortByDex) {
      return list.sort((a, b) => (b.dex || 0) - (a.dex || 0));
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const processedCharacters = processCharacters();

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
              <div 
                style={{
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
                  marginTop: '0.5rem',
                  cursor: 'pointer'
                }}
                onClick={handleCopyAccessCode}
                title="Clique para copiar o código"
              >
                <span className="gothic-label" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>CÓDIGO DE ENTRADA 📋</span>
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
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Clique para copiar</span>
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
            // Lobby Tab Selector (Campaigns vs NPC Library)
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0 0.5rem 1.25rem 0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.3rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLobbyTab('sessions')}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    fontSize: '0.7rem',
                    background: lobbyTab === 'sessions' ? 'rgba(229,169,59,0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: lobbyTab === 'sessions' ? 'var(--border-gold)' : 'transparent',
                    color: lobbyTab === 'sessions' ? 'var(--text-gold)' : 'var(--text-muted)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🏰 Campanhas
                </button>
                <button
                  type="button"
                  onClick={() => setLobbyTab('npcs')}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    fontSize: '0.7rem',
                    background: lobbyTab === 'npcs' ? 'rgba(229,169,59,0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: lobbyTab === 'npcs' ? 'var(--border-gold)' : 'transparent',
                    color: lobbyTab === 'npcs' ? 'var(--text-gold)' : 'var(--text-muted)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🐉 Criador NPCs
                </button>
              </div>

              {lobbyTab === 'sessions' && (
                <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

              {lobbyTab === 'npcs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span className="sidebar-item-header" style={{ margin: 0 }}>Biblioteca</span>
                  <button
                    type="button"
                    className="btn-occult"
                    onClick={handleCreateLibraryNpc}
                    style={{ padding: '0.5rem', fontSize: '0.75rem', justifyContent: 'center', background: 'rgba(0, 229, 255, 0.05)', borderColor: 'var(--accent-cyan)' }}
                  >
                    🐉 + Criar NPC/Monstro
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Render Active Campaigns List */}
          <div className="sidebar-item-header">Suas Campanhas Ativas</div>
          <div className="gm-session-list">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`gm-session-card glass-panel ${selectedSessionId === s.id ? 'active' : ''}`}
                style={{ padding: '0.75rem', border: '1px solid var(--border-light)', cursor: 'pointer' }}
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
            {/* Header section */}
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1 }}>
                <h1 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.6rem', margin: 0 }}>
                  {sessionDetails.name}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                  {sessionDetails.notes || 'Nenhuma descrição.'}
                </p>
              </div>

              {!sessionDetails.roll20_url ? (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="gothic-input"
                    placeholder="Sintonizar URL do Roll20..."
                    value={roll20Input}
                    onChange={(e) => setRoll20Input(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', width: '220px', margin: 0 }}
                  />
                  <button
                    type="button"
                    className="btn-occult"
                    onClick={handleUpdateRoll20Url}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      background: 'var(--accent-gold)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      height: '34px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    🌌 Sintonizar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <a
                    href={sessionDetails.roll20_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-occult"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
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
                  <button
                    type="button"
                    className="btn-occult"
                    onClick={handleCallToRoll20}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #008b8b 100%)',
                      border: '1.5px solid var(--accent-cyan)',
                      color: '#000',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(0, 243, 255, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap'
                    }}
                    title="Convocação e portal místico Roll20 para todos os investigadores"
                  >
                    🌌 Chamar para o Roll20
                  </button>
                  <button
                    type="button"
                    className="btn-occult"
                    onClick={() => {
                      if (confirm('Deseja desvincular ou alterar a URL do Roll20?')) {
                        setRoll20Input('');
                        fetch(`/api/sessions/${selectedSessionId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: sessionDetails.name,
                            notes: sessionDetails.notes,
                            roll20_url: '',
                            is_active: sessionDetails.is_active
                          })
                        }).then(r => {
                          if (r.ok) {
                            setSessionDetails((prev: any) => ({ ...prev, roll20_url: '' }));
                          }
                        });
                      }
                    }}
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      background: 'transparent',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '34px',
                      width: '34px'
                    }}
                    title="Desvincular ou alterar Portal Roll20"
                  >
                    ⚙️
                  </button>
                </div>
              )}
            </div>

            {/* High-Usability Grid (2 Columns: Initiatives/Combat & Notes/Tools) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }} className="gm-campaign-grid-two-col">
              
              {/* Left Column: Combat Initiative Tracker & PC/NPC Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-crimson)', fontSize: '1.2rem', margin: 0 }}>
                    Painel de Combate e Viritais
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`btn-occult-secondary ${sortByDex ? 'active' : ''}`}
                      onClick={() => setSortByDex(prev => !prev)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', border: sortByDex ? '1px solid var(--accent-cyan)' : '1px solid var(--border-light)' }}
                    >
                      {sortByDex ? '⚡ DEX: Maior para Menor' : '🔤 Ordem Alfabética'}
                    </button>
                  </div>
                </div>

                {/* Instant NPC Spawner & Library Importer */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }} className="gm-spawners-grid">
                    {/* Spawner Manual */}
                    <form onSubmit={handleSpawnNpcDirect} className="glass-panel" style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 1rem', alignItems: 'center' }}>
                      <span className="gothic-label" style={{ fontSize: '0.7rem', color: 'var(--text-gold)', flexShrink: 0 }}>+ Evocar:</span>
                      <input
                        type="text"
                        className="gothic-input"
                        placeholder="Nome do Monstro/NPC..."
                        value={newNpcName}
                        onChange={(e) => setNewNpcName(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.35rem', flex: 1 }}
                      />
                      <button type="submit" className="btn-occult" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>Spawn</button>
                    </form>

                    {/* Importer from Library */}
                    <div className="glass-panel" style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 1rem', alignItems: 'center' }}>
                      <span className="gothic-label" style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', flexShrink: 0 }}>📥 Biblioteca:</span>
                      <select
                        className="gothic-select"
                        style={{ fontSize: '0.8rem', padding: '0.35rem', flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-light)' }}
                        defaultValue=""
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const libraryNpc = libraryNpcs.find(n => n.id === parseInt(val, 10));
                          if (libraryNpc) {
                            await handleImportNpcFromLibrary(libraryNpc);
                          }
                          e.target.value = ""; // Reset dropdown selection
                        }}
                      >
                        <option value="" disabled>Escolha para evocar...</option>
                        {libraryNpcs.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.type === 'monster' ? '👻' : '👤'} {n.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick button to open Library/Bestiary Manager */}
                  <button
                    type="button"
                    className="btn-occult"
                    onClick={() => {
                      loadLibraryNpcs();
                      setIsBestiaryOpen(true);
                    }}
                    style={{
                      padding: '0.5rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: '1px solid var(--accent-cyan)',
                      background: 'rgba(0, 229, 255, 0.04)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(0, 229, 255, 0.1)',
                      width: '100%',
                      fontFamily: 'var(--font-gothic)',
                      letterSpacing: '0.05em'
                    }}
                  >
                    🐉 ABRIR CRIADOR & BIBLIOTECA DE NPCs / CRIATURAS 🐉
                  </button>
                </div>

                {/* PC and NPC List Stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {processedCharacters.map((c: any) => {
                    const isNpc = c.player === 'NPC' || c.occupation === 'NPC';
                    const isMyTurn = activeTurnCharId === c.id;

                    const spotHidden = c.skills?.find((s: any) => s.name === 'Spot Hidden' || s.name.includes('Spot Hidden'))?.value || 25;
                    const listen = c.skills?.find((s: any) => s.name === 'Listen' || s.name.includes('Listen'))?.value || 20;

                    // Progress bar percentages
                    const hpPercent = Math.max(0, Math.min(100, (c.hp_current / (c.hp_max || 1)) * 100));
                    const mpPercent = Math.max(0, Math.min(100, (c.mp_current / (c.mp_max || 1)) * 100));
                    const sanPercent = isNpc ? 0 : Math.max(0, Math.min(100, (c.san_current / (c.san_max || 1)) * 100));

                    return (
                      <div
                        key={c.id}
                        className={`gm-player-card glass-panel ${isMyTurn ? 'glowing-turn' : ''}`}
                        style={{
                          padding: '0.85rem',
                          border: isMyTurn ? '2px solid var(--accent-gold)' : '1px solid var(--border-light)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                          position: 'relative',
                          background: isMyTurn ? 'rgba(229,169,59,0.06)' : 'var(--bg-glass)',
                          boxShadow: isMyTurn ? '0 0 15px rgba(229,169,59,0.1)' : 'none'
                        }}
                      >
                        {/* Active turn badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            display: 'flex',
                            gap: '0.4rem',
                            alignItems: 'center'
                          }}
                        >
                          <button
                            type="button"
                            className="vital-btn"
                            onClick={() => setActiveTurnCharId(isMyTurn ? null : c.id)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.65rem',
                              background: isMyTurn ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                              color: isMyTurn ? '#000' : '#fff',
                              border: '1px solid var(--border-gold)',
                              fontWeight: 'bold'
                            }}
                          >
                            {isMyTurn ? '⚡ SEU TURNO' : '⚡ Turno'}
                          </button>
                        </div>

                        {/* Card Header (Avatar + Name) */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <span style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '4px',
                            border: isNpc ? '1px solid var(--border-crimson)' : '1px solid var(--border-gold)',
                            background: c.image ? `url(${c.image}) center/cover no-repeat` : 'rgba(0,0,0,0.5)',
                            display: 'block'
                          }} />
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: isNpc ? 'var(--text-crimson)' : 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {c.name}
                              {isNpc && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', border: '1px solid var(--border-crimson)', borderRadius: '3px', background: 'rgba(140,12,16,0.1)' }}>Monstro</span>}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {isNpc ? 'Criatura Controlada pelo Mestre' : `Jogador: ${c.owner_username}`}
                            </span>
                          </div>
                        </div>

                        {/* Vitals Direct inputs and bars grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: isNpc ? '1fr 1fr' : '1fr 1fr 1fr', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                          {/* HP Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--text-crimson)', fontWeight: 'bold' }}>Vida (PV)</span>
                              <span style={{ color: 'var(--text-muted)' }}>{c.hp_current}/{c.hp_max}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                              <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'hp_current', -1, 'hp_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>-</button>
                              <input
                                type="number"
                                className="gothic-input"
                                value={c.hp_current}
                                onChange={(e) => handleVitalInputChange(c.id, 'hp_current', e.target.value, 'hp_max')}
                                style={{ width: '100%', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'hp_current', 1, 'hp_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>+</button>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${hpPercent}%`, height: '100%', background: 'linear-gradient(90deg, #ff3333 0%, #aa0000 100%)', transition: 'width 0.2s ease' }} />
                            </div>
                          </div>

                          {/* MP Section */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Magia (PM)</span>
                              <span style={{ color: 'var(--text-muted)' }}>{c.mp_current}/{c.mp_max}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                              <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'mp_current', -1, 'mp_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>-</button>
                              <input
                                type="number"
                                className="gothic-input"
                                value={c.mp_current}
                                onChange={(e) => handleVitalInputChange(c.id, 'mp_current', e.target.value, 'mp_max')}
                                style={{ width: '100%', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                              />
                              <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'mp_current', 1, 'mp_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>+</button>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${mpPercent}%`, height: '100%', background: 'linear-gradient(90deg, #00d0ff 0%, #7d00aa 100%)', transition: 'width 0.2s ease' }} />
                            </div>
                          </div>

                          {/* Sanity Section (Only for PCs) */}
                          {!isNpc && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>Sanidade</span>
                                <span style={{ color: 'var(--text-muted)' }}>{c.san_current}/{c.san_max}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'san_current', -1, 'san_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>-</button>
                                <input
                                  type="number"
                                  className="gothic-input"
                                  value={c.san_current}
                                  onChange={(e) => handleVitalInputChange(c.id, 'san_current', e.target.value, 'san_max')}
                                  style={{ width: '100%', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                                <button type="button" className="vital-btn" onClick={() => handleAdjustVitalDirect(c.id, 'san_current', 1, 'san_max')} style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}>+</button>
                              </div>
                              <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${sanPercent}%`, height: '100%', background: 'linear-gradient(90deg, #e5a93b 0%, #aa1216 100%)', transition: 'width 0.2s ease' }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Insanity Status pills (Only for PCs) */}
                        {!isNpc && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleInsanity(c.id, 'temporary_insanity')}
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-crimson)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: c.temporary_insanity === 1 ? 'var(--text-crimson)' : 'transparent',
                                color: c.temporary_insanity === 1 ? '#000' : 'var(--text-crimson)',
                                fontWeight: 'bold'
                              }}
                            >
                              🌀 Insanidade Temporária
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleInsanity(c.id, 'indefinite_insanity')}
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-crimson)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: c.indefinite_insanity === 1 ? 'var(--text-crimson)' : 'transparent',
                                color: c.indefinite_insanity === 1 ? '#000' : 'var(--text-crimson)',
                                fontWeight: 'bold'
                              }}
                            >
                              💀 Insanidade Indefinida
                            </button>
                          </div>
                        )}

                        {/* Core parameters & Quick rollers */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>DES (DEX): <strong style={{ color: '#fff' }}>{c.dex || 50}</strong></span>
                            <span>POD (POW): <strong style={{ color: '#fff' }}>{c.pow || 50}</strong></span>
                            <span>CON: <strong style={{ color: '#fff' }}>{c.con || 50}</strong></span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                              type="button"
                              className="vital-btn"
                              onClick={() => triggerDiceRoll(`👁️ Percepção de ${c.name}`, spotHidden)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              title={`Rolar Percepção Ocular (${spotHidden}%)`}
                            >
                              👁️ Spot {spotHidden}%
                            </button>
                            <button
                              type="button"
                              className="vital-btn"
                              onClick={() => triggerDiceRoll(`👂 Escuta de ${c.name}`, listen)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              title={`Rolar Escuta (${listen}%)`}
                            >
                              👂 Listen {listen}%
                            </button>
                            <button
                              type="button"
                              className="vital-btn"
                              onClick={() => triggerDiceRoll(`🧠 Teste de PODER (POD) de ${c.name}`, c.pow || 50)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              title={`Rolar Teste de Poder / Defesa de Sanidade (${c.pow || 50}%)`}
                            >
                              🧠 POD {c.pow || 50}%
                            </button>
                            <button
                              type="button"
                              className="vital-btn"
                              onClick={() => triggerDiceRoll(`🤸 Teste de DEX (Destreza / Iniciativa) de ${c.name}`, c.dex || 50)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              title={`Rolar Teste de Destreza (${c.dex || 50}%)`}
                            >
                              🤸 DES {c.dex || 50}%
                            </button>
                          </div>
                        </div>

                        {/* Action buttons footer */}
                        <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn-occult"
                            onClick={() => handleOpenEditSheet(c)}
                            style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem', justifyContent: 'center' }}
                          >
                            📝 Editar Ficha Completa
                          </button>
                          {isNpc && (
                            <button
                              type="button"
                              className="btn-occult-secondary"
                              onClick={() => handleSacrificeNpc(c.id)}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-crimson)' }}
                              title="Sacrificar NPC / Apagar Ficha"
                            >
                              🔥 Sacrificar
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}

                  {processedCharacters.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border-light)', borderRadius: '8px', fontSize: '0.85rem' }}>
                      Nenhum combatente ativo no trono do mestre. Compartilhe o código da campanha com os jogadores!
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Dice Tray, Sticky Notepad & Campaign Logs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                
                {/* Dice Tray */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-gold)', fontSize: '1.2rem', margin: 0 }}>
                    Bandeja de Dados
                  </h2>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1.5px solid var(--border-light)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                      {[
                        { type: 'd100', label: 'D100' },
                        { type: 'd20', label: 'D20' },
                        { type: 'd12', label: 'D12' },
                        { type: 'd10', label: 'D10' },
                        { type: 'd8', label: 'D8' },
                        { type: 'd6', label: 'D6' },
                        { type: 'd4', label: 'D4' },
                        { type: 'custom', label: 'Form.' }
                      ].map(die => (
                        <button
                          key={die.type}
                          type="button"
                          className="vital-btn"
                          style={{
                            padding: '0.5rem 0.25rem',
                            fontSize: '0.8rem',
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
                          onClick={() => triggerDiceRoll(`Rolo de GM ${die.label}`, 0, die.type)}
                        >
                          {die.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* GMs Sticky Notepad */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-cyan)', fontSize: '1.1rem', margin: 0 }}>
                    Diário Rápido do Mestre (Notepad)
                  </h2>
                  <textarea
                    className="gothic-input"
                    placeholder="Escreva lembretes rápidos de sessão, pistas, nomes improvisados... (Salva automático)"
                    value={notesText}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    style={{
                      height: '150px',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      background: 'rgba(5, 5, 8, 0.8)',
                      color: 'var(--text-primary)',
                      border: '1.5px solid var(--border-light)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      resize: 'vertical',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                {/* Grimório (Campaign Logs) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-gold)', fontSize: '1.1rem', margin: 0 }}>
                    Grimório de Eventos (Logs)
                  </h2>
                  
                  <div className="gm-log-box" ref={logTerminalRef} style={{
                    height: '240px',
                    background: 'rgba(5, 5, 8, 0.95)',
                    border: '1.5px solid var(--border-gold)',
                    boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)',
                    color: '#4af626',
                    fontFamily: 'monospace',
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    overflowY: 'auto',
                    borderRadius: '6px'
                  }}>
                    {sessionDetails.logs?.map((l: any) => (
                      <div key={l.id} style={{ marginBottom: '0.4rem', wordBreak: 'break-word', borderBottom: '1px solid rgba(74, 246, 38, 0.05)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: '#00d0ff', marginRight: '0.4rem' }}>[{new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        <span>{l.content}</span>
                      </div>
                    ))}
                    {(!sessionDetails.logs || sessionDetails.logs.length === 0) && (
                      <div style={{ color: '#666', textAlign: 'center', marginTop: '2.5rem' }}>* Grimório aguardando rituais *</div>
                    )}
                  </div>

                  {/* Quick log entry console */}
                  <form onSubmit={handlePostLog} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      className="gothic-input"
                      placeholder="Registrar evento místico no grimório..."
                      value={newLogContent}
                      onChange={(e) => setNewLogContent(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem', flex: 1 }}
                    />
                    <button type="submit" className="btn-occult" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Escriba</button>
                  </form>
                </div>

              </div>

            </div>
          </>
        ) : (
          // Lobby View: Campaigns tab vs permanent NPCs catalog bestiary library
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {lobbyTab === 'sessions' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', color: 'var(--text-muted)', minHeight: '60vh', textAlign: 'center' }}>
                <span style={{ fontSize: '6.5rem', textShadow: 'var(--glow-cyan)' }}>🔮</span>
                <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--text-gold)', fontSize: '1.8rem' }}>
                  Trono do Mestre da Campanha
                </h2>
                <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  Selecione uma campanha existente na barra sinistra ou invoque uma nova preenchendo o formulário de evocações. O código de entrada permitirá que seus jogadores conectem as fichas à sua mesa.
                </p>
              </div>
            ) : (
              // Permanent NPC/Criaturas Bestiary Catalog & Editor
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-gothic)', color: 'var(--accent-cyan)', fontSize: '1.6rem', margin: 0 }}>
                    🐉 Grimório de Monstros & Criaturas
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn-occult" onClick={handleCreateLibraryNpc} style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>
                      🐉 + Novo NPC / Monstro
                    </button>
                    <button 
                      type="button" 
                      className="btn-occult-secondary" 
                      onClick={() => document.getElementById('lobby-npc-import-input')?.click()} 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                    >
                      📤 Importar JSON
                    </button>
                    <button 
                      type="button" 
                      className="btn-occult-secondary" 
                      onClick={handleExportAllNpcs} 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', border: '1px solid var(--text-gold)', color: 'var(--text-gold)' }}
                    >
                      📥 Exportar Todos
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }} className="gm-npc-library-grid">
                  {/* Sidebar list of NPCs */}
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                    <span className="gothic-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Biblioteca do Grimório</span>
                    {libraryNpcs.map(npc => (
                      <div
                        key={npc.id}
                        onClick={() => setSelectedLibraryNpc(npc)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.8rem',
                          background: selectedLibraryNpc?.id === npc.id ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0,0,0,0.25)',
                          border: selectedLibraryNpc?.id === npc.id ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: selectedLibraryNpc?.id === npc.id ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{npc.name}</span>
                          <span style={{ fontSize: '0.65rem', color: npc.type === 'monster' ? 'var(--text-crimson)' : 'var(--text-muted)' }}>
                            {npc.type === 'monster' ? '👻 Criatura / Monstro' : '👤 NPC / Aliado'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="vital-btn"
                          onClick={(e) => { e.stopPropagation(); handleDeleteLibraryNpc(npc.id); }}
                          style={{ color: 'var(--text-crimson)', padding: '0.2rem', fontSize: '0.75rem' }}
                          title="Sacrificar da biblioteca"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {libraryNpcs.length === 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem 0' }}>Sem monstros guardados na mente.</span>
                    )}
                  </div>

                  {/* Main Editor Details Panel */}
                  {selectedLibraryNpc ? (
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                        <span className="gothic-label" style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', margin: 0 }}>⛧ EDITOR MÍSTICO ⛧</span>
                        <button
                          type="button"
                          className="btn-occult-secondary"
                          onClick={() => handleExportNpc(selectedLibraryNpc)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-gold)', color: 'var(--text-gold)' }}
                        >
                          📥 Exportar Ficha (JSON)
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1rem' }}>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Nome da Criatura / NPC</label>
                          <input
                            type="text"
                            className="gothic-input"
                            value={selectedLibraryNpc.name || ''}
                            onChange={(e) => handleUpdateLibraryNpc('name', e.target.value)}
                            style={{ fontSize: '0.95rem' }}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Tipo de Entidade</label>
                          <select
                            className="gothic-select"
                            value={selectedLibraryNpc.type}
                            onChange={(e) => handleUpdateLibraryNpc('type', e.target.value)}
                            style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                          >
                            <option value="npc">👤 NPC Humano (Aliado/Inimigo)</option>
                            <option value="monster">👻 Criatura / Monstro Cósmico</option>
                          </select>
                        </div>
                      </div>

                      {/* Attributes grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <span className="gothic-label" style={{ fontSize: '0.7rem', color: 'var(--text-gold)' }}>Atributos Físicos e Mentais</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                          {[
                            { label: 'FOR', key: 'str' },
                            { label: 'DES', key: 'dex' },
                            { label: 'INT', key: 'int_val' },
                            { label: 'CON', key: 'con' },
                            { label: 'POD', key: 'pow' },
                            { label: 'TAM', key: 'siz' },
                          ].map(attr => (
                            <div key={attr.key} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{attr.label}</span>
                              <input
                                type="number"
                                className="gothic-input"
                                style={{ background: 'transparent', border: 'none', textAlign: 'center', fontWeight: 'bold', width: '100%', fontSize: '1rem', color: 'var(--text-gold)', padding: 0 }}
                                value={selectedLibraryNpc[attr.key] || 50}
                                onChange={(e) => handleUpdateLibraryNpc(attr.key, parseInt(e.target.value, 10) || 0)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Vitals & Combat */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Vida Máxima (PV)</label>
                          <input
                            type="number"
                            className="gothic-input"
                            value={selectedLibraryNpc.hp_max || 10}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              handleUpdateLibraryNpc('hp_max', val);
                              handleUpdateLibraryNpc('hp_current', val);
                            }}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Magia Máxima (PM)</label>
                          <input
                            type="number"
                            className="gothic-input"
                            value={selectedLibraryNpc.mp_max || 10}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              handleUpdateLibraryNpc('mp_max', val);
                              handleUpdateLibraryNpc('mp_current', val);
                            }}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Armadura (Redução Fís.)</label>
                          <input
                            type="number"
                            className="gothic-input"
                            value={selectedLibraryNpc.armor || 0}
                            onChange={(e) => handleUpdateLibraryNpc('armor', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                      </div>

                      {/* Photo Url */}
                      <div className="gothic-input-group">
                        <label className="gothic-label">Link de Foto do Monstro / NPC</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="gothic-input"
                            placeholder="URL da Imagem da Web..."
                            value={selectedLibraryNpc.image || ''}
                            onChange={(e) => handleUpdateLibraryNpc('image', e.target.value)}
                            style={{ flex: 1 }}
                          />
                          {selectedLibraryNpc.image && (
                            <span style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-gold)',
                              background: `url(${selectedLibraryNpc.image}) center/cover no-repeat`,
                              flexShrink: 0
                            }} />
                          )}
                        </div>
                      </div>

                      {/* Description & Attacks */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Habilidades Especiais & Ataques</label>
                          <textarea
                            className="gothic-input"
                            placeholder="Descreva as garras, presas, tentáculos ou feitiços que a criatura desfere..."
                            value={selectedLibraryNpc.special_abilities || ''}
                            onChange={(e) => handleUpdateLibraryNpc('special_abilities', e.target.value)}
                            style={{ height: '100px', resize: 'vertical', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div className="gothic-input-group">
                          <label className="gothic-label">Notas e Comportamentos</label>
                          <textarea
                            className="gothic-input"
                            placeholder="Notas de mistério, fraquezas ou táticas arcanas do mestre..."
                            value={selectedLibraryNpc.notes || ''}
                            onChange={(e) => handleUpdateLibraryNpc('notes', e.target.value)}
                            style={{ height: '100px', resize: 'vertical', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>

                      <div className="gothic-input-group">
                        <label className="gothic-label">Dossiê e Descrição Biográfica</label>
                        <textarea
                          className="gothic-input"
                          placeholder="Uma breve introdução descritiva para narrar na mesa..."
                          value={selectedLibraryNpc.description || ''}
                          onChange={(e) => handleUpdateLibraryNpc('description', e.target.value)}
                          style={{ height: '80px', resize: 'vertical', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '6rem 2rem', border: '1px dashed var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '3rem' }}>🐉</span>
                      <span>Selecione uma criatura arcanas na barra esquerda ou evoque um novo NPC para moldar seus atributos e ataques permanentemente.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* GM Floating Campaign Drawer (Floating Chat & Library Module) */}
      {gmCharacterMock && (
        <FloatingCampaignDrawer
          character={gmCharacterMock}
          currentUser={user}
          onRollClick={triggerDiceRoll}
        />
      )}

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

      {/* GM NPC LIBRARY & CREATOR MODAL */}
      {isBestiaryOpen && (
        <div className="occult-modal-overlay">
          <div className="occult-modal" style={{ maxWidth: '1100px', width: '95%' }}>
            
            {/* Modal Header */}
            <div className="occult-modal-header" style={{ borderBottomColor: 'var(--border-cyan)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Grimório de Monstros & Criaturas</span>
                <h3 style={{ margin: 0, color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🐉 Biblioteca e Criador de NPCs
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsBestiaryOpen(false)}>×</button>
            </div>

            {/* Modal Content */}
            <div className="occult-modal-content" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gerenciamento de Modelos da Mesa</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-occult" onClick={handleCreateLibraryNpc} style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', borderColor: 'var(--accent-cyan)' }}>
                    🐉 + Criar Novo
                  </button>
                  <button 
                    type="button" 
                    className="btn-occult-secondary" 
                    onClick={() => document.getElementById('modal-npc-import-input')?.click()} 
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                  >
                    📤 Importar JSON
                  </button>
                  <button 
                    type="button" 
                    className="btn-occult-secondary" 
                    onClick={handleExportAllNpcs} 
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', border: '1px solid var(--text-gold)', color: 'var(--text-gold)' }}
                  >
                    📥 Exportar Todos
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }} className="gm-npc-library-grid">
                {/* Sidebar list of NPCs */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '50vh', overflowY: 'auto' }}>
                  <span className="gothic-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Seus Modelos Guardados</span>
                  {libraryNpcs.map(npc => (
                    <div
                      key={npc.id}
                      onClick={() => setSelectedLibraryNpc(npc)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.8rem',
                        background: selectedLibraryNpc?.id === npc.id ? 'rgba(0, 229, 255, 0.08)' : 'rgba(0,0,0,0.25)',
                        border: selectedLibraryNpc?.id === npc.id ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: selectedLibraryNpc?.id === npc.id ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{npc.name}</span>
                        <span style={{ fontSize: '0.65rem', color: npc.type === 'monster' ? 'var(--text-crimson)' : 'var(--text-muted)' }}>
                          {npc.type === 'monster' ? '👻 Criatura' : '👤 NPC'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="vital-btn"
                        onClick={(e) => { e.stopPropagation(); handleDeleteLibraryNpc(npc.id); }}
                        style={{ color: 'var(--text-crimson)', padding: '0.2rem', fontSize: '0.75rem' }}
                        title="Sacrificar da biblioteca"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {libraryNpcs.length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '2rem 0' }}>Sem monstros guardados na mente.</span>
                  )}
                </div>

                {/* Main Editor Details Panel */}
                {selectedLibraryNpc ? (
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                      <span className="gothic-label" style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', margin: 0 }}>⛧ EDITOR MÍSTICO ⛧</span>
                      <button
                        type="button"
                        className="btn-occult-secondary"
                        onClick={() => handleExportNpc(selectedLibraryNpc)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-gold)', color: 'var(--text-gold)' }}
                      >
                        📥 Exportar Ficha (JSON)
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1rem' }}>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Nome da Criatura / NPC</label>
                        <input
                          type="text"
                          className="gothic-input"
                          value={selectedLibraryNpc.name || ''}
                          onChange={(e) => handleUpdateLibraryNpc('name', e.target.value)}
                          style={{ fontSize: '0.95rem' }}
                        />
                      </div>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Tipo de Entidade</label>
                        <select
                          className="gothic-select"
                          value={selectedLibraryNpc.type}
                          onChange={(e) => handleUpdateLibraryNpc('type', e.target.value)}
                          style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                        >
                          <option value="npc">👤 NPC Humano (Aliado/Inimigo)</option>
                          <option value="monster">👻 Criatura / Monstro Cósmico</option>
                        </select>
                      </div>
                    </div>

                    {/* Attributes grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span className="gothic-label" style={{ fontSize: '0.7rem', color: 'var(--text-gold)' }}>Atributos Físicos e Mentais</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                        {[
                          { label: 'FOR', key: 'str' },
                          { label: 'DES', key: 'dex' },
                          { label: 'INT', key: 'int_val' },
                          { label: 'CON', key: 'con' },
                          { label: 'POD', key: 'pow' },
                          { label: 'TAM', key: 'siz' },
                        ].map(attr => (
                          <div key={attr.key} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{attr.label}</span>
                            <input
                              type="number"
                              className="gothic-input"
                              style={{ background: 'transparent', border: 'none', textAlign: 'center', fontWeight: 'bold', width: '100%', fontSize: '1rem', color: 'var(--text-gold)', padding: 0 }}
                              value={selectedLibraryNpc[attr.key] || 50}
                              onChange={(e) => handleUpdateLibraryNpc(attr.key, parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Vitals & Combat */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Vida Máxima (PV)</label>
                        <input
                          type="number"
                          className="gothic-input"
                          value={selectedLibraryNpc.hp_max || 10}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            handleUpdateLibraryNpc('hp_max', val);
                            handleUpdateLibraryNpc('hp_current', val);
                          }}
                        />
                      </div>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Magia Máxima (PM)</label>
                        <input
                          type="number"
                          className="gothic-input"
                          value={selectedLibraryNpc.mp_max || 10}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            handleUpdateLibraryNpc('mp_max', val);
                            handleUpdateLibraryNpc('mp_current', val);
                          }}
                        />
                      </div>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Armadura (Redução Fís.)</label>
                        <input
                          type="number"
                          className="gothic-input"
                          value={selectedLibraryNpc.armor || 0}
                          onChange={(e) => handleUpdateLibraryNpc('armor', parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    </div>

                    {/* Photo Url */}
                    <div className="gothic-input-group">
                      <label className="gothic-label">Link de Foto do Monstro / NPC</label>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="gothic-input"
                          placeholder="URL da Imagem da Web..."
                          value={selectedLibraryNpc.image || ''}
                          onChange={(e) => handleUpdateLibraryNpc('image', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        {selectedLibraryNpc.image && (
                          <span style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-gold)',
                            background: `url(${selectedLibraryNpc.image}) center/cover no-repeat`,
                            flexShrink: 0
                          }} />
                        )}
                      </div>
                    </div>

                    {/* Description & Attacks */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Habilidades Especiais & Ataques</label>
                        <textarea
                          className="gothic-input"
                          placeholder="Descreva as garras, presas, tentáculos ou feitiços que a criatura desfere..."
                          value={selectedLibraryNpc.special_abilities || ''}
                          onChange={(e) => handleUpdateLibraryNpc('special_abilities', e.target.value)}
                          style={{ height: '100px', resize: 'vertical', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div className="gothic-input-group">
                        <label className="gothic-label">Notas e Comportamentos</label>
                        <textarea
                          className="gothic-input"
                          placeholder="Notas de mistério, fraquezas ou táticas arcanas do mestre..."
                          value={selectedLibraryNpc.notes || ''}
                          onChange={(e) => handleUpdateLibraryNpc('notes', e.target.value)}
                          style={{ height: '100px', resize: 'vertical', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    <div className="gothic-input-group">
                      <label className="gothic-label">Dossiê e Descrição Biográfica</label>
                      <textarea
                        className="gothic-input"
                        placeholder="Uma breve introdução descritiva para narrar na mesa..."
                        value={selectedLibraryNpc.description || ''}
                        onChange={(e) => handleUpdateLibraryNpc('description', e.target.value)}
                        style={{ height: '80px', resize: 'vertical', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '6rem 2rem', border: '1px dashed var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '3rem' }}>🐉</span>
                    <span>Selecione uma criatura arcanas na barra esquerda ou evoque um novo NPC para moldar seus atributos e ataques permanentemente.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="occult-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border-light)', padding: '1.5rem' }}>
              <button type="button" className="btn-occult" onClick={() => setIsBestiaryOpen(false)}>
                Concluído
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hidden file inputs for JSON import */}
      <input
        type="file"
        id="lobby-npc-import-input"
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleImportNpcsJson}
      />
      <input
        type="file"
        id="modal-npc-import-input"
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleImportNpcsJson}
      />

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
