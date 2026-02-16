import { Telegraf } from 'telegraf';
import { TelegramClient } from 'telegram';
import { createKbhBot, startKbhBot, stopKbhBot } from './bots/kbh';
import { createClientBot, startClientBot, stopClientBot } from './bots/client';

export class BotHost {
  private kbhBot: Telegraf | null = null;
  private clientBot: TelegramClient | null = null;
  private running = false;

  async start(): Promise<void> {
    if (this.running) {
      console.log('[Host] Already running');
      return;
    }

    console.log('[Host] Starting bot host...');

    // Initialize KBH bot
    this.kbhBot = createKbhBot();

    // Initialize Client bot (if configured)
    this.clientBot = await createClientBot();

    // Start all bots
    await Promise.all([
      startKbhBot(this.kbhBot),
      startClientBot(this.clientBot),
    ]);

    this.running = true;
    console.log('[Host] Bot host started');
  }

  stop(): void {
    if (!this.running) return;

    console.log('[Host] Stopping bot host...');

    if (this.kbhBot) {
      stopKbhBot(this.kbhBot);
    }

    stopClientBot();

    this.running = false;
    console.log('[Host] Bot host stopped');
  }

  isRunning(): boolean {
    return this.running;
  }
}
