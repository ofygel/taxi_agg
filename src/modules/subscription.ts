import { Markup } from 'telegraf';
import { SUB_PRICE_7, SUB_PRICE_15, SUB_PRICE_30, SUB_WARN_HOURS, DRIVERS_CHANNEL_INVITE } from '../config';
import { bot } from '../bot';
import type { MyContext, WaitReceipt } from '../types';
import { getSetting } from '../supabase';
import { supabase } from '../supabase';
import { kbBackHome } from './home';
import { saveTelegramFileToStorage } from '../storage';
import { isAdmin, nowIso, replaceWith, sendEphemeral } from '../utils';
import { upsertProfile } from './shared';

const subRejectWait = new Map<number, number>();

function subPricesKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`7 дн — ${SUB_PRICE_7} тг`, 'sub_7')],
    [Markup.button.callback(`15 дн — ${SUB_PRICE_15} тг`, 'sub_15')],
    [Markup.button.callback(`30 дн — ${SUB_PRICE_30} тг`, 'sub_30')],
    [Markup.button.callback('🔙 На главную', 'go_home')]
  ]);
}

async function startReceiptWait(ctx: MyContext, periodDays: number, amount: number) {
  ctx.session = ctx.session || {};
  ctx.session.sub = { waitReceipt: { periodDays, amount } };
  await ctx.reply(
    `Сумма оплаты: <b>${amount} тг</b> за ${periodDays} дней.\nПришлите <b>скрин/файл чека</b> одним сообщением.`,
    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 На главную', 'go_home')]]) }
  );
}

export function installSubscriptions() {
  bot.action('sub_buy', async (ctx) => {
    await ctx.answerCbQuery();
    try { await (ctx as any).deleteMessage?.(); } catch { }
    return ctx.reply(
      'Выберите срок подписки. Оплата Kaspi Gold «4400 4302 1304 3729 Алма С» или по номеру «747 456 86 61 Алма С».',
      subPricesKb()
    );
  });
  bot.action('sub_7', async (ctx) => { await ctx.answerCbQuery(); return startReceiptWait(ctx, 7, SUB_PRICE_7); });
  bot.action('sub_15', async (ctx) => { await ctx.answerCbQuery(); return startReceiptWait(ctx, 15, SUB_PRICE_15); });
  bot.action('sub_30', async (ctx) => { await ctx.answerCbQuery(); return startReceiptWait(ctx, 30, SUB_PRICE_30); });

  // media handler — подключается в registry через экспорт:
}

export async function subscriptionMediaHandler(ctx: MyContext): Promise<boolean> {
  const wait = ctx.session?.sub?.waitReceipt as WaitReceipt | undefined;
  if (!wait) return false;

  const verifyChannelId = Number(await getSetting('verify_channel_id')) || 0;
  if (!verifyChannelId) { await sendEphemeral(ctx, 'Канал модерации не привязан. /bind_verify_channel', kbBackHome()); return true; }

  let file_id: string | null = null;
  if ((ctx.message as any).photo) file_id = (ctx.message as any).photo.slice(-1)[0].file_id;
  if ((ctx.message as any).document) file_id = (ctx.message as any).document.file_id;

  let stored: any = null;
  if (file_id) stored = await saveTelegramFileToStorage(ctx.from!.id, 'SUBSCRIPTION_RECEIPT', file_id);

  await supabase.from('driver_subscriptions').insert({
    user_telegram_id: ctx.from!.id,
    period_days: wait.periodDays,
    amount_tg: wait.amount,
    receipt_file_id: stored?.path || null,
    status: 'PENDING'
  });

  const caption = `🧾 Чек подписки\nПользователь: ${ctx.from!.id}\nПериод: ${wait.periodDays} дн\nСумма: ${wait.amount} тг\nStorage: ${stored?.path || '-'}`;
  await bot.telegram.sendMessage(verifyChannelId, caption, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback(`Открыть доступ (${wait.periodDays} дн)`, `sub_approve:${ctx.from!.id}:${wait.periodDays}`)],
      [Markup.button.callback('Отказать', 'sub_reject:' + ctx.from!.id)]
    ])
  });

  ctx.session.sub = null;
  await sendEphemeral(ctx, 'Чек отправлен модераторам. Ожидайте.', kbBackHome());
  return true;
}

