'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Plus, Edit2, Trash2, X, Building2,
  ShieldAlert, Save, ChevronDown, Lock, Filter, FileText,
  CheckCircle2, Sparkles,
} from 'lucide-react';
import FinanceiroAuthGuard from '@/components/FinanceiroAuthGuard';

interface SecaoOption { id: number; secao_padrao: string; }
interface Tarifa {
  id: number;
  secao_padrao_id: number | null;
  secao_padrao: SecaoOption | null;
  cargo_pattern: string | null;
  cargo_label: string | null;
  valor_hora_diurno: number;
  valor_hora_noturno: number | null;
  jornada_horas: number;
  contrato_ref: string | null;
  ativo: boolean;
  observacoes: string | null;
}

const TARGET_CONTRACTS = [
  { id: 'ALL', label: 'Todos os Contratos' },
  { id: '158', label: 'CTR 158 (Salvador)' },
  { id: '618', label: 'CTR 618 (Indaiatuba/Campinas)' },
  { id: '778', label: 'CTR 778 (Guarulhos)' },
  { id: '214', label: 'CTR 214 (Ribeirão Preto)' },
  { id: '1268', label: 'CTR 1268 (Salvador/Feira)' },
  { id: '215', label: 'CTR 215 (Teresina)' },
];

const EMPTY_FORM = {
  secao_padrao_id: '' as string | number,
  cargo_pattern: '',
  cargo_label: '',
  valor_hora_diurno: '',
  valor_hora_noturno: '',
  jornada_horas: '8',
  contrato_ref: 'CTR 618',
  ativo: true,
  observacoes: '',
};

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function TarifasPage() {
  return (
    <FinanceiroAuthGuard>
      <TarifasContent />
    </FinanceiroAuthGuard>
  );
}

