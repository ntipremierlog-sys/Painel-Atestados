'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CidDetailModal } from '@/components/CidDetailModal';
import { SituacaoMultiSelect } from '@/components/SituacaoMultiSelect';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Stethoscope,
  UserCheck,
  Users,
  XCircle,
  X,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  exportAnaliseResumoToExcel,
  exportAnaliseDetalhamentoToExcel,
  exportAnaliseCidsToExcel,
  exportAnaliseCidsToPDF,
} from '@/lib/exportUtils';

const COLORS = ['#2a1b54', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export default function AnaliseGerencialPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumo' | 'detalhamento' | 'cids'>('resumo');

  // Consulta de CID
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

  // Filtros idênticos ao Dashboard
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [secao, setSecao] = useState('');
  const [secaoQuery, setSecaoQuery] = useState('');
  const [showSecaoDropdown, setShowSecaoDropdown] = useState(false);
  const secaoRef = useRef<HTMLDivElement>(null);
  const [situacoes, setSituacoes] = useState<string[]>(['TODOS']);
  const [diasMinimos, setDiasMinimos] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [inspectedCid, setInspectedCid] = useState<string | null>(null);
  const [expandedSecaoKey, setExpandedSecaoKey] = useState<string | null>(null);

  function formatDateStr(isoStr: string | null) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return format(d, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return String(isoStr);
    }
  }

  // Debounce para secaoQuery -> setSecao
  useEffect(() => {
    const timer = setTimeout(() => {
      setSecao(secaoQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [secaoQuery]);

  // Fechar dropdown da seção ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (secaoRef.current && !secaoRef.current.contains(event.target as Node)) {
        setShowSecaoDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estados da Aba de CIDs
  const [cidSubTab, setCidSubTab] = useState<'patologias' | 'grupos'>('patologias');
  const [expandedCid, setExpandedCid] = useState<string | null>(null);
  const [cidFilterQuery, setCidFilterQuery] = useState('');

  // Helper para buscar descrição e grupo do CID para o Tooltip de Mouse Hover
  const getCidInfo = (code: string) => {
    if (!data?.cidCatalog) return { descricao: 'Classificação CID-10 OMS', grupo: 'OMS' };
    const clean = code.trim().toUpperCase();
    const direct = data.cidCatalog[clean];
    if (direct) return direct;
    const baseCode = clean.split('.')[0];
    return data.cidCatalog[baseCode] || { descricao: 'Classificação CID-10 OMS', grupo: 'OMS' };
  };

  // Helper de Estilo Discreto para Dias de Afastamento (Sem fundo de caixa)
  const getDaysBadgeStyle = (dias: number) => {
    if (dias <= 2) {
      return { bg: 'transparent', color: '#0284c7' };
    }
    if (dias <= 7) {
      return { bg: 'transparent', color: '#b45309' };
    }
    return { bg: 'transparent', color: '#be123c' };
  };

  // Helper de Estilo Discreto para Situação do Colaborador (Sem fundo de caixa)
  const getSituacaoBadgeStyle = (sit: string) => {
    const s = (sit || '').toUpperCase();
    if (s.includes('DEMIT')) {
      return { bg: 'transparent', color: '#991b1b' };
    }
    if (s.includes('AVISO') || s.includes('AFAST')) {
      return { bg: 'transparent', color: '#b45309' };
    }
    return { bg: 'transparent', color: '#166534' };
  };

  // Estado dos acordeões (aba resumo)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (secao) params.append('secao', secao);
    if (situacoes.length > 0) params.append('situacao', situacoes.join(','));
    params.append('diasMinimos', String(diasMinimos));

    try {
      const res = await fetch(`/api/analise-gerencial?${params.toString()}`);
      const json = await res.json();
      setData(json);

      if (!dataInicio && json.filtrosAplicados?.dataInicio) {
        setDataInicio(json.filtrosAplicados.dataInicio);
      }
      if (!dataFim && json.filtrosAplicados?.dataFim) {
        setDataFim(json.filtrosAplicados.dataFim);
      }

      if (json.resumo) {
        const initialOpen: Record<string, boolean> = {};
        json.resumo.forEach((sec: any) => {
          initialOpen[sec.secao] = true;
        });
        setOpenSections(initialOpen);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, secao, situacoes, diasMinimos]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLimparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setSecao('');
    setSecaoQuery('');
    setSituacoes(['TODOS']);
    setDiasMinimos(1);
  };

  const toggleSection = (secao: string) => {
    setOpenSections(prev => ({ ...prev, [secao]: !prev[secao] }));
  };

  const toggleAllSections = (open: boolean) => {
    if (!data?.resumo) return;
    const newState: Record<string, boolean> = {};
    data.resumo.forEach((sec: any) => {
      newState[sec.secao] = open;
    });
    setOpenSections(newState);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const label = `${dataInicio || '2026-01-01'} a ${dataFim || '2026-07-31'}`;
    if (activeTab === 'resumo') {
      exportAnaliseResumoToExcel(data.resumo, label);
    } else if (activeTab === 'detalhamento') {
      exportAnaliseDetalhamentoToExcel(data.detalhamento, label);
    } else {
      exportAnaliseCidsToExcel(data.detalhamentoCids.grupos, label);
    }
  };

  const handleExportPDF = async () => {
    if (!data?.detalhamentoCids) return;
    const label = `${dataInicio || '2026-01-01'} a ${dataFim || '2026-07-31'}`;
    await exportAnaliseCidsToPDF(data.detalhamentoCids.grupos, data.detalhamentoCids.totalOcorrencias, label);
  };

  const filteredResumo = data?.resumo?.map((sec: any) => {
    const colabs = sec.colaboradores.filter((c: any) =>
      c.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.secao.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.cids_concatenados.toLowerCase().includes(searchFilter.toLowerCase())
    );
    return { ...sec, colaboradores: colabs };
  }).filter((sec: any) => sec.colaboradores.length > 0);

  const filteredDetalhamento = data?.detalhamento?.filter((d: any) =>
    d.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.secao.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.cid.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeDataInicio = dataInicio || data?.filtrosAplicados?.dataInicio || '2026-01-01';
  const activeDataFim = dataFim || data?.filtrosAplicados?.dataFim || '2026-07-31';

  let periodoLabel = '';
  if (activeDataInicio) {
    const dInicio = new Date(activeDataInicio + 'T12:00:00');
    const dFim = new Date(activeDataFim + 'T12:00:00');
    if (activeDataInicio === activeDataFim) {
      periodoLabel = format(dInicio, 'dd/MM/yyyy', { locale: ptBR });
    } else {
      periodoLabel = `${format(dInicio, 'dd/MM/yyyy', { locale: ptBR })} até ${format(dFim, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' }}>
      <CidDetailModal cidCode={inspectedCid} onClose={() => setInspectedCid(null)} />

      {/* Donezo Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Análise Gerencial de Atestados
          </h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
            Inteligência gerencial, grupos epidemiológicos e absenteísmo por unidade. <span style={{ color: '#94a3b8' }}>(Período: {periodoLabel})</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowCidModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '30px',
              background: '#f0f7ff',
              border: '1px solid #bae6fd',
              color: '#0284c7',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Search size={16} /> Consulta CID-10
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || !data}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: loading || !data ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>

          {activeTab === 'cids' && (
            <button
              onClick={handleExportPDF}
              disabled={loading || !data}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '30px',
                background: '#8b5cf6',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: loading || !data ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <FileText size={16} /> PDF Executivo
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS DONEZO STYLE (IDÊNTICA AO DASHBOARD) */}
      <div className="filters-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: '16px', alignItems: 'end', marginBottom: '24px' }}>
        
        <div className="input-group">
          <label className="input-label">Data Inicial</label>
          <input
            type="date"
            className="input"
            value={activeDataInicio}
            onChange={e => setDataInicio(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Data Final</label>
          <input
            type="date"
            className="input"
            value={activeDataFim}
            min={activeDataInicio}
            onChange={e => setDataFim(e.target.value)}
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
                  position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center'
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
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#ffffff',
                border: '1px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                maxHeight: '220px', overflowY: 'auto', zIndex: 9999, padding: '4px 0',
              }}
            >
              <div
                onClick={() => {
                  setSecaoQuery('');
                  setSecao('');
                  setShowSecaoDropdown(false);
                }}
                style={{
                  padding: '8px 14px', fontSize: '12.5px', fontWeight: 700, color: '#2563eb', cursor: 'pointer',
                  background: !secaoQuery ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f1f5f9'
                }}
              >
                Todas as Seções (Mostrar Tudo)
              </div>

              {(() => {
                const filtered = (data?.secoesDisponiveis || []).filter((s: string) =>
                  s.toLowerCase().includes(secaoQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                      Buscando por "<strong>{secaoQuery}</strong>" no banco...
                    </div>
                  );
                }

                return filtered.map((s: string) => (
                  <div
                    key={s}
                    onClick={() => {
                      setSecaoQuery(s);
                      setSecao(s);
                      setShowSecaoDropdown(false);
                    }}
                    style={{
                      padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer',
                      background: secaoQuery === s ? '#f0f9ff' : 'transparent', transition: 'background 0.15s ease',
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
          availableOptions={data?.situacoesDisponiveis}
        />

        <div className="input-group">
          <label className="input-label">Afastamento Mínimo</label>
          <select className="select" value={diasMinimos} onChange={e => setDiasMinimos(parseFloat(e.target.value))}>
            <option value={1}>1 dia ou mais (&gt;= 1d) — Padrão</option>
            <option value={2}>2 dias ou mais (&gt;= 2d)</option>
            <option value={3}>3 dias ou mais (&gt;= 3d)</option>
            <option value={7}>7 dias ou mais (&gt;= 7d)</option>
            <option value={15}>15 dias ou mais (&gt;= 15d INSS)</option>
          </select>
        </div>

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

          {/* Bot\u00e3o "Limpar" s\u00f3 aparece quando h\u00e1 pelo menos 1 filtro ativo */}
          {(dataInicio || dataFim || secao || diasMinimos !== 1 ||
            (situacoes.length > 0 && !situacoes.includes('TODOS') && !situacoes.includes('TODAS'))
          ) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLimparFiltros}
              style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px' }}
              title="Limpar todos os filtros"
            >
              <RotateCcw size={13} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      {data?.totais && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Card 1 */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Colaboradores no Critério</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{data.totais.colaboradoresAfetados}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Colaboradores com &gt;={diasMinimos}d no mês</div>
          </div>

          {/* Card 2 */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total de Atestados</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{data.totais.totalGeralAtestados}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Ocorrências lançadas no período</div>
          </div>

          {/* Card 3 */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dias Afastados</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                <BarChart3 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {data.totais.totalGeralDias} <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>dias</span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Dias acumulados de afastamento</div>
          </div>

          {/* Card 4 */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CIDs Registrados</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Stethoscope size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{data.totais.totalOcorrenciasCid}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Códigos de patologia informados</div>
          </div>
        </div>
      )}

      {/* Navegação de Abas Segmentada */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', background: '#ffffff', padding: '8px 12px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTab('resumo')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'resumo' ? '#2a1b54' : 'transparent',
              color: activeTab === 'resumo' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'resumo' ? '0 2px 8px rgba(42, 27, 84, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            1. Resumo Agregado por Seção
          </button>
          <button
            onClick={() => setActiveTab('detalhamento')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'detalhamento' ? '#2a1b54' : 'transparent',
              color: activeTab === 'detalhamento' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'detalhamento' ? '0 2px 8px rgba(42, 27, 84, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            2. Detalhamento de Ocorrências
          </button>
          <button
            onClick={() => setActiveTab('cids')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'cids' ? '#2a1b54' : 'transparent',
              color: activeTab === 'cids' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'cids' ? '0 2px 8px rgba(42, 27, 84, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            3. Detalhamento por CID-10 (OMS)
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px', height: '38px', borderRadius: '10px', fontSize: '12px' }}
            placeholder="Buscar colaborador, CID ou seção..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', borderColor: '#2a1b54', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* ABA 1: RESUMO POR SEÇÃO */}
          {activeTab === 'resumo' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                  Exibindo <strong style={{ color: '#0f172a' }}>{filteredResumo?.length || 0}</strong> seção(ões) de um total de {data?.resumo?.length || 0}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => toggleAllSections(true)}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Expandir Todas
                  </button>
                  <button
                    onClick={() => toggleAllSections(false)}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Recolher Todas
                  </button>
                </div>
              </div>

              {filteredResumo?.length === 0 ? (
                <div className="empty-state" style={{ background: '#ffffff', borderRadius: '16px', padding: '60px', border: '1px solid #e2e8f0' }}>
                  <div className="empty-state-title">Nenhum registro encontrado</div>
                  <p className="empty-state-text">Nenhum colaborador atende aos critérios de filtro selecionados.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredResumo?.map((sec: any) => {
                    const isOpen = openSections[sec.secao] ?? true;
                    return (
                      <div key={sec.secao} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        {/* Header da Seção Limpo */}
                        <div
                          onClick={() => toggleSection(sec.secao)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 20px',
                            background: '#ffffff',
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderBottom: isOpen ? '1px solid #f1f5f9' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ color: '#475569', display: 'flex', alignItems: 'center' }}>
                              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                                {sec.secao}
                              </span>
                              <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                                ({sec.colaboradores.length} colaborador(es))
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#2563eb', fontWeight: 700 }}>
                              {sec.totalAtestadosSecao} atestado(s)
                            </span>
                            <span style={{ fontSize: '12.5px', color: '#b45309', fontWeight: 700 }}>
                              {sec.totalDiasSecao} dias
                            </span>
                          </div>
                        </div>

                        {/* Tabela de Colaboradores Limpa */}
                        {isOpen && (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ background: '#ffffff', borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  <th style={{ padding: '10px 16px', fontWeight: 700 }}>Funcionário</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700 }}>Situação</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700 }}>Data Admissão</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700 }}>Mês</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'center' }}>Atestados</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'center' }}>Dias Afastados</th>
                                  <th style={{ padding: '10px 16px', fontWeight: 700 }}>CIDs Registrados</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sec.colaboradores.map((c: any, i: number) => {
                                  const badgeStyle = getDaysBadgeStyle(c.total_dias);
                                  const sitStyle = getSituacaoBadgeStyle(c.situacao);
                                  const cidList = c.cids_concatenados.split(', ');

                                  return (
                                    <tr key={`${c.colaborador_id}_${c.mes_competencia}_${i}`} style={{ borderBottom: i < sec.colaboradores.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                                        {c.nome}
                                      </td>
                                      <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          color: sitStyle.color,
                                        }}>
                                          {c.situacao}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{c.data_admissao}</td>
                                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>{c.mes_competencia}</td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>{c.qtd_atestados}</td>
                                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{
                                          fontWeight: 700,
                                          fontSize: '12.5px',
                                          color: badgeStyle.color,
                                        }}>
                                          {c.total_dias} dias
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                          {cidList.map((cid: string, idx: number) => {
                                            const info = getCidInfo(cid);
                                            return (
                                              <span
                                                key={idx}
                                                title={`Clique para ver o significado de [${cid.trim().toUpperCase()}] ${info.descricao}`}
                                                onClick={() => {
                                                  setInspectedCid(cid.trim());
                                                  setShowCidModal(true);
                                                }}
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontSize: '12px',
                                                  fontWeight: 700,
                                                  color: '#0284c7',
                                                  cursor: 'pointer',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '3px',
                                                }}
                                              >
                                                <Stethoscope size={11} style={{ color: '#0284c7' }} />
                                                {cid}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: DETALHAMENTO DE OCORRÊNCIAS */}
          {activeTab === 'detalhamento' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#ffffff', borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Seção Padrão</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Colaborador</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Situação</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Competência</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Início</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Fim</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Dias</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>CID</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetalhamento?.map((d: any, idx: number) => {
                      const badgeStyle = getDaysBadgeStyle(d.dias_afastado);
                      const sitStyle = getSituacaoBadgeStyle(d.situacao);
                      const cidInfo = getCidInfo(d.cid || '');
                      return (
                        <tr key={d.id} style={{ borderBottom: idx < filteredDetalhamento.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{d.secao}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{d.nome}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: sitStyle.color,
                            }}>
                              {d.situacao}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{d.mes_competencia}</td>
                          <td style={{ padding: '12px 16px' }}>{d.data_inicio}</td>
                          <td style={{ padding: '12px 16px' }}>{d.data_fim}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '12.5px', color: badgeStyle.color }}>
                              {d.dias_afastado}d
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              title={`Clique para ver o significado de [${(d.cid || '').trim().toUpperCase()}] ${cidInfo.descricao}`}
                              onClick={() => {
                                setInspectedCid((d.cid || '').trim());
                                setShowCidModal(true);
                              }}
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: '#0284c7',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Stethoscope size={11} style={{ color: '#0284c7' }} />
                              {d.cid}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{d.tipo_atestado}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: CLASSIFICAÇÃO DE CIDs (OMS) */}
          {activeTab === 'cids' && (
            <div>
              {/* CARDS EXECUTIVOS DE IMPACTO POR CID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Patologias Mapeadas</span>
                    <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}><Stethoscope size={18} /></div>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{data?.detalhamentoCids?.todosCids?.length || 0} CIDs</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{data?.detalhamentoCids?.totalOcorrencias || 0} atestados classificados</div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Dias Perdidos por CIDs</span>
                    <div style={{ background: '#fef3c7', color: '#d97706', padding: '8px', borderRadius: '10px' }}><Calendar size={18} /></div>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309' }}>{(data?.detalhamentoCids?.totalDias || 0).toLocaleString('pt-BR')} dias</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Média de {data?.detalhamentoCids?.totalOcorrencias ? (data.detalhamentoCids.totalDias / data.detalhamentoCids.totalOcorrencias).toFixed(1) : 0} dias/atestado</div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Maior Impacto em Dias</span>
                    <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px', borderRadius: '10px' }}><Activity size={18} /></div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={data?.detalhamentoCids?.top10Dias?.[0]?.descricao}>
                    {data?.detalhamentoCids?.top10Dias?.[0]?.codigo} — {data?.detalhamentoCids?.top10Dias?.[0]?.descricao || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    <strong>{data?.detalhamentoCids?.top10Dias?.[0]?.totalDias || 0} dias</strong> em {data?.detalhamentoCids?.top10Dias?.[0]?.ocorrencias || 0} atestados
                  </div>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Grupo Epidemiológico Líder</span>
                    <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '8px', borderRadius: '10px' }}><Layers size={18} /></div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#7c3aed', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={data?.detalhamentoCids?.grupos?.[0]?.grupo}>
                    {data?.detalhamentoCids?.grupos?.[0]?.grupo || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    <strong>{data?.detalhamentoCids?.grupos?.[0]?.totalDiasGrupo || 0} dias</strong> ({data?.detalhamentoCids?.grupos?.[0]?.percentualDiasGrupo || 0}% do total)
                  </div>
                </div>
              </div>

              {/* BARRA DE CONTROLE DA ABA CID: NAVEGAÇÃO SECUNDÁRIA + BUSCA */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <button
                    onClick={() => setCidSubTab('patologias')}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: cidSubTab === 'patologias' ? '#ffffff' : 'transparent',
                      color: cidSubTab === 'patologias' ? '#2563eb' : '#64748b',
                      fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                      boxShadow: cidSubTab === 'patologias' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Stethoscope size={15} /> Por Patologia / CID ({data?.detalhamentoCids?.todosCids?.length || 0})
                  </button>
                  <button
                    onClick={() => setCidSubTab('grupos')}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: cidSubTab === 'grupos' ? '#ffffff' : 'transparent',
                      color: cidSubTab === 'grupos' ? '#2563eb' : '#64748b',
                      fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                      boxShadow: cidSubTab === 'grupos' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Layers size={15} /> Por Grupos Epidemiológicos OMS ({data?.detalhamentoCids?.grupos?.length || 0})
                  </button>
                </div>

                <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Buscar CID por código ou nome (ex: M54, Grip)..."
                    value={cidFilterQuery}
                    onChange={e => setCidFilterQuery(e.target.value)}
                    style={{ paddingLeft: '36px', fontSize: '13px' }}
                  />
                  {cidFilterQuery && (
                    <button
                      onClick={() => setCidFilterQuery('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* VISÃO 1: POR PATOLOGIA / CIDs (Tabela Limpa com Expansão de Seções e Colaboradores) */}
              {cidSubTab === 'patologias' && (() => {
                const list = (data?.detalhamentoCids?.todosCids || []).filter((c: any) => {
                  if (!cidFilterQuery.trim()) return true;
                  const q = cidFilterQuery.toLowerCase();
                  return c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q) || c.grupo.toLowerCase().includes(q);
                });

                if (list.length === 0) {
                  return (
                    <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      Nenhuma patologia encontrada com o termo "{cidFilterQuery}".
                    </div>
                  );
                }

                return (
                  <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <th style={{ padding: '14px 20px', fontWeight: 800 }}>Código</th>
                            <th style={{ padding: '14px 20px', fontWeight: 800 }}>Patologia / Diagnóstico OMS</th>
                            <th style={{ padding: '14px 20px', fontWeight: 800 }}>Grupo Epidemiológico</th>
                            <th style={{ padding: '14px 20px', fontWeight: 800, textAlign: 'center' }}>Atestados (% Total)</th>
                            <th style={{ padding: '14px 20px', fontWeight: 800, textAlign: 'center' }}>Dias Perdidos (% Total)</th>
                            <th style={{ padding: '14px 20px', fontWeight: 800, textAlign: 'center' }}>Detalhamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((c: any, idx: number) => {
                            const isExpanded = expandedCid === c.codigo;
                            return (
                              <Fragment key={c.codigo}>
                                <tr
                                  onClick={() => setExpandedCid(isExpanded ? null : c.codigo)}
                                  style={{
                                    borderBottom: idx < list.length - 1 && !isExpanded ? '1px solid #f1f5f9' : 'none',
                                    background: isExpanded ? '#f0f9ff' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease',
                                  }}
                                >
                                  <td style={{ padding: '14px 20px' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#0284c7', background: '#e0f2fe', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: '6px' }}>
                                      {c.codigo}
                                    </span>
                                  </td>
                                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                                    {c.descricao}
                                  </td>
                                  <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12.5px' }}>
                                    {c.grupo}
                                  </td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{c.ocorrencias} atestados</div>
                                    <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>{c.percentual}% dos atestados</div>
                                  </td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, color: '#b45309' }}>{c.totalDias} dias</div>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>{c.percentualDias}% dos dias perdidos</div>
                                  </td>
                                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      style={{
                                        border: '1px solid #cbd5e1', background: isExpanded ? '#0284c7' : '#ffffff',
                                        color: isExpanded ? '#ffffff' : '#475569', borderRadius: '8px',
                                        padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                                      }}
                                    >
                                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      {isExpanded ? 'Ocultar' : 'Ver Pessoas & Seções'}
                                    </button>
                                  </td>
                                </tr>

                                {/* PAINEL EXPANDIDO COM DRILLDOWN POR SEÇÃO E POR COLABORADOR */}
                                {isExpanded && (
                                  <tr style={{ background: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
                                    <td colSpan={6} style={{ padding: '16px 24px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                                        {/* SEÇÕES MAIS AFETADAS POR ESTE CID */}
                                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #bae6fd', padding: '16px' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0369a1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Building2 size={16} /> Top Seções Afetadas por {c.codigo} ({c.descricao})
                                          </div>
                                          {c.secoes?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                              {c.secoes.map((s: any) => {
                                                const secKey = `${c.codigo}_${s.secao}`;
                                                const isSecExpanded = expandedSecaoKey === secKey;
                                                return (
                                                  <div key={s.secao} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                    <div
                                                      onClick={() => setExpandedSecaoKey(isSecExpanded ? null : secKey)}
                                                      style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        fontSize: '12.5px',
                                                        background: isSecExpanded ? '#eff6ff' : '#f8fafc',
                                                        padding: '10px 14px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        borderBottom: isSecExpanded ? '1px solid #bfdbfe' : 'none',
                                                      }}
                                                      title="Clique na unidade para ver a lista dos funcionários com atestados"
                                                    >
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {isSecExpanded ? <ChevronDown size={15} style={{ color: '#2563eb' }} /> : <ChevronRight size={15} style={{ color: '#64748b' }} />}
                                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>{s.secao}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '12px' }}>{s.ocorrencias} atestado(s)</span>
                                                        <span style={{ fontWeight: 800, color: '#b45309', fontSize: '12px' }}>{s.totalDias}d</span>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, background: isSecExpanded ? '#2563eb' : '#ffffff', color: isSecExpanded ? '#ffffff' : '#475569', border: '1px solid #cbd5e1', padding: '3px 9px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                          <Users size={12} /> {isSecExpanded ? 'Ocultar' : 'Ver Pessoas'}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    {/* DETALHAMENTO DOS FUNCIONÁRIOS DA UNIDADE */}
                                                    {isSecExpanded && (
                                                      <div style={{ padding: '12px', background: '#f0f9ff' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                          <Users size={13} /> Funcionários da unidade afastados por {c.codigo} ({s.colaboradores?.length || 0}):
                                                        </div>
                                                        {s.colaboradores?.length > 0 ? (
                                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {s.colaboradores.map((col: any, colIdx: number) => (
                                                              <div
                                                                key={`${col.nome}_${colIdx}`}
                                                                style={{
                                                                  display: 'flex',
                                                                  justifyContent: 'space-between',
                                                                  alignItems: 'center',
                                                                  fontSize: '12px',
                                                                  background: '#ffffff',
                                                                  padding: '8px 12px',
                                                                  borderRadius: '8px',
                                                                  border: '1px solid #bae6fd',
                                                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                                                }}
                                                              >
                                                                <div>
                                                                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{col.nome}</div>
                                                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                                    Período: {formatDateStr(col.data_inicio)} a {formatDateStr(col.data_fim)} ({col.mes_competencia})
                                                                  </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                  <span style={{
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    padding: '2px 8px',
                                                                    borderRadius: '6px',
                                                                    background: (col.situacao || '').includes('DEMIT') ? '#fef2f2' : '#ecfdf5',
                                                                    color: (col.situacao || '').includes('DEMIT') ? '#b91c1c' : '#15803d',
                                                                  }}>
                                                                    {col.situacao || 'Ativo'}
                                                                  </span>
                                                                  <span style={{ fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', border: '1px solid #fde68a' }}>
                                                                    {col.dias_afastado}d afastado(s)
                                                                  </span>
                                                                </div>
                                                              </div>
                                                            ))}
                                                          </div>
                                                        ) : (
                                                          <div style={{ fontSize: '12px', color: '#64748b' }}>Nenhum detalhe adicional</div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Sem dados de seções</div>
                                          )}
                                        </div>

                                        {/* COLABORADORES MAIS AFETADOS POR ESTE CID */}
                                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #bae6fd', padding: '16px' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0369a1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Users size={16} /> Principais Colaboradores Atingidos por {c.codigo}
                                          </div>
                                          {c.colaboradores?.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                              {c.colaboradores.map((col: any) => (
                                                <div key={col.nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                  <div>
                                                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{col.nome}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{col.secao}</div>
                                                  </div>
                                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '12px' }}>{col.ocorrencias} atestado(s)</span>
                                                    <span style={{ fontWeight: 800, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{col.totalDias}d</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Sem dados de colaboradores</div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* VISÃO 2: POR GRUPOS EPIDEMIOLÓGICOS OMS */}
              {cidSubTab === 'grupos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {data?.detalhamentoCids?.grupos?.filter((g: any) => {
                    if (!cidFilterQuery.trim()) return true;
                    const q = cidFilterQuery.toLowerCase();
                    return g.grupo.toLowerCase().includes(q) || g.cids.some((c: any) => c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q));
                  }).map((g: any, index: number) => (
                    <div key={g.grupo} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <div style={{
                        padding: '16px 20px',
                        background: '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: index === 0 ? '#1e3a8a' : index === 1 ? '#2563eb' : '#64748b',
                            color: '#ffffff', fontWeight: 800, fontSize: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            #{index + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>{g.grupo}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{g.cids.length} patologia(s) distintas neste grupo</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <span style={{ padding: '6px 14px', borderRadius: '20px', background: '#eff6ff', border: '1px solid #dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: '13px' }}>
                            {g.ocorrenciasGrupo} atestados ({g.percentualGrupo}%)
                          </span>
                          <span style={{ padding: '6px 14px', borderRadius: '20px', background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', fontWeight: 800, fontSize: '13px' }}>
                            {g.totalDiasGrupo} dias perdidos ({g.percentualDiasGrupo}%)
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                              <th style={{ padding: '12px 20px', width: '110px', fontWeight: 700 }}>Código</th>
                              <th style={{ padding: '12px 20px', fontWeight: 700 }}>Descrição / Patologia</th>
                              <th style={{ padding: '12px 20px', textAlign: 'center', width: '130px', fontWeight: 700 }}>Atestados</th>
                              <th style={{ padding: '12px 20px', textAlign: 'center', width: '140px', fontWeight: 700 }}>Dias Afastados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.cids.map((c: any, idx: number) => (
                              <tr key={c.codigo} style={{ borderBottom: idx < g.cids.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                                <td style={{ padding: '12px 20px' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', padding: '3px 9px', borderRadius: '6px' }}>
                                    {c.codigo}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 20px', fontWeight: 700, color: '#1e293b' }}>{c.descricao}</td>
                                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                                  {c.ocorrencias} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>({c.percentual}%)</span>
                                </td>
                                <td style={{ padding: '12px 20px', textAlign: 'center', fontWeight: 800, color: '#b45309' }}>
                                  {c.totalDias}d <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>({c.percentualDias}%)</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
  );
}
