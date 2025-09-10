import { Telegraf, type Context, Markup } from 'telegraf';
import { ensureSession, sendReplacing } from '@/shared';
import {
  getSetting,
  saveReceipt,
  openAccess,
  inviteButtonUrl
} from '@/supabase';

const PLAN_LABEL: Record<number, string> = {
  7: '7 дней — 3000 ₸',
  15: '15 дней — 5000 ₸',
  30: '30 дней — 10000 ₸'
};
const PLAN_PRICE: Record<number, number> = { 7: 3000, 15: 5000, 30: 10000 };

export function register(bot: Telegraf<Context>) {
  bot.action('sub_buy', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await sendReplacing(
      ctx,
      'Выберите срок подписки:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('7', 'plan_7'),
          Markup.button.callback('15', 'plan_15'),
          Markup.button.callback('30', 'plan_30')
        ],
        [Markup.button.callback('↩️ Отмена', 'sub_cancel')]
      ])
    );
  });

  bot.action('sub_cancel', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await sendReplacing(ctx, 'Отменено.');
  });

  bot.action(/plan_(7|15|30)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const match = (ctx as any).match as RegExpExecArray | undefined;
    const days = Number(match?.[1] ?? 7);
    const price = PLAN_PRICE[days];
    const text = `Оплата: ${PLAN_LABEL[days]}

Номер карты Kaspi Gold: 4400 4302 1304 3729 (Алма С)
Или по номеру: 747 456 86 61 (Алма С)

Сумма к оплате: ${price} ₸

После оплаты нажмите «Отправить чек».`;
    await sendReplacing(
      ctx,
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('📎 Отправить чек', `send_receipt:${days}`)]
      ])
    );
  });

  bot.action(/send_receipt:(7|15|30)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    s.collecting = true;
    s.files = [];
    s.supportThreadId = Number(((ctx as any).match as RegExpExecArray)?.[1]);
    await sendReplacing(ctx, 'Прикрепите скриншот/файл чека одним сообщением.');
  });

  bot.on(['photo', 'document'], async (ctx: Context) => {
    const s = ensureSession(ctx);
    if (!s.collecting) return;

    const verifyChan = await getSetting('verify_channel_id');
    if (!verifyChan)
      return ctx.reply(
        'Канал модерации не привязан. /bind_verify_channel в канале.'
      );

    const files: any[] = [];
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
    const planDays = Number(s.supportThreadId ?? 0) || 7;
    for (const f of files) await saveReceipt((ctx.from as any).id, planDays, f);

    await ctx.telegram.sendMessage(
      verifyChan,
      `Поступил чек об оплате\nПользователь: @${
        (ctx.from as any).username ?? (ctx.from as any).id
      }\nТариф: ${PLAN_LABEL[planDays]}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔓 Открыть доступ',
            `pay_open:${(ctx.from as any).id}:${planDays}`
          )
        ],
        [
          Markup.button.callback(
            '❌ Отказать',
            `pay_reject:${((ctx.from as any).id as number)}`
          )
        ]
      ])
    );

    s.collecting = false;
    s.files = [];
    await sendReplacing(ctx, 'Чек отправлен на проверку. Ожидайте.');
  });

  bot.action(/pay_open:(\d+):(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const match = (ctx as any).match as RegExpExecArray | undefined;
    if (!match) return;
    const userId = Number(match[1]);
    const days = Number(match[2]);
    await openAccess(userId, days);
    const invite = (await getSetting('drivers_channel_invite')) ?? inviteButtonUrl();
    await ctx.editMessageText(`Доступ открыт: ${userId} на ${days} дней.`);
    if (invite) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          `Оплата подтверждена. Нажмите, чтобы вступить в канал заказов:`,
          Markup.inlineKeyboard([[Markup.button.url('🔗 Вступить', invite)]])
        );
      } catch {}
    } else {
      try {
        await ctx.telegram.sendMessage(
          userId,
          'Оплата подтверждена. Ссылка на канал пока не настроена.'
        );
      } catch {}
    }
  });

  const pendingPayReject = new Map<number, number>(); // msgId → userId

  bot.action(/pay_reject:(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery('Ответьте на это сообщение причиной отказа.');
    const msg = (ctx.update as any).callback_query?.message as any | undefined;
    const msgId = msg?.message_id as number | undefined;
    if (typeof msgId === 'number') {
      const uid = Number(((ctx as any).match as RegExpExecArray)[1]);
      pendingPayReject.set(msgId, uid);
    }
  });

  bot.on('message', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId || chatId > 0) return; // только канал/группа модерации
    const msg = ctx.message as any | undefined;
    if (!msg) return;
    const replyTo = msg.reply_to_message?.message_id as number | undefined;
    if (!replyTo) return;
    const uid = pendingPayReject.get(replyTo);
    if (!uid) return;
    const reason = 'text' in msg ? (msg.text as string) : '(нет текста)';
    pendingPayReject.delete(replyTo);
    await ctx.reply(`Отказ по оплате сохранён: ${uid}. Причина: ${reason}`);
    try {
      await ctx.telegram.sendMessage(uid, `Оплата отклонена. Причина: ${reason}`);
    } catch {}
  });
}
