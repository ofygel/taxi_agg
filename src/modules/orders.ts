import { Telegraf, Markup } from 'telegraf';
import { supabase, getSetting } from '../supabase';
import { MyContext } from '../types';
import { sendEphemeral, nowIso } from '../utils';

export function registerOrders(bot: Telegraf<MyContext>) {
  // Клиент создаёт заказ
  bot.action('cli_make_order', async (ctx) => {
    await ctx.answerCbQuery();
    const row: any = {
      type: 'TAXI',
      client_telegram_id: ctx.from!.id,
      from_text: 'Точка А',
      to_text: 'Точка B',
      status: 'NEW',
      created_at: nowIso()
    };

    const ins = await supabase.from('orders').insert(row).select('*').maybeSingle();
    if (ins.error || !ins.data) return sendEphemeral(ctx, 'Не удалось создать заказ.');

    const o = ins.data;
    const chId = Number(await getSetting('drivers_channel_id')) || 0;

    if (chId) {
      await bot.telegram.sendMessage(
        chId,
        `🆕 Новый заказ\nID: ${o.id}\nОткуда: ${o.from_text}\nКуда: ${o.to_text}`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ Принять', `ord_acc:${o.id}`)]])
      );
    }

    return sendEphemeral(ctx, `Заказ создан. ID: ${o.id}`);
  });

  // Водитель принимает заказ
  bot.action(/ord_acc:(.+)/, async (ctx) => {
    const id = (ctx.match as any)[1];
    await supabase.from('orders')
      .update({ status: 'TAKEN', driver_telegram_id: ctx.from!.id })
      .eq('id', id);
    await ctx.reply(`✅ Вы приняли заказ ${id}`);
  });

  // Завершение заказа
  bot.action(/drv_done:(.+)/, async (ctx) => {
    const id = (ctx.match as any)[1];
    await supabase.from('orders')
      .update({ status: 'COMPLETED', completed_at: nowIso() })
      .eq('id', id);
    await ctx.reply(`✔️ Заказ ${id} завершён.`);
  });
}
