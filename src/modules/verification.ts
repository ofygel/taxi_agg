import { Markup } from 'telegraf';
import { bot } from '../bot';
import type { MyContext, VerifFile } from '../types';
import { getSetting } from '../supabase';
import { upsertProfile } from './shared';
import { nowIso, replaceWith, sendEphemeral } from '../utils';
import { supabase, singleOrNull } from '../supabase';
import { kbBackHome } from './home';
import { saveTelegramFileToStorage } from '../storage';
import { isAdmin } from '../utils';

const rejectWait = new Map<number, { userId: number }>();

export function installVerification() {
  bot.action('drv_verify', async (ctx) => {
    await ctx.answerCbQuery();
    const profile = await singleOrNull<{ actor_role: 'TAXI'|'COURIER' }>(
      supabase.from('driver_profiles').select('actor_role').eq('user_telegram_id', ctx.from!.id)
    );
    const role = (profile.data?.actor_role ?? 'TAXI') as ('TAXI'|'COURIER');
    ctx.session = ctx.session || {};
    ctx.session.verif = { collecting: true, files: [], role, stepMsg: (ctx as any).callbackQuery?.message?.message_id || null };
    const instr = role === 'TAXI'
      ? 'Отправьте 2–3 фото: 1) водительское удостоверение, 2) селфи с удостоверением.'
      : 'Отправьте 2 фото: удостоверение личности с обеих сторон.';
    try { await (ctx as any).deleteMessage?.(); } catch { }
    return sendEphemeral(ctx, `${instr}\nКаждый файл/фото присылайте сообщением. Когда закончите — нажмите «Готово». (0 загружено)`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🟢 Готово, отправить на проверку', 'ver_submit')],
        [Markup.button.callback('🔙 На главную', 'go_home')]
      ]));
  });

  // media aggregator в едином middleware будет вызывать этот обработчик:
  // экспортируем функцию и подключим в registry в orders.ts (или index)
}

export async function verifMediaHandler(ctx: MyContext): Promise<boolean> {
  if (!ctx.session?.verif?.collecting) return false;
  const files: VerifFile[] = ctx.session.verif.files;
  const msg: any = ctx.message;
  if (msg.photo) {
    const ph = msg.photo[msg.photo.length - 1];
    files.push({ kind: 'photo', file_id: ph.file_id, caption: msg.caption || '' });
  } else if (msg.document) {
    files.push({ kind: 'document', file_id: msg.document.file_id, caption: msg.caption || '' });
  } else {
    return false;
  }
  await sendEphemeral(ctx, `Принято. Загружено: ${files.length}. Когда закончите — «Готово».`, kbBackHome());
  return true;
}

export function installVerificationActions() {
  bot.action('ver_submit', async (ctx) => {
    await ctx.answerCbQuery();
    const vf = ctx.session?.verif;
    if (!vf || !vf.files?.length) return replaceWith(ctx, 'Нужно прислать хотя бы одно фото/документ.', kbBackHome());
    const verifyChannelId = Number(await getSetting('verify_channel_id')) || 0;
    if (!verifyChannelId) return replaceWith(ctx, 'Канал модерации не привязан. Выполните /bind_verify_channel в канале.', kbBackHome());

    for (const [i, f] of vf.files.entries()) {
      await saveTelegramFileToStorage(ctx.from!.id, 'VERIFY', f.file_id, undefined, { index: i, role: vf.role });
    }

    const header =
      `🪪 <b>Новая заявка на верификацию</b>\n` +
      `Исполнитель: <a href="tg://user?id=${ctx.from!.id}">${(ctx.from as any).first_name || ctx.from!.id}</a>\n` +
      `ID: <code>${ctx.from!.id}</code>\nРоль: <b>${vf.role}</b>\nФайлы выгружены в Storage (media_assets: kind=VERIFY).`;

    try {
      await bot.telegram.sendMessage(verifyChannelId, header, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Принять', `ver_approve:${ctx.from!.id}`),
          Markup.button.callback('❌ Отклонить', `ver_reject:${ctx.from!.id}`)]
        ])
      });
    } catch (e) { console.error('ver_submit send', e); return replaceWith(ctx, 'Не удалось отправить модераторам.', kbBackHome()); }

    ctx.session.verif = null;
    return replaceWith(ctx, 'Заявка отправлена. Ожидайте проверки.', kbBackHome());
  });

  bot.action(/ver_approve:(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Только модераторы.');
    await ctx.answerCbQuery('OK');
    const uid = Number((ctx.match as any)[1]);
    await upsertProfile(uid, { status: 'APPROVED', verified_at: nowIso(), verified_by: ctx.from!.id });
    try { await (ctx as any).editMessageReplyMarkup?.({ inline_keyboard: [] }); } catch { }
    try {
      await bot.telegram.sendMessage(uid,
        '✅ Проверка пройдена. Для доступа к заказам нужна подписка: 7/15/30 дней. Нажмите «Купить подписку».',
        Markup.inlineKeyboard([[Markup.button.callback('🛒 Купить подписку', 'sub_buy')], [Markup.button.callback('🔙 На главную', 'go_home')]])
      );
    } catch { }
  });

  bot.action(/ver_reject:(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('Только модераторы.');
    await ctx.answerCbQuery('Пришлите причину одним сообщением в этот же канал');
    rejectWait.set(ctx.from!.id, { userId: Number((ctx.match as any)[1]) });
  });

  bot.on('text', async (ctx, next) => {
    const chId = (ctx.chat as any)?.id;
    const modId = ctx.from?.id || 0;
    const pending = rejectWait.get(modId);
    if (chId && pending) {
      const reason = (ctx.message as any).text.trim();
      rejectWait.delete(modId);
      await upsertProfile(pending.userId, { status: 'REJECTED', verify_comment: reason, verified_at: null, verified_by: null });
      try { await (ctx as any).editMessageReplyMarkup?.({ inline_keyboard: [] }); } catch { }
      try { await bot.telegram.sendMessage(pending.userId, `❌ Верификация отклонена.\nПричина: ${reason}`); } catch { }
      return;
    }
    return next();
  });
}
