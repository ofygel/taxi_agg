import { bot } from '../bot';
import { getSetting } from '../supabase';
import { kbBackHome } from './home';
import { replaceWith, sendEphemeral } from '../utils';

export function installSupport() {
  bot.action('support', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.supportOpen = true;
    return replaceWith(ctx, 'Опишите проблему одним сообщением. Модератор ответит вам в ЛС.', kbBackHome());
  });

  bot.on('text', async (ctx, next) => {
    if (!ctx.session?.supportOpen) return next();
    ctx.session.supportOpen = false;
    const verifyChannelId = Number(await getSetting('verify_channel_id')) || 0;
    if (!verifyChannelId) return sendEphemeral(ctx, 'Канал модерации не привязан. /bind_verify_channel', kbBackHome());
    try {
      await bot.telegram.sendMessage(verifyChannelId,
        `🆘 <b>Поддержка</b>\nОт: <a href="tg://user?id=${ctx.from!.id}">${(ctx.from as any).first_name || ctx.from!.id}</a>\nID: <code>${ctx.from!.id}</code>\n\n${(ctx.message as any).text}`,
        { parse_mode: 'HTML' }
      );
      await sendEphemeral(ctx, 'Отправлено. Мы ответим.', kbBackHome());
    } catch (e) { console.error('support send', e); }
  });

  bot.hears(/^\/reply\s+(\d+)\s+([\s\S]+)/, async (ctx) => {
    const uid = Number((ctx.match as any)[1]); const txt = (ctx.match as any)[2];
    try { await bot.telegram.sendMessage(uid, `🔔 Ответ поддержки:\n${txt}`); } catch { }
  });
}
