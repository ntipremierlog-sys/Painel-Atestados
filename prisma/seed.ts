import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Criar usuário admin padrão
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      nome: 'Administrador',
    },
  });

  console.log(`✅ Usuário admin criado: ${admin.username}`);
  console.log('✅ Seed concluído!');
  console.log('');
  console.log('📋 Credenciais padrão:');
  console.log('   Usuário: admin');
  console.log('   Senha:   admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
