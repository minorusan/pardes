import { config, validateConfig } from './config';
import { BotHost } from './host';

async function main(): Promise<void> {
  console.log('='.repeat(40));
  console.log('Книги Без Хуйни - Bot Host');
  console.log('='.repeat(40));

  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
  }

  console.log(`PARDES API: ${config.pardes.apiUrl}`);

  const host = new BotHost();

  process.once('SIGINT', () => {
    console.log('\nReceived SIGINT');
    host.stop();
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    console.log('\nReceived SIGTERM');
    host.stop();
    process.exit(0);
  });

  await host.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
