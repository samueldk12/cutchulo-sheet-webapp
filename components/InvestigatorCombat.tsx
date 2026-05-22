'use client';

import React, { useState, useEffect } from 'react';

interface Weapon {
  id: number;
  name: string;
  skill: string;
  damage: string;
  range: string;
  attacks_per_round: string;
  ammo: number;
  malfunction: number;
}

interface Possession {
  id: number;
  item: string;
}

interface CatalogWeapon {
  id: number;
  name: string;
  skill: string;
  damage: string;
  range: string;
  attacks_per_round: string;
  ammo: number;
  malfunction: number;
  category: string;
  notes: string;
}

interface InvestigatorCombatProps {
  characterId: number;
  weapons: Weapon[];
  possessions: Possession[];
  skills: any[];
  onAddWeapon: (weapon: Partial<Weapon>) => void;
  onUpdateWeapon: (weaponId: number, field: string, value: any) => void;
  onDeleteWeapon: (weaponId: number) => void;
  onAddPossession: (item: string) => void;
  onUpdatePossession: (possessionId: number, item: string) => void;
  onDeletePossession: (possessionId: number) => void;
  onRollClick: (name: string, value: number) => void;
  onDamageRoll: (expr: string, name: string) => void;
}

export default function InvestigatorCombat({
  characterId,
  weapons = [],
  possessions = [],
  skills = [],
  onAddWeapon,
  onUpdateWeapon,
  onDeleteWeapon,
  onAddPossession,
  onUpdatePossession,
  onDeletePossession,
  onRollClick,
  onDamageRoll
}: InvestigatorCombatProps) {
  const [catalog, setCatalog] = useState<CatalogWeapon[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [newPossessionItem, setNewPossessionItem] = useState('');

  // Fetch weapon catalog on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/weapon-catalog');
        if (res.ok) {
          const data = await res.json();
          setCatalog(data);
        }
      } catch (err) {
        console.error('Erro ao buscar catálogo de armas:', err);
      }
    };
    fetchCatalog();
  }, []);

  const handleRollWeaponHit = (w: Weapon) => {
    // Find the matching skill value or base
    const matchingSkill = skills.find(s => s.name.toLowerCase().includes(w.skill.toLowerCase()) || w.skill.toLowerCase().includes(s.name.toLowerCase()));
    const targetVal = matchingSkill ? (matchingSkill.base_value + matchingSkill.occ_points + matchingSkill.int_points + matchingSkill.game_points) : 25;
    onRollClick(w.name ? `Ataque com ${w.name}` : 'Ataque', targetVal);
  };

  const handleAddFromCatalog = async (cw: CatalogWeapon) => {
    onAddWeapon({
      name: cw.name,
      skill: cw.skill,
      damage: cw.damage,
      range: cw.range,
      attacks_per_round: cw.attacks_per_round,
      ammo: cw.ammo,
      malfunction: cw.malfunction
    });
    setShowCatalog(false);
  };

  const handleCreateEmptyWeapon = () => {
    onAddWeapon({
      name: 'Nova Arma',
      skill: 'Luta',
      damage: '1d4+DB',
      range: 'Toque',
      attacks_per_round: '1',
      ammo: 0,
      malfunction: 100
    });
  };

  const handleCreatePossession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPossessionItem.trim()) return;
    onAddPossession(newPossessionItem.trim());
    setNewPossessionItem('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '2rem' }}>
      
      {/* Active Weapons Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-crimson)' }}>Armas em Combate</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-occult-secondary" onClick={() => setShowCatalog(!showCatalog)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              {showCatalog ? 'Fechar Catálogo' : 'Adicionar do Catálogo'}
            </button>
            <button type="button" className="btn-occult" onClick={handleCreateEmptyWeapon} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              + Nova Arma
            </button>
          </div>
        </div>

        {/* Catalog Modal / Section */}
        {showCatalog && (
          <div className="glass-panel" style={{ border: '1px solid var(--accent-cyan)', background: 'rgba(5, 15, 20, 0.95)', animation: 'slideDown 0.3s ease' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '1rem' }}>Catálogo do Arsenal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {catalog.map(cw => (
                <div 
                  key={cw.id} 
                  className="interactive-list-item" 
                  style={{ gridTemplateColumns: '1fr auto', padding: '0.5rem', margin: 0, cursor: 'pointer' }}
                  onClick={() => handleAddFromCatalog(cw)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{cw.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{cw.damage} | Malf: {cw.malfunction}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-gold)' }}>+ Adicionar</span>
                </div>
              ))}
              {catalog.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nenhuma arma no catálogo.</span>}
            </div>
          </div>
        )}

        {/* Weapons List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Header Row */}
          <div className="interactive-list-item interactive-list-header" style={{ border: 'none', background: 'transparent' }}>
            <span>Nome da Arma</span>
            <span>Perícia</span>
            <span>Dano</span>
            <span>Alcance</span>
            <span>Munição</span>
            <span>Ações</span>
          </div>

          {weapons.map(w => (
            <div key={w.id} className="interactive-list-item">
              <input
                type="text"
                className="gothic-input"
                style={{ background: 'transparent', border: 'none', fontWeight: 'bold', padding: '0.25rem 0.5rem' }}
                value={w.name || ''}
                onChange={(e) => onUpdateWeapon(w.id, 'name', e.target.value)}
              />
              <input
                type="text"
                className="gothic-input"
                style={{ background: 'transparent', border: 'none', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)' }}
                value={w.skill || ''}
                onChange={(e) => onUpdateWeapon(w.id, 'skill', e.target.value)}
              />
              <input
                type="text"
                className="gothic-input"
                style={{ background: 'transparent', border: 'none', padding: '0.25rem 0.5rem', color: 'var(--text-crimson)' }}
                value={w.damage || ''}
                onChange={(e) => onUpdateWeapon(w.id, 'damage', e.target.value)}
              />
              <input
                type="text"
                className="gothic-input"
                style={{ background: 'transparent', border: 'none', padding: '0.25rem 0.5rem' }}
                value={w.range || ''}
                onChange={(e) => onUpdateWeapon(w.id, 'range', e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="number"
                  className="gothic-input"
                  style={{ background: 'transparent', border: 'none', padding: '0.25rem 0.5rem', textAlign: 'center', width: '40px' }}
                  value={w.ammo || 0}
                  onChange={(e) => onUpdateWeapon(w.id, 'ammo', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                <button type="button" title="Rolar Teste de Acerto" className="vital-btn" onClick={() => handleRollWeaponHit(w)}>🎯</button>
                <button type="button" title="Rolar Dano" className="vital-btn" onClick={() => onDamageRoll(w.damage, w.name)}>🎲</button>
                <button type="button" title="Deletar Arma" className="vital-btn" style={{ color: 'var(--text-crimson)' }} onClick={() => onDeleteWeapon(w.id)}>×</button>
              </div>
            </div>
          ))}

          {weapons.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', border: '1px dashed var(--border-light)', borderRadius: '6px' }}>
              Investigador desarmado. Use o botão acima para adicionar equipamentos.
            </div>
          )}
        </div>
      </div>

      {/* Possessions Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-gold)' }}>Pertences e Equipamentos</h2>

        <form onSubmit={handleCreatePossession} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="gothic-input"
            placeholder="Adicionar novo item..."
            value={newPossessionItem}
            onChange={(e) => setNewPossessionItem(e.target.value)}
          />
          <button type="submit" className="btn-occult" style={{ padding: '0.75rem 1rem' }}>+</button>
        </form>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
          {possessions.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <input
                type="text"
                className="gothic-input"
                style={{ background: 'transparent', border: 'none', flex: 1, padding: '0.2rem' }}
                value={p.item || ''}
                onChange={(e) => onUpdatePossession(p.id, e.target.value)}
              />
              <button 
                type="button" 
                className="vital-btn" 
                style={{ width: '24px', height: '24px', color: 'var(--text-crimson)' }} 
                onClick={() => onDeletePossession(p.id)}
              >
                ×
              </button>
            </div>
          ))}
          {possessions.length === 0 && (
            <span style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem', padding: '1rem' }}>
              Nenhum pertence registrado na mochila.
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
