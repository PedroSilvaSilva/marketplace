import prisma from './src/config/database';

async function removeOrganizations() {
  try {
    console.log('🗑️  Removendo organizações indesejadas...\n');

    const organizationsToRemove = [
      'Temu',
      'FNAC',
      'Worten'
    ];

    for (const name of organizationsToRemove) {
      const org = await prisma.organization.findFirst({
        where: {
          name: {
            contains: name,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true
        }
      });

      if (org) {
        console.log(`📋 Encontrada: ${org.name} (${org.slug})`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Criada em: ${org.createdAt.toLocaleDateString('pt-PT')}`);

        // Delete organization (cascade will delete related records)
        await prisma.organization.delete({
          where: { id: org.id }
        });

        console.log(`✅ Removida com sucesso!\n`);
      } else {
        console.log(`⚠️  Não encontrada: ${name}\n`);
      }
    }

    console.log('✅ Processo concluído!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeOrganizations();
