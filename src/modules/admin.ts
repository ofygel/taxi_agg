import { Telegraf, type Context } from 'telegraf';
import { setSetting } from '@/supabase';

export function register(bot: Telegraf<Context>) {
  bot.command('bind_verify_channel', async (ctx: Context) => {
    const id = ctx.chat?.id;
    if (!id || id > 0)
      return ctx.reply('Команду запускают в КАНАЛЕ/ГРУППЕ модерации.');
    await setSetting('verify_channel_id', String(id));
    await ctx.reply('Канал модерации привязан.');
  });

  bot.command('bind_drivers_channel', async (ctx: Context) => {
    const id = ctx.chat?.id;
    if (!id || id > 0)
      return ctx.reply('Команду запускают в КАНАЛЕ/ГРУППЕ водителей.');
    await setSetting('drivers_channel_id', String(id));
    await ctx.reply('Канал водителей привязан.');
  });

  bot.command('set_invite', async (ctx: Context) => {
    const m = ctx.message;
    if (!m || !('text' in m))
      return ctx.reply('Формат: /set_invite https://t.me/...');
    const [, ...rest] = m.text.split(' ');
    const url = rest.join(' ').trim();
    if (!url) return ctx.reply('Укажите ссылку: /set_invite https://t.me/...');
    await setSetting('drivers_channel_invite', url);
    await ctx.reply('Инвайт-ссылка сохранена.');
  });
}
