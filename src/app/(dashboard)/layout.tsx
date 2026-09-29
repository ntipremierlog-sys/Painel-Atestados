'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { Bell, ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/analise-gerencial': 'Análise Gerencial',
  '/cids-pendentes': 'CIDs Pendentes',
  '/atestados': 'Histórico de Atestados',
  '/atestados/novo': 'Lançar Atestado',
  '/colaboradores': 'Colaboradores',
  '/secoes-pendentes': 'Seções Pendentes',
  '/de-para': 'De-Para de Seção',
  '/importar': 'Importar Base',
  '/financeiro': 'Impacto Financeiro',
  '/financeiro/tarifas': 'Tarifas de Faturamento',
};

function getBreadcrumb(pathname: string): { label: string; href: string }[] {
  if (pathname === '/') return [];
  const label = ROUTE_LABELS[pathname];
  if (label) return [{ label, href: pathname }];
  // Handle dynamic routes like /colaboradores/123
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const parentPath = '/' + parts[0];
    const parentLabel = ROUTE_LABELS[parentPath];
    if (parentLabel) return [
      { label: parentLabel, href: parentPath },
      { label: 'Detalhes', href: pathname },
    ];
  }
  return [{ label: pathname, href: pathname }];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const alertsDropdownRef = useRef<HTMLDivElement | null>(null);

  const breadcrumb = getBreadcrumb(pathname);

  // Estados dos Alertas e Notificações
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [alertsList, setAlertsList] = useState<Array<{ id: string; title: string; desc: string; type: 'warning' | 'info' | 'danger'; href: string }>>([]);

  // Carregar alertas reais em tempo real
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const [secRes, cidRes] = await Promise.all([
          fetch('/api/secoes?pendentes=true').then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/api/cids/pendentes').then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        const pendingSecs = Array.isArray(secRes) ? secRes.length : 0;
        const pendingCids = Array.isArray(cidRes) ? cidRes.length : 0;

        const list: Array<{ id: string; title: string; desc: string; type: 'warning' | 'info' | 'danger'; href: string }> = [];

        if (pendingSecs > 0) {
          list.push({
            id: 'sec',
            title: 'Mapeamento de Seções Pendente',
            desc: `${pendingSecs} seção(ões) bruta(s) aguardando vínculo no De-Para.`,
            type: 'warning',
            href: '/de-para',
          });
        }

        if (pendingCids > 0) {
          list.push({
            id: 'cid',
            title: 'CIDs Aguardando Referência OMS',
            desc: `${pendingCids} código(s) de CID pendentes no catálogo.`,
            type: 'info',
            href: '/cids-pendentes',
          });
        }

        setAlertsList(list);
        setAlertsCount(pendingSecs + pendingCids);
      } catch (e) {
        console.error('Erro ao buscar alertas:', e);
      }
    }

    if (status === 'authenticated') {
      fetchAlerts();
    }
  }, [status]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!showAlertsDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(event.target as Node)) {
        setShowAlertsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAlertsDropdown]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  // ResizeObserver no elemento main para notificar Recharts (ResponsiveContainer) instantaneamente durante a transição da sidebar
  useEffect(() => {
    if (!mainRef.current) return;
    let animationFrameId: number;

    const observer = new ResizeObserver(() => {
      animationFrameId = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });

    observer.observe(mainRef.current);

    return () => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Disparar redimensionamento gradual ao alternar o estado do menu
  useEffect(() => {
    const triggerResize = () => {
      window.dispatchEvent(new Event('resize'));
    };

    triggerResize();
    const t1 = setTimeout(triggerResize, 50);
    const t2 = setTimeout(triggerResize, 150);
    const t3 = setTimeout(triggerResize, 260);
    const t4 = setTimeout(triggerResize, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [collapsed]);

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <main ref={mainRef} className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <div className="dashboard-container">
          <div className="dashboard-canvas">
            {/* Topbar: Breadcrumb à esquerda + Alertas/Perfil à direita */}
            <div className="canvas-topbar" style={{ justifyContent: 'space-between', gap: '16px', position: 'relative' }}>
              
              {/* Breadcrumb dinâmico */}
              <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' }}>
                <button
                  onClick={() => router.push('/')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '4px', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                  <Home size={14} />
                </button>
                {breadcrumb.map((crumb, i) => (
                  <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChevronRight size={13} style={{ color: '#cbd5e1' }} />
                    {i === breadcrumb.length - 1 ? (
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{crumb.label}</span>
                    ) : (
                      <button
                        onClick={() => router.push(crumb.href)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600, padding: '2px 4px', borderRadius: '4px', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      >
                        {crumb.label}
                      </button>
                    )}
                  </span>
                ))}
              </nav>


              {/* Ações da Topbar Donezo */}
              <div ref={alertsDropdownRef} className="canvas-topbar-actions" style={{ position: 'relative' }}>
                
                {/* Botão de Alertas Ativos */}
                <button
                  className="icon-btn-circle"
                  title="Central de Alertas & Notificações"
                  onClick={() => setShowAlertsDropdown(prev => !prev)}
                  style={{
                    position: 'relative',
                    background: showAlertsDropdown ? '#e0f2fe' : '#ffffff',
                    borderColor: showAlertsDropdown ? '#0284c7' : '#eaecf0',
                    color: showAlertsDropdown ? '#0284c7' : '#475569',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                >
                  <Bell size={18} />
                  {alertsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '10px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                    }}>
                      {alertsCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Flutuante de Central de Alertas */}
                {showAlertsDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '52px',
                      right: '0',
                      width: '360px',
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.15)',
                      zIndex: 999,
                      overflow: 'hidden',
                      animation: 'fadeIn 0.2s ease-out',
                    }}
                  >
                    {/* Header do Dropdown */}
                    <div style={{
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}>
                        <Bell size={16} style={{ color: '#38bdf8' }} /> Central de Alertas
                      </div>
                      <span style={{
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                      }}>
                        {alertsList.length} Notificações
                      </span>
                    </div>

                    {/* Lista de Alertas */}
                    <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px 0' }}>
                      {alertsList.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                          Nenhum alerta pendente no momento! 🎉
                        </div>
                      ) : (
                        alertsList.map(item => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setShowAlertsDropdown(false);
                              router.push(item.href);
                            }}
                            style={{
                              padding: '14px 20px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                          >
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: item.type === 'warning' ? '#f59e0b' : item.type === 'danger' ? '#ef4444' : '#2563eb',
                              marginTop: '5px',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.35 }}>
                                {item.desc}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer do Dropdown */}
                    <div style={{
                      padding: '10px 16px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      textAlign: 'center',
                      fontSize: '11px',
                      color: '#64748b',
                      fontWeight: 600,
                    }}>
                      Clique em um alerta para resolver imediatamente
                    </div>
                  </div>
                )}

                {/* Badge do Usuário Logado com Logo da Premier */}
                <div className="user-profile-badge">
                  <div style={{
                    width: '41px',
                    height: '41px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                    <img
                      src="/premier-logo-clean-white.png"
                      alt="Premier Logistics"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                      {session.user?.name || 'Administrador'}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      Premier Logistics
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conteúdo da Página */}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
