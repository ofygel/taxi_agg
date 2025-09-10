// Историческая обертка для совместимости, если где-то в проекте подключается verify.ts
// Сейчас основная логика в modules/verification.ts

import { Telegraf, type Context } from 'telegraf';
import * as Verification from './verification';

export function register(bot: Telegraf<Context>) {
  Verification.register(bot);
}
