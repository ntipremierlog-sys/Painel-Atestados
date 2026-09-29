'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PorMes {
  mes: string;
  perdaDiurna: number;
  perdaNoturna: number;
  dias: number;
  atestados: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return fmt(v);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '18px',
          padding: '16px 20px',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(255,255,255,0.8) inset',
          minWidth: '260px',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#0f172a',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '8px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{item.fullMonthLabel || label}</span>
          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#0284c7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
            {item.atestados} atest. · {item.dias}d
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
          {/* Diurno - Real Faturamento Não Realizado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #38bdf8, #0284c7)', display: 'inline-block', boxShadow: '0 2px 4px rgba(2,132,199,0.3)' }} />
              ☀️ Faturamento Não Realizado (Base):
            </span>
            <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '13.5px' }}>{fmt(item.perdaDiurna)}</span>
          </div>

          {/* Noturno - Cenário Alternativo */}
          {item.perdaNoturna > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #312e81, #1e1b4b)', display: 'inline-block', boxShadow: '0 2px 4px rgba(30,27,75,0.3)' }} />
                🌙 Projeção em Turno Noturno:
              </span>
              <span style={{ fontWeight: 800, color: '#1e1b4b' }}>{fmt(item.perdaNoturna)}</span>
            </div>
          )}

          <div
            style={{
              fontSize: '10.5px',
              color: '#64748b',
              paddingTop: '6px',
              borderTop: '1px dashed #e2e8f0',
              marginTop: '2px',
              lineHeight: 1.35,
            }}
          >
            * Valores representam cenários alternativos por jornada de 8h e não são somados para evitar duplicidade.
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Rótulo moderno estilo Badge Flutuante no topo da barra Diurna
const renderTopLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  const labelText = fmtK(value);
  const textWidth = labelText.length * 6.5;
  const pillWidth = Math.max(textWidth + 14, 54);

  return (
    <g>
      {/* Background Pill */}
      <rect
        x={x + width / 2 - pillWidth / 2}
        y={y - 24}
        width={pillWidth}
        height={20}
        rx={6}
        fill="#f0f9ff"
        stroke="#bae6fd"
        strokeWidth={1}
      />
      {/* Text */}
      <text
        x={x + width / 2}
        y={y - 13}
        fill="#0284c7"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: '11px', fontWeight: 800 }}
      >
        {labelText}
      </text>
    </g>
  );
};

export function TendenciaFinanceiraChart({ data }: { data: PorMes[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#94a3b8', padding: '50px', fontSize: '13px' }}>
        Nenhum dado para o período selecionado
      </div>
    );
  }

  const chartData = data.map(m => {
    const [anoStr, mesStr] = m.mes.split('-');
    const dateObj = new Date(parseInt(anoStr), parseInt(mesStr) - 1, 1);
    const sigla = format(dateObj, 'MMM/yy', { locale: ptBR });
    const label = sigla.charAt(0).toUpperCase() + sigla.slice(1);
    const fullMonthStr = format(dateObj, "MMMM 'de' yyyy", { locale: ptBR });
    const fullMonthLabel = fullMonthStr.charAt(0).toUpperCase() + fullMonthStr.slice(1);

    return {
      mes: m.mes,
      label,
      fullMonthLabel,
      perdaDiurna: m.perdaDiurna,
      perdaNoturna: m.perdaNoturna,
      atestados: m.atestados,
      dias: m.dias,
    };
  });

  return (
    <div style={{ width: '100%', height: 340, marginTop: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 32, right: 15, left: 15, bottom: 10 }} barGap={6}>
          <defs>
            {/* Gradiente Diurno (Azul Claro Vibrante / Cyan Sky) */}
            <linearGradient id="diurnoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
              <stop offset="100%" stopColor="#0284c7" stopOpacity={0.9} />
            </linearGradient>

            {/* Gradiente Noturno (Azul Escuro / Midnight Navy) */}
            <linearGradient id="noturnoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#312e81" stopOpacity={1} />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity={0.95} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
            dy={10}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={val => fmtK(val)}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
            width={70}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: '#f8fafc', rx: 12 }}
          />

          {/* Barras Lado a Lado (NÃO empilhadas), evitando duplicidade de soma */}
          <Bar
            dataKey="perdaDiurna"
            name="Faturamento Não Realizado (Diurno)"
            fill="url(#diurnoGrad)"
            maxBarSize={32}
            radius={[8, 8, 0, 0]}
          >
            <LabelList dataKey="perdaDiurna" content={renderTopLabel} />
          </Bar>

          <Bar
            dataKey="perdaNoturna"
            name="Projeção Turno Noturno"
            fill="url(#noturnoGrad)"
            maxBarSize={32}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
