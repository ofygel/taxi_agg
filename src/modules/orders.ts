import { Telegraf, type Context, Markup } from 'telegraf';
import type { ClientOrderSession } from '@/types';
import {
  getSetting,
  setOrderChannelMsg,
  tryTakeOrder
} from '@/supabase';
import { makeGeoLink } from '@/geo';

function orderText(
  o: ClientOrderSession & { id?: number; price_estimate?: number }
) {
  const from =
    o.from_text ??
    (o.from_lat && o.from_lon
      ? makeGeoLink({ lat: o.from_lat, lon: o.from_lon })
      : '(не задано)');
  const to =
    o.to_text ??
    (o.to_lat && o.to_lon
      ? makeGeoLink({ lat: o.to_lat!, lon: o.to_lon! })
      : '(не задано)');
  return `Заказ #${o.id ?? 'NEW'} — ${o.kind === 'DELIVERY' ? 'Доставка' : 'Такси'}
A: ${from}
B: ${to}
Оценка: ${o.price_estimate ? `${o.price_estimate} ₸` : '—'}`;
}

export function register(bot: Telegraf<Context>) {
  bot.action(/order_take:(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const match = (ctx as any).match as RegExpExecArray | undefined;
    if (!match) return;
    const orderId = Number(match[1]);
    const updated = await tryTakeOrder(orderId, (ctx.from as any).id);
    if (!updated) return ctx.reply('К сожалению, заказ уже кем-то принят.');
    try {
      if ((updated as any).channel_msg_id)
        await ctx.editMessageText('✅ Заказ принят');
    } catch {}
    try {
      await ctx.telegram.sendMessage(
        (ctx.from as any).id,
        `Вы приняли заказ #${orderId}. Свяжитесь с клиентом: ${updated.client_id}`
      );
    } catch {}
  });

  bot.action(/order_decline:(\d+)/, async (ctx: Context) => {
    await ctx.answerCbQuery('Отклонено.');
  });

  (bot as any).postOrderToChannel = async function postOrderToChannel(o: any) {
    const chan = await getSetting('drivers_channel_id');
    if (!chan) return null;
    const btns = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Принять', `order_take:${o.id}`),
        Markup.button.callback('❌ Отказать', `order_decline:${o.id}`)
      ]
    ]);
    const msg = await bot.telegram.sendMessage(chan, orderText(o), btns);
    await setOrderChannelMsg(o.id, (msg as any).message_id);
    return msg;
  };
}
