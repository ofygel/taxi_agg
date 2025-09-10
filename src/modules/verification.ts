import { Telegraf, type Context, Markup } from 'telegraf';
import type { VerifFile, Role } from '@/types';
import { ensureSession, sendReplacing } from '@/shared';
import {
  createVerification,
  setVerificationStatus,
  getSetting
} from '@/supabase';

const pendingReasonByMsg = new Map<number, number>(); // msg_id → userId

function instructionsByRole(role: Role | undefined) {
  if (role === 'DRIVER')
    return 'Отправьте фото водительского удостоверения и селфи с удостоверением.';
  if (role === 'COURIER')
    return 'Отправьте фото удостоверения личности с обеих сторон.';
  return 'Отправьте документы для проверки.';
}

export function register(bot: Telegraf<Context>) {
  bot.action('go_verify', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    s.collecting = true;
    s.files = [];
    await sendReplacing(
      ctx,
      `${instructionsByRole(s.role)}\nФайло-счётчик: 0`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📤 Отправить на проверку', 'verif_send')]
      ])
    );
  });

  bot.on(['photo', 'document'], async (ctx: Context) => {
    const s = ensureSession(ctx);
    if (!s.collecting) return;

    const files = s.files as VerifFile[];
    const m = ctx.message;
    if (!m) return;

    if ('photo' in m && Array.isArray(m.photo)) {
      const p = m.photo[m.photo.length - 1];
      files.push({ file_id: p.file_id });
    } else if ('document' in m && m.document) {
      files.push({
        file_id: m.document.file_id,
        file_name: m.document.file_name ?? undefined,
        mime_type: m.document.mime_type ?? undefined,
        size: m.document.file_size ?? undefined
      });
    }
    await sendReplacing(
      ctx,
      `Файло-счётчик: ${files.length}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📤 Отправить на проверку', 'verif_send')]
      ])
    );
  });

  bot.action('verif_send', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    const files = (s.files ?? []) as VerifFile[];
    const verifyChan = await getSetting('verify_channel_id');
    if (!verifyChan)
      return ctx.reply(
        'Канал модерации не привязан. Запустите /bind_verify_channel внутри канала модерации.'
      );

    await createVerification((ctx.from as any).id, (s.role ?? 'DRIVER'), files);

    const list =
      files.map((f, i) => `${i + 1}. ${f.file_name ?? f.file_id}`).join('\n') ||
      '(пусто)';
    const m = await ctx.telegram.sendMessage(
      verifyChan,
      `Новая заявка на проверку
Пользователь: @${(ctx.from as any).username ?? (ctx.from as any).id}
Роль: ${s.role}
Файлы:
${list}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `mod_accept:${(ctx.from as any).id}`)],
        [Markup.button.callback('❌ Отклонить', `mod_reject:${(ctx.from as any).id}`)]
      ])
    );

    pendingReasonByMsg.set((m as any).message_id, (ctx.from as any).id);

    s.collecting = false;
    s.files = [];
    await sendReplacing(ctx, 'Заявка отправлена. Ожидайте решения модерации.');
  });

  bot.action(/mod_accept:(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const match = (ctx as any).match as RegExpExecArray | undefined;
    if (!match) return;
    const userId = Number(match[1]);
    await setVerificationStatus(userId, 'APPROVED');
    await ctx.editMessageText(`Заявка пользователя ${userId} — ✅ принята.`);
    try {
      await ctx.telegram.sendMessage(
        userId,
        'Поздравляем! Верификация пройдена. Доступ к заказам открывается после приобретения подписки. Нажмите «Купить подписку».',
        Markup.inlineKeyboard([[Markup.button.callback('💳 Купить подписку', 'sub_buy')]])
      );
    } catch {}
  });

  bot.action(/mod_reject:(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery('Ответьте на это сообщение причиной отказа.');
    await ctx.reply(
      'Пожалуйста, ответьте на сообщение заявки текстом причины отказа (reply).'
    );
  });

  bot.on('message', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId || chatId > 0) return; // только канал/группа
    const msg = ctx.message as any | undefined;
    if (!msg) return;
    const replyTo = msg.reply_to_message?.message_id as number | undefined;
    if (!replyTo) return;
    const uid = pendingReasonByMsg.get(replyTo);
    if (!uid) return;
    const reason = 'text' in msg ? (msg.text as string) : '(нет текста)';
    pendingReasonByMsg.delete(replyTo);
    await setVerificationStatus(uid, 'REJECTED', reason);
    await ctx.reply(`Отказ сохранён: ${uid}. Причина: ${reason}`);
    try {
      await ctx.telegram.sendMessage(uid, `Верификация отклонена. Причина: ${reason}`);
    } catch {}
  });
}
