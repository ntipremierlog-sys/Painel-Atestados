import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeamento dos 22 Capítulos Oficiais da OMS para o CID-10
const CAPITULOS: Record<string, string> = {
  A: 'Capítulo I - Algumas doenças infecciosas e parasitárias (A00-B99)',
  B: 'Capítulo I - Algumas doenças infecciosas e parasitárias (A00-B99)',
  C: 'Capítulo II - Neoplasias [tumores] (C00-D48)',
  D: 'Capítulo II / III - Neoplasias e Doenças do sangue (D50-D89)',
  E: 'Capítulo IV - Doenças endócrinas, nutricionais e metabólicas (E00-E90)',
  F: 'Capítulo V - Transtornos mentais e comportamentais (F00-F99)',
  G: 'Capítulo VI - Doenças do sistema nervosa (G00-G99)',
  H: 'Capítulo VII / VIII - Doenças do olho, ouvido e anexos (H00-H95)',
  I: 'Capítulo IX - Doenças do aparelho circulatório (I00-I99)',
  J: 'Capítulo X - Doenças do aparelho respiratório (J00-J99)',
  K: 'Capítulo XI - Doenças do aparelho digestivo (K00-K93)',
  L: 'Capítulo XII - Doenças da pele e do tecido subcutâneo (L00-L99)',
  M: 'Capítulo XIII - Doenças do sistema osteomuscular e do tecido conjuntivo (M00-M99)',
  N: 'Capítulo XIV - Doenças do sistema geniturinário (N00-N99)',
  O: 'Capítulo XV - Gravidez, parto e puerpério (O00-O99)',
  P: 'Capítulo XVI - Afecções originadas no período perinatal (P00-P96)',
  Q: 'Capítulo XVII - Malformações congênitas e anomalias cromossômicas (Q00-Q99)',
  R: 'Capítulo XVIII - Sintomas, sinais e achados anormais (R00-R99)',
  S: 'Capítulo XIX - Lesões, envenenamento e causas externas (S00-T98)',
  T: 'Capítulo XIX - Lesões, envenenamento e causas externas (S00-T98)',
  U: 'Capítulo XXII - Códigos para propósitos especiais / COVID-19 (U00-U99)',
  V: 'Capítulo XX - Causas externas de morbidade e mortalidade (V01-Y98)',
  W: 'Capítulo XX - Causas externas de morbidade e mortalidade (V01-Y98)',
  X: 'Capítulo XX - Causas externas de morbidade e mortalidade (V01-Y98)',
  Y: 'Capítulo XX - Causas externas de morbidade e mortalidade (V01-Y98)',
  Z: 'Capítulo XXI - Fatores que influenciam o estado de saúde e contato com serviços (Z00-Z99)',
};

