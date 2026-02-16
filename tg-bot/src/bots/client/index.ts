import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { config } from '../../config';

let client: TelegramClient | null = null;

export async function createClientBot(): Promise<TelegramClient | null> {
  const { apiId, apiHash } = config.client;

  if (!apiId || !apiHash) {
    console.log('[Client] MTProto credentials not configured, skipping');
    return null;
  }

  const session = new StringSession('');
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  return client;
}

export async function startClientBot(bot: TelegramClient | null): Promise<void> {
  if (!bot) return;

  // TBD: Client bot functionality
  // This will be a service user that can interact with Telegram as a client
  // Potential uses:
  // - Forward books to channels
  // - Scrape public channels for book requests
  // - Automated responses in groups

  console.log('[Client] Client bot initialized (functionality TBD)');
}

export function stopClientBot(): void {
  if (client) {
    client.disconnect();
    console.log('[Client] Client bot disconnected');
  }
}
