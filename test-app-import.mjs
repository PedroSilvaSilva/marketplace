import 'dotenv/config';
console.log('Step 1: Dotenv OK');

import('@/app').then((AppModule) => {
  console.log('Step 2: App imported OK');
  console.log('AppModule:', Object.keys(AppModule));
}).catch(err => {
  console.error('Error importing app:', err.message);
  console.error('Stack:', err.stack);
});
