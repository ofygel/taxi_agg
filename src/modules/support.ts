import { Telegraf, type Context } from 'telegraf';
import { ensureSession, sendReplacing } from '@/shared';
import { getSetting } from '@/supabase';

export function register(bot: Telegraf<Context>) {
  bot.hears('☎️ Поддержка', async (ctx: Context) => {
    await sendReplacing(
      ctx,
      'Опишите проблему. Сообщения (фото/видео/файлы) будут переданы модераторам.'
    );
    ensureSession(ctx);
  });

  bot.on(
    ['text', 'photo', 'document', 'video', 'voice', 'audio'],
    async (ctx: Context) => {
      const verifyChan = await getSetting('verify_channel_id');
      if (!verifyChan) return;
      if (ctx.chat?.type !== 'private') return;

      try {
        await ctx.telegram.sendMessage(
          verifyChan,
          `Сообщение в поддержку от @${
            (ctx.from as any).username ?? (ctx.from as any).id
          }`
        );
        // Forward текущего сообщения: ctx.forwardMessage(chatId[, extra])
        await ctx.forwardMessage(verifyChan);
      } catch {}
    }
  );
}
