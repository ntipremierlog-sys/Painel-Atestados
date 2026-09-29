'use client';

import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Trash2, Edit2, FileText, Download, X, AlertTriangle, Stethoscope } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CidDetailModal } from '@/components/CidDetailModal';
import { SituacaoMultiSelect } from '@/components/SituacaoMultiSelect';

interface Atestado {
  id: number;
  data_inicio: string;
  data_fim: string;
  data_retorno: string;
  dias_afastado: number;
  cid: string | null;
  tipo_atestado: string | null;
  mes_competencia: string;
  colaborador: {
    id: number;
    nome: string;
    cpf: string;
    secao_padrao: { secao_padrao: string } | null;
  };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
}

// Modal de confirmação elegante
function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  loading,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  loading: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px',
          boxShadow: '0 20px 40px -8px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={28} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{description}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
            <button
              ref={cancelRef}
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: '#ffffff',
                fontWeight: 700, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Excluindo...' : 'Sim, excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AtestadosPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cid, setCid] = useState('');
  const [mes, setMes] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [secao, setSecao] = useState('');
  const [secaoQuery, setSecaoQuery] = useState('');
  const [showSecaoDropdown, setShowSecaoDropdown] = useState(false);
  const secaoRef = useRef<HTMLDivElement>(null);
  const [situacoes, setSituacoes] = useState<string[]>(['TODOS']);
  const [selectedCidModal, setSelectedCidModal] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ atestados: Atestado[]; total: number } | null>(null);
  const [secoesList, setSecoesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: number | null; nome: string }>({
    isOpen: false, id: null, nome: '',
  });
  const limit = 30;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSecao(secaoQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [secaoQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (secaoRef.current && !secaoRef.current.contains(event.target as Node)) {
        setShowSecaoDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar seções para o filtro
  useEffect(() => {
    fetch('/api/secoes')
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        if (Array.isArray(list)) {
          const names = Array.from(new Set(list.map((item: any) => item.secao_padrao))).sort();
          setSecoesList(names as string[]);
        }
      })
      .catch(() => {});
  }, []);

  // Debounce para busca por colaborador
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (cid) params.set('cid', cid);
    if (mes) params.set('mesCompetencia', mes);
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (secao) params.set('secao', secao);
    if (situacoes.length > 0 && !situacoes.includes('TODOS')) params.set('situacao', situacoes.join(','));

    fetch(`/api/atestados?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, cid, mes, search, dataInicio, dataFim, secao, situacoes]);

  const handleDeleteClick = (id: number, nome: string) => {
    setConfirmModal({ isOpen: true, id, nome });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmModal.id) return;
    setDeletingId(confirmModal.id);
    await fetch(`/api/atestados/${confirmModal.id}`, { method: 'DELETE' });
    setDeletingId(null);
    setConfirmModal({ isOpen: false, id: null, nome: '' });
    fetchData();
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const hasFilters = !!(search || cid || mes || dataInicio || dataFim || secao || (situacoes.length > 0 && !situacoes.includes('TODOS')));

  return (
    <>
      <CidDetailModal cidCode={selectedCidModal} onClose={() => setSelectedCidModal(null)} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, id: null, nome: '' })}
        title="Excluir Atestado"
        description={`Você está prestes a excluir o atestado de ${confirmModal.nome}. Esta ação não pode ser desfeita.`}
        loading={deletingId !== null}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Histórico de Atestados</h1>
            <p className="page-subtitle">
              {data ? `${data.total.toLocaleString('pt-BR')} registros${totalPages > 1 ? ` · Página ${page} de ${totalPages}` : ''}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {data && data.atestados.length > 0 && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  title="Exportar página atual para Excel"
                  onClick={async () => {
                    const { exportAtestadosToExcel } = await import('@/lib/exportUtils');
                    exportAtestadosToExcel(data.atestados);
                  }}
                >
                  <Download size={14} style={{ color: '#10b981' }} /> Excel
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  title="Exportar página atual para PDF"
                  onClick={async () => {
                    const { exportAtestadosToPDF } = await import('@/lib/exportUtils');
                    exportAtestadosToPDF(data.atestados);
                  }}
                >
                  <Download size={14} style={{ color: '#ef4444' }} /> PDF
                </button>
              </>
            )}
            <a href="/atestados/novo" className="btn btn-primary btn-sm">
              <FileText size={14} /> Novo Atestado
            </a>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Filtros */}
        <div className="filters-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
            <label className="input-label">Buscar Colaborador</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="text"
                placeholder="Nome, CPF ou Chapa..."
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); setPage(1); }}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          <div className="input-group" style={{ width: '130px' }}>
            <label className="input-label">Data Inicial</label>
            <input className="input" type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1); }} />
          </div>

          <div className="input-group" style={{ width: '130px' }}>
            <label className="input-label">Data Final</label>
            <input className="input" type="date" min={dataInicio} value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1); }} />
          </div>

          <div className="input-group" ref={secaoRef} style={{ width: '220px', position: 'relative' }}>
            <label className="input-label">Seção / Unidade</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                className="input"
                placeholder="Digitar nome ou nº..."
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
                    setPage(1);
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

            {showSecaoDropdown && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#ffffff',
                  border: '1px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  maxHeight: '200px', overflowY: 'auto', zIndex: 9999, padding: '4px 0',
                }}
              >
                <div
                  onClick={() => { setSecaoQuery(''); setSecao(''); setShowSecaoDropdown(false); setPage(1); }}
                  style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#2563eb', cursor: 'pointer', background: !secaoQuery ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f1f5f9' }}
                >
                  Todas as Seções
                </div>
                {secoesList.filter(s => s.toLowerCase().includes(secaoQuery.toLowerCase())).map(s => (
                  <div
                    key={s}
                    onClick={() => { setSecaoQuery(s); setSecao(s); setShowSecaoDropdown(false); setPage(1); }}
                    style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', background: secaoQuery === s ? '#f0f9ff' : 'transparent' }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '180px' }}>
            <SituacaoMultiSelect
              value={situacoes}
              onChange={(newVal) => {
                setSituacoes(newVal);
                setPage(1);
              }}
            />
          </div>

          <div className="input-group" style={{ width: '110px' }}>
            <label className="input-label">CID</label>
            <input className="input" type="text" placeholder="Ex: M54..." value={cid} onChange={e => { setCid(e.target.value.toUpperCase()); setPage(1); }} />
          </div>

          <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setDataInicio('2026-01-01'); setDataFim('2026-12-31'); setPage(1); }}
              style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 600 }}
              title="Filtrar todo o ano de 2026"
            >
              Ano 2026
            </button>
            {hasFilters && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setCid('');
                  setMes('');
                  setDataInicio('');
                  setDataFim('');
                  setSecao('');
                  setSecaoQuery('');
                  setSituacoes(['TODOS']);
                  setPage(1);
                }}
              >
                <X size={13} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Seção</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Retorno</th>
                <th>Dias</th>
                <th>CID</th>
                <th>Tipo</th>
                <th>Competência</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              )}
              {!loading && data?.atestados.length === 0 && (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={40} /></div>
                    <div className="empty-state-title">Nenhum atestado encontrado</div>
                    <p className="empty-state-text">Ajuste os filtros ou lance um novo atestado.</p>
                  </div>
                </td></tr>
              )}
              {!loading && data?.atestados.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{a.colaborador.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {a.colaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </div>
                  </td>
                  <td style={{ fontSize: '12px' }}>{a.colaborador.secao_padrao?.secao_padrao || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(a.data_inicio)}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(a.data_fim)}</td>
                  <td style={{ fontSize: '12px' }}>{formatDate(a.data_retorno)}</td>
                  <td><span className="badge badge-orange">{a.dias_afastado}d</span></td>
                  <td>
                    {a.cid ? (
                      <span
                        className="badge badge-blue"
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedCidModal(a.cid)}
                        title={`Clique para detalhar o CID ${a.cid}`}
                      >
                        <Stethoscope size={11} /> {a.cid}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: '12px' }}>{a.tipo_atestado || '—'}</td>
                  <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{a.mes_competencia}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => router.push(`/atestados/${a.id}/editar`)}
                        title="Editar atestado"
                        style={{ padding: '4px 8px', borderRadius: '8px' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteClick(a.id, a.colaborador.nome)}
                        disabled={deletingId === a.id}
                        title="Excluir atestado"
                        style={{ padding: '4px 8px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação com total de páginas */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" onClick={() => setPage(1)} disabled={page === 1} title="Primeira página">«</button>
            <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = page <= 4 ? i + 1 : page - 3 + i;
              if (p < 1 || p > totalPages) return null;
              return <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            <button className="pagination-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages} title="Última página">»</button>
            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px', alignSelf: 'center' }}>
              de {totalPages}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
