import { Telegraf, type Context, Markup } from 'telegraf';
import { ensureUser, tgId } from '@/supabase';

export function register(bot: Telegraf<Context>) {
  bot.on('contact', async (ctx: Context) => {
    const m = ctx.message;
    if (!m || !('contact' in m) || !m.contact) return;
    const phone = m.contact.phone_number;
    await ensureUser(tgId(ctx as any), { phone });
    await ctx.reply(
      'Телефон сохранён. Теперь пройдите проверку.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Пройти проверку', 'go_verify')]
      ])
    );
  });

  bot.command('phone', async (ctx: Context) => {
    await ctx.reply(
      'Нажмите кнопку, чтобы отправить свой номер',
      Markup.keyboard([[Markup.button.contactRequest('Отправить номер')]])
        .resize()
        .oneTime()
    );
  });
}
