import 'dotenv/config';
import App from '@/app';
import logger from '@config/logger';
import prisma from '@config/database';
import { CronSchedulerService } from '@services/cron-scheduler.service';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  
  // Stop cron scheduler
  const scheduler = CronSchedulerService.getInstance();
  scheduler.stop();
  
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  
  // Stop cron scheduler
  const scheduler = CronSchedulerService.getInstance();
  scheduler.stop();
  
  await prisma.$disconnect();
  process.exit(0);
});

// Start server and cron scheduler
const app = new App();
app.listen();

// Initialize cron scheduler
(async () => {
  try {
    const scheduler = CronSchedulerService.getInstance();
    await scheduler.start();
    logger.info('✅ Cron Scheduler initialized');
  } catch (error: any) {
    logger.error('Failed to start cron scheduler:', error.message);
  }
})();
