'use client';

import React from 'react';
import { 
  calculateHPMax, 
  calculateMPMax, 
  calculateSanityMax, 
  calculateDodgeBase,
  calculateOwnLanguageBase,
  calculateMovementRate 
} from '../lib/formulas';

interface InvestigatorGeneralProps {
  character: any;
  onChange: (field: string, value: any) => void;
  onRollClick: (name: string, value: number) => void;
}

export default function InvestigatorGeneral({
  character,
  onChange,
  onRollClick
}: InvestigatorGeneralProps) {

  const handleStatChange = (stat: string, val: number) => {
    const newVal = Math.max(0, Math.min(99, val));
    onChange(stat, newVal);

    // Auto-calculating derived vitals if auto_calc is active
    const autoCalc = true; // Enabled by default
    if (autoCalc) {
      if (stat === 'con' || stat === 'siz') {
        const conVal = stat === 'con' ? newVal : (character.con || 0);
        const sizVal = stat === 'siz' ? newVal : (character.siz || 0);
        const hpMax = calculateHPMax(conVal, sizVal);
        onChange('hp_max', hpMax);
        if ((character.hp_current || 0) > hpMax || character.hp_current === character.hp_max) {
          onChange('hp_current', hpMax);
        }
      }
      if (stat === 'pow') {
        const mpMax = calculateMPMax(newVal);
        onChange('mp_max', mpMax);
        if ((character.mp_current || 0) > mpMax || character.mp_current === character.mp_max) {
          onChange('mp_current', mpMax);
        }
        const sanMax = calculateSanityMax(newVal);
        onChange('san_max', sanMax);
        if ((character.san_current || 0) > sanMax || character.san_current === character.san_max) {
          onChange('san_current', sanMax);
        }
      }
    }
  };

  const handleAdjustVital = (field: string, delta: number, maxField: string) => {
    const current = character[field] || 0;
    const max = character[maxField] || 99;
    const nextVal = Math.max(0, Math.min(max, current + delta));
    onChange(field, nextVal);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange('image', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Derive stats for display
  const dodgeVal = calculateDodgeBase(character.dex || 50);
  const ownLangVal = calculateOwnLanguageBase(character.edu || 50);
  const movVal = calculateMovementRate(character.str || 50, character.dex || 50, character.siz || 50, character.age || 25);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Vitals HUD (Hp, Mp, Sanity) */}
      <div className="vitals-grid">
        <div className="vital-card hp occult-card">
          <div className="vital-title">Pontos de Vida (PV)</div>
          <div className="vital-value">
            {character.hp_current ?? 10} / {character.hp_max ?? 10}
          </div>
          <div className="vital-inputs">
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('hp_current', -1, 'hp_max')}>-</button>
            <button type="button" className="vital-btn" onClick={() => handleRollAttribute('Vida (PV)', character.hp_current || 0)}>🎲</button>
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('hp_current', 1, 'hp_max')}>+</button>
          </div>
          <div className="vital-bar-container">
            <div className="vital-bar" style={{ width: `${Math.min(100, ((character.hp_current ?? 10) / (character.hp_max ?? 10)) * 100)}%` }}></div>
          </div>
        </div>

        <div className="vital-card mp occult-card">
          <div className="vital-title">Pontos de Magia (PM)</div>
          <div className="vital-value">
            {character.mp_current ?? 10} / {character.mp_max ?? 10}
          </div>
          <div className="vital-inputs">
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('mp_current', -1, 'mp_max')}>-</button>
            <button type="button" className="vital-btn" onClick={() => handleRollAttribute('Magia (PM)', character.mp_current || 0)}>🎲</button>
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('mp_current', 1, 'mp_max')}>+</button>
          </div>
          <div className="vital-bar-container">
            <div className="vital-bar" style={{ width: `${Math.min(100, ((character.mp_current ?? 10) / (character.mp_max ?? 10)) * 100)}%` }}></div>
          </div>
        </div>

        <div className="vital-card san occult-card">
          <div className="vital-title">Sanidade (SAN)</div>
          <div className="vital-value">
            {character.san_current ?? 50} / {character.san_max ?? 99}
          </div>
          <div className="vital-inputs">
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('san_current', -1, 'san_max')}>-</button>
            <button type="button" className="vital-btn" onClick={() => handleRollAttribute('Sanidade (SAN)', character.san_current || 0)}>🎲</button>
            <button type="button" className="vital-btn" onClick={() => handleAdjustVital('san_current', 1, 'san_max')}>+</button>
          </div>
          <div className="vital-bar-container">
            <div className="vital-bar" style={{ width: `${Math.min(100, ((character.san_current ?? 50) / (character.san_max ?? 99)) * 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Grid of Main Attributes */}
      <div className="attributes-grid">
        {[
          { label: 'FOR (Força)', key: 'str' },
          { label: 'DES (Destreza)', key: 'dex' },
          { label: 'INT (Inteligência)', key: 'int_val' },
          { label: 'CON (Constituição)', key: 'con' },
          { label: 'APA (Aparência)', key: 'app' },
          { label: 'POD (Poder)', key: 'pow' },
          { label: 'TAM (Tamanho)', key: 'siz' },
          { label: 'EDU (Educação)', key: 'edu' },
          { label: 'SOR (Sorte)', key: 'luck' },
        ].map((attr) => {
          const val = character[attr.key] ?? 50;
          return (
            <div key={attr.key} className="attr-card glass-panel" style={{ cursor: 'pointer' }}>
              <div className="attr-label" onClick={() => onRollClick(attr.label.split(' ')[0], val)}>
                {attr.label.split(' ')[0]} 🎲
              </div>
              <input
                type="number"
                className="attr-main-input"
                value={val}
                onChange={(e) => handleStatChange(attr.key, parseInt(e.target.value, 10) || 0)}
              />
              <div className="attr-subs">
                <div className="attr-sub-box">
                  <span className="attr-sub-val">{Math.floor(val / 2)}</span>
                  <span>1/2</span>
                </div>
                <div className="attr-sub-box">
                  <span className="attr-sub-val">{Math.floor(val / 5)}</span>
                  <span>1/5</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile & Biography panel */}
      <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Profile Image card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            height: '200px',
            border: '1px solid var(--border-crimson)',
            borderRadius: '8px',
            background: character.image ? `url(${character.image}) center/cover no-repeat` : 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {!character.image && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sem Imagem</span>}
          </div>
          <div style={{ width: '100%' }}>
            <label className="btn-occult-secondary" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', padding: '0.5rem', fontSize: '0.8rem' }}>
              Carregar Foto
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
          <input
            type="text"
            className="gothic-input"
            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
            placeholder="Ou Cole o Link da Imagem..."
            value={character.image || ''}
            onChange={(e) => onChange('image', e.target.value)}
          />
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="gothic-input-group">
            <label className="gothic-label">Nome do Investigador</label>
            <input
              type="text"
              className="gothic-input"
              value={character.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Jogador</label>
            <input
              type="text"
              className="gothic-input"
              value={character.player || ''}
              onChange={(e) => onChange('player', e.target.value)}
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Ocupação</label>
            <input
              type="text"
              className="gothic-input"
              value={character.occupation || ''}
              onChange={(e) => onChange('occupation', e.target.value)}
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Idade</label>
            <input
              type="number"
              className="gothic-input"
              value={character.age ?? 25}
              onChange={(e) => onChange('age', parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Gênero</label>
            <input
              type="text"
              className="gothic-input"
              value={character.gender || ''}
              onChange={(e) => onChange('gender', e.target.value)}
            />
          </div>

          <div className="gothic-input-group">
            <label className="gothic-label">Local de Nascimento</label>
            <input
              type="text"
              className="gothic-input"
              value={character.birthplace || ''}
              onChange={(e) => onChange('birthplace', e.target.value)}
            />
          </div>

          <div className="gothic-input-group" style={{ gridColumn: 'span 2' }}>
            <label className="gothic-label">Residência Atual</label>
            <input
              type="text"
              className="gothic-input"
              value={character.residence || ''}
              onChange={(e) => onChange('residence', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Derived Combat Vitals Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="gothic-label">Esquiva Base</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-gold)', marginTop: '0.25rem' }}>
            {dodgeVal}%
          </div>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="gothic-label">Idioma Próprio Base</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-gold)', marginTop: '0.25rem' }}>
            {ownLangVal}%
          </div>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div className="gothic-label">Movimento (TAXA)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-gold)', marginTop: '0.25rem' }}>
            {movVal}
          </div>
        </div>
      </div>
    </div>
  );

  function handleRollAttribute(name: string, val: number) {
    onRollClick(name, val);
  }
}
