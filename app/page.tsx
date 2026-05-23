'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import InvestigatorGeneral from '../components/InvestigatorGeneral';
import InvestigatorSkills from '../components/InvestigatorSkills';
import InvestigatorCombat from '../components/InvestigatorCombat';
import InvestigatorBackstory from '../components/InvestigatorBackstory';
import FloatingCampaignDrawer from '../components/FloatingCampaignDrawer';
import DiceRollerModal from '../components/DiceRollerModal';
import Link from 'next/link';

const LOCAL_DEFAULT_SKILLS = [
  { name: 'Accounting (Contabilidade)', base: 5 },
  { name: 'Anthropology (Antropologia)', base: 1 },
  { name: 'Appraise (Avaliar)', base: 5 },
  { name: 'Archaeology (Arqueologia)', base: 1 },
  { name: 'Art/Craft (Arte/Artesanato)', base: 5 },
  { name: 'Charm (Charme)', base: 15 },
  { name: 'Climb (Escalar)', base: 20 },
  { name: 'Computer Use (Computador)', base: 5 },
  { name: 'Credit Rating (Crédito)', base: 0 },
  { name: 'Cthulhu Mythos (Mitos de Cthulhu)', base: 0 },
  { name: 'Demolitions (Demolições)', base: 1 },
  { name: 'Disguise (Disfarce)', base: 5 },
  { name: 'Diving (Mergulho)', base: 1 },
  { name: 'Dodge (Esquivar)', base: 0 },
  { name: 'Drive Auto (Dirigir)', base: 20 },
  { name: 'Elec. Repair (Rep. Elétrica)', base: 10 },
  { name: 'Electronics (Eletrônica)', base: 1 },
  { name: 'Fast Talk (Conversa Fiada)', base: 5 },
  { name: 'Fighting (Brawl) (Luta)', base: 25 },
  { name: 'Firearms (Handgun) (Pistola)', base: 20 },
  { name: 'Firearms (Rifle/Shotgun) (Rifle)', base: 25 },
  { name: 'Firearms (Submachine Gun) (Submetralhadora)', base: 15 },
  { name: 'First Aid (Primeiros Socorros)', base: 30 },
  { name: 'History (História)', base: 5 },
  { name: 'Intimidate (Intimidar)', base: 15 },
  { name: 'Jump (Saltar)', base: 20 },
  { name: 'Language (Other) (Idioma - Outro)', base: 1 },
  { name: 'Language (Own) (Idioma - Próprio)', base: 0 },
  { name: 'Law (Direito)', base: 5 },
  { name: 'Library Use (Pesquisa em Biblioteca)', base: 20 },
  { name: 'Listen (Ouvir)', base: 20 },
  { name: 'Locksmith (Ladrão de Cofres)', base: 1 },
  { name: 'Mech. Repair (Rep. Mecânica)', base: 10 },
  { name: 'Medicine (Medicina)', base: 1 },
  { name: 'Natural World (Mundo Natural)', base: 10 },
  { name: 'Navigate (Navegação)', base: 10 },
  { name: 'Occult (Ocultismo)', base: 5 },
  { name: 'Op. Heavy Machinery (Op. Máq. Pesada)', base: 1 },
  { name: 'Persuade (Persuadir)', base: 10 },
  { name: 'Photography (Fotografia)', base: 1 },
  { name: 'Pilot (Pilotagem)', base: 1 },
  { name: 'Psychology (Psicologia)', base: 10 },
  { name: 'Psychoanalysis (Psicanálise)', base: 1 },
  { name: 'Read Lips (Leitura Labial)', base: 1 },
  { name: 'Ride (Equitação)', base: 5 },
  { name: 'Science (Biology) (Biologia)', base: 1 },
  { name: 'Science (Botany) (Botânica)', base: 1 },
  { name: 'Science (Chemistry) (Química)', base: 1 },
  { name: 'Science (Cryptography) (Criptografia)', base: 1 },
  { name: 'Science (Engineering) (Engenharia)', base: 1 },
  { name: 'Science (Forensics) (Forense)', base: 1 },
  { name: 'Science (Geology) (Geologia)', base: 1 },
  { name: 'Science (Mathematics) (Matemática)', base: 1 },
  { name: 'Science (Meteorology) (Meteorologia)', base: 1 },
  { name: 'Science (Pharmacy) (Farmácia)', base: 1 },
  { name: 'Science (Physics) (Física)', base: 1 },
  { name: 'Science (Zoology) (Zoologia)', base: 1 },
  { name: 'Sleight of Hand (Prestidigitação)', base: 10 },
  { name: 'Spot Hidden (Detectar)', base: 25 },
  { name: 'Stealth (Furtividade)', base: 20 },
  { name: 'Survival (Sobrevivência)', base: 10 },
  { name: 'Swim (Nadar)', base: 20 },
  { name: 'Throw (Arremesso)', base: 20 },
  { name: 'Track (Rastrear)', base: 10 },
];

