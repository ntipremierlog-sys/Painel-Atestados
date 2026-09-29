'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  FilePlus,
  AlertTriangle,
  ArrowLeftRight,
  Upload,
  LogOut,
  History,
  BarChart3,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  badge?: boolean;
  cidBadge?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const navItems: NavSection[] = [
  {
    section: 'MENU',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'ANÁLISE & CIDs',
    items: [
      { href: '/analise-gerencial', label: 'Análise Gerencial', icon: BarChart3 },
      { href: '/cids-pendentes', label: 'CIDs Pendentes', icon: Stethoscope, cidBadge: true },
    ],
  },
  {
    section: 'ATESTADOS',
    items: [
      { href: '/atestados/novo', label: 'Lançar Atestado', icon: FilePlus },
      { href: '/atestados', label: 'Histórico', icon: History },
    ],
  },
  {
    section: 'GESTÃO',
    items: [
      { href: '/colaboradores', label: 'Colaboradores', icon: Users },
      { href: '/secoes-pendentes', label: 'Seções Pendentes', icon: AlertTriangle, badge: true },
      { href: '/de-para', label: 'De-Para de Seção', icon: ArrowLeftRight },
    ],
  },
  {
    section: 'BASE DE DADOS',
    items: [
      { href: '/importar', label: 'Importar Base', icon: Upload },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingCidCount, setPendingCidCount] = useState(0);
  const [acessoFinanceiro, setAcessoFinanceiro] = useState(false);

  useEffect(() => {
    fetch('/api/secoes?pendentes=true')
      .then(r => r.json())
      .then(data => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});

    fetch('/api/cids/pendentes')
      .then(r => r.json())
      .then(data => setPendingCidCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});

    fetch('/api/financeiro/acesso')
      .then(r => r.json())
      .then(data => setAcessoFinanceiro(data.acesso === true))
      .catch(() => {});
  }, [pathname]);

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header com Logo e Botão de Expandir/Recolher */}
      <div className="sidebar-logo" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '16px 6px' : '16px 12px',
        borderBottom: '1px solid #eaecf0',
        position: 'relative',
        minHeight: '102px',
      }}>
        {collapsed ? (
          <div
            onClick={onToggle}
            title="Clique para expandir o menu lateral"
            style={{
              width: '65px',
              height: '65px',
              borderRadius: '14px',
              background: '#ffffff',
              border: '1px solid #eaecf0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              padding: '6px',
              overflow: 'hidden',
            }}
          >
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: '4px' }}>
            <img
              src="/premier-logo-clean-white.png"
              alt="Premier Logistics"
              style={{
                width: '100%',
                maxHeight: '80px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(30, 27, 75, 0.08))',
              }}
            />
          </div>
        )}

        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#475569',
            transition: 'all 0.2s ease',
            marginLeft: collapsed ? '0' : '8px',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ padding: collapsed ? '14px 8px' : '20px 14px' }}>
        {navItems.map((section) => (
          <div key={section.section} className="nav-section" style={{ marginBottom: collapsed ? '12px' : '18px' }}>
            {!collapsed ? (
              <div className="nav-section-label" style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: '0.1em',
                marginBottom: '8px',
                paddingLeft: '12px',
              }}>
                {section.section}
              </div>
            ) : (
              <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 4px' }} />
            )}
            {section.items.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : item.href === '/atestados'
                  ? pathname === '/atestados'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: collapsed ? '12px 8px' : '11px 14px',
                    borderRadius: '12px',
                    color: isActive ? '#ffffff' : '#475569',
                    background: isActive ? 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)' : 'transparent',
                    boxShadow: isActive ? '0 4px 14px rgba(37, 99, 235, 0.25)' : 'none',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13.5px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    position: 'relative',
                    marginBottom: '4px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={18} style={{ minWidth: '18px', color: isActive ? '#ffffff' : '#64748b' }} />
                  {!collapsed && <span>{item.label}</span>}

                  {item.badge && pendingCount > 0 && (
                    <span
                      className="nav-badge"
                      style={collapsed ? {
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '9px',
                        padding: '1px 5px',
                        minWidth: '14px',
                        height: '14px',
                        lineHeight: '12px',
                      } : {}}
                    >
                      {pendingCount}
                    </span>
                  )}
                  {item.cidBadge && pendingCidCount > 0 && (
                    <span
                      className="nav-badge"
                      style={{
                        background: '#2563eb',
                        ...(collapsed ? {
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          fontSize: '9px',
                          padding: '1px 5px',
                          minWidth: '14px',
                          height: '14px',
                          lineHeight: '12px',
                        } : {}),
                      }}
                    >
                      {pendingCidCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Seção Financeiro — apenas para usuários autorizados */}
        {acessoFinanceiro && (
          <div className="nav-section" style={{ marginBottom: collapsed ? '12px' : '18px' }}>
            {!collapsed ? (
              <div className="nav-section-label" style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: '0.1em',
                marginBottom: '8px',
                paddingLeft: '12px',
              }}>
                FINANCEIRO
              </div>
            ) : (
              <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 4px' }} />
            )}
            {[
              { href: '/financeiro', label: 'Impacto Financeiro', icon: TrendingDown },
              { href: '/financeiro/tarifas', label: 'Tarifas por Unidade', icon: DollarSign },
            ].map((item) => {
              const isActive = item.href === '/financeiro'
                ? pathname === '/financeiro'
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: collapsed ? '12px 8px' : '11px 14px',
                    borderRadius: '12px',
                    color: isActive ? '#ffffff' : '#475569',
                    background: isActive ? 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)' : 'transparent',
                    boxShadow: isActive ? '0 4px 14px rgba(37, 99, 235, 0.25)' : 'none',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13.5px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    position: 'relative',
                    marginBottom: '4px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={18} style={{ minWidth: '18px', color: isActive ? '#ffffff' : '#64748b' }} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}

      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ padding: collapsed ? '14px 8px' : '16px 20px', borderTop: '1px solid #eaecf0' }}>
        {!collapsed && (
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
            {session?.user?.name || 'Administrador'}
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? 'Sair' : undefined}
          style={{
            color: '#ef4444',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px 8px' : '10px 14px',
            borderRadius: '10px',
            background: '#fef2f2',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
          onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
        >
          <LogOut size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}
