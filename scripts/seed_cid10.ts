import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as https from 'https';

const prisma = new PrismaClient();

async function downloadFile(url: string, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      const file = fs.createWriteStream(path);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(path, () => reject(err));
    });
  });
}

async function main() {
  const filePath = 'cid10_dump.sql';
  console.log('Baixando dados da CID-10...');
  
  try {
    await downloadFile('https://raw.githubusercontent.com/aleckyann/cid10/master/cid10.sql', filePath);
    console.log('Download concluído. Processando arquivo...');
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Expressão regular para extrair valores: (id, 'codigo', 'doenca')
    const regex = /\(\d+,\s*'([^']+)',\s*'([^']+)'\)/g;
    let match;
    const records = [];
    
    while ((match = regex.exec(content)) !== null) {
      const codigo = match[1];
      const descricao = match[2];
      
      // O grupo pode ser a categoria (os 3 primeiros caracteres)
      const grupo = codigo.substring(0, 3);
      
      records.push({
        codigo,
        descricao,
        grupo
      });
    }
    
    console.log(`Encontrados ${records.length} registros da CID-10.`);
    
    // Remover duplicados
    const uniqueRecordsMap = new Map();
    for (const r of records) {
      if (!uniqueRecordsMap.has(r.codigo)) {
        uniqueRecordsMap.set(r.codigo, r);
      }
    }
    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    console.log(`Após remover duplicados: ${uniqueRecords.length} registros. Inserindo no banco de dados...`);
    
    if (uniqueRecords.length > 0) {
      // Limpa a tabela antes de inserir para evitar duplicação ou falha de chave única
      await prisma.cid10Referencia.deleteMany({});
      
      // Insere em lotes para evitar erro de pacote muito grande
      const batchSize = 1000;
      for (let i = 0; i < uniqueRecords.length; i += batchSize) {
        const batch = uniqueRecords.slice(i, i + batchSize);
        await prisma.cid10Referencia.createMany({
          data: batch
        });
        console.log(`Inseridos ${Math.min(i + batchSize, uniqueRecords.length)} de ${uniqueRecords.length}...`);
      }
      
      console.log('Base da CID-10 populada com sucesso!');
    } else {
      console.log('Nenhum registro encontrado para inserir.');
    }
    
    // Limpar o arquivo sql
    fs.unlinkSync(filePath);
    
  } catch (error) {
    console.error('Erro ao popular a base da CID-10:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