function TarifasContent() {
  const { status } = useSession();
  const router = useRouter();
  const [acesso, setAcesso] = useState<boolean | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [secoes, setSecoes] = useState<SecaoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedContractTab, setSelectedContractTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/financeiro/acesso').then(r => r.json()).then(d => {
        setAcesso(d.acesso);
        if (!d.acesso) router.push('/');
      });
    }
  }, [status, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      fetch('/api/financeiro/tarifas'),
      fetch('/api/secoes'),
    ]);
    const [t, s] = await Promise.all([tRes.json(), sRes.json()]);
    setTarifas(Array.isArray(t) ? t : []);
    setSecoes(Array.isArray(s) ? s : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (acesso) loadData(); }, [acesso, loadData]);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, contrato_ref: selectedContractTab !== 'ALL' ? `CTR ${selectedContractTab}` : 'CTR 618' });
    setShowForm(true);
  }

  function openEdit(t: Tarifa) {
    setEditingId(t.id);
    setForm({
      secao_padrao_id: t.secao_padrao_id ?? '',
      cargo_pattern: t.cargo_pattern ?? '',
      cargo_label: t.cargo_label ?? '',
      valor_hora_diurno: String(t.valor_hora_diurno),
      valor_hora_noturno: t.valor_hora_noturno != null ? String(t.valor_hora_noturno) : '',
      jornada_horas: String(t.jornada_horas),
      contrato_ref: t.contrato_ref ?? 'CTR 618',
      ativo: t.ativo,
      observacoes: t.observacoes ?? '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      secao_padrao_id: form.secao_padrao_id !== '' ? Number(form.secao_padrao_id) : null,
      cargo_pattern: form.cargo_pattern || null,
      cargo_label: form.cargo_label || null,
      valor_hora_diurno: parseFloat(form.valor_hora_diurno),
      valor_hora_noturno: form.valor_hora_noturno ? parseFloat(form.valor_hora_noturno) : null,
      jornada_horas: parseFloat(form.jornada_horas),
      contrato_ref: form.contrato_ref || null,
      ativo: form.ativo,
      observacoes: form.observacoes || null,
    };
    const url = editingId ? `/api/financeiro/tarifas/${editingId}` : '/api/financeiro/tarifas';
    const method = editingId ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await fetch(`/api/financeiro/tarifas/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    loadData();
  }

  function handleLockSession() {
    sessionStorage.removeItem('fin_unlocked');
    window.location.reload();
  }

  if (acesso === null || loading) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  // Filtrar tarifas por contrato selecionado e query de busca
  const tarifasFiltradas = tarifas.filter((t) => {
    if (selectedContractTab !== 'ALL') {
      const matchContrato =
        t.contrato_ref?.includes(selectedContractTab) ||
        t.secao_padrao?.secao_padrao.includes(selectedContractTab);
      if (!matchContrato) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const text = `${t.cargo_label} ${t.cargo_pattern} ${t.secao_padrao?.secao_padrao} ${t.contrato_ref}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  // Agrupar por Contrato / Unidade
  const grupos: Record<string, Tarifa[]> = {};
  for (const t of tarifasFiltradas) {
    const contratoTag = t.contrato_ref ? `Contrato ${t.contrato_ref}` : 'Tarifas Globais';
    const secaoTag = t.secao_padrao?.secao_padrao ? ` — ${t.secao_padrao.secao_padrao}` : ' (Geral)';
    const key = `${contratoTag}${secaoTag}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(t);
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
              <DollarSign size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>Tarifas por Unidade / Contrato</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
            >
              <Plus size={16} /> Nova Tarifa
            </button>
            <button onClick={handleLockSession} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }} title="Bloquear sessão financeira">
              <Lock size={14} /> Trancar
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filtrar por Contrato / CTR
          </label>
          <select
            value={selectedContractTab}
            onChange={(e) => setSelectedContractTab(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#1e293b', background: '#ffffff', fontWeight: 600 }}
          >
            {TARGET_CONTRACTS.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1.5', minWidth: '260px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Busca Rápida
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cargo, palavra-chave ou unidade..."
            style={{ width: '100%', padding: '9px 14px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#1e293b', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {tarifasFiltradas.length === 0 && (
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <ShieldAlert size={32} color="#2563eb" style={{ marginBottom: '10px' }} />
          <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '15px', marginBottom: '6px' }}>Nenhuma tarifa encontrada</div>
          <div style={{ color: '#475569', fontSize: '13px' }}>Cadastre tarifas para os contratos selecionados para habilitar os cálculos de faturamento.</div>
        </div>
      )}

      {Object.entries(grupos).map(([grupoNome, items]) => (
        <div key={grupoNome} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', background: 'linear-gradient(90deg, #f8fafc 0%, #eff6ff 100%)', borderBottom: '1px solid #e2e8f0' }}>
            <FileText size={16} color="#2563eb" />
            <span style={{ fontWeight: 700, color: '#1e1b4b', fontSize: '14px' }}>{grupoNome}</span>
            <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>{items.length} tarifa{items.length !== 1 ? 's' : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cargo</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Padrão Busca</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>R$/h Diurno</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>R$/h Noturno</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jornada</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contrato Ref</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr key={t.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600 }}>
                    {t.cargo_label ?? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Padrão da unidade</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.cargo_pattern ? (
                      <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, fontFamily: 'monospace' }}>
                        "{t.cargo_pattern}"
                      </span>
                    ) : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{fmt(t.valor_hora_diurno)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                    {t.valor_hora_noturno != null ? fmt(t.valor_hora_noturno) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>{t.jornada_horas}h/dia</td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.contrato_ref ? (
                      <span style={{ background: '#f1f5f9', color: '#1e1b4b', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}>
                        {t.contrato_ref}
                      </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => openEdit(t)} style={{ background: '#eff6ff', border: 'none', borderRadius: '7px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: '7px', padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Modal de Formulário */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={20} color="#ffffff" />
                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '16px' }}>
                  {editingId ? 'Editar Tarifa' : 'Nova Tarifa por Contrato'}
                </span>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#ffffff' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Contrato de Referência */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Contrato de Referência *
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {['CTR 158', 'CTR 618', 'CTR 778', 'CTR 214', 'CTR 1268', 'CTR 215'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, contrato_ref: c }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        border: form.contrato_ref === c ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: form.contrato_ref === c ? '#eff6ff' : '#f8fafc',
                        color: form.contrato_ref === c ? '#2563eb' : '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  value={form.contrato_ref}
                  onChange={e => setForm(f => ({ ...f, contrato_ref: e.target.value }))}
                  placeholder="Ex: CTR 618/2025"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Unidade */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Unidade / Seção Específica
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={form.secao_padrao_id}
                    onChange={e => setForm(f => ({ ...f, secao_padrao_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', color: '#1e293b', background: '#ffffff', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">🌐 Global para todas as unidades deste contrato</option>
                    {secoes.map(s => <option key={s.id} value={s.id}>{s.secao_padrao}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Cargo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Label do Cargo
                  </label>
                  <input
                    value={form.cargo_label}
                    onChange={e => setForm(f => ({ ...f, cargo_label: e.target.value }))}
                    placeholder="Ex: Auxiliar Operacional"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Padrão de Busca
                  </label>
                  <input
                    value={form.cargo_pattern}
                    onChange={e => setForm(f => ({ ...f, cargo_pattern: e.target.value }))}
                    placeholder='Ex: AUXILIAR OPERACIONAL'
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Valores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#16a34a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    R$/h Diurno *
                  </label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.valor_hora_diurno}
                    onChange={e => setForm(f => ({ ...f, valor_hora_diurno: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '2px solid #dcfce7', fontSize: '13.5px', color: '#16a34a', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2563eb', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    R$/h Noturno
                  </label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.valor_hora_noturno}
                    onChange={e => setForm(f => ({ ...f, valor_hora_noturno: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '2px solid #dbeafe', fontSize: '13.5px', color: '#2563eb', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Jornada (h/dia)
                  </label>
                  <input
                    type="number" step="0.5" min="1" max="12"
                    value={form.jornada_horas}
                    onChange={e => setForm(f => ({ ...f, jornada_horas: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Observações
                </label>
                <input
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Opcional"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.valor_hora_diurno}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <div className="spinner" style={{ width: '14px', height: '14px', borderColor: '#ffffff #ffffff #ffffff transparent' }} /> : <Save size={14} />}
                {editingId ? 'Salvar' : 'Criar Tarifa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
