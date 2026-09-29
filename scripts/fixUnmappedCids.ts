import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dicionário Oficial CID-10 para categorias de 3 dígitos e códigos especiais
const OFFICIAL_CATEGORIES: Record<string, { descricao: string; grupo: string }> = {
  'M54': { descricao: 'Dorsalgia', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'G43': { descricao: 'Enxaqueca', grupo: 'Doenças do sistema nervoso' },
  'R10': { descricao: 'Dor abdominal e pélvica', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'J11': { descricao: 'Influenza [gripe], vírus não identificado', grupo: 'Doenças do aparelho respiratório' },
  'F41': { descricao: 'Outros transtornos ansiosos', grupo: 'Transtornos mentais e comportamentais' },
  'R52': { descricao: 'Dor não classificada em outra parte', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'J06': { descricao: 'Infecções agudas das vias aéreas superiores de localizações múltiplas e não especificadas', grupo: 'Doenças do aparelho respiratório' },
  'B34': { descricao: 'Infecção viral de localização não especificada', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'H10': { descricao: 'Conjuntivite', grupo: 'Doenças do olho e anexos' },
  'M23': { descricao: 'Transtornos internos dos joelhos', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'J01': { descricao: 'Sinusite aguda', grupo: 'Doenças do aparelho respiratório' },
  'J03': { descricao: 'Amigdalite aguda', grupo: 'Doenças do aparelho respiratório' },
  'N94': { descricao: 'Dor e outras afecções associadas aos órgãos genitais femininos e ao ciclo menstrual', grupo: 'Doenças do aparelho geniturinário' },
  'K52': { descricao: 'Outras gastroenterites e colites não-infecciosas', grupo: 'Doenças do aparelho digestivo' },
  'Z35': { descricao: 'Supervisão de gravidez de alto risco', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'J02': { descricao: 'Faringite aguda', grupo: 'Doenças do aparelho respiratório' },
  'N39': { descricao: 'Outros transtornos do aparelho urinário', grupo: 'Doenças do aparelho geniturinário' },
  'M75': { descricao: 'Lesões do ombro', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'S90': { descricao: 'Traumatismo superficial do tornozelo e do pé', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'O26': { descricao: 'Assistência materna por outras complicações ligadas à gravidez', grupo: 'Gravidez, parto e puerpério' },
  'L02': { descricao: 'Abscesso cutâneo, furúnculo e carbúnculo', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'A08': { descricao: 'Infecções intestinais virais e outras infecções especificadas', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'M79': { descricao: 'Outros transtornos dos tecidos moles, não classificados em outra parte', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'K80': { descricao: 'Colelitíase', grupo: 'Doenças do aparelho digestivo' },
  'S92': { descricao: 'Fratura do pé, exceto do tornozelo', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'K08': { descricao: 'Outros transtornos dos dentes e de suas estruturas de sustentação', grupo: 'Doenças do aparelho digestivo' },
  'N30': { descricao: 'Cistite', grupo: 'Doenças do aparelho geniturinário' },
  'J18': { descricao: 'Pneumonia por microorganismo não especificado', grupo: 'Doenças do aparelho respiratório' },
  'N93': { descricao: 'Outro sangramento anormal do útero e da vagina', grupo: 'Doenças do aparelho geniturinário' },
  'B30': { descricao: 'Conjuntivite viral', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'B30.8': { descricao: 'Outras conjuntivites virais', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'H60': { descricao: 'Otite externa', grupo: 'Doenças do ouvido e da apófise mastóide' },
  'R07': { descricao: 'Dor de garganta e no peito', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'M79.7': { descricao: 'Fibromialgia', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'K92': { descricao: 'Outras doenças do aparelho digestivo', grupo: 'Doenças do aparelho digestivo' },
  'K42': { descricao: 'Hérnia umbilical', grupo: 'Doenças do aparelho digestivo' },
  'N20': { descricao: 'Calculose do rim e do ureter', grupo: 'Doenças do aparelho geniturinário' },
  'K04': { descricao: 'Doenças da polpa e dos tecidos periapicais', grupo: 'Doenças do aparelho digestivo' },
  'T14': { descricao: 'Traumatismo de região não especificada do corpo', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'Z34': { descricao: 'Supervisão de gravidez normal', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'R50': { descricao: 'Febre de origem desconhecida e de outras origens', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'Z00': { descricao: 'Exame geral e investigação de pessoas sem queixas ou diagnóstico relatado', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'S40': { descricao: 'Traumatismo superficial do ombro e do braço', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M65': { descricao: 'Sinovite e tenossinovite', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'L20': { descricao: 'Dermatite atópica', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'J30': { descricao: 'Rinite alérgica e vasomotora', grupo: 'Doenças do aparelho respiratório' },
  'K59': { descricao: 'Outros transtornos funcionais do intestino', grupo: 'Doenças do aparelho digestivo' },
  'L60': { descricao: 'Afecções das unhas', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'K29': { descricao: 'Gastrite e duodenite', grupo: 'Doenças do aparelho digestivo' },
  'D17': { descricao: 'Neoplasia lipomatosa benigna', grupo: 'Neoplasias [tumores]' },
  'O20': { descricao: 'Hemorragia do início da gravidez', grupo: 'Gravidez, parto e puerpério' },
  'S60': { descricao: 'Traumatismo superficial do punho e da mão', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'L23': { descricao: 'Dermatites de contato por alérgenos', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'J45': { descricao: 'Asma', grupo: 'Doenças do aparelho respiratório' },
  'K21': { descricao: 'Doença de refluxo gastroesofágico', grupo: 'Doenças do aparelho digestivo' },
  'J15': { descricao: 'Pneumonia bacteriana não classificada em outra parte', grupo: 'Doenças do aparelho respiratório' },
  'S93': { descricao: 'Entorse e distensão dos ligamentos ao nível do tornozelo e do pé', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M17': { descricao: 'Gonartrose [artrose do joelho]', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'Z03': { descricao: 'Observação e avaliação médicas por suspeita de doenças e afecções', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'B02': { descricao: 'Herpes zoster [zoster]', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'K01': { descricao: 'Dentes inclusos e impactados', grupo: 'Doenças do aparelho digestivo' },
  'D25': { descricao: 'Leiomioma do útero', grupo: 'Neoplasias [tumores]' },
  'H65': { descricao: 'Otite média não-supurativa', grupo: 'Doenças do ouvido e da apófise mastóide' },
  'L29': { descricao: 'Prurido', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'S73': { descricao: 'Disjunção e torção da articulação do quadril', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'S62': { descricao: 'Fratura ao nível do punho e da mão', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'S09': { descricao: 'Outros traumatismos da cabeça e os não especificados', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M67': { descricao: 'Outros transtornos das sinovias e dos tendões', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'S63': { descricao: 'Luxação, torção e distensão de articulações e de ligamentos ao nível do punho e da mão', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'H57': { descricao: 'Outros transtornos do olho e anexos', grupo: 'Doenças do olho e anexos' },
  'T23': { descricao: 'Queimadura e corrosão do punho e da mão', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'U07.2': { descricao: 'COVID-19, vírus não identificado', grupo: 'Códigos para fins especiais' },
  'X99': { descricao: 'Agressão por meio de objeto cortante ou penetrante', grupo: 'Causas externas de morbidade e de mortalidade' },
  'S69': { descricao: 'Outros traumatismos e os não especificados do punho e da mão', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'O21': { descricao: 'Vômitos excessivos na gravidez', grupo: 'Gravidez, parto e puerpério' },
  'O23': { descricao: 'Infecção do trato geniturinário na gravidez', grupo: 'Gravidez, parto e puerpério' },
  'B37': { descricao: 'Candidíase', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'B37.3': { descricao: 'Candidíase da vulva e da vagina', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'S80': { descricao: 'Traumatismo superficial da perna', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'Z10': { descricao: 'Exame geral de rotina de subpopulações definidas', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'K50': { descricao: 'Doença de Crohn [enterite regional]', grupo: 'Doenças do aparelho digestivo' },
  'F32': { descricao: 'Episódios depressivos', grupo: 'Transtornos mentais e comportamentais' },
  'A06': { descricao: 'Amebíase', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'A92': { descricao: 'Outras febres virais transmitidas por mosquitos', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'B00': { descricao: 'Infecções pelo vírus do herpes [herpes simples]', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'R06': { descricao: 'Respiração anômala', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'T74': { descricao: 'Síndromes de maus tratos', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M66': { descricao: 'Ruptura espontânea de sinóvia e de tendão', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'T30': { descricao: 'Queimadura e corrosão de parte não especificada do corpo', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'S20': { descricao: 'Traumatismo superficial do tórax', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'J20': { descricao: 'Bronquite aguda', grupo: 'Doenças do aparelho respiratório' },
  'Z30': { descricao: 'Anticoncepção', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'Y59': { descricao: 'Outras vacinas e substâncias biológicas causando efeitos adversos em uso terapêutico', grupo: 'Causas externas de morbidade e de mortalidade' },
  'S41': { descricao: 'Ferimento do ombro e do braço', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'S82': { descricao: 'Fratura da perna, incluindo tornozelo', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'W19': { descricao: 'Queda não especificada', grupo: 'Causas externas de morbidade e de mortalidade' },
  'T84': { descricao: 'Complicações de dispositivos práticos, implantes e enxertos ortopédicos internos', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M16': { descricao: 'Coxartrose [artrose do quadril]', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'J10': { descricao: 'Influenza devida a vírus identificado da gripe', grupo: 'Doenças do aparelho respiratório' },
  'G55.1': { descricao: 'Compressões das raízes e dos plexos nervosos em transtornos dos discos intervertebrais', grupo: 'Doenças do sistema nervoso' },
  'I09': { descricao: 'Outras doenças reumáticas do coração', grupo: 'Doenças do aparelho circulatório' },
  'S43': { descricao: 'Luxação, torção e distensão de articulações e de ligamentos da cintura escapular', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'J39': { descricao: 'Outras doenças das vias aéreas superiores', grupo: 'Doenças do aparelho respiratório' },
  'V29': { descricao: 'Motociclista traumatizado em outros acidentes de transporte e nos não especificados', grupo: 'Causas externas de morbidade e de mortalidade' },
  'C50': { descricao: 'Neoplasia maligna da mama', grupo: 'Neoplasias [tumores]' },
  'K10': { descricao: 'Outras doenças dos maxilares', grupo: 'Doenças do aparelho digestivo' },
  'S53': { descricao: 'Luxação, torção e distensão de articulações e de ligamentos do cotovelo', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'M50': { descricao: 'Transtornos dos discos cervicais', grupo: 'Doenças do sistema osteomuscular e do tecido conjuntivo' },
  'V18': { descricao: 'Ciclista traumatizado em um acidente de transporte sem colisão', grupo: 'Causas externas de morbidade e de mortalidade' },
  'N92': { descricao: 'Menstruação excessiva, freqüente e irregular', grupo: 'Doenças do aparelho geniturinário' },
  'Z08': { descricao: 'Exame de acompanhamento após tratamento de neoplasia maligna', grupo: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde' },
  'H92': { descricao: 'Otalgia e secreção do ouvido', grupo: 'Doenças do ouvido e da apófise mastóide' },
  'S70': { descricao: 'Traumatismo superficial do quadril e da coxa', grupo: 'Lesões, envenenamento e algumas outras consequências de causas externas' },
  'L08': { descricao: 'Outras infecções locais da pele e do tecido subcutâneo', grupo: 'Doenças da pele e do tecido subcutâneo' },
  'R30': { descricao: 'Disúria [dor ou ardor ao urinar]', grupo: 'Sintomas, sinais e achados anômalos de exames clínicos e de laboratório' },
  'K06': { descricao: 'Outros transtornos da gengiva e do rebordo alveolar sem dentes', grupo: 'Doenças do aparelho digestivo' },
  'B39': { descricao: 'Histoplasmose', grupo: 'Algumas doenças infecciosas e parasitárias' },
  'G40': { descricao: 'Epilepsia', grupo: 'Doenças do sistema nervoso' },
};

async function main() {
  console.log('🔄 Iniciando saneamento e resolução dos 118 CIDs pendentes...');

  // 1. Limpar CIDs no modelo Atestado (remover caracteres especiais +, *)
  const atestados = await prisma.atestado.findMany({ select: { id: true, cid: true } });
  let atestadosLimpos = 0;

  for (const a of atestados) {
    if (!a.cid) continue;
    const clean = a.cid.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (clean && clean !== a.cid) {
      await prisma.atestado.update({
        where: { id: a.id },
        data: { cid: clean }
      });
      atestadosLimpos++;
    }
  }

  console.log(`✅ ${atestadosLimpos} atestados tiveram a string do CID limpa (ex: 'B30.8+' -> 'B30.8').`);

  // 2. Garantir que todas as categorias/códigos no dicionário oficial existam no Cid10Referencia
  let cidsInseridos = 0;
  for (const [codigo, data] of Object.entries(OFFICIAL_CATEGORIES)) {
    await prisma.cid10Referencia.upsert({
      where: { codigo },
      update: {
        descricao: data.descricao,
        grupo: data.grupo
      },
      create: {
        codigo,
        descricao: data.descricao,
        grupo: data.grupo
      }
    });
    cidsInseridos++;
  }

  console.log(`✅ ${cidsInseridos} códigos/categorias de CID inseridos ou atualizados em Cid10Referencia.`);

  // 3. Verificar se sobrou algum CID pendente
  const updatedAtestados = await prisma.atestado.findMany({ select: { id: true, cid: true } });
  const refs = await prisma.cid10Referencia.findMany({ select: { codigo: true } });
  const refSet = new Set(refs.map(r => r.codigo));

  const pendentesRestantes = new Set<string>();
  updatedAtestados.forEach(a => {
    if (a.cid && !refSet.has(a.cid)) {
      pendentesRestantes.add(a.cid);
    }
  });

  console.log(`🎉 VERIFICAÇÃO FINAL:`);
  console.log(`   - CIDs pendentes restantes sem correspondência: ${pendentesRestantes.size}`);

  if (pendentesRestantes.size > 0) {
    console.log('   - CIDs ainda pendentes:', Array.from(pendentesRestantes));
  } else {
    console.log('   - 🚀 TODOS os CIDs dos atestados agora possuem correspondência 100% válida no Catálogo OMS!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
