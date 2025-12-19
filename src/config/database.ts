import { PrismaClient } from '@prisma/client';
import { config } from './index';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.app.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'colorless',
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (config.app.isDevelopment) globalThis.prismaGlobal = prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