export function installSubscriptionsActions() {
  bot.action(/sub_approve:(\d+):(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Только модераторы.');
    await ctx.answerCbQuery('OK');
    const uid = Number((ctx.match as any)[1]); const days = Number((ctx.match as any)[2]);
    const expires = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    await upsertProfile(uid, { subscription_expires_at: expires, last_warn_at: null });
    await supabase.from('driver_subscriptions')
      .update({ status: 'APPROVED', approved_at: nowIso(), moderator_id: ctx.from!.id })
      .eq('user_telegram_id', uid).eq('status', 'PENDING');
    try { await (ctx as any).editMessageReplyMarkup?.({ inline_keyboard: [] }); } catch { }
    const btn = DRIVERS_CHANNEL_INVITE
      ? Markup.inlineKeyboard([[Markup.button.url('✅ Вступить', DRIVERS_CHANNEL_INVITE)], [Markup.button.callback('🔙 На главную', 'go_home')]])
      : kbBackHome();
    try { await bot.telegram.sendMessage(uid, `💳 Оплата подтверждена. Подписка активна до: ${new Date(expires).toLocaleString()}.`, btn); } catch { }
  });

  bot.action(/sub_reject:(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Только модераторы.');
    await ctx.answerCbQuery('Пришлите причину отклонения одним сообщением');
    subRejectWait.set(ctx.from!.id, Number((ctx.match as any)[1]));
  });

  bot.on('text', async (ctx, next) => {
    const modId = ctx.from?.id || 0; const chId = (ctx.chat as any)?.id;
    if (chId && subRejectWait.has(modId)) {
      const uid = subRejectWait.get(modId)!;
      subRejectWait.delete(modId);
      await supabase.from('driver_subscriptions')
        .update({ status: 'REJECTED', reject_reason: (ctx.message as any).text, moderator_id: modId, approved_at: null })
        .eq('user_telegram_id', uid).eq('status', 'PENDING');
      try { await bot.telegram.sendMessage(uid, `❌ Оплата подписки отклонена.\nПричина: ${(ctx.message as any).text}`); } catch { }
      return;
    }
    return next();
  });
}

/** CRON */
export function installSubscriptionCron() {
  setInterval(async () => {
    try {
      const { data: profs } = await supabase.from('driver_profiles').select('user_telegram_id,subscription_expires_at,last_warn_at');
      const ordersChannelId = Number(await getSetting('drivers_channel_id')) || 0;
      const now = new Date();
      for (const p of (profs || [])) {
        if (!p.subscription_expires_at) continue;
        const exp = new Date(p.subscription_expires_at as any);
        const warnTime = new Date(exp.getTime() - SUB_WARN_HOURS * 3600 * 1000);
        if (!p.last_warn_at && now >= warnTime && now < exp) {
          try { await bot.telegram.sendMessage(p.user_telegram_id as any, `⚠️ Подписка истекает ${exp.toLocaleString()}. Продлите через «Купить подписку».`); } catch { }
          await upsertProfile(p.user_telegram_id as any, { last_warn_at: new Date().toISOString() });
        }
        if (now >= exp && ordersChannelId) {
          try {
            const until = Math.floor(Date.now() / 1000) + 30;
            // FIX: объект с until_date
            await bot.telegram.banChatMember(ordersChannelId, p.user_telegram_id as any, { until_date: until } as any);
            await bot.telegram.unbanChatMember(ordersChannelId, p.user_telegram_id as any);
            await bot.telegram.sendMessage(p.user_telegram_id as any, `⛔ Подписка истекла. Доступ к каналу закрыт. Оформите заново через «Купить подписку».`);
          } catch { }
        }
      }
    } catch (e) { console.error('subscriptionCron', e); }
  }, 120_000);
}
