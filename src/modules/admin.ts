import { Telegraf, type Context } from 'telegraf';
import { setSetting } from '@/supabase';

export function register(bot: Telegraf<Context>) {
  const bindVerify = async (ctx: Context) => {
    const id = ctx.chat?.id;
    if (!id || id > 0)
      return ctx.reply('Команду запускают в КАНАЛЕ/ГРУППЕ модерации.');
    await setSetting('verify_channel_id', String(id));
    await setSetting('bindings_updated_at', new Date().toISOString());
    await ctx.reply('Канал модерации привязан.');
  };

  const bindDrivers = async (ctx: Context) => {
    const id = ctx.chat?.id;
    if (!id || id > 0)
      return ctx.reply('Команду запускают в КАНАЛЕ/ГРУППЕ водителей.');
    await setSetting('drivers_channel_id', String(id));
    await setSetting('bindings_updated_at', new Date().toISOString());
    await ctx.reply('Канал водителей привязан.');
  };

  bot.command('bind_verify_channel', bindVerify);
  bot.command('bind_drivers_channel', bindDrivers);

  // Telegraf не обрабатывает команды внутри каналов по умолчанию,
  // поэтому перехватываем channel_post и выполняем нужный обработчик вручную
  bot.on('channel_post', async (ctx) => {
    const text = ctx.channelPost?.text;
    if (!text) return;
    if (text.startsWith('/bind_verify_channel')) return bindVerify(ctx as any);
    if (text.startsWith('/bind_drivers_channel')) return bindDrivers(ctx as any);
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
