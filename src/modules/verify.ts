import { Telegraf, Markup } from 'telegraf';
import { supabase, upsertProfile, getSetting } from '../supabase';
import { MyContext } from '../types';
import { sendEphemeral, nowIso } from '../utils';
import { saveTelegramFileToStorage } from './storage';

const rejectWait = new Map<number, { userId: number }>();

export function registerVerify(bot: Telegraf<MyContext>) {
  // начало верификации
  bot.action('drv_verify', async (ctx) => {
    await ctx.answerCbQuery();

    const profile = await supabase
      .from('driver_profiles')
      .select('actor_role')
      .eq('user_telegram_id', ctx.from!.id)
      .maybeSingle();

    const role = (profile.data?.actor_role as 'TAXI' | 'COURIER') || 'TAXI';

    ctx.session = ctx.session || {};
    ctx.session.verif = { collecting: true, files: [], role, stepMsg: (ctx as any).callbackQuery?.message?.message_id || null };

    const instr =
      role === 'TAXI'
        ? 'Отправьте 2–3 фото: 1) водительское удостоверение, 2) селфи с удостоверением.'
        : 'Отправьте 2 фото: удостоверение личности с обеих сторон.';

    try { await (ctx as any).deleteMessage?.(); } catch {}

    return sendEphemeral(
      ctx,
      `${instr}\nКаждый файл/фото присылайте сообщением. Когда закончите — нажмите «Готово». (0 загружено)`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🟢 Готово, отправить на проверку', 'ver_submit')],
        [Markup.button.callback('🔙 На главную', 'go_home')],
      ]),
      120_000
    );
  });

  // приём фото/документов
  bot.on(['photo', 'document'], async (ctx, next) => {
    if (!ctx.session?.verif?.collecting) return next();

    const files = ctx.session.verif.files;
    const msg: any = ctx.message;

    if (msg.photo) {
      const ph = msg.photo[msg.photo.length - 1];
      files.push({ kind: 'photo', file_id: ph.file_id, caption: msg.caption || '' });
    } else if (msg.document) {
      files.push({ kind: 'document', file_id: msg.document.file_id, caption: msg.caption || '' });
    }

    await sendEphemeral(ctx, `Принято. Загружено: ${files.length}. Когда закончите — «Готово».`, {}, 30_000);
  });

  // отправка на проверку
  bot.action('ver_submit', async (ctx) => {
    await ctx.answerCbQuery();

    const vf = ctx.session?.verif;
    if (!vf || !vf.files?.length) return sendEphemeral(ctx, 'Нужно прислать хотя бы одно фото/документ.');

    const verifyChannelId = Number(await getSetting('verify_channel_id')) || 0;
    if (!verifyChannelId) return sendEphemeral(ctx, 'Канал модерации не привязан. Выполните /bind_verify_channel в канале.');

    // сохраняем в storage
    for (const [i, f] of vf.files.entries()) {
      await saveTelegramFileToStorage(ctx.from!.id, 'VERIFY', f.file_id, undefined, { index: i, role: vf.role });
    }

    const header =
      `🪪 <b>Новая заявка на верификацию</b>\n` +
      `Исполнитель: <a href="tg://user?id=${ctx.from!.id}">${(ctx.from as any).first_name || ctx.from!.id}</a>\n` +
      `ID: <code>${ctx.from!.id}</code>\nРоль: <b>${vf.role}</b>`;

    await bot.telegram.sendMessage(verifyChannelId, header, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `ver_approve:${ctx.from!.id}`),
         Markup.button.callback('❌ Отклонить', `ver_reject:${ctx.from!.id}`)]
      ])
    });

    ctx.session.verif = null;
    return sendEphemeral(ctx, 'Заявка отправлена. Ожидайте проверки.');
  });

  // одобрение
  bot.action(/ver_approve:(\d+)/, async (ctx) => {
    const uid = Number((ctx.match as any)[1]);
    await upsertProfile(uid, { status: 'APPROVED', verified_at: nowIso(), verified_by: ctx.from!.id });
    await ctx.answerCbQuery('OK');
  });

  // отклонение → ожидание причины
  bot.action(/ver_reject:(\d+)/, async (ctx) => {
    rejectWait.set(ctx.from!.id, { userId: Number((ctx.match as any)[1]) });
    await ctx.answerCbQuery('Пришлите причину отклонения сообщением');
  });

  // приём причины отклонения
  bot.on('text', async (ctx, next) => {
    const modId = ctx.from?.id || 0;
    const pending = rejectWait.get(modId);
    if (!pending) return next();

    rejectWait.delete(modId);
    const reason = (ctx.message as any).text.trim();
    await upsertProfile(pending.userId, { status: 'REJECTED', verify_comment: reason });
    await ctx.reply(`❌ Верификация отклонена.\nПричина: ${reason}`);
  });
}
