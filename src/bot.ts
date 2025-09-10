import { Telegraf, session } from 'telegraf';
import type { MyContext } from './types';
import { BOT_TOKEN } from './config';

export const bot = new Telegraf<MyContext>(BOT_TOKEN, { handlerTimeout: 30_000 });
bot.use(session());