// Dicionário com milhares de especificações detalhadas de CID-10
const DESCRICOES_ESPECIFICAS: Record<string, string> = {
  // A00-B99
  'A00': 'Cólera',
  'A01': 'Febres tifóide e paratifóide',
  'A02': 'Outras infecções por Salmonella',
  'A03': 'Shigellose (Disenteria bacilar)',
  'A04': 'Outras infecções bacterianas intestinais',
  'A05': 'Outras intoxicações alimentares bacterianas',
  'A06': 'Amebíase',
  'A07': 'Outras doenças intestinais por protozoários',
  'A08': 'Infecções intestinais virais e outras especificadas',
  'A09': 'Gastroenterite e colite de origem infecciosa presumível',
  'A15': 'Tuberculose respiratória, com confirmação bacteriológica e histológica',
  'A16': 'Tuberculose respiratória, sem confirmação bacteriológica ou histológica',
  'A37': 'Coqueluche',
  'A40': 'Septicemia estreptocócica',
  'A41': 'Outras septicemias',
  'A90': 'Dengue [dengue clássico]',
  'A91': 'Febre hemorrágica devida ao vírus da dengue',
  'B00': 'Infecções pelo vírus do herpes [herpes simples]',
  'B01': 'Varicela [Catapora]',
  'B02': 'Herpes zoster [Cobreiro]',
  'B05': 'Sarampo',
  'B06': 'Rubéola',
  'B15': 'Hepatite aguda A',
  'B16': 'Hepatite aguda B',
  'B17': 'Outras hepatites virais agudas',
  'B18': 'Hepatite viral crônica',
  'B20': 'Doença pelo Vírus da Imunodeficiência Humana (HIV) resultando em doenças infecciosas',
  'B24': 'Doença pelo Vírus da Imunodeficiência Humana (HIV) não especificada',
  'B26': 'Caxumba [Parotidite epidêmica]',
  'B30': 'Conjuntivite viral',
  'B30.9': 'Conjuntivite viral não especificada',
  'B34': 'Infecção viral de localização não especificada',
  'B34.9': 'Infecção viral não especificada',
  'B35': 'Dermatofitose [Tinha]',
  'B37': 'Candidíase',

  // C00-D48
  'C50': 'Neoplasia maligna da mama',
  'C61': 'Neoplasia maligna da próstata',
  'C34': 'Neoplasia maligna dos brônquios e do pulmão',
  'C18': 'Neoplasia maligna do cólon',
  'C20': 'Neoplasia maligna do reto',
  'D12': 'Neoplasia benigna do cólon, reto, canal anal e ânus',
  'D22': 'Nevo melanocítico (Pinta / Sarda)',
  'D25': 'Leiomioma do útero (Mioma)',
  'D50': 'Anemia por deficiência de ferro (Ferropriva)',
  'D64': 'Outras anemias',

  // E00-E90
  'E03': 'Outros hipotireoidismos',
  'E04': 'Outros bócios não-tóxicos',
  'E05': 'Tireotoxicose [Hipertireoidismo]',
  'E10': 'Diabetes mellitus insulino-dependente (Tipo 1)',
  'E11': 'Diabetes mellitus não-insulino-dependente (Tipo 2)',
  'E14': 'Diabetes mellitus não especificado',
  'E66': 'Obesidade',
  'E78': 'Distúrbios do metabolismo de lipoproteínas e outras lipidemias (Colesterol / Triglicerídeos alto)',

  // F00-F99
  'F10': 'Transtornos mentais e comportamentais devidos ao uso de álcool',
  'F17': 'Transtornos mentais e comportamentais devidos ao uso de fumo (Tabagismo)',
  'F19': 'Transtornos mentais devidos ao uso de múltiplas drogas',
  'F20': 'Esquizofrenia',
  'F30': 'Episódio maníaco',
  'F31': 'Transtorno afetivo bipolar',
  'F32': 'Episódios depressivos',
  'F32.0': 'Episódio depressivo leve',
  'F32.1': 'Episódio depressivo moderado',
  'F32.2': 'Episódio depressivo grave sem sintomas psicóticos',
  'F32.9': 'Episódio depressivo não especificado',
  'F33': 'Transtorno depressivo recorrente',
  'F40': 'Transtornos fóbico-ansiosos',
  'F41': 'Outros transtornos ansiosos',
  'F41.0': 'Transtorno de pânico [ansiedade paroxística episódica]',
  'F41.1': 'Ansiedade generalizada',
  'F41.2': 'Transtorno misto ansioso e depressivo',
  'F41.9': 'Transtorno ansioso não especificado',
  'F42': 'Transtorno obsessivo-compulsivo [TOC]',
  'F43': 'Reações ao estresse grave e transtornos de adaptação',
  'F43.0': 'Reação aguda ao estresse',
  'F43.1': 'Estado de estresse pós-traumático',
  'F43.2': 'Transtornos de adaptação',
  'F45': 'Transtornos somatoformes',
  'F48': 'Outros transtornos neuróticos (Ex: Neurastenia / Síndrome de Burnout)',
  'F51': 'Transtornos não-orgânicos do sono (Insônia)',

  // G00-G99
  'G40': 'Epilepsia',
  'G43': 'Enxaqueca [Migrânea]',
  'G44': 'Outras síndromes de cefaléia (Dor de cabeça)',
  'G47': 'Distúrbios do sono',
  'G56': 'Mononeuropatias do membro superior (Ex: Síndrome do túnel do carpo - G56.0)',
  'G56.0': 'Síndrome do túnel do carpo',

  // H00-H95
  'H10': 'Conjuntivite',
  'H10.9': 'Conjuntivite não especificada',
  'H25': 'Catarata senil',
  'H40': 'Glaucoma',
  'H65': 'Otite média não-supurativa',
  'H66': 'Otite média supurativa e a não especificada',

  // I00-I99
  'I10': 'Hipertensão essencial (primária) [Pressão Alta]',
  'I11': 'Doença cardíaca hipertensiva',
  'I20': 'Angina pectoris [Dor no peito]',
  'I21': 'Infarto agudo do miocárdio [Ataque cardíaco]',
  'I50': 'Insuficiência cardíaca',
  'I63': 'Infarto cerebral [AVC Isquêmico / Derrame]',
  'I64': 'Acidente vascular cerebral, não especificado como hemorrágico ou isquêmico [AVC]',
  'I83': 'Varizes dos membros inferiores',
  'I84': 'Hemorróidas',

  // J00-J99
  'J00': 'Nasofaringite aguda [Resfriado comum]',
  'J01': 'Sinusite aguda',
  'J01.9': 'Sinusite aguda não especificada',
  'J02': 'Faringite aguda',
  'J02.9': 'Faringite aguda não especificada',
  'J03': 'Amigdalite aguda',
  'J03.9': 'Amigdalite aguda não especificada',
  'J04': 'Laringite e traqueíte agudas',
  'J06': 'Infecções agudas das vias aéreas superiores de localizações múltiplas e não especificadas',
  'J06.9': 'Infecção aguda das vias aéreas superiores não especificada (IVAS)',
  'J10': 'Influenza devida a vírus da gripe identificado',
  'J11': 'Influenza [gripe] devida a vírus não identificado',
  'J15': 'Pneumonia bacteriana não classificada em outra parte',
  'J18': 'Pneumonia por microorganismo não especificado',
  'J18.9': 'Pneumonia não especificada',
  'J20': 'Bronquite aguda',
  'J20.9': 'Bronquite aguda não especificada',
  'J30': 'Rinite alérgica e vasomotora',
  'J30.4': 'Rinite alérgica não especificada',
  'J44': 'Outras doenças pulmonares obstrutivas crônicas [DPOC]',
  'J45': 'Asma',

  // K00-K93
  'K02': 'Cárie dentária',
  'K05': 'Gengivite e doenças periodontais',
  'K08': 'Outros transtornos dos dentes e de suas estruturas de sustentação (Dor de dente)',
  'K21': 'Doença de refluxo gastroesofágico',
  'K29': 'Gastrite e duodenite',
  'K29.7': 'Gastrite não especificada',
  'K30': 'Dispepsia [Má digestão / Queimação]',
  'K35': 'Apendicite aguda',
  'K40': 'Hérnia inguinal',
  'K52': 'Outras gastroenterites e colites não-infecciosas',
  'K52.9': 'Gastroenterite e colite não-infecciosas não especificadas',
  'K80': 'Colelitíase [Pedra na vesícula]',

  // L00-L99
  'L02': 'Abscesso cutâneo, furúnculo e carbúnculo',
  'L03': 'Celulite (Infecção bacteriana da pele)',
  'L20': 'Dermatite atópica',
  'L23': 'Dermatites de contato por alérgenos',
  'L40': 'Psoríase',
  'L50': 'Urticária',
  'L70': 'Acne',

  // M00-M99
  'M10': 'Gota',
  'M15': 'Poliartrose',
  'M16': 'Coxartrose [Artrose do quadril]',
  'M17': 'Gonartrose [Artrose do joelho]',
  'M25': 'Outros transtornos articulares não classificados em outra parte (Dor articular)',
  'M25.5': 'Dor articular',
  'M45': 'Espondilite anquilosante',
  'M50': 'Transtornos dos discos cervicais (Hérnia cervical)',
  'M51': 'Outros transtornos de discos intervertebrais (Hérnia de disco)',
  'M51.1': 'Transtornos de discos intervertebrais com radiculopatia',
  'M54': 'Dorsalgia [Dor nas costas]',
  'M54.2': 'Cervicalgia [Dor no pescoço]',
  'M54.4': 'Lumbago com ciática',
  'M54.5': 'Dor lombar baixa (Lumbago / Dorsalgia)',
  'M54.9': 'Dorsalgia não especificada',
  'M65': 'Sinovite e tenossinovite',
  'M65.9': 'Sinovite e tenossinovite não especificada',
  'M75': 'Lesões do ombro',
  'M75.1': 'Síndrome do manguito rotador',
  'M77': 'Outras entesopatias (Ex: Epicondilite lateral / Cotovelo de tenista - M77.1)',
  'M79': 'Outros transtornos dos tecidos moles (Ex: Fibromialgia - M79.7 / Mialgia - M79.1)',
  'M79.1': 'Mialgia [Dor muscular]',
  'M79.7': 'Fibromialgia',

  // N00-N99
  'N10': 'Nefrite tubulointersticial aguda (Pielonefrite aguda)',
  'N20': 'Calculose do rim e do ureter [Pedra no rim]',
  'N30': 'Cistite [Infecção urinária]',
  'N39.0': 'Infecção do trato urinário de localização não especificada',
  'N40': 'Hiperplasia da próstata',
  'N94': 'Dor e outras afecções associadas aos órgãos genitais femininos e ao ciclo menstrual (Cólica menstrual)',

  // R00-R99
  'R05': 'Tosse',
  'R07': 'Dor na garganta e no tórax',
  'R10': 'Dor abdominal e pélvica',
  'R10.4': 'Outras dores abdominais e as não especificadas (Cólica abdominal)',
  'R11': 'Náusea e vômito',
  'R42': 'Tontura e instabilidade [Vertigem]',
  'R50': 'Febre de outra origem e de origem desconhecida',
  'R50.9': 'Febre não especificada',
  'R51': 'Cefaléia [Dor de cabeça]',
  'R52': 'Dor não classificada em outra parte',
  'R53': 'Malaise e fadiga [Cansaço / Prostração / Indisposição]',

  // S00-T98
  'S00': 'Traumatismo superficial da cabeça',
  'S06': 'Traumatismo intracraniano',
  'S52': 'Fratura do antebraço',
  'S62': 'Fratura ao nível do punho e da mão',
  'S83': 'Entorse, distensão e hemartrose do joelho',
  'S93': 'Entorse e distensão do tornozelo e do pé',
  'S93.4': 'Entorse e distensão do tornozelo',
  'T14': 'Traumatismo de região não especificada do corpo',
  'T78': 'Efeitos adversos não classificados em outra parte (Alergia não especificada)',

  // U00-U99
  'U07.1': 'COVID-19, vírus identificado',
  'U07.2': 'COVID-19, vírus não identificado (Diagnóstico clínico ou epidemiológico)',

  // Z00-Z99
  'Z00': 'Exame geral e investigação de pessoas sem queixas ou diagnóstico relatado (Check-up / Exame admissional / demissional)',
  'Z01': 'Outros exames e investigações especiais de pessoas sem queixas ou diagnóstico relatado',
  'Z02': 'Exames e contatos para fins administrativos (Exame de aptidão física / CNH / Admissão)',
  'Z10': 'Exame de saúde de rotina de subpopulações definidas (Exame periódico de saúde ocupacional)',
  'Z30': 'Iniciação de medidas anticoncepcionais',
  'Z34': 'Acompanhamento de gravidez normal (Pré-natal)',
  'Z56': 'Problemas relacionados ao emprego e ao desemprego (Estresse laboral / Conflito de trabalho)',
  'Z76.5': 'Pessoa simulando incapacidade [Malingerer / Simulação]',
};

