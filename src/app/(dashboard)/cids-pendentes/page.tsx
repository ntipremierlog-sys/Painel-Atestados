'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Stethoscope } from 'lucide-react';

interface CidPendente {
  codigo: string;
  ocorrencias: number;
}

const GRUPOS_PADRAO = [
  'Doenças do Aparelho Respiratório',
  'Doenças do Sistema Osteomuscular e Tecido Conjuntivo',
  'Transtornos Mentais e Comportamentais',
  'Doenças do Aparelho Digestivo',
  'Doenças do Aparelho Circulatório',
  'Doenças Infecciosas e Parasitárias',
  'Sintomas, Sinais e Achados Anormais',
  'Lesões, Envenenamento e Causas Externas',
  'Gravidez, Parto e Puerpério',
  'Doenças do Sistema Geniturinário',
  'Doenças da Pele e do Tecido Subcutâneo',
  'Doenças do Olho, Ouvido e Anexos',
  'Doenças Endócrinas, Nutricionais e Metabólicas',
  'Neoplasias (Tumores)',
  'Fatores que Influenciam o Estado de Saúde',
];

export default function CidsPendentesPage() {
  const [pendentes, setPendentes] = useState<CidPendente[]>([]);
  const [descricoes, setDescricoes] = useState<Record<string, string>>({});
  const [grupos, setGrupos] = useState<Record<string, string>>({});
  const [outrosGrupos, setOutrosGrupos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const loadPendentes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cids/pendentes');
      const json = await res.json();
      setPendentes(json);

      const initialDesc: Record<string, string> = {};
      const initialGrp: Record<string, string> = {};

      json.forEach((item: any) => {
        if (item.sugestaoDescricao) initialDesc[item.codigo] = item.sugestaoDescricao;
        if (item.sugestaoGrupo) initialGrp[item.codigo] = item.sugestaoGrupo;
      });

      setDescricoes(initialDesc);
      setGrupos(initialGrp);
    } catch (e) {
      console.error('Erro ao carregar CIDs pendentes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendentes();
  }, []);

  const handleSave = async (codigo: string) => {
    const desc = descricoes[codigo]?.trim();
    const grpSelecao = grupos[codigo];
    const grpFinal = grpSelecao === '__outro__' ? outrosGrupos[codigo]?.trim() : grpSelecao;

    if (!desc || !grpFinal) return;

    setSaving(codigo);
    try {
      const res = await fetch('/api/cids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          descricao: desc,
          grupo: grpFinal,
        }),
      });

      if (res.ok) {
        setSaved(prev => new Set([...prev, codigo]));
        setPendentes(prev => prev.filter(p => p.codigo !== codigo));
      }
    } catch (e) {
      console.error('Erro ao salvar classificação de CID:', e);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" style={{ width: '32px', height: '32px' }} />
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Stethoscope className="text-purple" size={24} />
              CIDs Pendentes de Classificação
            </h1>
            <p className="page-subtitle">
              {pendentes.length > 0
                ? `${pendentes.length} código(s) CID lançados aguardando classificação OMS/DATASUS`
                : 'Todos os códigos CID lançados estão classificados no catálogo ✅'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadPendentes}>
            <RefreshCw size={14} /> Atualizar Fila
          </button>
        </div>
      </div>

      <div className="page-content">
        {pendentes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div className="empty-state-title">Nenhum CID pendente</div>
            <p className="empty-state-text">Todos os códigos CID lançados nos atestados já possuem grupo e descrição cadastrados.</p>
          </div>
        ) : (
          <>
            <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
              <AlertTriangle size={16} />
              <span>
                Há <strong>{pendentes.length}</strong> código(s) CID aguardando classificação. Informe a descrição e o Grupo OMS/DATASUS para automatizar relatórios futuros.
              </span>
            </div>

            <div className="card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 90px 1fr 240px auto',
                  gap: '12px',
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  borderRadius: '8px 8px 0 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Código CID</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ocorrências</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição / Patologia</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grupo CID-10</span>
                  <span></span>
                </div>

                {pendentes.map((p, i) => {
                  const isSaved = saved.has(p.codigo);
                  return (
                    <div key={p.codigo} style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 90px 1fr 240px auto',
                      gap: '12px',
                      padding: '12px 16px',
                      alignItems: 'center',
                      borderBottom: i < pendentes.length - 1 ? '1px solid var(--border)' : 'none',
                      opacity: isSaved ? 0.5 : 1,
                    }}>
                      <div>
                        <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {p.codigo}
                        </span>
                      </div>

                      <div>
                        <span className="badge badge-orange">{p.ocorrencias} atest.</span>
                      </div>

                      <div>
                        <input
                          type="text"
                          className="input"
                          placeholder="Ex: Infecção aguda das vias aéreas superiores"
                          value={descricoes[p.codigo] || ''}
                          onChange={e => setDescricoes(prev => ({ ...prev, [p.codigo]: e.target.value }))}
                          disabled={isSaved}
                        />
                      </div>

                      <div>
                        <select
                          className="select"
                          value={grupos[p.codigo] || ''}
                          onChange={e => setGrupos(prev => ({ ...prev, [p.codigo]: e.target.value }))}
                          disabled={isSaved}
                        >
                          <option value="">Selecionar Grupo...</option>
                          {GRUPOS_PADRAO.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                          <option value="__outro__">+ Outro grupo...</option>
                        </select>

                        {grupos[p.codigo] === '__outro__' && (
                          <input
                            type="text"
                            className="input"
                            style={{ marginTop: '6px' }}
                            placeholder="Nome do novo grupo"
                            value={outrosGrupos[p.codigo] || ''}
                            onChange={e => setOutrosGrupos(prev => ({ ...prev, [p.codigo]: e.target.value }))}
                          />
                        )}
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSave(p.codigo)}
                        disabled={saving === p.codigo || isSaved || !descricoes[p.codigo] || !grupos[p.codigo]}
                      >
                        {saving === p.codigo ? (
                          <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />
                        ) : isSaved ? (
                          <CheckCircle size={12} />
                        ) : (
                          'Salvar'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
