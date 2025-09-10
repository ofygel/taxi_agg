import { Telegraf, type Context } from 'telegraf';
import { replyMainMenu } from '@/shared';

export function register(bot: Telegraf<Context>) {
  bot.start(async (ctx: Context) => {
    await replyMainMenu(ctx);
  });

  bot.hears('На главную', async (ctx: Context) => {
    await replyMainMenu(ctx);
  });
}

// Дополнительно, чтобы другие модули могли дергать прямой показ
export async function showHome(ctx: Context) {
  await replyMainMenu(ctx);
}
