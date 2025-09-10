import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import type { SessionData } from './types';
import { makeGeoLink } from './geo';

export function ensureSession(ctx: Context): SessionData {
  const anyCtx = ctx as any;
  if (!anyCtx.session) anyCtx.session = {};
  return anyCtx.session as SessionData;
}

export async function sendReplacing(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['reply']>[1]
) {
  const s = ensureSession(ctx);
  try {
    if (s._lastMessageId) {
      await ctx.deleteMessage(s._lastMessageId).catch(() => {});
      s._lastMessageId = undefined;
    }
  } catch {}
  const msg = await ctx.reply(text, extra as any);
  if (msg && typeof (msg as any).message_id === 'number') {
    s._lastMessageId = (msg as any).message_id as number;
  }
}

export function mapButtons(
  point: { lat: number; lon: number },
  label = 'Открыть в 2ГИС'
) {
  const url = makeGeoLink(point);
  return Markup.inlineKeyboard([[Markup.button.url(`🗺️ ${label}`, url)]]);
}

// Главное меню (экспортируется, т.к. его ждут другие файлы)
export async function replyMainMenu(ctx: Context) {
  await sendReplacing(
    ctx,
    'Главное меню',
    Markup.keyboard([
      ['🚕 Заказать такси'],
      ['📦 Заказать доставку'],
      ['☎️ Поддержка']
    ])
      .resize()
      .oneTime()
  );
}
