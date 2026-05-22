'use client';

import React, { useState, useEffect } from 'react';

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId?: number | null;
  targetName?: string;
  targetValue?: number;
  defaultDiceType?: 'd100' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'custom';
  onRollComplete?: (roll: { expression: string; result: number; details: string }) => void;
}

export default function DiceRollerModal({
  isOpen,
  onClose,
  characterId = null,
  targetName = '',
  targetValue = 0,
  defaultDiceType,
  onRollComplete
}: DiceRollerModalProps) {
  const [diceType, setDiceType] = useState<'d100' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'custom'>('d100');
  const [customExpr, setCustomExpr] = useState('2d6+2');
  const [bonusDice, setBonusDice] = useState<number>(0); // -2 to +2
  const [manualTarget, setManualTarget] = useState<string>(targetValue > 0 ? String(targetValue) : '');
  const [manualTargetName, setManualTargetName] = useState<string>(targetName || '');
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [rollDetails, setRollDetails] = useState('');
  const [successLevel, setSuccessLevel] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setRollResult(null);
      setSuccessLevel('');
      setRollDetails('');
      setManualTarget(targetValue > 0 ? String(targetValue) : '');
      setManualTargetName(targetName || '');
      if (defaultDiceType) {
        setDiceType(defaultDiceType);
      } else if (targetValue > 0) {
        setDiceType('d100');
      }
    }
  }, [isOpen, targetValue, targetName, defaultDiceType]);

  if (!isOpen) return null;

  const performRoll = async () => {
    setIsRolling(true);
    setRollResult(null);
    setSuccessLevel('');
    
    // Quick rolling animation simulation
    await new Promise((resolve) => setTimeout(resolve, 800));

    let result = 0;
    let expr = '';
    let details = '';
    let level = '';

    const targetValNum = parseInt(manualTarget, 10);

    if (diceType === 'd100') {
      // CoC d100 roll
      const tens = Math.floor(Math.random() * 10) * 10;
      const units = Math.floor(Math.random() * 10);
      let baseRoll = tens + units;
      if (baseRoll === 0) baseRoll = 100;

      expr = '1d100';
      result = baseRoll;
      details = `Rolado: ${baseRoll}`;

      // Handle bonus / penalty dice
      if (bonusDice !== 0) {
        const extraTensList = [];
        for (let i = 0; i < Math.abs(bonusDice); i++) {
          let extraTens = Math.floor(Math.random() * 10) * 10;
          extraTensList.push(extraTens);
        }

        let chosenRoll = baseRoll;
        const allPossibleRolls = [baseRoll];
        
        extraTensList.forEach(t => {
          let potential = t + units;
          if (potential === 0) potential = 100;
          allPossibleRolls.push(potential);
        });

        if (bonusDice > 0) {
          // Choose best roll (lowest)
          chosenRoll = Math.min(...allPossibleRolls);
          details = `Dados de bônus: Rolo base ${baseRoll}, Extras de dezena [${extraTensList.join(', ')}]. Melhor rolo escolhido: ${chosenRoll}`;
        } else {
          // Choose worst roll (highest)
          chosenRoll = Math.max(...allPossibleRolls);
          details = `Dados de penalidade: Rolo base ${baseRoll}, Extras de dezena [${extraTensList.join(', ')}]. Pior rolo escolhido: ${chosenRoll}`;
        }
        result = chosenRoll;
      }

      // Check success levels
      if (!isNaN(targetValNum) && targetValNum > 0) {
        const isFumble = result === 100 || (targetValNum < 50 && result >= 96);
        if (result === 1) {
          level = 'Extremo'; // Critical Success in Portuguese RPG
          setSuccessLevel('success-extreme');
          details += ` | SUCESSO CRÍTICO!`;
        } else if (isFumble) {
          level = 'Desastre'; // Fumble in Portuguese RPG
          setSuccessLevel('success-fumble');
          details += ` | DESASTRE!`;
        } else if (result <= Math.floor(targetValNum / 5)) {
          level = 'Extremo';
          setSuccessLevel('success-extreme');
          details += ` (Extremo - 1/5 de ${targetValNum})`;
        } else if (result <= Math.floor(targetValNum / 2)) {
          level = 'Bom'; // Hard Success in Portuguese RPG
          setSuccessLevel('success-hard');
          details += ` (Bom - 1/2 de ${targetValNum})`;
        } else if (result <= targetValNum) {
          level = 'Normal';
          setSuccessLevel('success-regular');
          details += ` (Normal - <= ${targetValNum})`;
        } else {
          level = 'Fracasso';
          setSuccessLevel('success-fail');
          details += ` (Fracasso - > ${targetValNum})`;
        }
      }
    } else if (diceType === 'custom') {
      // Simple custom rolling parsing (e.g. 2d6+2)
      expr = customExpr.replace(/\s+/g, '').toLowerCase();
      const match = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/);
      if (match) {
        const qty = parseInt(match[1], 10);
        const sides = parseInt(match[2], 10);
        const mod = match[3] ? parseInt(match[3], 10) : 0;
        
        let rolls = [];
        let total = 0;
        for (let i = 0; i < qty; i++) {
          const r = Math.floor(Math.random() * sides) + 1;
          rolls.push(r);
          total += r;
        }
        total += mod;
        result = total;
        details = `Rolagem: [${rolls.join(', ')}] ${mod !== 0 ? (mod > 0 ? `+${mod}` : mod) : ''}`;
      } else {
        // Fallback simple roll
        result = Math.floor(Math.random() * 6) + 1;
        expr = '1d6';
        details = 'Expressão inválida. Rolando 1d6 padrão';
      }
    } else {
      // Standard single die (d4, d6, d8, d10, d12, d20)
      const sides = parseInt(diceType.substring(1), 10);
      result = Math.floor(Math.random() * sides) + 1;
      expr = `1${diceType}`;
      details = `Resultado do ${diceType}`;
    }

    setRollResult(result);
    setRollDetails(details);
    setIsRolling(false);

    // Save to Database via API
    try {
      await fetch('/api/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          expression: expr,
          result,
          details: `${manualTargetName ? `Teste de ${manualTargetName}: ` : ''}${details}`
        })
      });
    } catch (e) {
      console.error('Erro ao registrar histórico do dado:', e);
    }

    if (onRollComplete) {
      onRollComplete({ expression: expr, result, details });
    }
  };

  return (
    <div className="dice-modal-overlay">
      <div className="dice-modal occult-card">
        <div className="dice-modal-header">
          <h3 style={{ margin: 0, color: 'var(--text-gold)' }}>Ritual de Dados</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dice-modal-content">
          {/* Dice Selection Grid */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
            {['d100', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'custom'].map((t) => (
              <button
                key={t}
                onClick={() => setDiceType(t as any)}
                className={`btn-occult-secondary ${diceType === t ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Conditional inputs */}
          {diceType === 'd100' && (
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="gothic-input-group">
                <label className="gothic-label">Valor Alvo (Perícia)</label>
                <input
                  type="number"
                  className="gothic-input"
                  placeholder="Ex: 50"
                  value={manualTarget}
                  onChange={(e) => setManualTarget(e.target.value)}
                />
              </div>

              <div className="gothic-input-group">
                <label className="gothic-label">Dados de Bônus/Pen.</label>
                <select
                  className="gothic-select"
                  value={bonusDice}
                  onChange={(e) => setBonusDice(parseInt(e.target.value, 10))}
                >
                  <option value={-2}>-2 Penalidade</option>
                  <option value={-1}>-1 Penalidade</option>
                  <option value={0}>Nenhum</option>
                  <option value={1}>+1 Bônus</option>
                  <option value={2}>+2 Bônus</option>
                </select>
              </div>
            </div>
          )}

          {diceType === 'custom' && (
            <div className="gothic-input-group" style={{ width: '100%', marginBottom: '1rem' }}>
              <label className="gothic-label">Expressão Customizada</label>
              <input
                type="text"
                className="gothic-input"
                placeholder="Ex: 3d6+4"
                value={customExpr}
                onChange={(e) => setCustomExpr(e.target.value)}
              />
            </div>
          )}

          {/* Roll Button */}
          <button
            onClick={performRoll}
            className="btn-occult btn-cyan"
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
            disabled={isRolling}
          >
            {isRolling ? 'Sacudindo os Ossos...' : 'Conjurar Dados'}
          </button>

          {/* Results section */}
          {isRolling && (
            <div style={{ marginTop: '2rem', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="pulse-text" style={{ fontSize: '1.2rem', color: 'var(--text-crimson)', fontFamily: 'var(--font-gothic)' }}>
                Os deuses antigos decidem...
              </div>
            </div>
          )}

          {!isRolling && rollResult !== null && (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
              <div className="dice-roll-total">{rollResult}</div>
              
              {successLevel && (
                <div className={`dice-success-badge ${successLevel}`}>
                  {successLevel === 'success-extreme' && 'SUCESSO EXTREMO'}
                  {successLevel === 'success-hard' && 'SUCESSO BOM'}
                  {successLevel === 'success-regular' && 'SUCESSO NORMAL'}
                  {successLevel === 'success-fumble' && 'DESASTRE (FUMBLE)'}
                  {successLevel === 'success-fail' && 'FRACASSO'}
                </div>
              )}

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: '1.4' }}>
                {rollDetails}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
