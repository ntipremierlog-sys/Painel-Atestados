'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Users, FileText, Database, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ImportBaseResult {
  success: boolean;
  resumo?: {
    totalLinhas: number;
    colaboradoresInseridos: number;
    colaboradoresAtualizados: number;
    atestadosInseridos: number;
    atestadosDuplicados: number;
    secoesNovasEncontradas: number;
    erros: number;
  };
  error?: string;
}

interface ImportColabResult {
  success: boolean;
  resumo?: {
    linhasProcessadas: number;
    inseridos: number;
    atualizados: number;
    erros: number;
    secoesNovasEncontradas: number;
    secoesNovas: string[];
    camposMapeados: Record<string, string>;
  };
  error?: string;
}

interface ImportAtestadoResult {
  success: boolean;
  resumo?: {
    totalLinhas: number;
    inseridos: number;
    duplicadosIgnorados: number;
    erros: number;
  };
  error?: string;
}

export default function ImportarPage() {
  const router = useRouter();
  const [tipoImportacao, setTipoImportacao] = useState<'base_historica' | 'atestados' | 'colaboradores'>('base_historica');

  // Base Histórica State
  const [fileBase, setFileBase] = useState<File | null>(null);
  const [dragOverBase, setDragOverBase] = useState(false);
  const [loadingBase, setLoadingBase] = useState(false);
  const [resultBase, setResultBase] = useState<ImportBaseResult | null>(null);
  const inputBaseRef = useRef<HTMLInputElement>(null);

  // Colaboradores state
  const [dragOverColab, setDragOverColab] = useState(false);
  const [fileColab, setFileColab] = useState<File | null>(null);
  const [loadingColab, setLoadingColab] = useState(false);
  const [resultColab, setResultColab] = useState<ImportColabResult | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const inputColabRef = useRef<HTMLInputElement>(null);

  // Atestados state
  const [dragOverAtestado, setDragOverAtestado] = useState(false);
  const [fileAtestado, setFileAtestado] = useState<File | null>(null);
  const [modoAtestado, setModoAtestado] = useState<'substituir_competencia' | 'upsert'>('substituir_competencia');
  const [loadingAtestado, setLoadingAtestado] = useState(false);
  const [resultAtestado, setResultAtestado] = useState<ImportAtestadoResult | null>(null);
  const inputAtestadoRef = useRef<HTMLInputElement>(null);

  const handleUploadBase = async () => {
    if (!fileBase) return;
    setLoadingBase(true);
    setResultBase(null);
    const formData = new FormData();
    formData.append('file', fileBase);
    try {
      const res = await fetch('/api/importar/base-historica', { method: 'POST', body: formData });
      const data = await res.json();
      setResultBase(data);
    } catch {
      setResultBase({ success: false, error: 'Erro de comunicação ao importar base histórica' });
    }
    setLoadingBase(false);
  };

  const handleUploadColab = async () => {
    if (!fileColab) return;
    setLoadingColab(true);
    setResultColab(null);
    const formData = new FormData();
    formData.append('file', fileColab);
    try {
      const res = await fetch('/api/importar', { method: 'POST', body: formData });
      const data = await res.json();
      setResultColab(data);
    } catch {
      setResultColab({ success: false, error: 'Erro de comunicação ao importar cadastro' });
    }
    setLoadingColab(false);
  };

  const handleClearDatabase = async () => {
    if (!confirm('ATENÇÃO: Tem certeza que deseja apagar TODOS os colaboradores e atestados do sistema? Esta ação é irreversível.')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/colaboradores/limpar', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('A base foi ZERADA. ' + data.message);
        setResultBase(null);
        setResultColab(null);
        setResultAtestado(null);
        setFileBase(null);
        setFileColab(null);
        setFileAtestado(null);
      } else {
        alert('Erro: ' + data.error);
      }
    } catch {
      alert('Erro de comunicação ao tentar limpar a base.');
    }
    setIsClearing(false);
  };

  const handleUploadAtestado = async () => {
    if (!fileAtestado) return;
    setLoadingAtestado(true);
    setResultAtestado(null);
    const formData = new FormData();
    formData.append('file', fileAtestado);
    formData.append('modo', modoAtestado);
    try {
      const res = await fetch('/api/atestados/importar', { method: 'POST', body: formData });
      const data = await res.json();
      setResultAtestado(data);
    } catch {
      setResultAtestado({ success: false, error: 'Erro de comunicação ao importar atestados' });
    }
    setLoadingAtestado(false);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Central de Importação e Carga de Dados</h1>
        <p className="page-subtitle">Alimente o sistema com a Base Histórica Inicial ou com planilhas recorrentes do RM Labore</p>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: '840px' }}>

          {/* Abas de Opções de Importação */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px',
            background: 'var(--bg-secondary)',
            padding: '6px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid var(--border)'
          }}>
            <button
              type="button"
              className={`btn ${tipoImportacao === 'base_historica' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTipoImportacao('base_historica')}
              style={{ justifyContent: 'center', fontSize: '13px', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
            >
              <Database size={16} /> 1. Base Histórica (Análise 2026)
            </button>
            <button
              type="button"
              className={`btn ${tipoImportacao === 'atestados' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTipoImportacao('atestados')}
              style={{ justifyContent: 'center', fontSize: '13px', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
            >
              <FileText size={16} /> 2. Atestados Recorrentes (RM)
            </button>
            <button
              type="button"
              className={`btn ${tipoImportacao === 'colaboradores' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTipoImportacao('colaboradores')}
              style={{ justifyContent: 'center', fontSize: '13px', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
            >
              <Users size={16} /> 3. Folha de Colaboradores (RM)
            </button>
          </div>

          {/* OPCÃO 1: BASE HISTÓRICA INICIAL */}
          {tipoImportacao === 'base_historica' && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Info size={22} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '14px' }}>Carga Inicial da Base Consolidada ("ANÁLISE DE LANÇAMENTOS - 2026"):</strong>
                    <ul style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.7', fontSize: '13px' }}>
                      <li><strong>Objetivo:</strong> Importar o arquivo histórico completo de uma só vez para alimentar a plataforma com os dados legados.</li>
                      <li><strong>O que é importado:</strong> O sistema lê todos os colaboradores com suas funções/seções e cadastra todos os atestados acumulados até o momento.</li>
                      <li><strong>Próximos Passos:</strong> Após carregar a base inicial, você usará a opção <strong>"2. Atestados Recorrentes (RM Labore)"</strong> no dia a dia para fazer as atualizações normais sem sobrescrever nada.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div
                className={`upload-area ${dragOverBase ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverBase(true); }}
                onDragLeave={() => setDragOverBase(false)}
                onDrop={e => { e.preventDefault(); setDragOverBase(false); const f = e.dataTransfer.files[0]; if (f) { setFileBase(f); setResultBase(null); } }}
                onClick={() => inputBaseRef.current?.click()}
                style={{ marginBottom: '20px' }}
              >
                <input
                  ref={inputBaseRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFileBase(f); setResultBase(null); } }}
                />
                <div className="upload-icon"><Database size={48} /></div>
                <div className="upload-title">{fileBase ? fileBase.name : 'Arraste a planilha "ANÁLISE DE LANÇAMENTOS - 2026.xlsx" ou clique aqui'}</div>
                <div className="upload-subtitle">
                  {fileBase ? `${(fileBase.size / 1024 / 1024).toFixed(2)} MB · Arquivo pronto para Carga Inicial` : 'Planilha histórica consolidada (.xlsx) contendo a aba BASE'}
                </div>
              </div>

              {fileBase && !loadingBase && !resultBase && (
                <button className="btn btn-primary" onClick={handleUploadBase} style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '14px' }}>
                  <Upload size={16} /> Realizar Carga Inicial da Plataforma
                </button>
              )}

              {loadingBase && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 12px' }} />
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>Importando base histórica inicial...</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Cadastrando colaboradores e histórico de atestados acumulados...</div>
                </div>
              )}

              {resultBase && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    {resultBase.success ? (
                      <><CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-green)' }}>Carga Inicial Concluída com Sucesso!</span></>
                    ) : (
                      <><AlertCircle size={20} style={{ color: 'var(--accent-red)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-red)' }}>Erro na Carga Inicial</span></>
                    )}
                  </div>

                  {resultBase.error && <div className="alert alert-error">{resultBase.error}</div>}

                  {resultBase.success && resultBase.resumo && (
                    <>
                      <div className="grid-4" style={{ marginBottom: '16px', gap: '12px' }}>
                        <div style={{ background: '#f1f5f9', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>{resultBase.resumo.totalLinhas}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Linhas Lidas</div>
                        </div>

                        <div style={{ background: 'rgba(37,99,235,0.06)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(37,99,235,0.15)' }}>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent-blue)' }}>{resultBase.resumo.colaboradoresInseridos}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Colaboradores</div>
                        </div>

                        <div style={{ background: 'rgba(5,150,105,0.06)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(5,150,105,0.15)' }}>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent-green)' }}>{resultBase.resumo.atestadosInseridos}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Atestados Históricos</div>
                        </div>

                        <div style={{ background: 'rgba(217,119,6,0.06)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(217,119,6,0.15)' }}>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent-orange)' }}>{resultBase.resumo.atestadosDuplicados}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Duplicados Ignorados</div>
                        </div>
                      </div>

                      {resultBase.resumo.secoesNovasEncontradas > 0 && (
                        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
                          ⚠️ <strong>{resultBase.resumo.secoesNovasEncontradas}</strong> seção(ões) bruta(s) precisam de classificação.
                          Acesse a tela de <a href="/secoes-pendentes" style={{ color: 'inherit', fontWeight: '700', textDecoration: 'underline' }}>Seções Pendentes</a>.
                        </div>
                      )}

                      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <button className="btn btn-primary" onClick={() => router.push('/')}>
                          Ir para o Dashboard
                        </button>
                        <button className="btn btn-secondary" onClick={() => router.push('/atestados')}>
                          Ver Histórico de Atestados
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* OPCÃO 2: ATESTADOS RECORRENTES (RM LABORE) */}
          {tipoImportacao === 'atestados' && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Info size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Alimentação Recorrente de Atestados (RM Labore):</strong>
                    <ul style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.7', fontSize: '13px' }}>
                      <li><strong>Uso no Dia a Dia:</strong> Esta opção é para relatórios mensais ou parciais extraídos do RM Labore.</li>
                      <li><strong>Substituição de Competência:</strong> Quando selecionado, substitui 100% dos lançamentos do mês enviado para manter o banco perfeitamente sincronizado com o relatório mais recente.</li>
                      <li><strong>Atualização Inteligente:</strong> Atualiza atestados existentes com novos dias/CIDs e cadastra novos lançamentos sem perda de histórico.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Seletor de Modo de Importação */}
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '14px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Modo de Importação:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="modoAtestado"
                      value="substituir_competencia"
                      checked={modoAtestado === 'substituir_competencia'}
                      onChange={() => setModoAtestado('substituir_competencia')}
                    />
                    <span><strong>Substituir Competência (Recomendado)</strong> — Garante paridade 1-para-1 com o relatório enviado (135 linhas = 135 registros no banco).</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="modoAtestado"
                      value="upsert"
                      checked={modoAtestado === 'upsert'}
                      onChange={() => setModoAtestado('upsert')}
                    />
                    <span><strong>Manter e Atualizar Existentes (Upsert)</strong> — Atualiza os atestados cadastrados e adiciona novos sem apagar nada.</span>
                  </label>
                </div>
              </div>

              <div
                className={`upload-area ${dragOverAtestado ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverAtestado(true); }}
                onDragLeave={() => setDragOverAtestado(false)}
                onDrop={e => { e.preventDefault(); setDragOverAtestado(false); const f = e.dataTransfer.files[0]; if (f) { setFileAtestado(f); setResultAtestado(null); } }}
                onClick={() => inputAtestadoRef.current?.click()}
                style={{ marginBottom: '20px' }}
              >
                <input
                  ref={inputAtestadoRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFileAtestado(f); setResultAtestado(null); } }}
                />
                <div className="upload-icon"><FileSpreadsheet size={48} /></div>
                <div className="upload-title">{fileAtestado ? fileAtestado.name : 'Arraste a planilha de Atestados do RM Labore ou clique'}</div>
                <div className="upload-subtitle">
                  {fileAtestado ? `${(fileAtestado.size / 1024 / 1024).toFixed(2)} MB · Arquivo pronto` : 'Planilha de atestados extraída do RM Labore (.xlsx com colunas Nome, CPF, Data Inicio, Data Fim, CID)'}
                </div>
              </div>

              {fileAtestado && !loadingAtestado && !resultAtestado && (
                <button className="btn btn-primary" onClick={handleUploadAtestado} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                  <Upload size={16} /> Importar Planilha de Atestados ({modoAtestado === 'substituir_competencia' ? 'Modo Substituição' : 'Modo Atualização'})
                </button>
              )}

              {loadingAtestado && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 12px' }} />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Processando lançamentos de atestados...</div>
                </div>
              )}

              {resultAtestado && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    {resultAtestado.success ? (
                      <><CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-green)' }}>Atestados Importados com Sucesso!</span></>
                    ) : (
                      <><AlertCircle size={20} style={{ color: 'var(--accent-red)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-red)' }}>Erro no Processamento</span></>
                    )}
                  </div>

                  {resultAtestado.error && <div className="alert alert-error">{resultAtestado.error}</div>}

                  {resultAtestado.success && resultAtestado.resumo && (
                    <>
                      <div className="grid-3" style={{ marginBottom: '16px', gap: '12px' }}>
                        <div style={{ background: '#f1f5f9', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{resultAtestado.resumo.totalLinhas}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Linhas Lidas</div>
                        </div>
                        <div style={{ background: 'rgba(5,150,105,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(5,150,105,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-green)' }}>{resultAtestado.resumo.inseridos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Novos Atestados Adicionados</div>
                        </div>
                        <div style={{ background: 'rgba(217,119,6,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(217,119,6,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-orange)' }}>{resultAtestado.resumo.duplicadosIgnorados}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Duplicados Preservados</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setFileAtestado(null); setResultAtestado(null); }}>
                          Nova importação
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push('/atestados')}>Ver Histórico de Atestados</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* OPCÃO 3: FOLHA DE COLABORADORES */}
          {tipoImportacao === 'colaboradores' && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                <div>
                  <strong>Importação de Cadastro da Folha de Pagamento (RM):</strong>
                  <ul style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.7', fontSize: '13px' }}>
                    <li>Detecta automaticamente as colunas pelo cabeçalho (CPF, Nome, Seção, Função, Admissão, Demissão, Salário).</li>
                    <li>Faz <strong>upsert automático pelo CPF</strong> (insere novos colaboradores e atualiza cadastros existentes).</li>
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClearDatabase}
                  disabled={isClearing}
                  style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                >
                  {isClearing ? 'Limpando...' : 'Zerar Base de Colaboradores Atual'}
                </button>
              </div>

              <div
                className={`upload-area ${dragOverColab ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverColab(true); }}
                onDragLeave={() => setDragOverColab(false)}
                onDrop={e => { e.preventDefault(); setDragOverColab(false); const f = e.dataTransfer.files[0]; if (f) { setFileColab(f); setResultColab(null); } }}
                onClick={() => inputColabRef.current?.click()}
                style={{ marginBottom: '20px' }}
              >
                <input
                  ref={inputColabRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFileColab(f); setResultColab(null); } }}
                />
                <div className="upload-icon"><FileSpreadsheet size={48} /></div>
                <div className="upload-title">{fileColab ? fileColab.name : 'Arraste a planilha de Folha de Pagamento ou clique'}</div>
                <div className="upload-subtitle">
                  {fileColab ? `${(fileColab.size / 1024 / 1024).toFixed(2)} MB · Arquivo pronto` : 'Planilha exportada da folha RM com 57 colunas (.xlsx)'}
                </div>
              </div>

              {fileColab && !loadingColab && !resultColab && (
                <button className="btn btn-primary" onClick={handleUploadColab} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                  <Upload size={16} /> Importar Cadastro de Colaboradores
                </button>
              )}

              {loadingColab && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 12px' }} />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Processando cadastro de colaboradores...</div>
                </div>
              )}

              {resultColab && (
                <div className="card" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    {resultColab.success ? (
                      <><CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-green)' }}>Importação concluída!</span></>
                    ) : (
                      <><AlertCircle size={20} style={{ color: 'var(--accent-red)' }} />
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--accent-red)' }}>Erro na importação</span></>
                    )}
                  </div>

                  {resultColab.error && <div className="alert alert-error">{resultColab.error}</div>}

                  {resultColab.success && resultColab.resumo && (
                    <>
                      <div className="grid-3" style={{ marginBottom: '16px', gap: '12px' }}>
                        <div style={{ background: '#f1f5f9', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{resultColab.resumo.linhasProcessadas}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Linhas processadas</div>
                        </div>
                        <div style={{ background: 'rgba(5,150,105,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(5,150,105,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-green)' }}>{resultColab.resumo.inseridos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Inseridos</div>
                        </div>
                        <div style={{ background: 'rgba(37,99,235,0.08)', padding: '14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(37,99,235,0.15)' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-blue)' }}>{resultColab.resumo.atualizados}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Atualizados</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setFileColab(null); setResultColab(null); }}>
                          Nova importação
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push('/colaboradores')}>Ver colaboradores</button>
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
