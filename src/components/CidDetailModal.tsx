'use client';

import { useState, useEffect } from 'react';
import { Stethoscope, X, FileText, Activity, HeartPulse, CheckCircle2 } from 'lucide-react';
import { getGrupoOmsFromCidCode } from '@/lib/cidSync';

interface CidDetailModalProps {
  cidCode: string | null;
  onClose: () => void;
}

interface CidDetail {
  codigo: string;
  descricao: string;
  grupo: string;
}

export function CidDetailModal({ cidCode, onClose }: CidDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CidDetail | null>(null);

  useEffect(() => {
    if (!cidCode) {
      setDetail(null);
      return;
    }

    const cleanCode = cidCode.trim().toUpperCase();
    setLoading(true);

    fetch(`/api/cids?search=${encodeURIComponent(cleanCode)}`)
      .then(r => r.ok ? r.json() : [])
      .then((cids: any[]) => {
        const exact = cids.find((c: any) => c.codigo.toUpperCase() === cleanCode);
        if (exact) {
          setDetail({
            codigo: exact.codigo,
            descricao: exact.descricao,
            grupo: exact.grupo,
          });
        } else if (cids.length > 0) {
          setDetail({
            codigo: cleanCode,
            descricao: cids[0].descricao,
            grupo: cids[0].grupo,
          });
        } else {
          setDetail({
            codigo: cleanCode,
            descricao: `Diagnóstico / Patologia referente ao CID ${cleanCode}`,
            grupo: getGrupoOmsFromCidCode(cleanCode),
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setDetail({
          codigo: cleanCode,
          descricao: `Diagnóstico referente ao CID ${cleanCode}`,
          grupo: getGrupoOmsFromCidCode(cleanCode),
        });
        setLoading(false);
      });
  }, [cidCode]);

  if (!cidCode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          maxWidth: '560px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)'
            }}>
              <Stethoscope size={24} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Classificação CID-10 OMS
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                CID {cidCode}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '13px', color: '#64748b' }}>Consultando detalhes do CID no catálogo OMS...</p>
          </div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bloco de Descrição */}
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                <FileText size={14} style={{ color: '#2563eb' }} /> Descrição / Patologia
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                {detail.descricao}
              </div>
            </div>

            {/* Bloco de Grupo OMS */}
            <div style={{ background: '#f0f9ff', borderRadius: '16px', padding: '20px', border: '1px solid #bae6fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                <Activity size={14} style={{ color: '#0284c7' }} /> Grupo Epidemiológico OMS
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0369a1' }}>
                {detail.grupo}
              </div>
            </div>

            {/* Bloco de Gestão de Saúde */}
            <div style={{ background: '#faf5ff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                <HeartPulse size={14} style={{ color: '#9333ea' }} /> Gestão Ocupacional & Saúde
              </div>
              <div style={{ fontSize: '12.5px', color: '#581c87', lineHeight: 1.5 }}>
                Os atestados associados ao <strong>CID {detail.codigo}</strong> devem ser acompanhados pela equipe de Medicina do Trabalho para rastreio de reincidência e prevenção de afastamentos de longa duração.
              </div>
            </div>

            {/* Botão de Conclusão */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={onClose}
                className="btn btn-primary"
                style={{ padding: '10px 28px', borderRadius: '12px', fontWeight: 700, fontSize: '13.5px' }}
              >
                <CheckCircle2 size={16} /> Fechar Detalhamento
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
