'use client';

import React, { useState } from 'react';

interface Skill {
  id: number;
  name: string;
  base_value: number;
  value: number;
  is_occupation: number;
  is_interest: number;
  occ_points: number;
  int_points: number;
  game_points: number;
  checked?: boolean; // client-only recovery checkmark
}

interface InvestigatorSkillsProps {
  skills: Skill[];
  onSkillChange: (skillId: number, field: string, value: number) => void;
  onRollClick: (name: string, value: number) => void;
  isReadOnly?: boolean;
}

export default function InvestigatorSkills({
  skills = [],
  onSkillChange,
  onRollClick,
  isReadOnly = false
}: InvestigatorSkillsProps) {
  const [filterText, setFilterText] = useState('');
  const [activePointsTab, setActivePointsTab] = useState<'all' | 'occ' | 'int'>('all');

  const filteredSkills = skills.filter((s) => {
    const nameMatch = s.name.toLowerCase().includes(filterText.toLowerCase());
    if (!nameMatch) return false;
    
    if (activePointsTab === 'occ') return s.occ_points > 0 || s.is_occupation === 1;
    if (activePointsTab === 'int') return s.int_points > 0 || s.is_interest === 1;
    return true;
  });

  // Derived point totals
  const totalOcc = skills.reduce((sum, s) => sum + (s.occ_points || 0), 0);
  const totalInt = skills.reduce((sum, s) => sum + (s.int_points || 0), 0);

  const handlePointChange = (s: Skill, field: string, val: number) => {
    const newVal = Math.max(0, Math.min(99, val));
    onSkillChange(s.id, field, newVal);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* HUD de controle de pontos */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <span className="gothic-label" style={{ display: 'block', fontSize: '0.75rem' }}>Total Pontos Ocupação</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-gold)' }}>{totalOcc}</span>
          </div>
          <div>
            <span className="gothic-label" style={{ display: 'block', fontSize: '0.75rem' }}>Total Pontos Interesse</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-gold)' }}>{totalInt}</span>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '450px', justifyContent: 'flex-end' }}>
          <input
            type="text"
            className="gothic-input"
            style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: '200px' }}
            placeholder="Filtrar perícia..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <button
            type="button"
            className={`btn-occult-secondary ${activePointsTab === 'all' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActivePointsTab('all')}
          >
            Todas
          </button>
          <button
            type="button"
            className={`btn-occult-secondary ${activePointsTab === 'occ' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActivePointsTab('occ')}
          >
            Ocupação
          </button>
          <button
            type="button"
            className={`btn-occult-secondary ${activePointsTab === 'int' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={() => setActivePointsTab('int')}
          >
            Interesse
          </button>
        </div>
      </div>

      {/* Grid de Perícias */}
      <div className="skills-grid">
        {filteredSkills.map((s) => {
          const totalVal = (s.base_value || 0) + (s.occ_points || 0) + (s.int_points || 0) + (s.game_points || 0);
          
          return (
            <div key={s.id} className="skill-row">
              <div className="skill-name">
                <span 
                  onClick={() => onRollClick(s.name, totalVal)} 
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.2s ease'
                  }}
                  className="skill-name-clickable"
                  title="Clique para rolar teste desta perícia"
                >
                  {s.name} <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>🎲</span>
                </span>
              </div>

              <div className="skill-value-inputs">
                {/* Ocupação Points */}
                <input
                  type="number"
                  className="skill-main-input"
                  style={{ fontSize: '0.85rem', width: '42px', color: 'var(--text-gold)', opacity: s.occ_points > 0 ? 1 : 0.4 }}
                  title="Pontos de Ocupação"
                  value={s.occ_points || 0}
                  onChange={(e) => handlePointChange(s, 'occ_points', parseInt(e.target.value, 10) || 0)}
                  readOnly={isReadOnly}
                />

                {/* Interesse Points */}
                <input
                  type="number"
                  className="skill-main-input"
                  style={{ fontSize: '0.85rem', width: '42px', color: 'var(--accent-cyan)', opacity: s.int_points > 0 ? 1 : 0.4 }}
                  title="Pontos de Interesse"
                  value={s.int_points || 0}
                  onChange={(e) => handlePointChange(s, 'int_points', parseInt(e.target.value, 10) || 0)}
                  readOnly={isReadOnly}
                />

                {/* Game / Experiência Points */}
                <input
                  type="number"
                  className="skill-main-input"
                  style={{ fontSize: '0.85rem', width: '42px', color: 'var(--accent-green)', opacity: s.game_points > 0 ? 1 : 0.4 }}
                  title="Pontos de Experiência obtidos em jogo"
                  value={s.game_points || 0}
                  onChange={(e) => handlePointChange(s, 'game_points', parseInt(e.target.value, 10) || 0)}
                  readOnly={isReadOnly}
                />

                {/* Total Value Display */}
                <span style={{
                  fontSize: '1.05rem',
                  fontWeight: 'bold',
                  width: '45px',
                  textAlign: 'right',
                  color: totalVal > s.base_value ? 'var(--text-crimson)' : 'var(--text-primary)',
                  marginRight: '0.25rem'
                }}>
                  {totalVal}
                </span>

                {/* Subvalues half and fifth */}
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.25rem', width: '28px' }}>
                  <span>{Math.floor(totalVal / 2)}</span>
                  <span>{Math.floor(totalVal / 5)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredSkills.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          Nenhuma perícia encontrada correspondendo aos filtros.
        </div>
      )}
    </div>
  );
}
