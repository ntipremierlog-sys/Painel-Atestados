'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, ChevronRight, X } from 'lucide-react';
import { SituacaoMultiSelect, SituacaoBadge } from '@/components/SituacaoMultiSelect';

interface Colaborador {
  id: number;
  nome: string;
  cpf: string;
  matricula: string | null;
  funcao: string | null;
  situacao: string;
  secao_padrao: { secao_padrao: string } | null;
  _count: { atestados: number };
}

function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function ColaboradoresPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [situacoes, setSituacoes] = useState<string[]>(['TODOS']);
  const [secao, setSecao] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ colaboradores: Colaborador[]; total: number } | null>(null);
  const [secoes, setSecoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  // Debounce para o input de busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Carregar seções disponíveis para o filtro
  useEffect(() => {
    fetch('/api/secoes')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const nomes = [...new Set(d.map((s: any) => s.secao_padrao).filter(Boolean))].sort();
          setSecoes(nomes as string[]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      search, situacao: situacoes.join(','), secao, page: String(page), limit: String(limit),
    });
    fetch(`/api/colaboradores?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search, situacoes, secao, page]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const hasFilters = !!(searchInput || search || (situacoes.length > 0 && !situacoes.includes('TODOS')) || secao);

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSituacoes(['TODOS']);
    setSecao('');
    setPage(1);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Colaboradores</h1>
        <p className="page-subtitle">
          {data ? `${data.total.toLocaleString('pt-BR')} colaboradores encontrados${totalPages > 1 ? ` · Página ${page} de ${totalPages}` : ''}` : ''}
        </p>
      </div>

      <div className="page-content">
        {/* Filtros */}
        <div className="filters-bar">
          <div className="input-group" style={{ flex: 1, minWidth: '220px' }}>
            <label className="input-label">Buscar</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="text"
                placeholder="Nome, CPF ou matrícula..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ paddingLeft: '36px', paddingRight: searchInput ? '32px' : '12px' }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', padding: '2px'
                  }}
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="input-group" style={{ minWidth: '180px' }}>
            <label className="input-label">Seção</label>
            <select className="select" value={secao} onChange={e => { setSecao(e.target.value); setPage(1); }}>
              <option value="">Todas as Seções</option>
              {secoes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <SituacaoMultiSelect
            value={situacoes}
            onChange={opts => { setSituacoes(opts); setPage(1); }}
          />
          {hasFilters && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
                <X size={13} /> Limpar
              </button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome / Matrícula</th>
                <th>CPF</th>
                <th>Função</th>
                <th>Seção</th>
                <th>Situação</th>
                <th>Atestados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              )}
              {!loading && data?.colaboradores.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><Users size={40} /></div>
                      <div className="empty-state-title">Nenhum colaborador encontrado</div>
                      <p className="empty-state-text">
                        {search ? `Nenhum colaborador ativo corresponde ao termo "${search}".` : 'Ajuste os filtros ou importe uma base de dados.'}
                      </p>
                      {search && situacoes.length === 1 && situacoes[0] === 'ATIVO' && (
                        <div style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSituacoes(['TODOS']); setPage(1); }}
                            style={{ fontWeight: 600, color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
                          >
                            Buscar em Todas as Situações (incluindo Demitidos)
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && data?.colaboradores.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/colaboradores/${c.id}`)}>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{c.nome}</div>
                    {c.matricula && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Matrícula: <span style={{ fontFamily: 'monospace' }}>{c.matricula}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{formatCPF(c.cpf)}</td>
                  <td style={{ fontSize: '13px' }}>{c.funcao || '—'}</td>
                  <td>{c.secao_padrao?.secao_padrao || <span className="badge badge-orange">Sem seção</span>}</td>
                  <td>
                    <SituacaoBadge situacao={c.situacao} />
                  </td>
                  <td>
                    <span
                      className={`badge ${c._count.atestados > 0 ? 'badge-blue' : 'badge-gray'}`}
                      title={`${c._count.atestados} atestado(s)`}
                    >
                      {c._count.atestados}
                    </span>
                  </td>
                  <td>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação com total */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" onClick={() => setPage(1)} disabled={page === 1} title="Primeira página">«</button>
            <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = page <= 4 ? i + 1 : page - 3 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              );
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
