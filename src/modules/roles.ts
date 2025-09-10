import { Telegraf, type Context, Markup } from 'telegraf';
import { ensureUserFromCtx } from '@/supabase';
import type { Role } from '@/types';
import { showHome } from './home';

export function register(bot: Telegraf<Context>) {
  bot.command('role', async (ctx: Context) => {
    await ctx.reply(
      'Выберите роль:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🚕 Водитель такси', 'set_role:DRIVER'),
          Markup.button.callback('📦 Курьер', 'set_role:COURIER')
        ],
        [Markup.button.callback('👤 Клиент', 'set_role:CLIENT')]
      ])
    );
  });

  bot.action(/set_role:(DRIVER|COURIER|CLIENT)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const match = (ctx as any).match as RegExpExecArray | undefined;
    if (!match) return;
    const role = match[1] as Role;

    await ensureUserFromCtx(ctx, { role });

    await ctx.deleteMessage();
    await ctx.reply(
      `Роль установлена: ${role === 'DRIVER' ? 'Водитель' : role === 'COURIER' ? 'Курьер' : 'Клиент'}`
    );

    if (role === 'DRIVER' || role === 'COURIER') {
      await ctx.reply(
        'Поделитесь контактом, чтобы получать заказы:',
        Markup.keyboard([[Markup.button.contactRequest('📱 Поделиться контактом')]])
          .oneTime()
          .resize()
      );
    } else {
      await showHome(ctx);
    }
  });
}
