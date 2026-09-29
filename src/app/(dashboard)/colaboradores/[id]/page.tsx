'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Briefcase, MapPin, FilePlus, Stethoscope } from 'lucide-react';
import { CidDetailModal } from '@/components/CidDetailModal';
import { SituacaoBadge } from '@/components/SituacaoMultiSelect';
import { formatDisplayDate } from '@/lib/dateUtils';

interface Colaborador {
  id: number;
  nome: string;
  cpf: string;
  funcao: string | null;
  situacao: string;
  data_admissao: string | null;
  data_demissao: string | null;
  descricao_situacao: string | null;
  secao_padrao: { secao_padrao: string } | null;
  atestados: {
    id: number;
    data_inicio: string;
    data_fim: string;
    data_retorno: string;
    dias_afastado: number;
    cid: string | null;
    tipo_atestado: string | null;
    mes_competencia: string;
  }[];
}

function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatDate(iso: string | null) {
  return formatDisplayDate(iso);
}

export default function ColaboradorDetalhePage() {
  const { id } = useParams();
  const router = useRouter();
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/colaboradores/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) setColaborador(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const [selectedCid, setSelectedCid] = useState<string | null>(null);

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" style={{ width: '32px', height: '32px' }} />
    </div>
  );

  if (!colaborador) return (
    <div className="page-content">
      <div className="empty-state"><p>Colaborador não encontrado.</p></div>
    </div>
  );

  return (
    <>
      <CidDetailModal cidCode={selectedCid} onClose={() => setSelectedCid(null)} />

      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()} style={{ marginBottom: '12px' }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">{colaborador.nome}</h1>
            <p className="page-subtitle" style={{ fontFamily: 'monospace' }}>{formatCPF(colaborador.cpf)}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SituacaoBadge situacao={colaborador.situacao} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/atestados/novo?colaboradorId=${colaborador.id}`)}
            >
              <FilePlus size={14} /> Lançar Atestado
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Cards de dados */}
        <div className="grid-4 mb-6">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Briefcase size={14} style={{ color: 'var(--accent-blue)' }} />
              <span className="card-title">Função</span>
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
              {colaborador.funcao || '—'}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <MapPin size={14} style={{ color: 'var(--accent-purple)' }} />
              <span className="card-title">Seção</span>
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
              {colaborador.secao_padrao?.secao_padrao || <span style={{ color: 'var(--accent-orange)' }}>Sem mapeamento</span>}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={14} style={{ color: 'var(--accent-green)' }} />
              <span className="card-title">Admissão</span>
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
              {formatDate(colaborador.data_admissao)}
            </div>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={14} style={{ color: 'var(--accent-red)' }} />
              <span className="card-title">Demissão</span>
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>
              {formatDate(colaborador.data_demissao)}
            </div>
          </div>
        </div>

        {/* Histórico de atestados */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Histórico de Atestados</span>
            <span className="badge badge-blue">{colaborador.atestados.length}</span>
          </div>
          {colaborador.atestados.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum atestado lançado para este colaborador.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: '0' }}>
              <table>
                <thead>
                  <tr>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Retorno</th>
                    <th>Dias</th>
                    <th>CID</th>
                    <th>Tipo</th>
                    <th>Competência</th>
                  </tr>
                </thead>
                <tbody>
                  {colaborador.atestados.map(a => (
                    <tr key={a.id}>
                      <td>{formatDate(a.data_inicio)}</td>
                      <td>{formatDate(a.data_fim)}</td>
                      <td>{formatDate(a.data_retorno)}</td>
                      <td><span className="badge badge-orange">{a.dias_afastado} dias</span></td>
                      <td>
                        {a.cid ? (
                          <span
                            className="badge badge-blue"
                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setSelectedCid(a.cid)}
                            title={`Clique para detalhar o CID ${a.cid}`}
                          >
                            <Stethoscope size={11} /> {a.cid}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{a.tipo_atestado || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{a.mes_competencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

