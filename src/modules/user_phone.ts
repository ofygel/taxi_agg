import { Markup } from 'telegraf';
import type { MyContext } from '../types';
import { supabase } from '../supabase';
import { fmtPhone, sendEphemeral } from '../utils';
import { TTL_INFO_MS } from '../config';
import { ensureUser } from './shared';
import { showHome } from './home';
import { bot } from '../bot';

export async function ensurePhone(ctx: MyContext) {
  const me = await ensureUser(ctx);
  if (me?.phone) return true;
  ctx.session = ctx.session || {};
  ctx.session.awaitingPhone = true;
  await sendEphemeral(ctx, 'Поделитесь телефоном, чтобы продолжить.', {
    reply_markup: {
      keyboard: [[{ text: '📱 Отправить мой контакт', request_contact: true }]],
      resize_keyboard: true, one_time_keyboard: true
    }
  }, TTL_INFO_MS * 2);
  return false;
}

export function installPhoneHandlers() {
  bot.on('contact', async (ctx, next) => {
    if (!ctx.session?.awaitingPhone) return next();
    const phone = fmtPhone((ctx.message as any).contact?.phone_number);
    await supabase.from('users').update({ phone }).eq('telegram_id', ctx.from!.id);
    ctx.session.awaitingPhone = false;
    ctx.session.lastClientPhone = phone;
    await ctx.reply(`Сохранил номер: ${phone}`, { reply_markup: { remove_keyboard: true } });
    return showHome(ctx, 'Телефон сохранён.');
  });
}
