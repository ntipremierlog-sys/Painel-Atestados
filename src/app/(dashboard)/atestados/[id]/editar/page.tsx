'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Calendar, User, Stethoscope } from 'lucide-react';
import { parseISO, differenceInDays, addDays } from 'date-fns';
import { formatDisplayDate } from '@/lib/dateUtils';

const TIPOS_ATESTADO = [
  'Médico',
  'Odontológico',
  'Acompanhamento Médico (Familiar)',
  'Acidente de Trabalho',
  'Doença Ocupacional',
  'Maternidade',
  'Paternidade',
  'Outros',
];

interface Colaborador {
  id: number;
  nome: string;
  cpf: string;
  situacao: string;
  secao_padrao: { secao_padrao: string } | null;
}

interface AtestadoData {
  id: number;
  colaborador_id: number;
  data_inicio: string;
  data_fim: string;
  data_retorno: string;
  dias_afastado: number;
  cid: string | null;
  tipo_atestado: string | null;
  mes_competencia: string;
  observacoes: string | null;
  colaborador: Colaborador;
}

function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function toInputDate(val: string | null | undefined): string {
  if (!val) return '';
  return val.slice(0, 10);
}

export default function EditarAtestadoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [atestado, setAtestado] = useState<AtestadoData | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [cid, setCid] = useState('');
  const [tipo, setTipo] = useState('Médico');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/atestados/${id}`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Atestado não encontrado');
        }
        return res.json();
      })
      .then((data: AtestadoData) => {
        setAtestado(data);
        setDataInicio(toInputDate(data.data_inicio));
        setDataFim(toInputDate(data.data_fim));
        setCid(data.cid || '');
        setTipo(data.tipo_atestado || 'Médico');
        setObservacoes(data.observacoes || '');
      })
      .catch(err => {
        setError(err.message || 'Erro ao carregar dados do atestado');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  // Cálculos automáticos do afastamento
  const diasAfastado = dataInicio && dataFim && dataFim >= dataInicio
    ? differenceInDays(parseISO(dataFim), parseISO(dataInicio)) + 1
    : null;

  const dataRetorno = dataFim
    ? formatDisplayDate(addDays(parseISO(dataFim), 1).toISOString())
    : '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicio || !dataFim) {
      setError('Informe a data de início e de fim');
      return;
    }

    if (dataFim < dataInicio) {
      setError('A data de fim não pode ser anterior à data de início');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/atestados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_inicio: dataInicio,
          data_fim: dataFim,
          cid: cid || null,
          tipo_atestado: tipo,
          observacoes: observacoes || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar alterações');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/atestados');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="spin" style={{ color: 'var(--accent-blue)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Carregando dados do atestado...</p>
        </div>
      </div>
    );
  }

  if (!atestado && error) {
    return (
      <div className="page-content">
        <div className="alert alert-error mb-4">{error}</div>
        <button className="btn btn-secondary" onClick={() => router.push('/atestados')}>
          <ArrowLeft size={14} /> Voltar para lista de atestados
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => router.back()}
          style={{ marginBottom: '12px' }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Editar Atestado #{id}</h1>
            <p className="page-subtitle">Modifique os dados do atestado ou retifique períodos e CIDs</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: '720px' }}>
          {success && (
            <div className="alert alert-success mb-4">
              ✅ Atestado atualizado com sucesso! Redirecionando...
            </div>
          )}

          {error && (
            <div className="alert alert-error mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* 1. Colaborador vinculado */}
            {atestado?.colaborador && (
              <div className="card mb-4">
                <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} style={{ color: 'var(--accent-blue)' }} />
                  1. Colaborador
                </div>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(79, 142, 247, 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 142, 247, 0.2)',
                }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {atestado.colaborador.nome}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>CPF: </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCPF(atestado.colaborador.cpf)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Seção: </span>
                      <span style={{ fontWeight: 600 }}>{atestado.colaborador.secao_padrao?.secao_padrao || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Período do Afastamento */}
            <div className="card mb-4">
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--accent-purple)' }} />
                2. Período do Afastamento
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Data de Início *</label>
                  <input
                    className="input"
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Data de Fim *</label>
                  <input
                    className="input"
                    type="date"
                    value={dataFim}
                    min={dataInicio}
                    onChange={e => setDataFim(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                display: 'flex',
                gap: '24px',
                fontSize: '13px',
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Dias afastado: </span>
                  <span style={{ fontWeight: '700', color: diasAfastado && diasAfastado > 0 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
                    {diasAfastado && diasAfastado > 0 ? `${diasAfastado} dias` : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Data de retorno: </span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>{dataRetorno}</span>
                </div>
              </div>
            </div>

            {/* 3. Informações do Atestado */}
            <div className="card mb-4">
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Stethoscope size={16} style={{ color: 'var(--accent-teal, #0d9488)' }} />
                3. Informações do Atestado
              </div>

              <div className="grid-2" style={{ marginBottom: '12px' }}>
                <div className="input-group">
                  <label className="input-label">CID</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Ex: Z76.0, M54.5..."
                    value={cid}
                    onChange={e => setCid(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Tipo de Atestado</label>
                  <select className="select" value={tipo} onChange={e => setTipo(e.target.value)}>
                    {TIPOS_ATESTADO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Observações</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Informações adicionais (opcional)..."
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || success}
              >
                {saving ? (
                  <><Loader2 size={14} className="spin" /> Salvando alterações...</>
                ) : (
                  <><Save size={14} /> Salvar Alterações</>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => router.push('/atestados')}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
