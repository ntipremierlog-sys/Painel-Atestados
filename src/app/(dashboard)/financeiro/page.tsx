'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingDown, DollarSign, Calendar, Users, Building2,
  AlertTriangle, Settings, ChevronRight, Briefcase, Info, Lock,
  PieChart, Filter, Clock, ArrowUpRight, CheckCircle2, FileText,
} from 'lucide-react';
import FinanceiroAuthGuard from '@/components/FinanceiroAuthGuard';
import { MonthYearPicker } from '@/components/MonthYearPicker';
import { TendenciaFinanceiraChart } from '@/components/TendenciaFinanceiraChart';

interface KPIs {
  totalPerdaDiurna: number;
  totalPerdaNoturna: number;
  totalDias: number;
  totalAtestados: number;
  semTarifa: number;
  custoMedioPorAtestado: number;
  custoMedioPorDia: number;
  horasPerdidasTotal: number;
}

interface PorMes { mes: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number; }
interface PorContrato { contrato: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number; percentual: number; }
interface PorSecao { secao: string; secao_id: number | null; contrato: string; perdaDiurna: number; perdaNoturna: number; dias: number; atestados: number; }
interface PorCargo { funcao: string; perdaDiurna: number; dias: number; atestados: number; }

interface RelatorioRow {
  atestado_id: number;
  colaborador_nome: string;
  funcao: string | null;
  secao: string;
  mes_competencia: string;
  cid: string | null;
  dias_afastado: number;
  valor_hora_diurno: number;
  valor_hora_noturno: number | null;
  perda_diurna: number;
  perda_noturna: number | null;
  sem_tarifa: boolean;
}

const TARGET_CONTRACTS_LIST = [
  { id: 'TODOS', label: 'Todos os Contratos' },
  { id: '158', label: 'CTR 158' },
  { id: '618', label: 'CTR 618' },
  { id: '778', label: 'CTR 778' },
  { id: '214', label: 'CTR 214' },
  { id: '1268', label: 'CTR 1268' },
  { id: '215', label: 'CTR 215' },
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return fmt(v);
};

function MonthBar({ data, maxDiurno }: { data: PorMes; maxDiurno: number }) {
  const pct = maxDiurno > 0 ? (data.perdaDiurna / maxDiurno) * 100 : 0;
  const pctN = maxDiurno > 0 ? (data.perdaNoturna / maxDiurno) * 100 : 0;
  const [anoStr, mesStr] = data.mes.split('-');
  const label = format(new Date(parseInt(anoStr), parseInt(mesStr) - 1, 1), 'MMM/yy', { locale: ptBR });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1, minWidth: '42px' }}>
      <div style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: 800 }}>{fmtK(data.perdaDiurna)}</div>
      <div style={{ width: '100%', position: 'relative', height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '3px' }}>
        {/* Barra noturna */}
        <div
          title={`Noturno (estimado): ${fmt(data.perdaNoturna)}`}
          style={{ width: '100%', height: `${pctN}%`, background: 'linear-gradient(180deg, #60a5fa, #3b82f6)', borderRadius: '6px 6px 0 0', transition: 'height 0.4s ease', minHeight: data.perdaNoturna > 0 ? '3px' : '0', opacity: 0.35 }}
        />
        {/* Barra diurna */}
        <div
          title={`Diurno (base): ${fmt(data.perdaDiurna)} (${data.atestados} atestados)`}
          style={{ width: '100%', height: `${pct}%`, background: 'linear-gradient(180deg, #1e1b4b 0%, #2563eb 100%)', borderRadius: '6px 6px 0 0', transition: 'height 0.4s ease', minHeight: data.perdaDiurna > 0 ? '4px' : '0', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' }}
        />
      </div>
      <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
    </div>
  );
}

export default function FinanceiroDashboardPage() {
  return (
    <FinanceiroAuthGuard>
      <FinanceiroDashboardContent />
    </FinanceiroAuthGuard>
  );
}

