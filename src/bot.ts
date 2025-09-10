import { Telegraf, session } from 'telegraf';
import type { MyContext } from './types';
import { TELEGRAM_BOT_TOKEN } from './config';

export const bot = new Telegraf<MyContext>(TELEGRAM_BOT_TOKEN);

// простая сессия; если у вас есть своя — подключите её вместо
bot.use(session({ defaultSession: () => ({}) as any }));

export type Bot = typeof bot;
