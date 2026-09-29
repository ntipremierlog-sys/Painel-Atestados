'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Plus, RefreshCw } from 'lucide-react';

interface SecaoPendente {
  secao_bruta_atual: string;
  _count: { id: number };
}

interface SecaoDePara {
  id: number;
  secao_padrao: string;
}

export default function SecoesPendentesPage() {
  const [pendentes, setPendentes] = useState<SecaoPendente[]>([]);
  const [secoesExistentes, setSecoesExistentes] = useState<string[]>([]);
  const [mapeamentos, setMapeamentos] = useState<Record<string, string>>({});
  const [novasSecoes, setNovasSecoes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch('/api/secoes?pendentes=true').then(r => r.json()),
      fetch('/api/secoes').then(r => r.json()),
    ]).then(([pend, dep]) => {
      setPendentes(pend);
      const uniqueSecoes = [...new Set<string>(dep.map((d: SecaoDePara) => d.secao_padrao))].sort();
      setSecoesExistentes(uniqueSecoes);
      setLoading(false);
    });
  }, []);

  const handleSave = async (secaoBruta: string) => {
    const secaoPadrao = mapeamentos[secaoBruta] === '__nova__'
      ? novasSecoes[secaoBruta]
      : mapeamentos[secaoBruta];

    if (!secaoPadrao?.trim()) return;

    setSaving(secaoBruta);
    const res = await fetch('/api/secoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secao_bruta: secaoBruta, secao_padrao: secaoPadrao.trim() }),
    });

    if (res.ok) {
      setSaved(prev => new Set([...prev, secaoBruta]));
      setPendentes(prev => prev.filter(p => p.secao_bruta_atual !== secaoBruta));
    }
    setSaving(null);
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
            <h1 className="page-title">Seções Pendentes</h1>
            <p className="page-subtitle">
              {pendentes.length > 0
                ? `${pendentes.length} seção(ões) aguardando classificação`
                : 'Todas as seções estão classificadas ✅'}
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              setLoading(true);
              await fetch('/api/secoes/sincronizar', { method: 'POST' });
              window.location.reload();
            }}
          >
            <RefreshCw size={14} /> Sincronizar Seções
          </button>
        </div>
      </div>

      <div className="page-content">
        {pendentes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div className="empty-state-title">Nenhuma seção pendente</div>
            <p className="empty-state-text">Todas as seções da base foram classificadas.</p>
          </div>
        ) : (
          <>
            <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
              <AlertTriangle size={16} />
              <span>
                Há <strong>{pendentes.length}</strong> seção(ões) sem classificação. 
                Colaboradores nessas seções não aparecerão corretamente nos relatórios.
              </span>
            </div>

            <div className="card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 220px auto',
                  gap: '12px',
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  borderRadius: '8px 8px 0 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Seção Bruta (como vem do RM)</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Colaboradores</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mapear para</span>
                  <span></span>
                </div>

                {pendentes.map((p, i) => {
                  const isSaved = saved.has(p.secao_bruta_atual || '');
                  return (
                    <div key={p.secao_bruta_atual} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 220px auto',
                      gap: '12px',
                      padding: '12px 16px',
                      alignItems: 'center',
                      borderBottom: i < pendentes.length - 1 ? '1px solid var(--border)' : 'none',
                      opacity: isSaved ? 0.5 : 1,
                    }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {p.secao_bruta_atual}
                        </div>
                      </div>
                      <span className="badge badge-orange">{p._count.id} colab.</span>
                      <div>
                        <select
                          className="select"
                          value={mapeamentos[p.secao_bruta_atual || ''] || ''}
                          onChange={e => setMapeamentos(prev => ({ ...prev, [p.secao_bruta_atual || '']: e.target.value }))}
                          disabled={isSaved}
                        >
                          <option value="">Selecionar...</option>
                          {secoesExistentes.map(s => <option key={s} value={s}>{s}</option>)}
                          <option value="__nova__">+ Nova seção padrão...</option>
                        </select>
                        {mapeamentos[p.secao_bruta_atual || ''] === '__nova__' && (
                          <input
                            className="input"
                            style={{ marginTop: '6px' }}
                            type="text"
                            placeholder="Nome da nova seção padrão"
                            value={novasSecoes[p.secao_bruta_atual || ''] || ''}
                            onChange={e => setNovasSecoes(prev => ({ ...prev, [p.secao_bruta_atual || '']: e.target.value }))}
                          />
                        )}
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSave(p.secao_bruta_atual || '')}
                        disabled={saving === p.secao_bruta_atual || isSaved || !mapeamentos[p.secao_bruta_atual || '']}
                      >
                        {saving === p.secao_bruta_atual ? (
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
