'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  FileText, Calendar, MapPin, Activity, TrendingUp, Filter, RotateCcw, Download, Users, Clock, AlertTriangle, Stethoscope, Search, X, ArrowUpRight, Plus
} from 'lucide-react';
import { SituacaoMultiSelect } from '@/components/SituacaoMultiSelect';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#e11d48', '#10b981'];

interface DashboardData {
  dataInicioSelecionada?: string;
  dataFimSelecionada?: string;
  /** Indica que os rankings cobrem apenas os registros mais recentes (limite de memória) */
  rankingTruncado?: boolean;
  rankingLimite?: number;
  cards: {
    totalAtestados: number;
    totalDiasAfastado: number;
    mediaDiasPorAtestado: string;
    totalColabsAfastados: number;
    totalHorasAfastadas: number;
    secaoMaiorIncidencia: string;
    secaoMaiorQtd: number;
    cidMaisRecorrente: string;
    cidMaisQtd: number;
  };
  tendencia: { mes: string; label: string; atestados: number; dias: number }[];
  incidenciaPorDia: { dia: string; total: number }[];
  topSecoes: { secao: string; total: number; dias: number }[];
  rankingCID: { cid: string; total: number }[];
  rankingColaboradores: { id: number; nome: string; secao: string; totalAtestados: number; diasAfastado: number }[];
  cidCatalog?: Record<string, { codigo: string; descricao: string; grupo: string }>;
  filtros?: {
    dataInicio?: string;
    dataFim?: string;
    secoes: string[];
    mesesDisponiveis: string[];
    situacoes: string[];
  };
}

function formatNum(n: number) {
  return n ? n.toLocaleString('pt-BR') : '0';
}

const CustomTendenciaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const atestadosVal = payload.find((p: any) => p.dataKey === 'atestados')?.value || 0;
    const diasVal = payload.find((p: any) => p.dataKey === 'dias')?.value || 0;
    const media = atestadosVal > 0 ? (diasVal / atestadosVal).toFixed(1) : '0';

    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        minWidth: '230px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '10px' }}>
          Competência: {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1d4ed8' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#1d4ed8', display: 'inline-block' }} />
              Atestados Lançados:
            </span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{atestadosVal.toLocaleString('pt-BR')} atestado(s)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0284c7' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#0284c7', display: 'inline-block' }} />
              Dias Afastados:
            </span>
            <span style={{ fontWeight: 800, color: '#b45309' }}>{diasVal.toLocaleString('pt-BR')} dias</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
            <span>Média por atestado:</span>
            <span style={{ fontWeight: 700, color: '#334155' }}>{media} dias/atestado</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};


