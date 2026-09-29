'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, FilePlus, Loader2, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function formatCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function NovoAtestadoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadId = searchParams.get('colaboradorId');

  const [mode, setMode] = useState<'manual' | 'excel'>('manual');

  // Manual Form State
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Colaborador[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [cid, setCid] = useState('');
  const [tipo, setTipo] = useState('Médico');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<{
    success: boolean;
    resumo?: {
      totalLinhas: number;
      inseridos: number;
      duplicadosIgnorados: number;
      erros: number;
    };
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pré-carregar colaborador se vier por query param
  useEffect(() => {
    if (preloadId) {
      fetch(`/api/colaboradores/${preloadId}`)
        .then(r => r.json())
        .then(c => {
          if (c && !c.error) {
            setSelectedColaborador(c);
            setSearch(c.nome);
          }
        });
    }
  }, [preloadId]);

  // Autocomplete
  useEffect(() => {
    if (search.length < 2 || selectedColaborador) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/colaboradores?search=${encodeURIComponent(search)}&autocomplete=true`)
        .then(r => r.json())
        .then(setSuggestions);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedColaborador]);

  // Cálculos automáticos
  const diasAfastado = dataInicio && dataFim
    ? differenceInDays(parseISO(dataFim), parseISO(dataInicio)) + 1
    : null;
  const dataRetorno = dataFim
    ? format(addDays(parseISO(dataFim), 1), 'dd/MM/yyyy', { locale: ptBR })
    : '—';

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaborador) { setError('Selecione um colaborador'); return; }
    if (!dataInicio || !dataFim) { setError('Informe a data de início e fim'); return; }
    if (parseISO(dataFim) < parseISO(dataInicio)) { setError('Data fim não pode ser anterior à data início'); return; }

    setLoading(true);
    setError('');

    const res = await fetch('/api/atestados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colaborador_id: selectedColaborador.id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        cid,
        tipo_atestado: tipo,
        observacoes,
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/atestados'), 1500);
    } else {
      const err = await res.json();
      setError(err.error || 'Erro ao lançar atestado');
    }
    setLoading(false);
  };

  const handleExcelUpload = async () => {
    if (!excelFile) return;
    setExcelLoading(true);
    setExcelResult(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await fetch('/api/atestados/importar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setExcelResult(data);
    } catch {
      setExcelResult({ success: false, error: 'Erro de conexão ou arquivo inválido' });
    }
    setExcelLoading(false);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Lançar Atestado</h1>
        <p className="page-subtitle">Registre atestados manualmente ou importe uma planilha do RM Labore</p>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: '720px' }}>

          {/* Abas de Modo (Manual vs Excel) */}
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--bg-secondary)',
            padding: '6px',
            borderRadius: '10px',
            marginBottom: '24px',
            border: '1px solid var(--border)'
          }}>
            <button
              type="button"
              className={`btn ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('manual')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <FilePlus size={16} /> Lançamento Individual (Manual)
            </button>
            <button
              type="button"
              className={`btn ${mode === 'excel' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('excel')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <FileSpreadsheet size={16} /> Importar Planilha (RM Labore)
            </button>
          </div>

          {/* MODO MANUAL */}
          {mode === 'manual' && (
            <div>
              {success && (
                <div className="alert alert-success mb-4">
                  ✅ Atestado lançado com sucesso! Redirecionando...
                </div>
              )}
              {error && (
                <div className="alert alert-error mb-4">{error}</div>
              )}

              <form onSubmit={handleSubmitManual}>
                {/* Busca de colaborador */}
                <div className="card mb-4">
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    1. Identificação do Colaborador
                  </div>

                  <div className="input-group" ref={searchRef} style={{ position: 'relative' }}>
                    <label className="input-label">Colaborador *</label>
                    <div className="autocomplete-wrapper">
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          className="input"
                          type="text"
                          placeholder="Digite o nome para buscar..."
                          value={search}
                          onChange={e => {
                            setSearch(e.target.value);
                            setSelectedColaborador(null);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          style={{ paddingLeft: '36px' }}
                        />
                      </div>
                      {showSuggestions && suggestions.length > 0 && !selectedColaborador && (
                        <div className="autocomplete-dropdown">
                          {suggestions.map(s => (
                            <div
                              key={s.id}
                              className="autocomplete-item"
                              onClick={() => {
                                setSelectedColaborador(s);
                                setSearch(s.nome);
                                setShowSuggestions(false);
                              }}
                            >
                              <div className="autocomplete-item-name">{s.nome}</div>
                              <div className="autocomplete-item-sub">
                                CPF: {formatCPF(s.cpf)} · {s.secao_padrao?.secao_padrao || 'Sem seção'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedColaborador && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(79,142,247,0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(79,142,247,0.2)',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>CPF</div>
                          <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatCPF(selectedColaborador.cpf)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Seção</div>
                          <div style={{ color: 'var(--text-primary)' }}>{selectedColaborador.secao_padrao?.secao_padrao || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Datas */}
                <div className="card mb-4">
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
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

                  {/* Cálculos automáticos */}
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

                {/* CID e tipo */}
                <div className="card mb-4">
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || success}
                  >
                    {loading ? (
                      <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Salvando...</>
                    ) : (
                      <><FilePlus size={14} /> Lançar Atestado</>
                    )}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => router.push('/atestados')}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* MODO EXCEL (IMPORTAÇÃO EM LOTE DO RM LABORE) */}
          {mode === 'excel' && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Info size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Importação Cumulativa de Atestados (RM Labore):</strong>
                    <ul style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.7', fontSize: '13px' }}>
                      <li><strong>Preservação do Histórico:</strong> O upload de atestados adiciona os novos registros <u>sem apagar</u> ou substituir os lançamentos anteriores.</li>
                      <li><strong>Prevenção de Duplicidades:</strong> Registros com mesmo colaborador e datas idênticas são identificados e ignorados automaticamente para não duplicar dados.</li>
                      <li><strong>Vínculo Automático:</strong> Os atestados são vinculados aos colaboradores pelo CPF. Se o colaborador não existir no banco, ele será cadastrado automaticamente.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                className={`upload-area ${excelDragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setExcelDragOver(true); }}
                onDragLeave={() => setExcelDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setExcelDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) setExcelFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{ marginBottom: '20px' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setExcelFile(f);
                  }}
                />
                <div className="upload-icon">
                  <FileSpreadsheet size={48} />
                </div>
                <div className="upload-title">
                  {excelFile ? excelFile.name : 'Arraste o arquivo de Atestados ou clique para selecionar'}
                </div>
                <div className="upload-subtitle">
                  {excelFile
                    ? `${(excelFile.size / 1024 / 1024).toFixed(2)} MB · Arquivo selecionado`
                    : 'Planilha exportada do RM Labore (.xlsx com colunas Nome, CPF, Data Inicio, Data Fim, CID)'}
                </div>
              </div>

              {excelFile && !excelLoading && !excelResult && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExcelUpload}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                >
                  <Upload size={16} /> Importar e Processar Atestados
                </button>
              )}

              {excelLoading && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 12px' }} />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Lendo e cadastrando atestados...</div>
                </div>
              )}

              {/* Resultado do Upload */}
              {excelResult && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    {excelResult.success ? (
                      <><CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-green)' }}>
                          Importação de Atestados Concluída!
                        </span></>
                    ) : (
                      <><AlertCircle size={20} style={{ color: 'var(--accent-red)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-red)' }}>
                          Erro no Processamento
                        </span></>
                    )}
                  </div>

                  {excelResult.error && (
                    <div className="alert alert-error">{excelResult.error}</div>
                  )}

                  {excelResult.success && excelResult.resumo && (
                    <>
                      <div className="grid-3" style={{ marginBottom: '16px', gap: '12px' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {excelResult.resumo.totalLinhas}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Linhas Lidas</div>
                        </div>

                        <div style={{ background: 'rgba(34,211,165,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(34,211,165,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-green)' }}>
                            {excelResult.resumo.inseridos}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Novos Atestados Adicionados</div>
                        </div>

                        <div style={{ background: 'rgba(245,158,79,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(245,158,79,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-orange)' }}>
                            {excelResult.resumo.duplicadosIgnorados}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Duplicados Preservados</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => { setExcelFile(null); setExcelResult(null); }}
                        >
                          Importar Outro Arquivo
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => router.push('/atestados')}
                        >
                          Ver Histórico de Atestados
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default function NovoAtestadoPage() {
  return (
    <Suspense>
      <NovoAtestadoForm />
    </Suspense>
  );
}
