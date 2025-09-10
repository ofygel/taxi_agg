import { Telegraf } from 'telegraf';
import { supabase, ensureUser } from '../supabase';
import { MyContext } from '../types';
import { sendEphemeral } from '../utils';

export async function ensurePhone(ctx: MyContext) {
  const me = await ensureUser(ctx);
  if (me?.phone) return true;

  ctx.session = ctx.session || {};
  ctx.session.awaitingPhone = true;

  await sendEphemeral(
    ctx,
    'Поделитесь телефоном, чтобы продолжить.',
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Отправить мой контакт', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
    120_000
  );

  return false;
}

export function registerPhone(bot: Telegraf<MyContext>) {
  bot.on('contact', async (ctx, next) => {
    if (!ctx.session?.awaitingPhone) return next();

    const phone = '+' + (ctx.message as any).contact?.phone_number.replace(/[^\d]/g, '');
    await supabase.from('users').update({ phone }).eq('telegram_id', ctx.from!.id);

    ctx.session.awaitingPhone = false;
    ctx.session.lastClientPhone = phone;

    await ctx.reply(`Сохранил номер: ${phone}`, { reply_markup: { remove_keyboard: true } });
    return ctx.reply('Телефон сохранён. Нажмите /start для выбора роли.');
  });
}
