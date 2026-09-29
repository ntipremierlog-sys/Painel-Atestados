'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

interface FinanceiroAuthGuardProps {
  children: React.ReactNode;
}

export default function FinanceiroAuthGuard({ children }: FinanceiroAuthGuardProps) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar se a sessão financeira já foi desbloqueada no navegador
    const isUnlocked = sessionStorage.getItem('fin_unlocked') === 'true';
    setUnlocked(isUnlocked);
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/financeiro/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        sessionStorage.setItem('fin_unlocked', 'true');
        setUnlocked(true);
      } else {
        setError(data.error || 'Senha incorreta');
      }
    } catch {
      setError('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  }

  if (unlocked === null) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '20px' }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        border: '1px solid #e2e8f0',
        padding: '36px 32px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 20px 50px rgba(30, 27, 75, 0.08)',
        textAlign: 'center',
      }}>
        {/* Ícone de Cadeado em Azul Premier */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
        }}>
          <Lock size={30} color="#ffffff" />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e1b4b', marginBottom: '8px' }}>
          Área Restrita — Financeiro
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          Informe sua senha de usuário ou o PIN de acesso gerencial para visualizar os dados financeiros.
        </p>

        <form onSubmit={handleUnlock} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Senha / PIN de Acesso
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha ou PIN..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 38px',
                  borderRadius: '12px',
                  border: error ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
              />
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', color: '#dc2626', fontSize: '12.5px', marginBottom: '16px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !password.trim() ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <div className="spinner" style={{ width: '16px', height: '16px', borderColor: '#ffffff #ffffff #ffffff transparent' }} />
            ) : (
              <>
                Desbloquear Acesso <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#94a3b8', fontSize: '11.5px' }}>
          <ShieldCheck size={14} color="#2563eb" />
          <span>Acesso protegido para a Diretoria</span>
        </div>
      </div>
    </div>
  );
}
