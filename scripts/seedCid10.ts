import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAPITULOS_CID10: Record<string, string> = {
  A: 'Doenças Infecciosas e Parasitárias',
  B: 'Doenças Infecciosas e Parasitárias',
  C: 'Neoplasias (Tumores)',
  D: 'Neoplasias e Doenças do Sangue',
  E: 'Doenças Endócrinas, Nutricionais e Metabólicas',
  F: 'Transtornos Mentais e Comportamentais',
  G: 'Doenças do Sistema Nervoso',
  H: 'Doenças do Olho, Ouvido e Anexos',
  I: 'Doenças do Aparelho Circulatório',
  J: 'Doenças do Aparelho Respiratório',
  K: 'Doenças do Aparelho Digestivo',
  L: 'Doenças da Pele e do Tecido Subcutâneo',
  M: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo',
  N: 'Doenças do Sistema Geniturinário',
  O: 'Gravidez, Parto e Puerpério',
  P: 'Algumas Afecções Originadas no Período Perinatal',
  Q: 'Malformações Congênitas e Anomalias Cromossômicas',
  R: 'Sintomas, Sinais e Achados Anormais',
  S: 'Lesões, Envenenamento e Causas Externas',
  T: 'Lesões, Envenenamento e Causas Externas',
  U: 'Códigos para Propósitos Especiais (Ex: COVID-19)',
  V: 'Causas Externas de Morbidade e Mortalidade',
  W: 'Causas Externas de Morbidade e Mortalidade',
  X: 'Causas Externas de Morbidade e Mortalidade',
  Y: 'Causas Externas de Morbidade e Mortalidade',
  Z: 'Fatores que Influenciam o Estado de Saúde',
};

