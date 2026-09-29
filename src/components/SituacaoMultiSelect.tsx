'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface SituacaoMultiSelectProps {
  value: string[];
  onChange: (newValue: string[]) => void;
  availableOptions?: string[];
}

// Mapa de labels amigáveis para cada situação
const SITUACAO_LABELS: Record<string, string> = {
  'ATIVO': 'Ativos',
  'DEMITIDO': 'Demitidos',
  'FÉRIAS': 'Em Férias',
  'AVISO PRÉVIO': 'Aviso Prévio',
  'AF.PREVIDÊNCIA': 'Afastado (INSS)',
  'LICENÇA MATER.': 'Licença Maternidade',
};

// Cores/badges para cada situação
const SITUACAO_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  'ATIVO':          { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  'DEMITIDO':       { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  'FÉRIAS':         { bg: '#fefce8', color: '#a16207', dot: '#eab308' },
  'AVISO PRÉVIO':   { bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  'AF.PREVIDÊNCIA': { bg: '#f5f3ff', color: '#7c3aed', dot: '#8b5cf6' },
  'LICENÇA MATER.': { bg: '#fdf4ff', color: '#9333ea', dot: '#c026d3' },
};

const DEFAULT_COLOR = { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };

function getSituacaoLabel(situacao: string): string {
  return SITUACAO_LABELS[situacao] ?? situacao.charAt(0).toUpperCase() + situacao.slice(1).toLowerCase();
}

export function SituacaoMultiSelect({
  value = ['TODOS'],
  onChange,
  availableOptions = ['ATIVO', 'DEMITIDO'],
}: SituacaoMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Considera "Todas as Situações" selecionado se o array estiver vazio ou contiver 'TODOS' / 'TODAS'
  const isAllSelected = value.length === 0 || value.includes('TODOS') || value.includes('TODAS');

  // Opções padrão consolidadas do banco de dados
  const defaultOptions = [
    'ATIVO',
    'DEMITIDO',
    'FÉRIAS',
    'AVISO PRÉVIO',
    'AF.PREVIDÊNCIA',
    'LICENÇA MATER.',
  ];

  const allOptions = Array.from(
    new Set([...defaultOptions, ...availableOptions])
  ).filter(Boolean);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (isAllSelected) {
      // Se estava em "Todas", selecionar apenas esta opção
      onChange([opt]);
    } else {
      if (value.includes(opt)) {
        const next = value.filter(v => v !== opt);
        // Se desmarcou tudo, voltar para TODOS
        onChange(next.length === 0 ? ['TODOS'] : next);
      } else {
        onChange([...value, opt]);
      }
    }
  };

  const selectAll = () => {
    onChange(['TODOS']);
    setIsOpen(false); // Fecha ao selecionar "Todas as Situações"
  };

  // Texto do botão principal — amigável e capitalizado
  const renderTriggerText = () => {
    if (isAllSelected) return 'Todas as Situações';
    if (value.length === 1) return getSituacaoLabel(value[0]);
    if (value.length === 2) return `${getSituacaoLabel(value[0])} + ${getSituacaoLabel(value[1])}`;
    return `${value.length} situações`;
  };

  return (
    <div className="input-group" ref={containerRef} style={{ position: 'relative', minWidth: '180px' }}>
      <label className="input-label">Situação</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '9px 12px',
          background: '#ffffff',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          borderRadius: '10px',
          fontSize: '13px',
          color: isAllSelected ? '#2563eb' : '#0f172a',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          textAlign: 'left',
          gap: '6px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {renderTriggerText()}
        </span>
        <ChevronDown
          size={15}
          style={{
            color: '#64748b',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '220px',
            width: 'max-content',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
            zIndex: 99999,
            padding: '6px',
          }}
        >
          {/* Cabeçalho do dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 8px',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Filtrar por Situação
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Fechar"
            >
              <X size={13} />
            </button>
          </div>

          {/* Opção "Todas as Situações" */}
          <div
            onClick={selectAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: isAllSelected ? 700 : 500,
              color: isAllSelected ? '#2563eb' : '#334155',
              background: isAllSelected ? '#eff6ff' : 'transparent',
              cursor: 'pointer',
              marginBottom: '2px',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={e => { if (!isAllSelected) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isAllSelected ? '#eff6ff' : 'transparent'; }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: isAllSelected ? 'none' : '1.5px solid #cbd5e1',
                background: isAllSelected ? '#2563eb' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {isAllSelected && <Check size={10} style={{ color: '#ffffff', strokeWidth: 3 }} />}
            </div>
            <span>Todas as Situações</span>
          </div>

          <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

          {/* Opções Individuais com Checkbox */}
          {allOptions.map(opt => {
            const isChecked = !isAllSelected && value.includes(opt);
            const colors = SITUACAO_COLORS[opt] ?? DEFAULT_COLOR;
            return (
              <div
                key={opt}
                onClick={() => toggleOption(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: isChecked ? 700 : 500,
                  color: isChecked ? '#0f172a' : '#334155',
                  background: isChecked ? '#f0f9ff' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                  marginBottom: '2px',
                }}
                onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isChecked ? '#f0f9ff' : 'transparent'; }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: isChecked ? 'none' : '1.5px solid #cbd5e1',
                    background: isChecked ? '#2563eb' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isChecked && <Check size={10} style={{ color: '#ffffff', strokeWidth: 3 }} />}
                </div>

                {/* Dot colorido por situação */}
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: colors.dot,
                    flexShrink: 0,
                  }}
                />

                {/* Label */}
                <span style={{ flex: 1 }}>{getSituacaoLabel(opt)}</span>

                {/* Badge com a situação original para referência */}
                {isChecked && (
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '99px',
                    background: colors.bg,
                    color: colors.color,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}

          {/* Rodapé: resumo da seleção e botão aplicar */}
          {!isAllSelected && (
            <div style={{
              borderTop: '1px solid #f1f5f9',
              marginTop: '4px',
              paddingTop: '8px',
              paddingLeft: '10px',
              paddingRight: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                {value.length} selecionada{value.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontWeight: 600,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#ffffff',
                    fontWeight: 700,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente auxiliar exportado: badge de situação colorido para usar nas tabelas
export function SituacaoBadge({ situacao }: { situacao: string }) {
  const colors = SITUACAO_COLORS[situacao] ?? DEFAULT_COLOR;
  const label = getSituacaoLabel(situacao);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '99px',
        fontSize: '11px',
        fontWeight: 700,
        background: colors.bg,
        color: colors.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: colors.dot,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
