console.log('Step 1: Starting test');

import('dotenv/config').then(() => {
  console.log('Step 2: Dotenv loaded');
  
  import('@config/logger').then((loggerModule) => {
    console.log('Step 3: Logger loaded');
    const logger = loggerModule.default;
    logger.info('Logger working!');
  }).catch((err) => {
    console.error('Error loading logger:', err);
  });
}).catch((err) => {
  console.error('Error loading dotenv:', err);
});