const BASE_CIDS = [
  // Aparelho Respiratório
  { codigo: 'J06.9', descricao: 'Infecção aguda das vias aéreas superiores não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J06', descricao: 'Infecções agudas das vias aéreas superiores de localizações múltiplas e não especificadas', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J01.9', descricao: 'Sinusite aguda não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J01', descricao: 'Sinusite aguda', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J03.9', descricao: 'Amigdalite aguda não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J03', descricao: 'Amigdalite aguda', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J00', descricao: 'Nasofaringite aguda [resfriado comum]', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J11', descricao: 'Influenza [gripe] devido a vírus não identificado', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J18.9', descricao: 'Pneumonia não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J20.9', descricao: 'Bronquite aguda não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J30.4', descricao: 'Rinite alérgica não especificada', grupo: 'Doenças do Aparelho Respiratório' },
  { codigo: 'J45', descricao: 'Asma', grupo: 'Doenças do Aparelho Respiratório' },

  // Osteomuscular
  { codigo: 'M54.5', descricao: 'Dor lombar baixa (Lumbago com ciática / Dorsalgia)', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M54.4', descricao: 'Lumbago com ciática', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M54', descricao: 'Dorsalgia', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M54.9', descricao: 'Dorsalgia não especificada', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M75.1', descricao: 'Síndrome do manguito rotador', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M75', descricao: 'Lesões do ombro', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M65.9', descricao: 'Sinovite e tenossinovite não especificada', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M25.5', descricao: 'Dor articular', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },
  { codigo: 'M51.1', descricao: 'Transtornos de discos intervertebrais radiculopatia', grupo: 'Doenças do Sistema Osteomuscular e Tecido Conjuntivo' },

  // Transtornos Mentais
  { codigo: 'F41.1', descricao: 'Ansiedade generalizada', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F41.2', descricao: 'Transtorno misto ansioso e depressivo', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F41', descricao: 'Outros transtornos ansiosos', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F32.9', descricao: 'Episódio depressivo não especificado', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F32', descricao: 'Episódios depressivos', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F43.1', descricao: 'Estado de estresse pós-traumático', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F43.2', descricao: 'Transtornos de adaptação', grupo: 'Transtornos Mentais e Comportamentais' },
  { codigo: 'F43', descricao: 'Reações ao estresse grave e transtornos de adaptação', grupo: 'Transtornos Mentais e Comportamentais' },

  // Aparelho Digestivo
  { codigo: 'K29.7', descricao: 'Gastrite não especificada', grupo: 'Doenças do Aparelho Digestivo' },
  { codigo: 'K29', descricao: 'Gastrite e duodenite', grupo: 'Doenças do Aparelho Digestivo' },
  { codigo: 'K30', descricao: 'Dispepsia', grupo: 'Doenças do Aparelho Digestivo' },
  { codigo: 'K52.9', descricao: 'Gastroenterite e colite não-infecciosas não especificadas', grupo: 'Doenças do Aparelho Digestivo' },
  { codigo: 'K52', descricao: 'Outras gastroenterites e colites não-infecciosas', grupo: 'Doenças do Aparelho Digestivo' },
  { codigo: 'K80', descricao: 'Colelitíase', grupo: 'Doenças do Aparelho Digestivo' },

  // Infecciosas
  { codigo: 'A09', descricao: 'Gastroenterite e colite de origem infecciosa presumível', grupo: 'Doenças Infecciosas e Parasitárias' },
  { codigo: 'B34.9', descricao: 'Infecção viral não especificada', grupo: 'Doenças Infecciosas e Parasitárias' },
  { codigo: 'B34', descricao: 'Infecção viral de localização não especificada', grupo: 'Doenças Infecciosas e Parasitárias' },
  { codigo: 'B30.9', descricao: 'Conjuntivite viral não especificada', grupo: 'Doenças Infecciosas e Parasitárias' },
  { codigo: 'A90', descricao: 'Dengue [dengue clássico]', grupo: 'Doenças Infecciosas e Parasitárias' },
  { codigo: 'U07.1', descricao: 'COVID-19, vírus identificado', grupo: 'Códigos para Propósitos Especiais (Ex: COVID-19)' },

  // Sintomas e Achados
  { codigo: 'R10.4', descricao: 'Outras dores abdominais e as não especificadas', grupo: 'Sintomas, Sinais e Achados Anormais' },
  { codigo: 'R10', descricao: 'Dor abdominal e pélvica', grupo: 'Sintomas, Sinais e Achados Anormais' },
  { codigo: 'R51', descricao: 'Cefaléia', grupo: 'Sintomas, Sinais e Achados Anormais' },
  { codigo: 'R50.9', descricao: 'Febre não especificada', grupo: 'Sintomas, Sinais e Achados Anormais' },
  { codigo: 'R42', descricao: 'Tontura e instabilidade', grupo: 'Sintomas, Sinais e Achados Anormais' },

  // Lesões e Causas Externas
  { codigo: 'S93.4', descricao: 'Entorse e distensão do tornozelo', grupo: 'Lesões, Envenenamento e Causas Externas' },
  { codigo: 'S83.6', descricao: 'Entorse e distensão de outras partes do joelho', grupo: 'Lesões, Envenenamento e Causas Externas' },
  { codigo: 'S62.6', descricao: 'Fratura de outro dedo', grupo: 'Lesões, Envenenamento e Causas Externas' },

  // Aparelho Circulatório
  { codigo: 'I10', descricao: 'Hipertensão essencial (primária)', grupo: 'Doenças do Aparelho Circulatório' },
  { codigo: 'I20.9', descricao: 'Angina pectoris não especificada', grupo: 'Doenças do Aparelho Circulatório' },

  // Geniturinário
  { codigo: 'N39.0', descricao: 'Infecção do trato urinário de localização não especificada', grupo: 'Doenças do Sistema Geniturinário' },
  { codigo: 'N20.1', descricao: 'Cálculo do ureter', grupo: 'Doenças do Sistema Geniturinário' },

  // Gravidez
  { codigo: 'O80', descricao: 'Parto único espontâneo', grupo: 'Gravidez, Parto e Puerpério' },
  { codigo: 'Z76.2', descricao: 'Acompanhamento médico de outra criança ou lactente saudável', grupo: 'Fatores que Influenciam o Estado de Saúde' },
];

async function seed() {
  console.log('🌱 Populando tabela Cid10Referencia com base de dados inicial...');

  let inseridos = 0;
  for (const item of BASE_CIDS) {
    await prisma.cid10Referencia.upsert({
      where: { codigo: item.codigo.toUpperCase() },
      update: { descricao: item.descricao, grupo: item.grupo },
      create: { codigo: item.codigo.toUpperCase(), descricao: item.descricao, grupo: item.grupo }
    });
    inseridos++;
  }

  console.log(`✅ Populados ${inseridos} códigos CID-10 base no catálogo.`);

  // Buscar todos os CIDs distintos presentes na tabela Atestado
  const atestadosCids = await prisma.atestado.groupBy({
    by: ['cid'],
    where: { cid: { not: null } },
  });

  console.log(`🔍 Encontrados ${atestadosCids.length} CIDs distintos nos atestados lançados.`);

  let autoClassificados = 0;
  for (const row of atestadosCids) {
    const rawCid = (row.cid || '').trim().toUpperCase();
    if (!rawCid || rawCid === '-' || rawCid === '0' || rawCid === 'NAO INFORMADO') continue;

    const existing = await prisma.cid10Referencia.findUnique({ where: { codigo: rawCid } });
    if (!existing) {
      const firstChar = rawCid.charAt(0);
      const grupo = CAPITULOS_CID10[firstChar] || 'Outras Categorias CID-10';
      const descricao = `CID-10 Código ${rawCid}`;

      await prisma.cid10Referencia.create({
        data: {
          codigo: rawCid,
          descricao,
          grupo,
        }
      });
      autoClassificados++;
    }
  }

  console.log(`✅ Auto-classificados ${autoClassificados} CIDs da base de atestados.`);
  await prisma.$disconnect();
}

seed().catch(console.error);
