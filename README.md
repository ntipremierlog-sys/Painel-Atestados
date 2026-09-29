# Gestão de Atestados — Premier Logistics

Sistema de controle e análise de absenteísmo com integração ao RM Labore, dashboard de KPIs e catálogo CID-10 da OMS.

## ⚠️ Aviso Importante — Banco de Dados SQLite

O sistema usa **SQLite** (`prisma/dev.db`) como banco de dados. Este arquivo contém **todos os dados de produção**.

> **FAÇA BACKUP REGULARMENTE!** Copie o arquivo `prisma/dev.db` para um local seguro (OneDrive, pendrive, etc.) antes de qualquer atualização do sistema.

**Comando de backup manual (PowerShell):**
```powershell
Copy-Item "prisma\dev.db" "prisma\backup_$(Get-Date -Format 'yyyyMMdd_HHmm').db"
```

**Futuramente:** Para maior segurança em produção, migrar para PostgreSQL ou SQL Server.

---

## 🚀 Como Iniciar

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## 🔧 Configuração

O arquivo `.env` contém as configurações:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Caminho do banco SQLite |
| `NEXTAUTH_SECRET` | Chave secreta JWT (manter segura!) |
| `NEXTAUTH_URL` | URL base da aplicação |

> Gere uma `NEXTAUTH_SECRET` segura: `openssl rand -base64 32`

---

## 📋 Scripts Disponíveis

```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Build de produção
npm run prisma:studio    # Interface visual do banco
npm run prisma:seed      # Popular banco com usuário admin padrão
```

---

## 🏗️ Estrutura do Projeto

```
src/
├── app/
│   ├── (dashboard)/     # Páginas da aplicação (Dashboard, Atestados, etc.)
│   ├── api/             # Rotas de API (Next.js Route Handlers)
│   └── login/           # Página de login
├── components/
│   └── Sidebar.tsx      # Menu lateral
└── lib/
    ├── auth.ts          # Helper de autenticação
    ├── prisma.ts        # Cliente Prisma (singleton)
    ├── secaoSync.ts     # Sincronização De-Para de seções
    └── exportUtils.ts   # Exportação PDF/Excel
prisma/
├── schema.prisma        # Modelo do banco de dados
└── dev.db               # Banco SQLite (FAZER BACKUP!)
scripts/                 # Scripts auxiliares de diagnóstico
```

---

## 👥 Perfis de Acesso

| Role | Permissões |
|---|---|
| `ADMIN` | Acesso total: importar, editar, excluir |
| `VIEWER` | Apenas visualização (em implementação) |

---

## 📦 Principais Dependências

- **Next.js 16** — Framework React
- **Prisma 5** — ORM + SQLite
- **NextAuth v4** — Autenticação JWT
- **Recharts** — Gráficos do dashboard
- **ExcelJS / jsPDF** — Exportação de relatórios
- **xlsx** — Leitura de planilhas RM Labore
