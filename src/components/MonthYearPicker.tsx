'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface MonthYearPickerProps {
  label: string;
  value: string; // Formato "YYYY-MM", ex: "2026-01"
  onChange: (value: string) => void;
  minDate?: string;
}

const MESES = [
  { num: '01', nome: 'Janeiro', sigla: 'Jan' },
  { num: '02', nome: 'Fevereiro', sigla: 'Fev' },
  { num: '03', nome: 'Março', sigla: 'Mar' },
  { num: '04', nome: 'Abril', sigla: 'Abr' },
  { num: '05', nome: 'Maio', sigla: 'Mai' },
  { num: '06', nome: 'Junho', sigla: 'Jun' },
  { num: '07', nome: 'Julho', sigla: 'Jul' },
  { num: '08', nome: 'Agosto', sigla: 'Ago' },
  { num: '09', nome: 'Setembro', sigla: 'Set' },
  { num: '10', nome: 'Outubro', sigla: 'Out' },
  { num: '11', nome: 'Novembro', sigla: 'Nov' },
  { num: '12', nome: 'Dezembro', sigla: 'Dez' },
];

const ANOS_DISPONIVEIS = [2023, 2024, 2025, 2026, 2027, 2028];

export function MonthYearPicker({ label, value, onChange }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extrair Ano e Mês do valor atual (fallback para hoje se inválido)
  const today = new Date();
  const [valYearStr, valMonthStr] = (value || '').split('-');
  
  const selectedYear = parseInt(valYearStr) || today.getFullYear();
  const selectedMonth = valMonthStr || String(today.getMonth() + 1).padStart(2, '0');

  // Estado interno do ano sendo visualizado no seletor
  const [viewYear, setViewYear] = useState<number>(selectedYear);

  useEffect(() => {
    if (value) {
      const [y] = value.split('-');
      if (y) setViewYear(parseInt(y));
    }
  }, [value]);

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

  const handleSelectMonth = (monthNum: string) => {
    const newMonthStr = String(monthNum).padStart(2, '0');
    const newValue = `${viewYear}-${newMonthStr}`;
    onChange(newValue);
    setIsOpen(false);
  };

  // Texto formatado do botão (ex: "Janeiro / 2026")
  const currentMonthObj = MESES.find(m => m.num === selectedMonth);
  const triggerLabel = currentMonthObj
    ? `${currentMonthObj.nome} / ${selectedYear}`
    : `${selectedMonth}/${selectedYear}`;

  return (
    <div style={{ flex: 1, minWidth: '170px' }} ref={containerRef}>
      <label
        style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748b',
          marginBottom: '5px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>

      <div style={{ position: 'relative' }}>
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
            color: '#0f172a',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={15} style={{ color: '#2563eb' }} />
            <span>{triggerLabel}</span>
          </div>
          <ChevronDown
            size={15}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>

        {/* POPOVER DO SELETOR DE MÊS E ANO */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '6px',
              width: '280px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '16px',
              boxShadow: '0 20px 30px -10px rgba(15, 23, 42, 0.18)',
              zIndex: 99999,
              padding: '16px',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {/* NAVEGAÇÃO DE ANO */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => setViewYear(prev => prev - 1)}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={viewYear}
                  onChange={e => setViewYear(parseInt(e.target.value))}
                  style={{
                    border: 'none',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '14px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {ANOS_DISPONIVEIS.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setViewYear(prev => prev + 1)}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* GRADE DE 12 MESES */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              {MESES.map(m => {
                const isSelected = selectedYear === viewYear && selectedMonth === m.num;
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => handleSelectMonth(m.num)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '10px',
                      border: isSelected ? 'none' : '1px solid #f1f5f9',
                      background: isSelected
                        ? 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)'
                        : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = '#f0f7ff';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    {m.sigla}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