function FinanceiroDashboardContent() {
  const { status } = useSession();
  const router = useRouter();
  const [acesso, setAcesso] = useState<boolean | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [porMes, setPorMes] = useState<PorMes[]>([]);
  const [porContrato, setPorContrato] = useState<PorContrato[]>([]);
  const [porSecao, setPorSecao] = useState<PorSecao[]>([]);
  const [porCargo, setPorCargo] = useState<PorCargo[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioRow[]>([]);
  const [relTotal, setRelTotal] = useState(0);
  const [loadingDash, setLoadingDash] = useState(true);
  const [loadingRel, setLoadingRel] = useState(false);
  const [mesInicio, setMesInicio] = useState('2025-01');
  const [mesFim, setMesFim] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [secaoFiltro, setSecaoFiltro] = useState('');
  const [contratoFiltro, setContratoFiltro] = useState('TODOS');
  const [secoes, setSecoes] = useState<Array<{ id: number; secao_padrao: string }>>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relatorio'>('dashboard');
  const [relPage, setRelPage] = useState(1);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/financeiro/acesso').then(r => r.json()).then(d => {
        setAcesso(d.acesso);
        if (!d.acesso) router.push('/');
      });
      fetch('/api/secoes').then(r => r.json()).then(s => setSecoes(Array.isArray(s) ? s : []));
    }
  }, [status, router]);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    const params = new URLSearchParams({ mesInicio, mesFim, contrato: contratoFiltro });
    if (secaoFiltro) params.set('secaoId', secaoFiltro);
    const res = await fetch(`/api/financeiro/dashboard?${params}`);
    const data = await res.json();
    setKpis(data.kpis);
    setPorMes(data.porMes ?? []);
    setPorContrato(data.porContrato ?? []);
    setPorSecao(data.porSecao ?? []);
    setPorCargo(data.porCargo ?? []);
    setLoadingDash(false);
  }, [mesInicio, mesFim, secaoFiltro, contratoFiltro]);

  const loadRelatorio = useCallback(async (page = 1) => {
    setLoadingRel(true);
    const params = new URLSearchParams({ mesInicio, mesFim, page: String(page), limit: '50' });
    if (secaoFiltro) params.set('secaoId', secaoFiltro);
    const res = await fetch(`/api/financeiro/relatorio?${params}`);
    const data = await res.json();
    setRelatorio(data.rows ?? []);
    setRelTotal(data.total ?? 0);
    setRelPage(page);
    setLoadingRel(false);
  }, [mesInicio, mesFim, secaoFiltro]);

  useEffect(() => { if (acesso) { loadDashboard(); } }, [acesso, loadDashboard]);
  useEffect(() => { if (acesso && activeTab === 'relatorio') loadRelatorio(1); }, [acesso, activeTab, loadRelatorio]);

  function handleLockSession() {
    sessionStorage.removeItem('fin_unlocked');
    window.location.reload();
  }

  if (acesso === null) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  const maxDiurno = Math.max(...porMes.map(m => m.perdaDiurna), 1);
  const totalNoturno = porMes.reduce((s, m) => s + m.perdaNoturna, 0);

  return (
    <div className="page-content">
      {/* Header Corporativo Moderno */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(37,99,235,0.3)' }}>
              <TrendingDown size={24} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e1b4b', margin: 0, letterSpacing: '-0.02em' }}>
                Impacto Financeiro dos Atestados
              </h1>
              <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '20px', color: '#1d4ed8' }}>🔒 Área Restrita para Diretoria</span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#64748b' }}>Faturamento Potencial Não Realizado</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/financeiro/tarifas')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Settings size={15} /> Tarifas por Contrato
          </button>
          <button onClick={handleLockSession} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }} title="Bloquear sessão financeira">
            <Lock size={15} /> Trancar
          </button>
        </div>
      </div>

      {/* Painel de Filtros Modernizado com Seletor de Contratos em Dropdown */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '18px 20px', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Filter size={15} color="#2563eb" />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtros de Análise & Contratos</span>
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Seletor de Contrato (Dropdown Limpo e Escalável) */}
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contrato / CTR</label>
            <select
              value={contratoFiltro}
              onChange={(e) => setContratoFiltro(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#1e293b', background: '#ffffff', fontWeight: 600 }}
            >
              {TARGET_CONTRACTS_LIST.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <MonthYearPicker
            label="Mês Inicial"
            value={mesInicio}
            onChange={setMesInicio}
          />

          <MonthYearPicker
            label="Mês Final"
            value={mesFim}
            onChange={setMesFim}
          />
          <div style={{ flex: 1.2, minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidade / Seção Específica</label>
            <select value={secaoFiltro} onChange={e => setSecaoFiltro(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#1e293b', background: '#ffffff' }}>
              <option value="">Todas as Unidades</option>
              {secoes.map(s => <option key={s.id} value={s.id}>{s.secao_padrao}</option>)}
            </select>
          </div>
          <button onClick={() => { loadDashboard(); if (activeTab === 'relatorio') loadRelatorio(1); }}
            style={{ padding: '9px 22px', borderRadius: '9px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
            Atualizar Dashboard
          </button>
        </div>
      </div>

      {/* Aviso Tarifa Cadastrada */}
      {kpis && kpis.semTarifa > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <span><strong>{kpis.semTarifa} atestados</strong> sem tarifa específica cadastrada no período. Recomendamos cadastrar as tarifas por contrato.</span>
          <button onClick={() => router.push('/financeiro/tarifas')} style={{ marginLeft: 'auto', fontSize: '12px', color: '#2563eb', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Gerenciar Tarifas <ChevronRight size={12} />
          </button>
        </div>
      )}

      {loadingDash ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      ) : (
        <>
          {/* CARDS DE KPIS HARMONIOSOS NO MESMO ESTILO DO DASHBOARD PRINCIPAL */}
          <div className="kpi-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            
            {/* KPI 1: Faturamento Não Realizado */}
            <div className="donezo-stat-card" style={{ background: '#eff6ff', borderColor: '#dbeafe', padding: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8' }}>
                    Perda Não Realizada
                  </span>
                  <div className="arrow-circle-btn" style={{ background: '#dbeafe', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                    <ArrowUpRight size={15} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1.1, marginBottom: '6px' }}>
                  {fmt(kpis?.totalPerdaDiurna ?? 0)}
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>
                Base diurna ({fmt(kpis?.custoMedioPorAtestado ?? 0)}/atestado)
              </div>
            </div>

            {/* KPI 2: Potencial Máximo Noturno */}
            <div className="donezo-stat-card" style={{ background: '#f0f3ff', borderColor: '#dbe2fe', padding: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1e3a8a' }}>
                    Potencial Máximo
                  </span>
                  <div className="arrow-circle-btn" style={{ background: '#dbe2fe', borderColor: '#bfdbfe', color: '#1e3a8a' }}>
                    <ArrowUpRight size={15} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#172554', lineHeight: 1.1, marginBottom: '6px' }}>
                  {fmt((kpis?.totalPerdaDiurna ?? 0) + totalNoturno)}
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>
                Com noturno (+{((totalNoturno / Math.max(kpis?.totalPerdaDiurna ?? 1, 1)) * 100).toFixed(0)}%)
              </div>
            </div>

            {/* KPI 3: Dias Afastados */}
            <div className="donezo-stat-card" style={{ background: '#f0f7ff', borderColor: '#e0f2fe', padding: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0369a1' }}>
                    Dias Afastados
                  </span>
                  <div className="arrow-circle-btn" style={{ background: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1' }}>
                    <ArrowUpRight size={15} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1, marginBottom: '6px' }}>
                  {(kpis?.totalDias ?? 0).toLocaleString('pt-BR')} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>dias</span>
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 600 }}>
                ~{(kpis?.horasPerdidasTotal ?? 0).toLocaleString('pt-BR')}h ({fmt(kpis?.custoMedioPorDia ?? 0)}/dia)
              </div>
            </div>

            {/* KPI 4: Total Atestados */}
            <div className="donezo-stat-card" style={{ background: '#f4f7ff', borderColor: '#e0e8ff', padding: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1d4ed8' }}>
                    Total Atestados
                  </span>
                  <div className="arrow-circle-btn" style={{ background: '#e0e8ff', borderColor: '#c7d2fe', color: '#1d4ed8' }}>
                    <ArrowUpRight size={15} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.1, marginBottom: '6px' }}>
                  {(kpis?.totalAtestados ?? 0).toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#3b82f6', fontWeight: 700 }}>
                Média de ~{((kpis?.totalDias ?? 0) / Math.max(kpis?.totalAtestados ?? 1, 1)).toFixed(1)}d por atestado
              </div>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
            {(['dashboard', 'relatorio'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '8px 18px', borderRadius: '9px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: activeTab === tab ? '#ffffff' : 'transparent', color: activeTab === tab ? '#2563eb' : '#64748b', boxShadow: activeTab === tab ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s' }}>
                {tab === 'dashboard' ? '📊 Análise Visual & Gráficos' : '📋 Relatório Detalhado de Atestados'}
              </button>
            ))}
          </div>

          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Gráfico 1 — Tendência Mensal de Perda Faturada */}
              <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingDown size={18} color="#2563eb" />
                    <div>
                      <span style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '15px' }}>Tendência Mensal — Faturamento Não Realizado</span>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Evolução mês a mês das horas não faturadas por atestados</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '18px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'linear-gradient(135deg, #38bdf8, #0284c7)', boxShadow: '0 2px 6px rgba(2,132,199,0.3)' }} />
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>☀️ Diurno (Tarifa Base)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'linear-gradient(135deg, #312e81, #1e1b4b)', boxShadow: '0 2px 6px rgba(30,27,75,0.3)' }} />
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>🌙 Noturno (Adicional Estimado)</span>
                    </div>
                  </div>
                </div>
                <TendenciaFinanceiraChart data={porMes} />
              </div>

              {/* Gráfico 2 — Distribuição Financeira por Contrato (158 / 618 / 778 / 214 / 1268 / 215) */}
              <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <PieChart size={18} color="#2563eb" />
                  <div>
                    <span style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '15px' }}>Distribuição de Perda por Contrato Operacional</span>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Participação financeira dos contratos 158, 618, 778, 214, 1268, 215 no absenteísmo</div>
                  </div>
                </div>

                {/* Barra de Proporção Acumulada */}
                {porContrato.length > 0 && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ width: '100%', height: '14px', borderRadius: '8px', overflow: 'hidden', display: 'flex', background: '#f1f5f9' }}>
                      {porContrato.map((c, idx) => {
                        const colors = ['#1e1b4b', '#2563eb', '#3b82f6', '#60a5fa', '#059669', '#d97706', '#94a3b8'];
                        const bg = colors[idx % colors.length];
                        return (
                          <div
                            key={c.contrato}
                            title={`${c.contrato}: ${fmt(c.perdaDiurna)} (${c.percentual.toFixed(1)}%)`}
                            style={{ width: `${c.percentual}%`, background: bg, height: '100%', transition: 'width 0.5s' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid de Cards dos Contratos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {porContrato.map((c, idx) => {
                    const colors = ['#1e1b4b', '#2563eb', '#3b82f6', '#60a5fa', '#059669', '#d97706', '#94a3b8'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={c.contrato} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 800, color, fontSize: '13px' }}>{c.contrato}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '5px' }}>
                            {c.percentual.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{fmt(c.perdaDiurna)}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.atestados} atestados · {c.dias} dias</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid: Ranking por Unidade + Ranking por Cargo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Por Seção */}
                <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Building2 size={16} color="#2563eb" />
                    <span style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '14.5px' }}>Top Unidades mais Afetadas</span>
                  </div>
                  {porSecao.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>Sem dados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {porSecao.slice(0, 8).map((s, i) => {
                        const maxS = porSecao[0]?.perdaDiurna || 1;
                        const pct = (s.perdaDiurna / maxS) * 100;
                        return (
                          <div key={s.secao}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12.5px' }}>
                              <span style={{ color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }} title={s.secao}>{i + 1}. {s.secao}</span>
                              <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '12px' }}>{fmtK(s.perdaDiurna)}</span>
                            </div>
                            <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #1e1b4b, #2563eb)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{s.atestados} atestados · {s.dias} dias</span>
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>{s.contrato}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Por Cargo */}
                <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Briefcase size={16} color="#059669" />
                    <span style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '14.5px' }}>Custo por Cargo Operado</span>
                  </div>
                  {porCargo.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>Sem dados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {porCargo.slice(0, 8).map((c, i) => {
                        const maxC = porCargo[0]?.perdaDiurna || 1;
                        const pct = (c.perdaDiurna / maxC) * 100;
                        return (
                          <div key={c.funcao}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12.5px' }}>
                              <span style={{ color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }} title={c.funcao}>{i + 1}. {c.funcao}</span>
                              <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '12px' }}>{fmtK(c.perdaDiurna)}</span>
                            </div>
                            <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #059669, #10b981)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>{c.atestados} atestados · {c.dias} dias afastado</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Nota Metodológica */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', background: '#f0f7ff', border: '1px solid #bae6fd', borderRadius: '16px', padding: '18px 22px', fontSize: '13px', color: '#0369a1', boxShadow: '0 2px 8px rgba(2,132,199,0.05)' }}>
                <Info size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#0284c7' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '14px' }}>
                    Metodologia de Faturamento Não Realizado
                  </div>
                  <div style={{ color: '#334155' }}>
                    O valor do impacto financeiro decorrente dos afastamentos por atestado é calculado multiplicando a quantidade de <strong>dias afastados</strong> pela <strong>jornada diária padrão (8 horas/dia)</strong> e pelo <strong>valor/hora contratual vigente</strong>:
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '12.5px', color: '#1e1b4b', fontWeight: 700, margin: '4px 0', width: 'fit-content' }}>
                    Perda Financeira = Dias Afastados × 8 Horas/Dia × Valor/Hora Contratual (R$)
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>
                    * Os valores consideram como base a tarifa diurna regular cadastrada por contrato (ex: 158, 618, 778, 214, 1268, 215) para assegurar uma estimativa conservadora, auditável e precisa do impacto no faturamento.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Relatório Detalhado */}
          {activeTab === 'relatorio' && (
            <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '14.5px' }}>Relatório Detalhado por Atestado</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{relTotal.toLocaleString('pt-BR')} registros encontrados</span>
              </div>
              {loadingRel ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ width: '28px', height: '28px' }} />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Colaborador', 'Cargo', 'Unidade', 'Mês', 'CID', 'Dias', 'R$/h', 'Perda (Diurna)', 'Perda (Noturna)'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('Perda') || h === 'Dias' ? 'right' : 'left', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.map((row) => (
                        <tr key={row.atestado_id} style={{ borderTop: '1px solid #f1f5f9', background: row.sem_tarifa ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.colaborador_nome}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>{row.funcao ?? '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>{row.secao}</td>
                          <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{row.mes_competencia}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {row.cid ? <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 7px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 600 }}>{row.cid}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{row.dias_afastado}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b', fontSize: '11.5px' }}>
                            {row.sem_tarifa ? <span title="Sem tarifa específica cadastrada" style={{ color: '#d97706' }}>⚠ —</span> : fmt(row.valor_hora_diurno)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                            {row.perda_diurna > 0 ? fmt(row.perda_diurna) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                            {row.perda_noturna != null && row.perda_noturna > 0 ? fmt(row.perda_noturna) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Paginação */}
              {relTotal > 50 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '14px', borderTop: '1px solid #f1f5f9' }}>
                  <button disabled={relPage <= 1} onClick={() => loadRelatorio(relPage - 1)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: relPage <= 1 ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 600, fontSize: '12px', opacity: relPage <= 1 ? 0.5 : 1 }}>← Anterior</button>
                  <span style={{ padding: '6px 14px', fontSize: '12px', color: '#64748b' }}>Página {relPage} de {Math.ceil(relTotal / 50)}</span>
                  <button disabled={relPage * 50 >= relTotal} onClick={() => loadRelatorio(relPage + 1)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: relPage * 50 >= relTotal ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: 600, fontSize: '12px', opacity: relPage * 50 >= relTotal ? 0.5 : 1 }}>Próxima →</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
