-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nome" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SecaoDePara" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secao_bruta" TEXT NOT NULL,
    "secao_padrao" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "secao_bruta_atual" TEXT,
    "secao_padrao_id" INTEGER,
    "data_admissao" DATETIME,
    "data_demissao" DATETIME,
    "situacao" TEXT NOT NULL DEFAULT 'ATIVO',
    "salario_mensal" REAL,
    "descricao_situacao" TEXT,
    "matricula" TEXT,
    "nome_cargo" TEXT,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "Colaborador_secao_padrao_id_fkey" FOREIGN KEY ("secao_padrao_id") REFERENCES "SecaoDePara" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Atestado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "colaborador_id" INTEGER NOT NULL,
    "data_inicio" DATETIME NOT NULL,
    "data_fim" DATETIME NOT NULL,
    "data_retorno" DATETIME NOT NULL,
    "dias_afastado" INTEGER NOT NULL,
    "cid" TEXT,
    "tipo_atestado" TEXT,
    "mes_competencia" TEXT NOT NULL,
    "observacoes" TEXT,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "Atestado_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportacaoLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "arquivo_nome" TEXT NOT NULL,
    "data_importacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linhas_processadas" INTEGER NOT NULL,
    "secoes_novas_encontradas" INTEGER NOT NULL,
    "colaboradores_inseridos" INTEGER NOT NULL,
    "colaboradores_atualizados" INTEGER NOT NULL,
    "erros" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "SecaoDePara_secao_bruta_key" ON "SecaoDePara"("secao_bruta");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_cpf_key" ON "Colaborador"("cpf");
