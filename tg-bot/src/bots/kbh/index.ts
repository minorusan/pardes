import { Telegraf } from 'telegraf';
import { config } from '../../config';
import {
  handleStart,
  handleStats,
  handleRandom,
  handleSearch,
  handleDownload,
} from './handlers';

export function createKbhBot(): Telegraf {
  const bot = new Telegraf(config.kbh.token);

  bot.command('start', handleStart);
  bot.command('stats', handleStats);
  bot.command('random', handleRandom);

  bot.action(/^dl_\d+$/, handleDownload);

  bot.on('text', handleSearch);

  return bot;
}

export async function startKbhBot(bot: Telegraf): Promise<void> {
  await bot.launch();
  console.log('[KBH] Книги Без Хуйни bot started');
}

export function stopKbhBot(bot: Telegraf): void {
  bot.stop('SIGTERM');
  console.log('[KBH] Bot stopped');
}
