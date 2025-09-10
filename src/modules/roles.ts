import { Telegraf, type Context, Markup } from 'telegraf';
import { ensureUserFromCtx } from '@/supabase';
import type { Role } from '@/types';

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

    await ctx.editMessageText(
      `Роль установлена: ${role === 'DRIVER' ? 'Водитель' : role === 'COURIER' ? 'Курьер' : 'Клиент'}`
    );

    if (role === 'DRIVER' || role === 'COURIER') {
      await ctx.reply(
        'Для доступа к заказам пройдите проверку:',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Пройти проверку', 'go_verify')]
        ])
      );
    }
  });
}
