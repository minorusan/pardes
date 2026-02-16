import dotenv from 'dotenv';
dotenv.config();

export const config = {
  kbh: {
    token: process.env.KBH_BOT_TOKEN || '',
  },
  client: {
    apiId: parseInt(process.env.TG_API_ID || '0', 10),
    apiHash: process.env.TG_API_HASH || '',
    phone: process.env.TG_PHONE || '',
  },
  pardes: {
    apiUrl: process.env.PARDES_API_URL || 'http://localhost:3000',
  },
};

export function validateConfig(): void {
  if (!config.kbh.token) {
    throw new Error('KBH_BOT_TOKEN is required');
  }
  if (!config.pardes.apiUrl) {
    throw new Error('PARDES_API_URL is required');
  }
}
