'use client';

import { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Loader2, Plus, Save, RefreshCw } from 'lucide-react';

interface SecaoDePara {
  id: number;
  secao_bruta: string;
  secao_padrao: string;
  _count: { colaboradores: number };
}

export default function DeParaPage() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<SecaoDePara[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBruta, setNewBruta] = useState('');
  const [newPadrao, setNewPadrao] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/secoes?search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSaveEdit = async (id: number) => {
    if (!editValue.trim()) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/secoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secao_padrao: editValue.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingId(null);
      fetchData();
    } catch (e) {
      setError(`Erro ao salvar: ${String(e)}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este mapeamento? Os colaboradores vinculados perderão a seção padrão.')) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/secoes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
    } catch (e) {
      setError(`Erro ao excluir: ${String(e)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    if (!newBruta.trim() || !newPadrao.trim()) return;
    setAddLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/secoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secao_bruta: newBruta.trim(), secao_padrao: newPadrao.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowAddForm(false);
      setNewBruta('');
      setNewPadrao('');
      fetchData();
    } catch (e) {
      setError(`Erro ao adicionar: ${String(e)}`);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">De-Para de Seção</h1>
            <p className="page-subtitle">{data.length} mapeamentos cadastrados</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                setLoading(true);
                await fetch('/api/secoes/sincronizar', { method: 'POST' });
                fetchData();
              }}
            >
              <RefreshCw size={14} /> Sincronizar Seções
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={14} /> Novo Mapeamento
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
            background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px', fontWeight: 600,
          }}>
            <span>⚠</span> {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 800 }}>✕</button>
          </div>
        )}
        {showAddForm && (
          <div className="card mb-4">
            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Adicionar Mapeamento Manual
            </div>
            <div className="grid-2" style={{ marginBottom: '12px' }}>
              <div className="input-group">
                <label className="input-label">Seção Bruta (como vem do RM)</label>
                <input className="input" type="text" placeholder="Ex: CTCE SALVADOR TURNO 1 - 062/2019" value={newBruta} onChange={e => setNewBruta(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Seção Padrão (nome canônico)</label>
                <input className="input" type="text" placeholder="Ex: CTCE SALVADOR - 062/2019" value={newPadrao} onChange={e => setNewPadrao(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={addLoading || !newBruta.trim() || !newPadrao.trim()}>
                {addLoading ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={12} />}
                Salvar
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="filters-bar">
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Buscar mapeamento</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" type="text" placeholder="Seção bruta ou padrão..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Seção Bruta (RM)</th>
                <th>→</th>
                <th>Seção Padrão</th>
                <th>Colaboradores</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              )}
              {!loading && data.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <p>Nenhum mapeamento encontrado.</p>
                  </div>
                </td></tr>
              )}
              {!loading && data.map(d => (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {d.secao_bruta}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>→</td>
                  <td>
                    {editingId === d.id ? (
                      <input
                        className="input"
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        style={{ fontSize: '13px' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(d.id); if (e.key === 'Escape') setEditingId(null); }}
                      />
                    ) : (
                      <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{d.secao_padrao}</span>
                    )}
                  </td>
                  <td><span className="badge badge-gray">{d._count.colaboradores}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {editingId === d.id ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(d.id)} disabled={savingId === d.id} style={{ padding: '4px 10px' }}>
                            {savingId === d.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={12} />}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)} style={{ padding: '4px 8px' }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setEditingId(d.id); setEditValue(d.secao_padrao); }}
                            style={{ padding: '4px 8px' }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(d.id)}
                            disabled={deletingId === d.id}
                            style={{ padding: '4px 8px' }}
                          >
                            {deletingId === d.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Trash2 size={12} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