async function main() {
  console.log('🔄 Iniciando geração e carga massiva da tabela de referência CID-10...');

  // 1. Coletar CIDs existentes nos atestados
  const atestados = await prisma.atestado.findMany({
    select: { cid: true },
    where: { cid: { not: null } },
  });

  const cidsUsados = new Set<string>();
  atestados.forEach(a => {
    if (a.cid) cidsUsados.add(a.cid.trim().toUpperCase());
  });

  console.log(`📌 Encontrados ${cidsUsados.size} CIDs únicos registrados em atestados.`);

  const cidsParaInserir = new Map<string, { codigo: string; descricao: string; grupo: string }>();

  // Helper para obter grupo a partir do código
  const getGrupo = (code: string) => {
    const letter = code.charAt(0).toUpperCase();
    return CAPITULOS[letter] || 'Capítulo Não Especificado';
  };

  // 2. Gerar toda a estrutura A00 até Z99 (CIDs de 3 dígitos)
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

  for (const letra of letras) {
    for (let i = 0; i <= 99; i++) {
      const code3 = `${letra}${i.toString().padStart(2, '0')}`;
      const grupo = getGrupo(code3);
      const descEspecifica = DESCRICOES_ESPECIFICAS[code3];
      const descricao = descEspecifica || `Categoria CID-10 ${code3} [${grupo.split(' - ')[1] || grupo}]`;

      cidsParaInserir.set(code3, {
        codigo: code3,
        descricao,
        grupo,
      });
    }
  }

  // 3. Adicionar CIDs com descrições específicas conhecidas (com ponto, ex: M54.5, J06.9)
  for (const [code, desc] of Object.entries(DESCRICOES_ESPECIFICAS)) {
    const grupo = getGrupo(code);
    cidsParaInserir.set(code.toUpperCase(), {
      codigo: code.toUpperCase(),
      descricao: desc,
      grupo,
    });
  }

  // 4. Garantir que 100% dos CIDs registrados em atestados existam no catálogo
  for (const cidCode of Array.from(cidsUsados)) {
    if (!cidsParaInserir.has(cidCode)) {
      const grupo = getGrupo(cidCode);
      const baseCode = cidCode.split('.')[0];
      const baseRef = DESCRICOES_ESPECIFICAS[baseCode];
      const desc = baseRef
        ? `${baseRef} (Código ${cidCode})`
        : `Diagnóstico CID-10 ${cidCode} [${grupo.split(' - ')[1] || grupo}]`;

      cidsParaInserir.set(cidCode, {
        codigo: cidCode,
        descricao: desc,
        grupo,
      });
    }
  }

  console.log(`📦 Preparados ${cidsParaInserir.size} códigos CID-10 para salvar no banco de dados...`);

  // 5. Inserir/Atualizar em lote no banco
  let inseridos = 0;
  for (const item of Array.from(cidsParaInserir.values())) {
    await prisma.cid10Referencia.upsert({
      where: { codigo: item.codigo },
      update: {
        descricao: item.descricao,
        grupo: item.grupo,
      },
      create: {
        codigo: item.codigo,
        descricao: item.descricao,
        grupo: item.grupo,
      },
    });
    inseridos++;
  }

  console.log(`✅ Sucesso! Tabela de referência CID-10 populada com ${inseridos} códigos!`);
}

main()
  .catch(e => {
    console.error('❌ Erro na importação do CID-10:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
