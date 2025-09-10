import { ADMIN_IDS, BASE_TG, KM_TG, FREE_KM, TWO_GIS_OPEN_URL, TTL_INFO_MS } from './config';
import type { MyContext } from './types';

// ====================== Вспомогательные функции ======================

export const nowIso = () => new Date().toISOString();

export const isAdmin = (ctx: MyContext) =>
  ADMIN_IDS.includes(ctx.from?.id || 0);

export const fmtPhone = (p?: string | null) =>
  !p ? '' : (p.startsWith('+') ? p : '+' + p.replace(/[^\d]/g, ''));

export const toRad = (d: number) => d * Math.PI / 180;

export const b64 = (s: string) =>
  Buffer.from(s, 'utf8').toString('base64');

export const ub64 = (s: string) =>
  Buffer.from(s, 'base64').toString('utf8');

// ====================== Гео и тарифы ======================

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const roundFare = (tg: number) => Math.round(tg / 50) * 50;

export function parse2gis(urlStr: string) {
  try {
    const u = new URL(urlStr);
    if (!/2gis\./i.test(u.hostname)) return null;

    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';

    const m1 = last.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m1) return { lon: +m1[1], lat: +m1[2], label: '2ГИС-координаты' };

    const m2 = (u.searchParams.get('m') || '').match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m2) return { lon: +m2[1], lat: +m2[2], label: '2ГИС-координаты' };

    return null;
  } catch {
    return null;
  }
}

export function twoGisOpenLink(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return TWO_GIS_OPEN_URL;
  return `${TWO_GIS_OPEN_URL}?m=${lon},${lat}`;
}

export function calcFare(from_lat: number, from_lon: number, to_lat: number, to_lon: number) {
  const distKm = haversineKm(from_lat, from_lon, to_lat, to_lon);
  const paidKm = Math.max(0, distKm - FREE_KM);
  const fare = roundFare(BASE_TG + paidKm * KM_TG);
  return { distKm, fare };
}

// ====================== Сообщения в Telegram ======================

export async function sendEphemeral(
  ctx: MyContext,
  text: string,
  extra: any = {},
  ttl = TTL_INFO_MS
) {
  const m = await ctx.reply(text, extra);
  const chatId = (m as any)?.chat?.id;
  const msgId = (m as any)?.message_id;

  if (ttl > 0 && chatId && msgId) {
    setTimeout(() => ctx.telegram.deleteMessage(chatId, msgId).catch(() => {}), ttl);
  }
  return m;
}

export async function replaceWith(
  ctx: MyContext,
  text: string,
  extra: any = {},
  ttl = TTL_INFO_MS
) {
  try {
    await (ctx as any).editMessageText?.(text, extra);
    const msg = (ctx as any).update?.callback_query?.message;
    const chatId = msg?.chat?.id;
    const msgId = msg?.message_id;

    if (ttl > 0 && chatId && msgId) {
      setTimeout(() => ctx.telegram.deleteMessage(chatId, msgId).catch(() => {}), ttl);
    }
  } catch {
    return sendEphemeral(ctx, text, extra, ttl);
  }
}