export default function DashboardPage() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const hasInitializedDates = useRef(false);
  const [secao, setSecao] = useState('');
  const [situacoes, setSituacoes] = useState<string[]>(['TODOS']);

  // Buscador Interativo de Seção (Combobox)
  const [secaoQuery, setSecaoQuery] = useState('');
  const [showSecaoDropdown, setShowSecaoDropdown] = useState(false);
  const secaoRef = useRef<HTMLDivElement>(null);

  // Sincronizar secao (filtro real da busca) com debounce ao digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      setSecao(secaoQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [secaoQuery]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (secaoRef.current && !secaoRef.current.contains(event.target as Node)) {
        setShowSecaoDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Consulta de CID modal
  const [showCidModal, setShowCidModal] = useState(false);
  const [cidSearchQuery, setCidSearchQuery] = useState('');
  const [dbCidSearchResults, setDbCidSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (!cidSearchQuery.trim()) {
      setDbCidSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cids?search=${encodeURIComponent(cidSearchQuery.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setDbCidSearchResults(json);
        }
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [cidSearchQuery]);

  const getCidInfo = (code: string) => {
    if (!code || code === 'Sem CID') return { descricao: 'Atestados registrados sem código CID informado', grupo: 'Não Especificado' };
    const clean = code.trim().toUpperCase();
    // Primeiro busca no catalog separado, depois no cidCatalog retornado pelo dashboard
    const fromSeparate = cidCatalog[clean];
    if (fromSeparate) return fromSeparate;
    if (!data?.cidCatalog) return { descricao: 'Classificação CID-10 OMS', grupo: 'OMS' };
    const direct = data.cidCatalog[clean];
    if (direct) return direct;
    const baseCode = clean.split('.')[0];
    return data.cidCatalog[baseCode] || cidCatalog[baseCode] || { descricao: 'Classificação CID-10 OMS', grupo: 'OMS' };
  };

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catálogo de CIDs carregado separadamente (endpoint /api/cids/catalogo)
  const [cidCatalog, setCidCatalog] = useState<Record<string, { codigo: string; descricao: string; grupo: string }>>({});
  const cidCatalogLoaded = useRef(false);

  // Carregar catálogo de CIDs uma única vez
  useEffect(() => {
    if (cidCatalogLoaded.current) return;
    cidCatalogLoaded.current = true;
    fetch('/api/cids/catalogo?limit=200')
      .then(r => r.ok ? r.json() : {})
      .then(catalog => setCidCatalog(catalog))
      .catch(() => {});
  }, []);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (secao) params.set('secao', secao);
    if (situacoes.length > 0) params.set('situacao', situacoes.join(','));

    fetch(`/api/dashboard?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`Erro ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then(d => {
        setData(d);
        if (!hasInitializedDates.current) {
          if (d.dataInicioSelecionada) setDataInicio(d.dataInicioSelecionada);
          if (d.dataFimSelecionada) setDataFim(d.dataFimSelecionada);
          hasInitializedDates.current = true;
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar dashboard:', err);
        setError('Não foi possível carregar os dados. Verifique a conexão e tente novamente.');
        setLoading(false);
      });
  }, [dataInicio, dataFim, secao, situacoes]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLimparFiltros = () => {
    const defaultInicio = data?.dataInicioSelecionada || data?.filtros?.dataInicio || '2026-01-01';
    const defaultFim = data?.dataFimSelecionada || data?.filtros?.dataFim || '2026-09-30';
    setDataInicio(defaultInicio);
    setDataFim(defaultFim);
    setSecao('');
    setSecaoQuery('');
    setSituacoes(['TODOS']);
  };

  const activeDataInicio = dataInicio || data?.dataInicioSelecionada || '';
  const activeDataFim = dataFim || data?.dataFimSelecionada || '';

  let periodoLabel = '';
  if (activeDataInicio && activeDataFim) {
    const dInicio = new Date(activeDataInicio + 'T12:00:00');
    const dFim = new Date(activeDataFim + 'T12:00:00');
    if (activeDataInicio === activeDataFim) {
      periodoLabel = format(dInicio, 'dd/MM/yyyy', { locale: ptBR });
    } else {
      periodoLabel = `${format(dInicio, 'dd/MM/yyyy', { locale: ptBR })} até ${format(dFim, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
  } else if (activeDataInicio) {
    const dInicio = new Date(activeDataInicio + 'T12:00:00');
    periodoLabel = `A partir de ${format(dInicio, 'dd/MM/yyyy', { locale: ptBR })}`;
  }

  return (
    <>
      {/* Donezo Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
            Gestão, inteligência e controle de absenteísmo com base CID OMS. <span style={{ color: '#94a3b8' }}>(Período: {periodoLabel})</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/atestados/novo" className="btn-pill-primary">
            <Plus size={16} />
            Lançar Atestado
          </a>
          {data && (
            <button
              className="btn-pill-secondary"
              onClick={async () => {
                const { exportDashboardToPDF } = await import('@/lib/exportUtils');
                exportDashboardToPDF(data, periodoLabel);
              }}
            >
              <Download size={15} />
              Exportar Relatório
            </button>
          )}
        </div>
      </div>

      <div>

        {/* BARRA DE FILTROS DONEZO STYLE */}
        <div className="filters-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '16px', alignItems: 'end', marginBottom: '24px' }}>
          
          <div className="input-group">
            <label className="input-label">Data Inicial</label>
            <input
              type="date"
              className="input"
              value={dataInicio}
              onChange={e => {
                const val = e.target.value;
                setDataInicio(val);
                if (val && dataFim && val > dataFim) {
                  setDataFim(val);
                }
              }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Data Final</label>
            <input
              type="date"
              className="input"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={e => {
                const val = e.target.value;
                setDataFim(val);
                if (val && dataInicio && val < dataInicio) {
                  setDataInicio(val);
                }
              }}
            />
          </div>

          {/* BUSCADOR DE SEÇÃO / UNIDADE (COMBOBOX INTERATIVO COM BUSCA POR TEXTO/NÚMERO) */}
          <div className="input-group" ref={secaoRef} style={{ position: 'relative' }}>
            <label className="input-label">Seção / Unidade</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                className="input"
                placeholder="Digitar nome ou nº da seção..."
                value={secaoQuery}
                onFocus={() => setShowSecaoDropdown(true)}
                onChange={e => {
                  setSecaoQuery(e.target.value);
                  setShowSecaoDropdown(true);
                }}
                style={{ paddingLeft: '32px', paddingRight: secaoQuery ? '30px' : '10px', fontSize: '13px' }}
              />
              {secaoQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSecaoQuery('');
                    setSecao('');
                    setShowSecaoDropdown(false);
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Limpar Seção"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* DROPDOWN DE SUGESTÕES DA SEÇÃO */}
            {showSecaoDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  zIndex: 9999,
                  padding: '4px 0',
                }}
              >
                <div
                  onClick={() => {
                    setSecaoQuery('');
                    setSecao('');
                    setShowSecaoDropdown(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#2563eb',
                    cursor: 'pointer',
                    background: !secaoQuery ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  Todas as Seções (Mostrar Tudo)
                </div>

                {(() => {
                  const filtered = (data?.filtros?.secoes || []).filter(s =>
                    s.toLowerCase().includes(secaoQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                        Buscando por "<strong>{secaoQuery}</strong>" no banco...
                      </div>
                    );
                  }

                  return filtered.map(s => (
                    <div
                      key={s}
                      onClick={() => {
                        setSecaoQuery(s);
                        setSecao(s);
                        setShowSecaoDropdown(false);
                      }}
                      style={{
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#1e293b',
                        cursor: 'pointer',
                        background: secaoQuery === s ? '#f0f9ff' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = secaoQuery === s ? '#f0f9ff' : 'transparent')}
                    >
                      {s}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          <SituacaoMultiSelect
            value={situacoes}
            onChange={setSituacoes}
            availableOptions={data?.filtros?.situacoes}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDataInicio('2026-01-01');
                setDataFim('2026-12-31');
              }}
              style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}
              title="Filtrar todo o ano de 2026"
            >
              Ano 2026
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLimparFiltros}
              style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '10px' }}
              title="Limpar filtros (Todo o Período)"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '16px 20px', borderRadius: '12px',
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', fontSize: '14px', fontWeight: 600, marginBottom: '16px',
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            {error}
            <button
              onClick={fetchDashboard}
              style={{ marginLeft: 'auto', padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Aviso de Truncamento de Rankings — exibido quando o período tem mais de 2.000 registros */}
            {data.rankingTruncado && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '16px',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, color: '#d97706' }} />
                <span>
                  <strong>Atenção — Rankings parciais:</strong> O período selecionado contém mais de{' '}
                  {(data.rankingLimite ?? 2000).toLocaleString('pt-BR')} registros. Os{' '}
                  <strong>totais (KPIs) são precisos</strong>, mas os rankings de seção, colaboradores e CIDs
                  cobrem apenas os {(data.rankingLimite ?? 2000).toLocaleString('pt-BR')} atestados mais recentes do período.
                  Aplique um filtro de data ou seção para resultados completos.
                </span>
              </div>
            )}

            {/* CARDS DE KPIS HARMONIOSOS */}
            <div className="kpi-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
              
              {/* KPI 1: Total Atestados */}
              <div className="donezo-stat-card" style={{ background: '#eff6ff', borderColor: '#dbeafe', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8' }}>
                      Total Atestados
                    </span>
                    <div className="arrow-circle-btn" style={{ background: '#dbeafe', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1.1, marginBottom: '6px' }}>
                    {formatNum(data.cards.totalAtestados)}
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>
                  No período filtrado
                </div>
              </div>

              {/* KPI 2: Total Dias Afastados */}
              <div className="donezo-stat-card" style={{ background: '#f0f3ff', borderColor: '#dbe2fe', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1e3a8a' }}>
                      Dias Afastados
                    </span>
                    <div className="arrow-circle-btn" style={{ background: '#dbe2fe', borderColor: '#bfdbfe', color: '#1e3a8a' }}>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#172554', lineHeight: 1.1, marginBottom: '6px' }}>
                    {formatNum(data.cards.totalDiasAfastado)}
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>
                  Equivalente a ~{formatNum(data.cards.totalHorasAfastadas)}h
                </div>
              </div>

              {/* KPI 3: Colaboradores Afastados */}
              <div className="donezo-stat-card" style={{ background: '#f0f7ff', borderColor: '#e0f2fe', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0369a1' }}>
                      Colaboradores
                    </span>
                    <div className="arrow-circle-btn" style={{ background: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1' }}>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1, marginBottom: '6px' }}>
                    {formatNum(data.cards.totalColabsAfastados)}
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 600 }}>
                  Pessoas únicas no período
                </div>
              </div>

              {/* KPI 4: Seção Com Mais Atestados */}
              <div className="donezo-stat-card" style={{ background: '#f4f7ff', borderColor: '#e0e8ff', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8' }}>
                      Maior Incidência
                    </span>
                    <div className="arrow-circle-btn" style={{ background: '#e0e8ff', borderColor: '#c7d2fe', color: '#1d4ed8' }}>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.25, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={data.cards.secaoMaiorIncidencia || '—'}>
                    {data.cards.secaoMaiorIncidencia || '—'}
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#3b82f6', fontWeight: 700 }}>
                  {data.cards.secaoMaiorQtd > 0 ? `${formatNum(data.cards.secaoMaiorQtd)} atestados` : 'Sem atestados'}
                </div>
              </div>

              {/* KPI 5: CID Mais Recorrente */}
              {(() => {
                const cidInfo = getCidInfo(data.cards.cidMaisRecorrente);
                return (
                  <div
                    className="donezo-stat-card"
                    title={`[${data.cards.cidMaisRecorrente}] ${cidInfo.descricao}\nGrupo OMS: ${cidInfo.grupo}`}
                    onClick={() => {
                      if (data.cards.cidMaisRecorrente && data.cards.cidMaisRecorrente !== '—') {
                        setCidSearchQuery(data.cards.cidMaisRecorrente);
                        setShowCidModal(true);
                      }
                    }}
                    style={{ background: '#eef2ff', borderColor: '#e0e7ff', padding: '20px', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3730a3' }}>
                          CID Recorrente
                        </span>
                        <div className="arrow-circle-btn" style={{ background: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3' }}>
                          <Stethoscope size={15} />
                        </div>
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#312e81', lineHeight: 1.1, marginBottom: '6px' }}>
                        {data.cards.cidMaisRecorrente || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#4f46e5', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cidInfo.descricao !== 'Classificação CID-10 OMS' ? cidInfo.descricao : 'Doença mais frequente'}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Gráficos linha 1 - Monocromático Azul */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {/* Tendência mensal */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} style={{ color: '#2563eb' }} />
                    Tendência — Histórico Mensal
                  </span>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: '8px' }} title="Barra Azul Escuro = Total de atestados emitidos no mês">
                      <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#1d4ed8', display: 'inline-block' }} />
                      Qtd. Atestados
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '3px 9px', borderRadius: '8px' }} title="Barra Azul Claro = Soma total de dias perdedores/afastados no mês">
                      <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#0284c7', display: 'inline-block' }} />
                      Dias Afastados
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.tendencia} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="colorSkyBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<CustomTendenciaTooltip />} />
                    <Bar dataKey="atestados" fill="url(#colorBlue)" radius={[6, 6, 0, 0]} name="Qtd. Atestados" />
                    <Bar dataKey="dias" fill="url(#colorSkyBlue)" radius={[6, 6, 0, 0]} name="Dias Afastados" />
                  </BarChart>
                </ResponsiveContainer>
              </div>


              {/* Atestados por Dia da Semana */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Incidência por Dia da Semana
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.incidenciaPorDia} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRoyalBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="colorSlateBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.85}/>
                        <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [value, 'Atestados']}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} name="Atestados">
                      {data.incidenciaPorDia.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.dia === 'Sábado' || entry.dia === 'Domingo' ? 'url(#colorSlateBlue)' : 'url(#colorRoyalBlue)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Atestados por seção */}
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-header">
                  <span className="card-title">
                    <MapPin size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Distribuição por Seção
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Clique na barra para detalhar</span>
                </div>
                {data.topSecoes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={data.topSecoes}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                      onClick={(state: any) => {
                        if (state && state.activePayload && state.activePayload.length > 0) {
                          const clickedSecao = state.activePayload[0].payload.secao;
                          setSecao(clickedSecao);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="colorIndigoNavy" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#1e3a8a" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.85}/>
                        </linearGradient>
                      </defs>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="secao" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                        width={120}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                        contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                        formatter={(value: any, name: any) => [value, name === 'total' ? 'Atestados' : 'Dias']}
                        itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="url(#colorIndigoNavy)" 
                        radius={[0, 6, 6, 0]} 
                        barSize={20}
                        style={{ cursor: 'pointer' }}
                        name="total"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <p>Sem dados de seções no período selecionado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tabelas de ranking */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {/* Ranking colaboradores */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <FileText size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Ranking — Top 10 Colaboradores com Mais Afastamentos
                  </span>
                </div>
                {data.rankingColaboradores.length > 0 ? (
                  <div style={{ marginTop: '-4px' }}>
                    {data.rankingColaboradores.slice(0, 10).map((c, i) => (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 0', borderBottom: i < data.rankingColaboradores.slice(0, 10).length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: i < 3 ? 'rgba(37, 99, 235, 0.1)' : '#f1f5f9',
                          color: i < 3 ? 'var(--accent-blue)' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: '700', flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.nome}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.secao}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{c.totalAtestados} atestados</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.diasAfastado} dias</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>Sem atestados no período</p></div>
                )}
              </div>

              {/* Ranking CID */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">
                    <Activity size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Ranking — Top 10 CIDs Recorrentes
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Passe o mouse no CID para o significado</span>
                </div>
                {data.rankingCID.length > 0 ? (
                  <div style={{ marginTop: '-4px' }}>
                    {data.rankingCID.slice(0, 10).map((c, i) => {
                      const info = getCidInfo(c.cid);
                      return (
                        <div key={c.cid} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 0', borderBottom: i < data.rankingCID.slice(0, 10).length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <span
                            title={`[${c.cid}] ${info.descricao}\nGrupo OMS: ${info.grupo}`}
                            onClick={() => {
                              if (c.cid && c.cid !== 'Sem CID') {
                                setCidSearchQuery(c.cid);
                                setShowCidModal(true);
                              }
                            }}
                            style={{
                              minWidth: '78px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: '#f0f9ff',
                              color: '#0284c7',
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <Stethoscope size={11} style={{ color: '#0284c7' }} />
                            {c.cid || 'Sem CID'}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`[${c.cid}] ${info.descricao}\nGrupo OMS: ${info.grupo}`}>
                              {info.descricao}
                            </div>
                            <div style={{
                              height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '4px',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${(c.total / data.rankingCID[0].total) * 100}%`,
                                background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                                borderRadius: '3px',
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>

                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', minWidth: '32px', textAlign: 'right', flexShrink: 0 }}>
                            {c.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state"><p>Sem registros de CID no período</p></div>
                )}
              </div>
            </div>

            {/* Modal de Consulta de CID-10 */}
            {showCidModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}>
                <div style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '650px',
                  maxHeight: '85vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                }}>
                  {/* Modal Header */}
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#2563eb' }}>
                        <Search size={20} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Consulta de CID-10 (Significados & OMS)</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Pesquise qualquer código CID ou sintoma/patologia</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCidModal(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '8px' }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Modal Search Input */}
                  <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        className="input"
                        placeholder="Digite o código (ex: M54, J06, Z56) ou sintoma (ex: Dorsalgia, Gripal)..."
                        value={cidSearchQuery}
                        onChange={e => setCidSearchQuery(e.target.value)}
                        autoFocus
                        style={{ paddingLeft: '40px', fontSize: '13.5px', borderRadius: '10px', height: '42px', width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Modal Results List */}
                  <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const q = cidSearchQuery.trim().toLowerCase();
                      const list = Object.values(data?.cidCatalog || {});
                      const localFiltered = !q ? list.slice(0, 40) : list.filter((item: any) =>
                        item.codigo.toLowerCase().includes(q) ||
                        item.descricao.toLowerCase().includes(q) ||
                        item.grupo.toLowerCase().includes(q)
                      );

                      const map = new Map<string, any>();
                      localFiltered.forEach((item: any) => map.set(item.codigo.toUpperCase(), item));
                      dbCidSearchResults.forEach((item: any) => {
                        if (!map.has(item.codigo.toUpperCase())) {
                          map.set(item.codigo.toUpperCase(), item);
                        }
                      });

                      const filtered = Array.from(map.values()).slice(0, 80);

                      if (filtered.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                            <Stethoscope size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Nenhum CID encontrado para "{cidSearchQuery}"</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Tente pesquisar por código (ex: M54) ou sintoma (ex: Dor, Ansiedade)</p>
                          </div>
                        );
                      }

                      return filtered.map((item: any) => (
                        <div key={item.codigo} style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#1d4ed8', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                            {item.codigo}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '2px' }}>{item.descricao}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{item.grupo}</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