function getLocalDefaultSkills(dex: number, edu: number) {
  return LOCAL_DEFAULT_SKILLS.map((skill, idx) => {
    let base = skill.base;
    if (skill.name.includes('Dodge')) base = Math.floor(dex / 2);
    if (skill.name.includes('Language (Own)')) base = edu;
    const isOcc = skill.name.includes('Credit Rating') ? 1 : 0;
    return {
      id: idx + 1,
      name: skill.name,
      base_value: base,
      value: base,
      is_occupation: isOcc,
      is_interest: 0,
      occ_points: 0,
      int_points: 0,
      game_points: 0
    };
  });
}

function generateLocalUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

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

  // Quick Campaign Join State
  const [quickJoinCode, setQuickJoinCode] = useState('');

  // Hidden file input for JSON import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnonymous = user?.id === -1;

  // Load characters and friends list
  const loadSidebarData = async () => {
    if (isAnonymous) {
      try {
        const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
        const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
        setCharacters(anonChars);
        setFriends([]);
      } catch (err) {
        console.error('Erro ao carregar fichas anônimas:', err);
      }
      return;
    }

    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
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

  // Load companions inside campaign if selected character has session, else fallback to standard friends list
  useEffect(() => {
    if (isAnonymous) {
      setFriends([]);
      return;
    }

    if (character?.session?.id) {
      fetch(`/api/sessions/${character.session.id}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch session companions');
        })
        .then(data => {
          const companions = (data.characters || [])
            .filter((c: any) => c.id !== selectedCharId)
            .map((c: any) => ({
              ...c,
              is_friend: 1 // treat as read-only companion sheet
            }));
          setFriends(companions);
        })
        .catch(err => {
          console.error('Error fetching campaign companions:', err);
        });
    } else {
      // Standard friends list
      fetch('/api/characters?friends=true')
        .then(res => {
          if (res.ok) return res.json();
          return [];
        })
        .then(data => {
          setFriends(data);
        })
        .catch(err => {
          console.error('Error fetching friends:', err);
        });
    }
  }, [selectedCharId, character?.session?.id, isAnonymous]);

  // Fetch full character sheet details when selected
  useEffect(() => {
    if (!selectedCharId) {
      setCharacter(null);
      return;
    }

    if (isAnonymous) {
      try {
        const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
        const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
        const found = anonChars.find((c: any) => c.id === selectedCharId);
        setCharacter(found || null);
      } catch (err) {
        console.error(err);
      }
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
  }, [selectedCharId, isAnonymous]);

  // Polling Hook for live updates - Typing-safe check
  useEffect(() => {
    if (isAnonymous || !selectedCharId) return;

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
  }, [selectedCharId, isAnonymous]);

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
    if (isAnonymous) {
      const newCharId = Date.now();
      const dex = 50;
      const edu = 50;
      const newCharObj = {
        id: newCharId,
        uuid: generateLocalUUID(),
        name: 'Novo Investigador Anônimo',
        player: '',
        occupation: '',
        age: 25,
        gender: '',
        residence: '',
        birthplace: '',
        str: 50, dex, int_val: 50, con: 50, app: 50, pow: 50, siz: 50, edu, luck: 50,
        hp_max: 10, hp_current: 10,
        mp_max: 10, mp_current: 10,
        san_max: 250, san_current: 250,
        appearance_desc: '', ideology: '', significant_people: '', meaningful_locations: '',
        treasured_possessions: '', traits: '', injuries_scars: '', phobias_manias: '',
        arcane_tomes: '', backstory: '', notes: '', image: '', cash: '', assets: '', spending_level: '',
        skills: getLocalDefaultSkills(dex, edu),
        weapons: [],
        possessions: [],
        updated_at: new Date().toISOString()
      };
      try {
        const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
        const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
        anonChars.push(newCharObj);
        localStorage.setItem('cutchulo_anon_characters', JSON.stringify(anonChars));
        loadSidebarData();
        setSelectedCharId(newCharId);
        setActiveTab('general');
      } catch (err) {
        console.error(err);
      }
      return;
    }

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

    if (isAnonymous) {
      try {
        const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
        const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
        const filtered = anonChars.filter((c: any) => c.id !== character.id);
        localStorage.setItem('cutchulo_anon_characters', JSON.stringify(filtered));
        setSelectedCharId(null);
        loadSidebarData();
      } catch (err) {
        console.error(err);
      }
      return;
    }

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
    const updated = { ...character, [field]: value, updated_at: new Date().toISOString() };
    setCharacter(updated);

    if (isAnonymous) {
      try {
        const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
        const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
        const updatedList = anonChars.map((c: any) => c.id === character.id ? updated : c);
        localStorage.setItem('cutchulo_anon_characters', JSON.stringify(updatedList));
      } catch (err) {
        console.error(err);
      }
      return;
    }

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
    
    if (isAnonymous) {
      const exportData = {
        version: 3,
        exportedAt: new Date().toISOString(),
        character: {
          ...character,
          skills: character.skills || [],
          weapons: character.weapons || [],
          possessions: character.possessions || []
        }
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ficha_${character.name.replace(/\s+/g, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
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
    }
  };

  const handleImportSheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Recursive helper to unpack character from any nested structure
        const extractCharacter = (obj: any): any => {
          if (!obj) return null;
          if (obj.character && typeof obj.character === 'object') {
            const inner = extractCharacter(obj.character);
            if (inner && inner.name) return inner;
          }
          if (obj.name) return obj;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = extractCharacter(item);
              if (found) return found;
            }
          }
          for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
              const found = extractCharacter(obj[key]);
              if (found && found.name) return found;
            }
          }
          return null;
        };

        const unpackedChar = extractCharacter(json);
        if (!unpackedChar || !unpackedChar.name) {
          alert('JSON inválido: campo "character" ou "name" obrigatório no arquivo JSON');
          return;
        }

        if (isAnonymous) {
          const anonCharsStr = localStorage.getItem('cutchulo_anon_characters');
          const anonChars = anonCharsStr ? JSON.parse(anonCharsStr) : [];
          
          const newId = anonChars.length > 0 ? Math.max(...anonChars.map((c: any) => c.id)) + 1 : 1;
          const newUuid = unpackedChar.uuid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));

          const importedChar = {
            ...unpackedChar,
            id: newId,
            uuid: newUuid,
            skills: unpackedChar.skills || [],
            weapons: unpackedChar.weapons || [],
            possessions: unpackedChar.possessions || []
          };

          const existingIndex = anonChars.findIndex((c: any) => c.uuid === newUuid);
          if (existingIndex > -1) {
            anonChars[existingIndex] = importedChar;
          } else {
            anonChars.push(importedChar);
          }

          localStorage.setItem('cutchulo_anon_characters', JSON.stringify(anonChars));
          alert('Grimório de Ficha importado com sucesso localmente!');
          
          setCharacters(anonChars);
          setSelectedCharId(importedChar.id);
          setCharacter(importedChar);
        } else {
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
          {!selectedCharId && (
            <>
              <button type="button" className="btn-occult" style={{ padding: '0.75rem', fontSize: '0.8rem', textAlign: 'center', justifyContent: 'center' }} onClick={handleCreateInvestigator}>
                + Criar Investigador
              </button>
              
              <button type="button" className="btn-occult-secondary" style={{ padding: '0.6rem', fontSize: '0.75rem', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                📥 Importar Ficha JSON
              </button>
            </>
          )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Character Avatar Thumbnail */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '8px',
                  border: '2px solid var(--border-gold)',
                  background: character.image ? `url(${character.image}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(140,12,16,0.3), rgba(0,0,0,0.6))',
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(229,169,59,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }} >
                  {!character.image && <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>👤</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <h1 style={{ fontSize: '1.5rem', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {character.name}
                    {character.is_friend === 1 && <span style={{ fontSize: '0.7rem', background: 'rgba(229,169,59,0.15)', color: 'var(--text-gold)', border: '1px solid var(--border-gold)', borderRadius: '4px', padding: '0.1rem 0.5rem' }}>Leitura</span>}
                  </h1>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {character.occupation || 'Sem Ocupação'} · {character.age} Anos
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn-occult btn-cyan" onClick={handleCopyPublicShareLink} style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem' }}>
                  Compartilhar
                </button>
                <button type="button" className="btn-occult-secondary" onClick={handleExportSheet} style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem' }}>
                  Exportar JSON
                </button>
                {character.is_friend !== 1 && (
                  <button type="button" className="btn-occult" style={{ background: 'var(--primary-crimson)', borderColor: 'var(--primary-crimson-glow)', padding: '0.5rem 0.8rem', fontSize: '0.75rem' }} onClick={handleDeleteInvestigator}>
                    Excluir Ficha
                  </button>
                )}
              </div>
            </div>

            {/* Quick Campaign Join / Status Bar */}
            {!isAnonymous && character.is_friend !== 1 && (
              <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1.25rem', borderColor: character.session ? 'var(--accent-cyan)' : 'var(--border-light)', borderWidth: '1px', borderStyle: 'solid' }}>
                {character.session ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                          {character.session.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Código: <strong style={{ color: 'var(--text-crimson)' }}>{character.session.code}</strong> · Mestre: {character.session.gm_username}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {character.session.roll20_url && (
                        <a
                          href={character.session.roll20_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-occult"
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.7rem',
                            background: 'linear-gradient(135deg, var(--accent-gold) 0%, #b8860b 100%)',
                            color: '#000',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            textDecoration: 'none'
                          }}
                        >
                          🎲 Abrir Roll20
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-occult-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-crimson)' }}
                        onClick={async () => {
                          if (!confirm('Deseja desvincular seu investigador desta campanha?')) return;
                          try {
                            const res = await fetch('/api/sessions/join', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ characterId: character.id }),
                            });
                            if (res.ok) {
                              // Refresh character to clear session info
                              const charRes = await fetch(`/api/characters/${character.id}`);
                              if (charRes.ok) setCharacter(await charRes.json());
                            } else {
                              const err = await res.json();
                              alert(`Erro: ${err.error}`);
                            }
                          } catch (err) { console.error(err); }
                        }}
                      >
                        Sair da Campanha
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sem campanha vinculada</span>
                    <form
                      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!quickJoinCode.trim()) return;
                        try {
                          const res = await fetch('/api/sessions/join', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code: quickJoinCode.trim(), characterId: character.id }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setQuickJoinCode('');
                            // Refresh character to get session info
                            const charRes = await fetch(`/api/characters/${character.id}`);
                            if (charRes.ok) setCharacter(await charRes.json());
                          } else {
                            alert(`Erro: ${data.error}`);
                          }
                        } catch (err) { console.error(err); }
                      }}
                    >
                      <input
                        type="text"
                        className="gothic-input"
                        placeholder="Código (ex: CUTH42)"
                        value={quickJoinCode}
                        onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                        style={{ width: '140px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}
                        maxLength={6}
                      />
                      <button type="submit" className="btn-occult btn-cyan" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        Entrar na Campanha
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            {/* Sub-Tabs Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '2px solid var(--border-crimson)', paddingBottom: '0.5rem' }}>
              {[
                { label: 'Geral', key: 'general' },
                character.is_friend !== 1 && { label: 'Perícias', key: 'skills' },
                { label: 'Combate & Equipamentos', key: 'combat' },
                { label: 'Histórico & Dossiê', key: 'backstory' },
              ].filter(Boolean).map((tab: any) => (
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

      {/* Floating Side Drawer for Campaign (Chat, Grimoire, Library) */}
      {character && character.session && (
        <FloatingCampaignDrawer
          character={character}
          currentUser={user}
          onRollClick={triggerDiceRoll}
        />
      )}
    </div>
  );
}
