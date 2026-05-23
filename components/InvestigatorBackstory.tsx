'use client';

import React from 'react';

interface InvestigatorBackstoryProps {
  character: any;
  onChange: (field: string, value: string) => void;
}

export default function InvestigatorBackstory({
  character,
  onChange
}: InvestigatorBackstoryProps) {
  
  const isFriend = character?.is_friend === 1;

  if (isFriend) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="gothic-label" style={{ color: 'var(--text-gold)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
              Descrição Pessoal
            </label>
            <textarea
              className="gothic-input"
              style={{ minHeight: '180px', background: 'rgba(0,0,0,0.3)', resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.4' }}
              placeholder="Nenhuma descrição pessoal registrada."
              value={character.appearance_desc || ''}
              readOnly
            />
          </div>
        </div>
      </div>
    );
  }

  const textareas = [
    { label: 'Descrição Pessoal', key: 'appearance_desc', placeholder: 'Aparência, estilo de se vestir, traços característicos...' },
    { label: 'Ideologia & Crenças', key: 'ideology', placeholder: 'Suas convicções espirituais ou filosóficas, atitude perante a vida...' },
    { label: 'Pessoas Importantes', key: 'significant_people', placeholder: 'Amigos, familiares, mentores, inimigos mortais...' },
    { label: 'Locais Significativos', key: 'meaningful_locations', placeholder: 'Sua casa de infância, um laboratório antigo, uma floresta sinistra...' },
    { label: 'Pertences Queridos', key: 'treasured_possessions', placeholder: 'Um relógio de bolso quebrado, um diário criptografado, um talismã...' },
    { label: 'Traços de Personalidade', key: 'traits', placeholder: 'Melancólico, corajoso, paranóico, obsessivo, cético...' },
    { label: 'Ferimentos & Cicatrizes', key: 'injuries_scars', placeholder: 'Cicatrizes de guerra, queimaduras sobrenaturais, traumas físicos...' },
    { label: 'Fobias & Manias', key: 'phobias_manias', placeholder: 'Medo de escuro, aracnofobia, mania de lavar as mãos constante...' },
    { label: 'Tomos Arcanos & Feitiços', key: 'arcane_tomes', placeholder: 'Textos necromânticos estudados, feitiços aprendidos...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 2-Column Grid for Backstory Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {textareas.map((ta) => (
          <div key={ta.key} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="gothic-label" style={{ color: 'var(--text-gold)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
              {ta.label}
            </label>
            <textarea
              className="gothic-input"
              style={{ minHeight: '80px', background: 'rgba(0,0,0,0.3)', resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.4' }}
              placeholder={ta.placeholder}
              value={character[ta.key] || ''}
              onChange={(e) => onChange(ta.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Narrative Backstory & General Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label className="gothic-label" style={{ color: 'var(--text-crimson)', borderBottom: '1px solid var(--border-crimson)', paddingBottom: '0.25rem' }}>
            História do Investigador
          </label>
          <textarea
            className="gothic-input"
            style={{ minHeight: '180px', background: 'rgba(0,0,0,0.3)', resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.4' }}
            placeholder="Como o investigador começou a estudar o desconhecido? Qual a sua história de vida?"
            value={character.backstory || ''}
            onChange={(e) => onChange('backstory', e.target.value)}
          />
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label className="gothic-label" style={{ color: 'var(--accent-cyan)', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '0.25rem' }}>
            Anotações Gerais & Pistas
          </label>
          <textarea
            className="gothic-input"
            style={{ minHeight: '180px', background: 'rgba(0,0,0,0.3)', resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.4' }}
            placeholder="Pistas reunidas, enigmas por resolver, suspeitos, teorias..."
            value={character.notes || ''}
            onChange={(e) => onChange('notes', e.target.value)}
          />
        </div>

      </div>

    </div>
  );
}
